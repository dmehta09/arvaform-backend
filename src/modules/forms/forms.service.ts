/* eslint-disable @typescript-eslint/require-await */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateFormDto } from './dto/create-form.dto';
import { FormQueryDto } from './dto/form-query.dto';
import { FormResponseDto } from './dto/form-response.dto';
import { PaginatedFormsDto } from './dto/paginated-forms.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { Form, FormDocument } from './entities/form.entity';
import { FormVersioningService } from './form-versioning.service';
import { FormsRepository } from './forms.repository';

/**
 * Service for managing forms
 * Handles all business logic related to form operations
 */
@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    private readonly formsRepository: FormsRepository,
    private readonly formVersioningService: FormVersioningService,
  ) {}

  /**
   * Create a new form
   * @param createFormDto - Form creation data
   * @param userId - ID of the user creating the form
   * @returns Created form
   */
  async create(createFormDto: CreateFormDto, userId: string): Promise<FormResponseDto> {
    this.logger.log(`Creating new form for user: ${userId}`);

    try {
      // Generate unique slug
      const slug = await this.generateUniqueSlug(createFormDto.title, userId);

      // Create form document
      const formData = {
        ...createFormDto,
        slug,
        userId,
        status: 'draft' as const,
        elements: createFormDto.elements || [],
        pages: createFormDto.pages || [],
        conditions: [],
        collaborators: [],
        integrations: [],
        settings: {
          encryption: { enabled: false },
          layout: 'classic' as const,
          ...createFormDto.settings,
        },
        postSubmission: {
          thankYouPage: { type: 'default' as const },
          emails: {
            notifications: { enabled: false, recipients: [] },
            autoresponder: { enabled: false },
          },
        },
        publishing: {
          isPublished: false,
          sharing: {
            allowPublicAccess: true,
            requireLogin: false,
          },
        },
        analytics: {
          views: 0,
          submissions: 0,
          conversionRate: 0,
        },
      };

      const createdForm = new this.formModel(formData);
      const savedForm = await createdForm.save();

      this.logger.log(`Form created successfully with ID: ${String(savedForm._id)}`);
      return this.transformToResponseDto(savedForm);
    } catch (error: unknown) {
      this.logger.error(`Failed to create form for user ${userId}:`, error);
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        throw new BadRequestException('A form with this slug already exists');
      }
      throw new BadRequestException('Failed to create form');
    }
  }

  /**
   * Find all forms for a user
   * @param userId - ID of the user
   * @returns Array of user's forms
   */
  async findAll(userId: string): Promise<FormResponseDto[]> {
    this.logger.log(`Fetching all forms for user: ${userId}`);

    try {
      const forms = await this.formModel
        .find({
          userId,
          deletedAt: { $exists: false },
        })
        .sort({ updatedAt: -1 })
        .exec();

      this.logger.log(`Found ${forms.length} forms for user: ${userId}`);
      return forms.map(form => this.transformToResponseDto(form));
    } catch (error: unknown) {
      this.logger.error(`Failed to fetch forms for user ${userId}:`, error);
      throw new BadRequestException('Failed to retrieve forms');
    }
  }

  /**
   * Find a specific form by ID
   * @param id - Form ID
   * @param userId - ID of the user
   * @returns Form if found
   */
  async findOne(id: string, userId: string): Promise<FormResponseDto> {
    this.logger.log(`Fetching form with ID: ${id} for user: ${userId}`);

    try {
      const form = await this.formModel
        .findOne({
          _id: id,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Check ownership or collaboration access
      if (!(await this.hasAccess(form, userId))) {
        throw new ForbiddenException('Access denied to this form');
      }

      this.logger.log(`Form found: ${id}`);
      return this.transformToResponseDto(form);
    } catch (error: unknown) {
      this.logger.error(`Failed to fetch form ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve form');
    }
  }

  /**
   * Update a form
   * @param id - Form ID
   * @param updateFormDto - Form update data
   * @param userId - ID of the user
   * @returns Updated form
   */
  async update(id: string, updateFormDto: UpdateFormDto, userId: string): Promise<FormResponseDto> {
    this.logger.log(`Updating form with ID: ${id} for user: ${userId}`);

    try {
      const form = await this.formModel
        .findOne({
          _id: id,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Check ownership (only owners can edit)
      if (!(await this.isOwner(id, userId))) {
        throw new ForbiddenException('Only form owners can edit forms');
      }

      // Create version before update (automatic versioning)
      await this.formVersioningService.createVersion(
        id,
        userId,
        `Form updated: ${Object.keys(updateFormDto).join(', ')}`,
        'auto',
      );

      // Handle slug update if title changed
      const updateData: Record<string, unknown> = { ...updateFormDto };
      if (updateFormDto.title && updateFormDto.title !== form.title) {
        updateData.slug = await this.generateUniqueSlug(updateFormDto.title, userId);
      }

      const updatedForm = await this.formModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();

      if (!updatedForm) {
        throw new NotFoundException('Form not found after update');
      }

      this.logger.log(`Form updated successfully: ${id}`);
      return this.transformToResponseDto(updatedForm);
    } catch (error: unknown) {
      this.logger.error(`Failed to update form ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        throw new BadRequestException('A form with this slug already exists');
      }
      throw new BadRequestException('Failed to update form');
    }
  }

  /**
   * Delete a form (soft delete)
   * @param id - Form ID
   * @param userId - ID of the user
   * @returns Deletion result
   */
  async remove(id: string, userId: string): Promise<{ message: string }> {
    this.logger.log(`Deleting form with ID: ${id} for user: ${userId}`);

    try {
      const form = await this.formModel
        .findOne({
          _id: id,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Check ownership (only owners can delete)
      if (!(await this.isOwner(id, userId))) {
        throw new ForbiddenException('Only form owners can delete forms');
      }

      // Soft delete
      await this.formModel
        .findByIdAndUpdate(id, {
          deletedAt: new Date(),
          deletedBy: userId,
        })
        .exec();

      this.logger.log(`Form soft deleted successfully: ${id}`);
      return { message: 'Form deleted successfully' };
    } catch (error: unknown) {
      this.logger.error(`Failed to delete form ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete form');
    }
  }

  /**
   * Check if user owns a form
   * @param formId - Form ID
   * @param userId - User ID
   * @returns True if user owns the form
   */
  private async isOwner(formId: string, userId: string): Promise<boolean> {
    this.logger.log(`Checking ownership for form: ${formId} by user: ${userId}`);

    try {
      const form = await this.formModel
        .findOne({
          _id: formId,
          userId,
          deletedAt: { $exists: false },
        })
        .exec();

      return !!form;
    } catch (error: unknown) {
      this.logger.error(`Failed to check ownership for form ${formId}:`, error);
      return false;
    }
  }

  /**
   * Check if user has access to a form (owner or collaborator)
   * @param form - Form document
   * @param userId - User ID
   * @returns True if user has access
   */
  private async hasAccess(form: FormDocument, userId: string): Promise<boolean> {
    // Check if user is the owner
    if (form.userId.toString() === userId) {
      return true;
    }

    // Check if user is a collaborator
    const isCollaborator = form.collaborators.some(
      collaborator => collaborator.userId.toString() === userId,
    );

    return isCollaborator;
  }

  /**
   * Generate unique slug for form
   * @param title - Form title
   * @param userId - User ID
   * @returns Unique slug
   */
  private async generateUniqueSlug(title: string, userId: string): Promise<string> {
    this.logger.log(`Generating slug for title: ${title}`);

    const baseSlug = title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50); // Limit length

    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug, userId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.logger.log(`Generated unique slug: ${slug}`);
    return slug;
  }

  /**
   * Check if slug already exists for the user
   * @param slug - Slug to check
   * @param userId - User ID
   * @returns True if slug exists
   */
  private async slugExists(slug: string, userId: string): Promise<boolean> {
    const existingForm = await this.formModel
      .findOne({
        slug,
        userId,
        deletedAt: { $exists: false },
      })
      .exec();

    return !!existingForm;
  }

  /**
   * Transform Form document to response DTO
   * @param form - Form document
   * @returns Form response DTO
   */
  private transformToResponseDto(form: FormDocument): FormResponseDto {
    const formObject = form.toObject
      ? form.toObject()
      : (form as unknown as Record<string, unknown>);

    return {
      _id: String(form._id),
      title: form.title,
      description: form.description,
      slug: form.slug,
      status: form.status,
      userId: form.userId.toString(),
      organizationId: form.organizationId?.toString(),
      collaborators: form.collaborators.map(collab => ({
        userId: collab.userId.toString(),
        role: collab.role,
        addedAt: collab.addedAt,
        expiresAt: collab.expiresAt,
      })),
      settings: {
        encryption: form.settings.encryption,
        layout: form.settings.layout,
        theme: form.settings.theme
          ? {
              themeId: form.settings.theme.themeId?.toString(),
              customStyles: form.settings.theme.customStyles
                ? {
                    css: form.settings.theme.customStyles.css,
                    variables: Object.fromEntries(
                      form.settings.theme.customStyles.variables || new Map(),
                    ),
                  }
                : undefined,
            }
          : undefined,
        branding: form.settings.branding,
      },
      elements: form.elements.map(element => ({
        id: element.id,
        type: element.type,
        label: element.label,
        placeholder: element.placeholder,
        helpText: element.helpText,
        required: element.required,
        validation: element.validation as Record<string, unknown> | undefined,
        properties: element.properties as Record<string, unknown> | undefined,
        styles: element.styles as Record<string, unknown> | undefined,
        options: element.options,
        order: element.order,
        parentId: element.parentId,
        createdAt: element.createdAt,
        updatedAt: element.updatedAt,
      })),
      pages: form.pages,
      conditions: form.conditions,
      postSubmission: form.postSubmission,
      integrations: form.integrations.map(integration => ({
        type: integration.type,
        config: integration.config as unknown as Record<string, unknown>,
        isActive: integration.isActive,
      })),
      publishing: form.publishing,
      analytics: form.analytics,
      createdAt: (formObject.createdAt as Date) || new Date(),
      updatedAt: (formObject.updatedAt as Date) || new Date(),
      deletedAt: form.deletedAt,
      deletedBy: form.deletedBy?.toString(),
    };
  }

  /**
   * Find forms with advanced querying, pagination, and search
   * @param userId - ID of the user
   * @param queryDto - Query parameters for filtering, sorting, and pagination
   * @returns Paginated forms response with metadata
   */
  async findWithPagination(userId: string, queryDto: FormQueryDto): Promise<PaginatedFormsDto> {
    this.logger.log(`Finding paginated forms for user: ${userId}`);
    return this.formsRepository.findWithPagination(userId, queryDto);
  }

  /**
   * Update form status
   * @param id - Form ID
   * @param status - New status
   * @param userId - User ID
   * @returns Updated form
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'published' | 'archived' | 'disabled',
    userId: string,
  ): Promise<FormResponseDto> {
    this.logger.log(`Updating form ${id} status to ${status} by user: ${userId}`);

    try {
      const form = await this.formModel
        .findOne({
          _id: id,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Check ownership
      if (!(await this.isOwner(id, userId))) {
        throw new ForbiddenException('Only form owners can change form status');
      }

      // Create version before status change
      await this.formVersioningService.createVersion(
        id,
        userId,
        `Status changed from ${form.status} to ${status}`,
        'auto',
      );

      // Update status
      const updatedForm = await this.formModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .exec();

      if (!updatedForm) {
        throw new NotFoundException('Form not found after update');
      }

      this.logger.log(`Form status updated successfully: ${id}`);
      return this.transformToResponseDto(updatedForm);
    } catch (error: unknown) {
      this.logger.error(`Failed to update form status ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to update form status');
    }
  }

  /**
   * Publish a form
   * @param id - Form ID
   * @param userId - User ID
   * @returns Updated form
   */
  async publishForm(id: string, userId: string): Promise<FormResponseDto> {
    this.logger.log(`Publishing form: ${id} by user: ${userId}`);

    try {
      const form = await this.formModel
        .findOne({
          _id: id,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Check ownership
      if (!(await this.isOwner(id, userId))) {
        throw new ForbiddenException('Only form owners can publish forms');
      }

      // Validate form before publishing
      this.validateFormForPublishing(form);

      // Create version before publishing
      await this.formVersioningService.createVersion(id, userId, 'Form published', 'manual');

      // Update form to published status
      const updatedForm = await this.formModel
        .findByIdAndUpdate(
          id,
          {
            status: 'published',
            'publishing.isPublished': true,
          },
          { new: true },
        )
        .exec();

      if (!updatedForm) {
        throw new NotFoundException('Form not found after update');
      }

      this.logger.log(`Form published successfully: ${id}`);
      return this.transformToResponseDto(updatedForm);
    } catch (error: unknown) {
      this.logger.error(`Failed to publish form ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to publish form');
    }
  }

  /**
   * Archive a form
   * @param id - Form ID
   * @param userId - User ID
   * @returns Updated form
   */
  async archiveForm(id: string, userId: string): Promise<FormResponseDto> {
    this.logger.log(`Archiving form: ${id} by user: ${userId}`);

    try {
      const form = await this.formModel
        .findOne({
          _id: id,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Check ownership
      if (!(await this.isOwner(id, userId))) {
        throw new ForbiddenException('Only form owners can archive forms');
      }

      // Create version before archiving
      await this.formVersioningService.createVersion(id, userId, 'Form archived', 'manual');

      // Update form to archived status
      const updatedForm = await this.formModel
        .findByIdAndUpdate(
          id,
          {
            status: 'archived',
            'publishing.isPublished': false,
          },
          { new: true },
        )
        .exec();

      if (!updatedForm) {
        throw new NotFoundException('Form not found after update');
      }

      this.logger.log(`Form archived successfully: ${id}`);
      return this.transformToResponseDto(updatedForm);
    } catch (error: unknown) {
      this.logger.error(`Failed to archive form ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to archive form');
    }
  }

  /**
   * Get form versions
   * @param id - Form ID
   * @param userId - User ID
   * @param limit - Number of versions to retrieve
   * @returns Array of form versions
   */
  async getFormVersions(id: string, userId: string, limit: number = 50) {
    this.logger.log(`Getting versions for form: ${id} by user: ${userId}`);

    try {
      // Check if user has access to the form
      const form = await this.formModel
        .findOne({
          _id: id,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      if (!(await this.hasAccess(form, userId))) {
        throw new ForbiddenException('Access denied to form versions');
      }

      return this.formVersioningService.getFormVersions(id, limit);
    } catch (error: unknown) {
      this.logger.error(`Failed to get versions for form ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve form versions');
    }
  }

  /**
   * Revert form to a specific version
   * @param id - Form ID
   * @param version - Version number to revert to
   * @param userId - User ID
   * @returns Updated form
   */
  async revertToVersion(id: string, version: number, userId: string): Promise<FormResponseDto> {
    this.logger.log(`Reverting form ${id} to version ${version} by user: ${userId}`);

    try {
      // Check ownership
      if (!(await this.isOwner(id, userId))) {
        throw new ForbiddenException('Only form owners can revert forms');
      }

      const revertedForm = await this.formVersioningService.revertToVersion(id, version, userId);
      return this.transformToResponseDto(revertedForm);
    } catch (error: unknown) {
      this.logger.error(`Failed to revert form ${id} to version ${version}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to revert form');
    }
  }

  /**
   * Validate form before publishing
   * @param form - Form document
   */
  private validateFormForPublishing(form: FormDocument): void {
    // Check if form has required elements
    if (!form.elements || form.elements.length === 0) {
      throw new BadRequestException('Form must have at least one element to be published');
    }

    // Check if form has a title
    if (!form.title || form.title.trim().length === 0) {
      throw new BadRequestException('Form must have a title to be published');
    }

    // Additional validation rules can be added here
    this.logger.log(`Form validation passed for form: ${String(form._id)}`);
  }
}
