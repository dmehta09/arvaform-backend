import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RealTimeGateway } from '../../common/websocket/websocket.gateway';
import { CaptchaService } from '../captcha/captcha.service';
import { Form, FormDocument } from '../forms/entities/form.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionResponseDto } from './dto/submission-response.dto';
import { Submission, SubmissionDocument } from './entities/submission.entity';
import { FileUploadService, UploadedFileInfo } from './services/file-upload.service';

/**
 * Submissions Service
 * Handles all form submission business logic with comprehensive validation and processing
 * Integrates with form validation, file uploads, and external services
 */
@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
    @InjectModel(Form.name)
    private readonly formModel: Model<FormDocument>,
    private readonly fileUploadService: FileUploadService,
    private readonly captchaService: CaptchaService,
    private readonly webSocketGateway: RealTimeGateway,
  ) {
    this.logger.log('SubmissionsService initialized');
  }

  /**
   * Create a new form submission with comprehensive validation
   * @param formId - Form ID to submit to
   * @param submissionDto - Submission data
   * @param files - Uploaded files (if any)
   * @returns Promise<SubmissionResponseDto>
   */
  async createSubmission(
    formId: string,
    submissionDto: CreateSubmissionDto,
    files?: Express.Multer.File[],
  ): Promise<SubmissionResponseDto> {
    this.logger.debug(`Creating submission for form: ${formId}`);

    // Validate form exists and is published
    const form = await this.validateFormForSubmission(formId);

    // Verify CAPTCHA if required and not a draft (TODO: Implement proper CAPTCHA integration)
    if (!submissionDto.isDraft && submissionDto.captchaToken) {
      // TODO: Implement CAPTCHA verification
      this.logger.debug('CAPTCHA verification skipped for now');
    }

    // Validate submission data against form schema
    this.validateSubmissionData(
      submissionDto.data,
      (form.elements || []) as unknown as Record<string, unknown>[],
    );

    // Process file uploads if any
    let uploadedFiles: UploadedFileInfo[] = [];
    if (files && files.length > 0) {
      // Create field mapping for files based on form elements
      const fieldMapping = this.createFileFieldMapping(form, files);
      uploadedFiles = await this.fileUploadService.processFileUploads(files, fieldMapping);
    }

    // Create submission document
    const submissionData = {
      formId: new Types.ObjectId(formId),
      formVersion: 1, // Default version for now
      data: submissionDto.data,
      files: uploadedFiles,
      payment: submissionDto.payment,
      source: submissionDto.source || 'web',
      status: submissionDto.isDraft ? 'draft' : 'submitted',
      submittedBy: submissionDto.submittedBy,
      signatures: submissionDto.signatures,
      processing: {
        notifications: { sent: false },
        integrations: [],
      },
    };

    // Create and save submission
    const submission = new this.submissionModel(submissionData);
    const savedSubmission = await submission.save();

    this.logger.log(`Submission created: ${savedSubmission.submissionId}`);

    // Emit real-time WebSocket event for new submission
    if (!submissionDto.isDraft) {
      this.emitNewSubmissionEvent(savedSubmission, form);
    }

    // Process post-submission actions (notifications, integrations) synchronously
    if (!submissionDto.isDraft) {
      this.processPostSubmissionActions(savedSubmission, form);
    }

    return this.mapToResponseDto(savedSubmission);
  }

  /**
   * Find submissions by form with query parameters
   * @param formId - Form ID
   * @param query - Query parameters for filtering and pagination
   * @returns Promise with paginated submissions
   */
  async findSubmissionsByForm(
    formId: string,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      submitterEmail?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{
    submissions: SubmissionResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Build filter query
    const filter: Record<string, unknown> = {
      formId: new Types.ObjectId(formId),
      deletedAt: { $exists: false },
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.submitterEmail) {
      filter['submittedBy.email'] = { $regex: query.submitterEmail, $options: 'i' };
    }

    if (query.startDate || query.endDate) {
      filter.submittedAt = {};
      if (query.startDate) {
        (filter.submittedAt as Record<string, unknown>).$gte = query.startDate;
      }
      if (query.endDate) {
        (filter.submittedAt as Record<string, unknown>).$lte = query.endDate;
      }
    }

    // Build sort query
    const sortField = query.sortBy || 'submittedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: { [key: string]: 1 | -1 } = { [sortField]: sortOrder };

    const [submissions, total] = await Promise.all([
      this.submissionModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.submissionModel.countDocuments(filter),
    ]);

    const mappedSubmissions = submissions.map(submission => this.mapToResponseDto(submission));

    return {
      submissions: mappedSubmissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find submission by ID
   * @param submissionId - Submission ID
   * @returns Promise<SubmissionResponseDto>
   */
  async findSubmissionById(submissionId: string): Promise<SubmissionResponseDto> {
    const submission = await this.submissionModel.findById(submissionId).exec();

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return this.mapToResponseDto(submission);
  }

  /**
   * Delete submission by ID
   * @param submissionId - Submission ID
   * @returns Promise<boolean>
   */
  async deleteSubmission(submissionId: string): Promise<boolean> {
    const submission = await this.submissionModel.findByIdAndDelete(submissionId);

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Clean up associated files
    if (submission.files && submission.files.length > 0) {
      await this.fileUploadService.deleteFiles(submission.files);
    }

    return true;
  }

  /**
   * Get submission by ID with proper access control (legacy method)
   * @param submissionId - Submission ID
   * @param formOwnerId - Form owner ID for access control (optional)
   * @returns Promise<SubmissionResponseDto>
   */
  async getSubmission(submissionId: string, formOwnerId?: string): Promise<SubmissionResponseDto> {
    const submission = await this.submissionModel.findById(submissionId).exec();

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check access permissions if form owner ID provided (simplified since formId is ObjectId)
    if (formOwnerId) {
      const form = await this.formModel.findById(submission.formId).exec();
      if (!form || form.userId.toString() !== formOwnerId) {
        throw new ForbiddenException('Access denied to this submission');
      }
    }

    return this.mapToResponseDto(submission);
  }

  /**
   * Get submissions for a specific form with pagination (legacy method)
   * @param formId - Form ID
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @param formOwnerId - Form owner ID for access control
   * @returns Promise<{ submissions: SubmissionResponseDto[], total: number, page: number, limit: number }>
   */
  async getFormSubmissions(
    formId: string,
    page: number = 1,
    limit: number = 20,
    formOwnerId?: string,
  ): Promise<{
    submissions: SubmissionResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Verify form ownership if required
    if (formOwnerId) {
      const form = await this.formModel.findById(formId);
      if (!form || form.userId.toString() !== formOwnerId) {
        throw new ForbiddenException('Access denied to this form');
      }
    }

    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      this.submissionModel
        .find({ formId: new Types.ObjectId(formId), deletedAt: { $exists: false } })
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.submissionModel.countDocuments({
        formId: new Types.ObjectId(formId),
        deletedAt: { $exists: false },
      }),
    ]);

    const mappedSubmissions = submissions.map(submission => this.mapToResponseDto(submission));

    return {
      submissions: mappedSubmissions,
      total,
      page,
      limit,
    };
  }

  /**
   * Delete submission with access control (legacy method)
   * @param submissionId - Submission ID
   * @param formOwnerId - Form owner ID for access control (optional)
   */
  async deleteSubmissionLegacy(submissionId: string, formOwnerId?: string): Promise<void> {
    const submission = await this.submissionModel.findById(submissionId).exec();

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check access permissions if form owner ID provided
    if (formOwnerId) {
      const form = await this.formModel.findById(submission.formId).exec();
      if (!form || form.userId.toString() !== formOwnerId) {
        throw new ForbiddenException('Access denied to this submission');
      }
    }

    // Soft delete - set deletedAt timestamp
    submission.deletedAt = new Date();
    await submission.save();

    this.logger.log(`Submission soft deleted: ${submission.submissionId}`);
  }

  /**
   * Validate form exists and is available for submissions
   * @param formId - Form ID to validate
   * @returns Promise<FormDocument>
   */
  private async validateFormForSubmission(formId: string): Promise<FormDocument> {
    const form = await this.formModel.findById(formId).exec();

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (!form.publishing.isPublished) {
      throw new ForbiddenException('Form is not published');
    }

    // Check if form has submission deadline
    if (form.publishing.sharing?.expiresAt && new Date() > form.publishing.sharing.expiresAt) {
      throw new ForbiddenException('Form submission deadline has passed');
    }

    // Check maximum submissions limit (feature removed for now)
    // Future implementation can add this check when needed

    return form;
  }

  /**
   * Validate submission data against form elements
   * @param submittedData - Data submitted by user
   * @param formElements - Form element definitions
   */
  private validateSubmissionData(
    submittedData: Record<string, unknown>,
    formElements: Record<string, unknown>[],
  ): void {
    const errors: string[] = [];

    // Check required fields
    for (const element of formElements) {
      if (
        element.required &&
        (!submittedData[element.id as string] || submittedData[element.id as string] === '')
      ) {
        errors.push(`Field '${(element.label as string) || (element.id as string)}' is required`);
      }

      // Validate field format if value exists
      if (submittedData[element.id as string]) {
        this.validateFieldValue(element, submittedData[element.id as string], errors);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate individual field value
   * @param element - Form element definition
   * @param value - Field value to validate
   * @param errors - Array to collect validation errors
   */
  private validateFieldValue(
    element: Record<string, unknown>,
    value: unknown,
    errors: string[],
  ): void {
    const fieldLabel = (element.label as string) || (element.id as string);

    switch (element.type) {
      case 'email':
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(`'${fieldLabel}' must be a valid email address`);
        }
        break;

      case 'text':
      case 'textarea':
        if (typeof value === 'string') {
          const validation = element.validation as Record<string, unknown>;
          if (validation?.minLength && value.length < (validation.minLength as number)) {
            errors.push(
              `'${fieldLabel}' must be at least ${validation.minLength as number} characters`,
            );
          }
          if (validation?.maxLength && value.length > (validation.maxLength as number)) {
            errors.push(
              `'${fieldLabel}' must not exceed ${validation.maxLength as number} characters`,
            );
          }
        }
        break;

      case 'number':
        if (typeof value === 'number') {
          const validation = element.validation as Record<string, unknown>;
          if (validation?.min && value < (validation.min as number)) {
            errors.push(`'${fieldLabel}' must be at least ${validation.min as number}`);
          }
          if (validation?.max && value > (validation.max as number)) {
            errors.push(`'${fieldLabel}' must not exceed ${validation.max as number}`);
          }
        }
        break;

      case 'url':
        if (typeof value === 'string') {
          try {
            new URL(value);
          } catch (_error) {
            errors.push(`'${fieldLabel}' must be a valid URL`);
          }
        }
        break;

      case 'select':
      case 'radio':
        if (element.type === 'select' || element.type === 'radio') {
          const options = element.options as Record<string, unknown>[];
          const allowedValues = options?.map((opt: Record<string, unknown>) => opt.value) || [];
          if (!allowedValues.includes(value)) {
            errors.push(`'${fieldLabel}' contains invalid selection`);
          }
        }
        break;

      case 'checkbox':
        if (element.type === 'checkbox' && Array.isArray(value)) {
          const options = element.options as Record<string, unknown>[];
          const allowedValues = options?.map((opt: Record<string, unknown>) => opt.value) || [];
          const invalidSelections = value.filter(v => !allowedValues.includes(v));
          if (invalidSelections.length > 0) {
            errors.push(`'${fieldLabel}' contains invalid selections`);
          }
        }
        break;
    }
  }

  /**
   * Create field mapping for file uploads
   * @param _form - Form document (currently unused)
   * @param files - Uploaded files
   * @returns { [key: string]: string }
   */
  private createFileFieldMapping(
    _form: FormDocument,
    files: Express.Multer.File[],
  ): { [key: string]: string } {
    const mapping: { [key: string]: string } = {};

    // Simple mapping - assumes files are named with field IDs
    files.forEach((file, index) => {
      // In real implementation, this would be more sophisticated
      // and would map files to actual form fields
      mapping[file.fieldname || `file-${index}`] = file.originalname;
    });

    return mapping;
  }

  /**
   * Process post-submission actions (notifications, integrations)
   * @param submission - Saved submission document
   * @param _form - Form document (currently unused)
   */
  private processPostSubmissionActions(submission: SubmissionDocument, _form: FormDocument): void {
    try {
      // Send notification emails
      this.sendNotificationEmails(submission, _form);

      // Send autoresponder to submitter
      this.sendAutoresponder(submission, _form);

      // Process integrations (webhooks, third-party services)
      this.processIntegrations(submission, _form);

      this.logger.debug(`Post-submission actions completed for: ${submission.submissionId}`);
    } catch (error) {
      this.logger.error('Error in post-submission processing:', error);
    }
  }

  /**
   * Send notification emails to form owner
   * @param submission - Submission document
   * @param _form - Form document (currently unused)
   */
  private sendNotificationEmails(submission: SubmissionDocument, _form: FormDocument): void {
    // TODO: Implement email notification sending
    this.logger.debug(`Sending notification emails for submission: ${submission.submissionId}`);
  }

  /**
   * Send autoresponder email to submitter
   * @param submission - Submission document
   * @param _form - Form document (currently unused)
   */
  private sendAutoresponder(submission: SubmissionDocument, _form: FormDocument): void {
    // TODO: Implement autoresponder email sending
    this.logger.debug(`Sending autoresponder for submission: ${submission.submissionId}`);
  }

  /**
   * Process integrations (webhooks, third-party services)
   * @param submission - Submission document
   * @param _form - Form document (currently unused)
   */
  private processIntegrations(submission: SubmissionDocument, _form: FormDocument): void {
    // TODO: Implement integration processing
    this.logger.debug(`Processing integrations for submission: ${submission.submissionId}`);
  }

  /**
   * Map submission document to response DTO
   * @param submission - Submission document
   * @returns SubmissionResponseDto
   */
  private mapToResponseDto(submission: SubmissionDocument): SubmissionResponseDto {
    const submissionObj = submission.toObject() as Record<string, unknown>;

    return {
      id: (submission._id as Types.ObjectId).toString(),
      formId: submission.formId.toString(),
      formVersion: submission.formVersion || 1,
      submissionId: submission.submissionId,
      data: submission.data,
      files: submission.files || [],
      status: submission.status,
      source: submission.source || 'web',
      submittedBy: submission.submittedBy
        ? {
            userId: submission.submittedBy.userId?.toString(),
            email: submission.submittedBy.email,
            name: submission.submittedBy.name,
            ipAddress: submission.submittedBy.ipAddress,
            userAgent: submission.submittedBy.userAgent,
            location: submission.submittedBy.location,
          }
        : undefined,
      processing: submission.processing || {
        notifications: { sent: false },
        integrations: [],
      },
      signatures: submission.signatures,
      submittedAt: submission.submittedAt,
      createdAt: (submissionObj.createdAt as Date) || submission.submittedAt,
      updatedAt: (submissionObj.updatedAt as Date) || submission.submittedAt,
    };
  }

  /**
   * Emit WebSocket event for new submission
   * @param submission - The created submission
   * @param form - The form document
   */
  private emitNewSubmissionEvent(submission: SubmissionDocument, form: FormDocument): void {
    try {
      const eventData = {
        formId: (form._id as Types.ObjectId).toString(),
        submissionId: (submission._id as Types.ObjectId).toString(),
        submission: submission.data,
        timestamp: new Date(),
        userId: submission.submittedBy?.userId?.toString() || 'anonymous',
        username: submission.submittedBy?.name || submission.submittedBy?.email || 'Anonymous',
      };

      // Emit the new submission event to all users in the form room
      this.webSocketGateway.emitNewSubmission(eventData);

      // Also emit analytics update if available
      this.emitAnalyticsUpdate((form._id as Types.ObjectId).toString());

      this.logger.debug(`WebSocket event emitted for new submission: ${submission.submissionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to emit WebSocket event for submission ${submission.submissionId}:`,
        error,
      );
    }
  }

  /**
   * Emit analytics update for the form
   * @param formId - The form ID
   */
  private async emitAnalyticsUpdate(formId: string): Promise<void> {
    try {
      // Get basic analytics for the form
      const totalSubmissions = await this.submissionModel.countDocuments({
        formId: new Types.ObjectId(formId),
        status: { $ne: 'draft' },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todaySubmissions = await this.submissionModel.countDocuments({
        formId: new Types.ObjectId(formId),
        status: { $ne: 'draft' },
        submittedAt: { $gte: todayStart },
      });

      const analyticsData = {
        formId,
        metrics: {
          totalSubmissions,
          todaySubmissions,
          completionRate: 85, // Mock completion rate for now
          lastSubmissionAt: new Date(),
        },
      };

      this.webSocketGateway.emitAnalyticsUpdate(analyticsData);
    } catch (error) {
      this.logger.error(`Failed to emit analytics update for form ${formId}:`, error);
    }
  }
}
