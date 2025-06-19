import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FormChangeMetadata,
  FormVersion,
  FormVersionDocument,
} from './entities/form-version.entity';
import { Form, FormDocument } from './entities/form.entity';

/**
 * Service for managing form versions and change tracking
 * Handles version creation, comparison, and retrieval
 */
@Injectable()
export class FormVersioningService {
  private readonly logger = new Logger(FormVersioningService.name);

  constructor(
    @InjectModel(FormVersion.name) private formVersionModel: Model<FormVersionDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
  ) {}

  /**
   * Create a new version of a form
   * @param formId - Form ID
   * @param userId - User making the changes
   * @param changeDescription - Optional description of changes
   * @param versionType - Type of version (auto or manual)
   * @returns Created form version
   */
  async createVersion(
    formId: string,
    userId: string,
    changeDescription?: string,
    versionType: 'auto' | 'manual' = 'auto',
  ): Promise<FormVersionDocument> {
    this.logger.log(`Creating version for form: ${formId} by user: ${userId}`);

    try {
      // Get current form data
      const form = await this.formModel.findById(formId).exec();
      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Get the latest version number
      const latestVersion = await this.getLatestVersionNumber(formId);
      const newVersionNumber = latestVersion + 1;

      // Get previous version for change comparison
      const previousVersion = await this.formVersionModel
        .findOne({ formId, version: latestVersion })
        .exec();

      // Calculate changes between versions
      const changes = this.calculateChanges(
        previousVersion?.formData || {},
        form.toObject() as unknown as Record<string, unknown>,
      );

      // Create new version
      const formVersion = new this.formVersionModel({
        formId,
        version: newVersionNumber,
        createdBy: userId,
        changeDescription,
        changes,
        formData: form.toObject(),
        versionType,
        isRevertPoint: versionType === 'manual',
      });

      const savedVersion = await formVersion.save();
      this.logger.log(`Form version ${newVersionNumber} created for form: ${formId}`);

      return savedVersion;
    } catch (error: unknown) {
      this.logger.error(`Failed to create version for form ${formId}:`, error);
      throw error;
    }
  }

  /**
   * Get all versions for a form
   * @param formId - Form ID
   * @param limit - Number of versions to retrieve
   * @returns Array of form versions
   */
  async getFormVersions(formId: string, limit: number = 50): Promise<FormVersionDocument[]> {
    this.logger.log(`Retrieving versions for form: ${formId}`);

    try {
      const versions = await this.formVersionModel
        .find({ formId })
        .sort({ version: -1 })
        .limit(limit)
        .populate('createdBy', 'firstName lastName email')
        .exec();

      this.logger.log(`Found ${versions.length} versions for form: ${formId}`);
      return versions;
    } catch (error: unknown) {
      this.logger.error(`Failed to retrieve versions for form ${formId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific version of a form
   * @param formId - Form ID
   * @param version - Version number
   * @returns Form version document
   */
  async getVersion(formId: string, version: number): Promise<FormVersionDocument> {
    this.logger.log(`Retrieving version ${version} for form: ${formId}`);

    try {
      const formVersion = await this.formVersionModel
        .findOne({ formId, version })
        .populate('createdBy', 'firstName lastName email')
        .exec();

      if (!formVersion) {
        throw new NotFoundException(`Version ${version} not found for form ${formId}`);
      }

      return formVersion;
    } catch (error: unknown) {
      this.logger.error(`Failed to retrieve version ${version} for form ${formId}:`, error);
      throw error;
    }
  }

  /**
   * Revert form to a specific version
   * @param formId - Form ID
   * @param version - Version to revert to
   * @param userId - User performing the revert
   * @returns Updated form document
   */
  async revertToVersion(formId: string, version: number, userId: string): Promise<FormDocument> {
    this.logger.log(`Reverting form ${formId} to version ${version} by user: ${userId}`);

    try {
      // Get the target version
      const targetVersion = await this.getVersion(formId, version);

      // Update the form with the version data
      const revertedFormData = { ...targetVersion.formData };
      delete revertedFormData._id; // Remove the _id to avoid conflicts
      delete revertedFormData.__v; // Remove version key

      const updatedForm = await this.formModel
        .findByIdAndUpdate(formId, revertedFormData, { new: true })
        .exec();

      if (!updatedForm) {
        throw new NotFoundException('Form not found');
      }

      // Create a new version marking this as a revert point
      await this.createVersion(formId, userId, `Reverted to version ${version}`, 'manual');

      this.logger.log(`Form ${formId} successfully reverted to version ${version}`);
      return updatedForm;
    } catch (error: unknown) {
      this.logger.error(`Failed to revert form ${formId} to version ${version}:`, error);
      throw error;
    }
  }

  /**
   * Compare two versions of a form
   * @param formId - Form ID
   * @param version1 - First version number
   * @param version2 - Second version number
   * @returns Comparison result with changes
   */
  async compareVersions(
    formId: string,
    version1: number,
    version2: number,
  ): Promise<{
    version1: FormVersionDocument;
    version2: FormVersionDocument;
    changes: FormChangeMetadata[];
  }> {
    this.logger.log(`Comparing versions ${version1} and ${version2} for form: ${formId}`);

    try {
      const [v1, v2] = await Promise.all([
        this.getVersion(formId, version1),
        this.getVersion(formId, version2),
      ]);

      const changes = this.calculateChanges(v1.formData, v2.formData);

      return {
        version1: v1,
        version2: v2,
        changes,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to compare versions for form ${formId}:`, error);
      throw error;
    }
  }

  /**
   * Delete old versions (cleanup)
   * @param formId - Form ID
   * @param keepVersions - Number of recent versions to keep
   * @returns Number of deleted versions
   */
  async cleanupOldVersions(formId: string, keepVersions: number = 100): Promise<number> {
    this.logger.log(
      `Cleaning up old versions for form: ${formId}, keeping ${keepVersions} versions`,
    );

    try {
      const versions = await this.formVersionModel
        .find({ formId })
        .sort({ version: -1 })
        .skip(keepVersions)
        .exec();

      if (versions.length === 0) {
        return 0;
      }

      const versionIds = versions.map(v => v._id);
      const result = await this.formVersionModel
        .deleteMany({
          _id: { $in: versionIds },
        })
        .exec();

      this.logger.log(`Deleted ${result.deletedCount} old versions for form: ${formId}`);
      return result.deletedCount || 0;
    } catch (error: unknown) {
      this.logger.error(`Failed to cleanup versions for form ${formId}:`, error);
      throw error;
    }
  }

  /**
   * Get latest version number for a form
   * @param formId - Form ID
   * @returns Latest version number
   */
  private async getLatestVersionNumber(formId: string): Promise<number> {
    const latestVersion = await this.formVersionModel
      .findOne({ formId })
      .sort({ version: -1 })
      .exec();

    return latestVersion?.version || 0;
  }

  /**
   * Calculate changes between two form objects
   * @param oldData - Previous form data
   * @param newData - Current form data
   * @returns Array of detected changes
   */
  private calculateChanges(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
  ): FormChangeMetadata[] {
    const changes: FormChangeMetadata[] = [];

    // Simple field comparison for major fields
    const fieldsToTrack = [
      'title',
      'description',
      'status',
      'elements',
      'pages',
      'conditions',
      'settings',
      'publishing',
    ];

    for (const field of fieldsToTrack) {
      const oldValue = oldData[field];
      const newValue = newData[field];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue: oldValue as Record<string, unknown>,
          newValue: newValue as Record<string, unknown>,
          changeType: !oldValue ? 'created' : !newValue ? 'deleted' : 'updated',
        });
      }
    }

    return changes;
  }
}
