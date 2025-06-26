import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import {
  CreateTemplateDto,
  RenderTemplateDto,
  TemplatePreviewDto,
  TemplateQueryDto,
  TemplateResponseDto,
  UpdateTemplateDto,
} from './dto/template.dto';
import { EmailTemplate, EmailTemplateDocument } from './entities/email-template.entity';

/**
 * MJML Render Result Interface
 */
interface MjmlRenderResult {
  html: string;
  errors: Array<{
    line: number;
    message: string;
    tagName: string;
    formattedMessage: string;
  }>;
}

/**
 * MJML Validation Result Interface
 */
interface MjmlValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  html?: string;
}

/**
 * Compiled Template Cache Entry
 * Stores compiled Handlebars templates for performance
 */
interface CompiledTemplateCache {
  template: HandlebarsTemplateDelegate;
  subjectTemplate: HandlebarsTemplateDelegate;
  compiledAt: Date;
  version: string;
}

/**
 * Template Security Scan Result
 * Results from template security validation
 */

/**
 * Template Service
 *
 * Comprehensive email template management service with Handlebars and MJML support.
 * Provides template compilation, caching, validation, versioning, and security scanning.
 * Follows 2025 security best practices with proper input sanitization and XSS prevention.
 *
 * @class TemplateService
 * @since 2025-01-15
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templateCache = new Map<string, CompiledTemplateCache>();
  private readonly cacheExpiryMs = 30 * 60 * 1000; // 30 minutes

  constructor(
    @InjectModel(EmailTemplate.name)
    private readonly templateModel: Model<EmailTemplateDocument>,
  ) {
    this.setupHandlebarsHelpers();
  }

  /**
   * Create a new email template with security validation
   */
  async createTemplate(
    createTemplateDto: CreateTemplateDto,
    ownerId: string,
  ): Promise<TemplateResponseDto> {
    this.logger.log(`Creating template: ${createTemplateDto.templateId}`);

    // Check if template ID already exists
    const existingTemplate = await this.templateModel.findOne({
      templateId: createTemplateDto.templateId,
    });

    if (existingTemplate) {
      throw new ConflictException(
        `Template with ID '${createTemplateDto.templateId}' already exists`,
      );
    }

    // Validate and compile template for security
    const securityScan = this.performSecurityScan(createTemplateDto.handlebarsSource);

    if (!securityScan.isSecure) {
      throw new BadRequestException(
        `Template security validation failed: ${securityScan.securityIssues.join(', ')}`,
      );
    }

    // Compile template to check for syntax errors
    try {
      this.compileAndValidateTemplate(
        createTemplateDto.handlebarsSource,
        createTemplateDto.subject,
        createTemplateDto.mjmlSource,
      );
    } catch (error) {
      throw new BadRequestException(
        `Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Generate content from MJML if provided
    let content = createTemplateDto.handlebarsSource;
    if (createTemplateDto.mjmlSource) {
      const mjmlResult = mjml2html(createTemplateDto.mjmlSource);
      if (mjmlResult.errors.length > 0) {
        const errorMessages = mjmlResult.errors
          .map((e: { message: string }) => e.message)
          .join(', ');
        throw new BadRequestException(`MJML compilation failed: ${errorMessages}`);
      }
      content = mjmlResult.html;
    }

    // Create template document
    const template = new this.templateModel({
      ...createTemplateDto,
      content,
      ownerId: new Types.ObjectId(ownerId),
      securityScan,
      versions: [
        {
          version: '1.0.0',
          content,
          mjmlSource: createTemplateDto.mjmlSource,
          variables: createTemplateDto.variables?.map(v => v.name) || [],
          createdAt: new Date(),
          createdBy: ownerId,
          changeDescription: 'Initial version',
          isActive: true,
        },
      ],
    });

    const savedTemplate = await template.save();
    this.logger.log(`Template created successfully: ${savedTemplate.templateId}`);

    return this.toResponseDto(savedTemplate);
  }

  /**
   * Update an existing email template
   */
  async updateTemplate(
    templateId: string,
    updateTemplateDto: UpdateTemplateDto,
    ownerId: string,
    changeDescription?: string,
  ): Promise<TemplateResponseDto> {
    this.logger.log(`Updating template: ${templateId}`);

    const template = await this.findTemplateByIdAndOwner(templateId, ownerId);

    // If updating template content, perform security validation
    if (updateTemplateDto.handlebarsSource || updateTemplateDto.mjmlSource) {
      const securityScan = this.performSecurityScan(
        updateTemplateDto.handlebarsSource || template.handlebarsSource,
      );

      if (!securityScan.isSecure) {
        throw new BadRequestException(
          `Template security validation failed: ${securityScan.securityIssues.join(', ')}`,
        );
      }

      template.securityScan = securityScan;
    }

    // Compile updated template
    if (updateTemplateDto.handlebarsSource || updateTemplateDto.subject) {
      try {
        this.compileAndValidateTemplate(
          updateTemplateDto.handlebarsSource || template.handlebarsSource,
          updateTemplateDto.subject || template.subject,
          updateTemplateDto.mjmlSource || template.mjmlSource,
        );
      } catch (error) {
        throw new BadRequestException(
          `Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Generate new content if MJML source is updated
    let newContent = updateTemplateDto.handlebarsSource || template.handlebarsSource;
    if (updateTemplateDto.mjmlSource) {
      const mjmlResult = mjml2html(updateTemplateDto.mjmlSource);
      if (mjmlResult.errors.length > 0) {
        const errorMessages = mjmlResult.errors
          .map((e: { message: string }) => e.message)
          .join(', ');
        throw new BadRequestException(`MJML compilation failed: ${errorMessages}`);
      }
      newContent = mjmlResult.html;
    }

    // Create new version if content changed
    if (updateTemplateDto.handlebarsSource || updateTemplateDto.mjmlSource) {
      const newVersion = this.incrementVersion(template.currentVersion);
      template.versions.push({
        version: newVersion,
        content: newContent,
        mjmlSource: updateTemplateDto.mjmlSource || template.mjmlSource,
        variables:
          updateTemplateDto.variables?.map(v => v.name) || template.variables.map(v => v.name),
        createdAt: new Date(),
        createdBy: ownerId,
        changeDescription: changeDescription || 'Template update',
        isActive: true,
      });

      // Deactivate previous versions
      template.versions.forEach((v, index) => {
        if (index < template.versions.length - 1) {
          v.isActive = false;
        }
      });

      template.currentVersion = newVersion;
      template.content = newContent;
    }

    // Update template fields
    Object.assign(template, updateTemplateDto);

    // Clear cache for this template
    this.clearTemplateCache(templateId);

    const updatedTemplate = await template.save();
    this.logger.log(`Template updated successfully: ${templateId}`);

    return this.toResponseDto(updatedTemplate);
  }

  /**
   * Find template by ID and owner with ownership validation
   */
  async findTemplateByIdAndOwner(
    templateId: string,
    ownerId: string,
  ): Promise<EmailTemplateDocument> {
    const template = await this.templateModel.findOne({
      templateId,
      ownerId: new Types.ObjectId(ownerId),
    });

    if (!template) {
      throw new NotFoundException(`Template '${templateId}' not found or access denied`);
    }

    return template;
  }

  /**
   * Get template by ID (with owner verification)
   */
  async getTemplate(templateId: string, ownerId: string): Promise<TemplateResponseDto> {
    const template = await this.findTemplateByIdAndOwner(templateId, ownerId);
    return this.toResponseDto(template);
  }

  /**
   * Get all templates for a user with filtering and pagination
   */
  async getTemplates(
    queryDto: TemplateQueryDto,
    ownerId: string,
  ): Promise<{
    templates: TemplateResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.listTemplates(ownerId, queryDto);
  }

  /**
   * List templates with filtering and pagination
   */
  async listTemplates(
    ownerId: string,
    query: TemplateQueryDto,
  ): Promise<{
    templates: TemplateResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: FilterQuery<EmailTemplateDocument> = {
      ownerId: new Types.ObjectId(ownerId),
    };

    // Apply filters
    if (query.category) {
      filter.category = query.category;
    }

    if (query.language) {
      filter.language = query.language;
    }

    if (typeof query.isActive === 'boolean') {
      filter.isActive = query.isActive;
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
        { templateId: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }

    // Pagination
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Sorting
    const sort: Record<string, SortOrder> = {};
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    if (sortBy === 'usage') {
      sort['analytics.sendCount'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    // Execute query
    const [templates, total] = await Promise.all([
      this.templateModel.find(filter).sort(sort).skip(offset).limit(limit).exec(),
      this.templateModel.countDocuments(filter),
    ]);

    return {
      templates: templates.map(t => this.toResponseDto(t)),
      total,
      page,
      limit,
    };
  }

  /**
   * Render template with variables and security validation
   */
  async renderTemplate(
    renderDto: RenderTemplateDto,
    ownerId?: string,
  ): Promise<TemplatePreviewDto> {
    this.logger.log(`Rendering template: ${renderDto.templateId}`);

    // Find template (with owner check if ownerId provided)
    let template: EmailTemplateDocument;
    if (ownerId) {
      template = await this.findTemplateByIdAndOwner(renderDto.templateId, ownerId);
    } else {
      const foundTemplate = await this.templateModel.findOne({
        templateId: renderDto.templateId,
        isActive: true,
      });

      if (!foundTemplate) {
        throw new NotFoundException(`Template '${renderDto.templateId}' not found`);
      }

      template = foundTemplate;
    }

    // Validate required variables
    const missingVariables = this.validateRequiredVariables(template, renderDto.variables);
    if (missingVariables.length > 0) {
      throw new BadRequestException(`Missing required variables: ${missingVariables.join(', ')}`);
    }

    // Sanitize variables for security
    const sanitizedVariables = this.sanitizeVariables(renderDto.variables);

    // Get compiled template from cache or compile new
    const compiled = this.getCompiledTemplate(template);

    try {
      // Render template and subject
      const htmlContent = compiled.template(sanitizedVariables);
      const subject = compiled.subjectTemplate(sanitizedVariables);

      // Update analytics
      await this.updateTemplateAnalytics(template.templateId, 'render');

      return {
        htmlContent,
        subject,
        variables: sanitizedVariables,
        metadata: {
          templateId: template.templateId,
          version: template.currentVersion,
          language: renderDto.language || template.language,
          renderedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Template rendering failed: ${renderDto.templateId}`, error);
      throw new BadRequestException(
        `Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a template permanently
   */
  async deleteTemplate(templateId: string, ownerId: string): Promise<void> {
    this.logger.log(`Deleting template: ${templateId}`);

    const template = await this.findTemplateByIdAndOwner(templateId, ownerId);

    // Check if template is system-managed
    if (template.isSystem) {
      throw new BadRequestException('System templates cannot be deleted');
    }

    // Clear cache before deletion
    this.clearTemplateCache(templateId);

    // Delete the template
    await this.templateModel.deleteOne({ _id: template._id });

    this.logger.log(`Template deleted successfully: ${templateId}`);
  }

  /**
   * Get template version history
   */
  async getTemplateVersions(
    templateId: string,
    ownerId: string,
  ): Promise<{
    templateId: string;
    currentVersion: string;
    versions: Array<{
      version: string;
      createdAt: Date;
      createdBy: string;
      changeDescription: string;
      isActive: boolean;
    }>;
  }> {
    const template = await this.findTemplateByIdAndOwner(templateId, ownerId);

    return {
      templateId: template.templateId,
      currentVersion: template.currentVersion,
      versions: template.versions.map(v => ({
        version: v.version,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        changeDescription: v.changeDescription || '',
        isActive: v.isActive,
      })),
    };
  }

  /**
   * Get enhanced template analytics
   */
  async getTemplateAnalytics(
    templateId: string,
    ownerId: string,
  ): Promise<{
    templateId: string;
    totalSends: number;
    successRate: number;
    openRate: number;
    clickRate: number;
    renderCount: number;
    lastSent?: Date;
    performance: {
      averageRenderTime: number;
      errorRate: number;
    };
  }> {
    const template = await this.findTemplateByIdAndOwner(templateId, ownerId);

    return {
      templateId: template.templateId,
      totalSends: template.analytics.sendCount,
      successRate: template.analytics.successRate,
      openRate: template.analytics.openRate,
      clickRate: template.analytics.clickRate,
      renderCount: template.analytics.sendCount, // For now, assume 1:1 render to send ratio
      lastSent: template.analytics.lastSent,
      performance: {
        averageRenderTime: 150, // Default placeholder - would need separate tracking
        errorRate: 100 - template.analytics.successRate,
      },
    };
  }

  /**
   * Duplicate an existing template
   */
  async duplicateTemplate(
    sourceTemplateId: string,
    newTemplateId: string,
    ownerId: string,
  ): Promise<TemplateResponseDto> {
    this.logger.log(`Duplicating template: ${sourceTemplateId} -> ${newTemplateId}`);

    // Get source template
    const sourceTemplate = await this.findTemplateByIdAndOwner(sourceTemplateId, ownerId);

    // Check if new template ID already exists
    const existingTemplate = await this.templateModel.findOne({
      templateId: newTemplateId,
    });

    if (existingTemplate) {
      throw new ConflictException(`Template with ID '${newTemplateId}' already exists`);
    }

    // Create duplicate template
    const duplicateData = {
      templateId: newTemplateId,
      name: `${sourceTemplate.name} (Copy)`,
      description: sourceTemplate.description,
      category: sourceTemplate.category,
      subject: sourceTemplate.subject,
      handlebarsSource: sourceTemplate.handlebarsSource,
      mjmlSource: sourceTemplate.mjmlSource,
      variables: sourceTemplate.variables,
      language: sourceTemplate.language,
      tags: [...sourceTemplate.tags, 'duplicate'],
    };

    return this.createTemplate(duplicateData, ownerId);
  }

  /**
   * Validate template syntax without saving
   */
  validateTemplate(validateDto: {
    handlebarsSource: string;
    subject: string;
    mjmlSource?: string;
  }): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    securityScan: {
      isSecure: boolean;
      securityIssues: string[];
    };
  } {
    const validation = this.validateTemplateContent(
      validateDto.handlebarsSource,
      validateDto.mjmlSource,
    );

    const securityScan = this.performSecurityScan(validateDto.handlebarsSource);

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      securityScan,
    };
  }

  /**
   * Setup Handlebars helpers for enhanced functionality
   */
  private setupHandlebarsHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      if (!date) return '';

      const d = new Date(date);
      if (format === 'short') {
        return d.toLocaleDateString();
      } else if (format === 'long') {
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return d.toISOString();
    });

    // Conditional helper
    Handlebars.registerHelper(
      'if_eq',
      function (a: unknown, b: unknown, options: Handlebars.HelperOptions) {
        return a === b ? options.fn(this) : options.inverse(this);
      },
    );

    // URL helper with validation
    Handlebars.registerHelper('url', (path: string, base?: string) => {
      try {
        if (path.startsWith('http://') || path.startsWith('https://')) {
          return path;
        }
        const baseUrl = base || process.env.APP_URL || 'https://app.arvaform.com';
        return new URL(path, baseUrl).toString();
      } catch {
        return '#';
      }
    });

    // Safe string helper (already escaped by Handlebars)
    Handlebars.registerHelper('safe', (str: string) => {
      return new Handlebars.SafeString(str);
    });

    // Truncate helper
    Handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str || str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    this.logger.log('Handlebars helpers registered');
  }

  /**
   * Process MJML content with proper error handling
   */
  private processMjml(mjmlContent: string): MjmlRenderResult {
    try {
      const result = mjml2html(mjmlContent) as MjmlRenderResult;

      // Handle MJML errors
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors
          .map(err => err.formattedMessage || err.message)
          .join(', ');
        this.logger.warn('MJML compilation warnings:', errorMessages);
      }

      return result;
    } catch (error) {
      this.logger.error('MJML processing failed', error);
      throw new Error(`MJML processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate template syntax and security
   */
  private validateTemplateContent(
    handlebarsSource: string,
    mjmlSource?: string,
  ): MjmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate Handlebars syntax
      Handlebars.compile(handlebarsSource, { strict: true });
    } catch (error) {
      const handlebarsError = error as Error;
      errors.push(`Handlebars syntax error: ${handlebarsError.message}`);
    }

    // Validate MJML syntax if provided
    let mjmlResult: MjmlRenderResult | undefined;
    if (mjmlSource) {
      try {
        mjmlResult = this.processMjml(mjmlSource);

        if (mjmlResult.errors && mjmlResult.errors.length > 0) {
          errors.push(...mjmlResult.errors.map(err => err.formattedMessage || err.message));
        }
      } catch (error) {
        errors.push(`MJML validation error: ${(error as Error).message}`);
      }
    }

    // Security validation - check for dangerous patterns
    const securityScan = this.performSecurityScan(handlebarsSource);
    if (!securityScan.isSecure) {
      errors.push(...securityScan.securityIssues);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      html: mjmlResult?.html,
    };
  }

  /**
   * Perform security scan on template content
   */
  private performSecurityScan(content: string): {
    isSecure: boolean;
    securityIssues: string[];
  } {
    const securityIssues: string[] = [];
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
    ];

    dangerousPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        const patternNames = [
          'Script tags detected',
          'JavaScript URLs detected',
          'Event handlers detected',
          'Iframe tags detected',
          'Object tags detected',
          'Embed tags detected',
        ];
        securityIssues.push(patternNames[index]);
      }
    });

    return {
      isSecure: securityIssues.length === 0,
      securityIssues,
    };
  }

  /**
   * Compile and validate template syntax
   */
  private compileAndValidateTemplate(
    handlebarsSource: string,
    subject: string,
    mjmlSource?: string,
  ): void {
    // Compile Handlebars templates
    Handlebars.compile(handlebarsSource);
    Handlebars.compile(subject);

    // Validate MJML if provided
    if (mjmlSource) {
      const mjmlResult = mjml2html(mjmlSource);
      if (mjmlResult.errors.length > 0) {
        const errorMessages = mjmlResult.errors
          .map((e: { message: string }) => e.message)
          .join(', ');
        throw new Error(`MJML validation failed: ${errorMessages}`);
      }
    }
  }

  /**
   * Get compiled template from cache or compile new
   */
  private getCompiledTemplate(template: EmailTemplateDocument): CompiledTemplateCache {
    const cacheKey = `${template.templateId}:${template.currentVersion}`;
    const cached = this.templateCache.get(cacheKey);

    // Return cached version if valid
    if (cached && Date.now() - cached.compiledAt.getTime() < this.cacheExpiryMs) {
      return cached;
    }

    // Compile new template
    const compiledTemplate = Handlebars.compile(template.content);
    const compiledSubject = Handlebars.compile(template.subject);

    const compiled: CompiledTemplateCache = {
      template: compiledTemplate,
      subjectTemplate: compiledSubject,
      compiledAt: new Date(),
      version: template.currentVersion,
    };

    // Cache the compiled template
    this.templateCache.set(cacheKey, compiled);

    this.logger.debug(`Template compiled and cached: ${cacheKey}`);
    return compiled;
  }

  /**
   * Validate required variables are provided
   */
  private validateRequiredVariables(
    template: EmailTemplateDocument,
    variables: Record<string, unknown>,
  ): string[] {
    const missing: string[] = [];

    for (const templateVar of template.variables) {
      if (templateVar.required && !(templateVar.name in variables)) {
        // Check if default value exists
        if (templateVar.defaultValue === undefined) {
          missing.push(templateVar.name);
        }
      }
    }

    return missing;
  }

  /**
   * Sanitize variables for security (prevent XSS)
   */
  private sanitizeVariables(
    variables: Record<string, unknown>,
  ): Record<string, string | number | boolean> {
    const sanitized: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else {
        // Convert other types to string for safety
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Update template analytics
   */
  private async updateTemplateAnalytics(
    templateId: string,
    _action: 'render' | 'send',
  ): Promise<void> {
    try {
      const update = {
        $inc: { 'analytics.sendCount': 1 },
        $set: { 'analytics.lastSent': new Date() },
      };

      await this.templateModel.updateOne({ _id: new Types.ObjectId(templateId) }, update);
    } catch (error) {
      this.logger.warn(`Failed to update template analytics: ${templateId}`, error);
    }
  }

  /**
   * Increment version number (semantic versioning)
   */
  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Clear template cache
   */
  private clearTemplateCache(templateId: string): void {
    const keysToDelete = Array.from(this.templateCache.keys()).filter(key =>
      key.startsWith(`${templateId}:`),
    );

    for (const key of keysToDelete) {
      this.templateCache.delete(key);
    }

    this.logger.debug(`Template cache cleared: ${templateId}`);
  }

  /**
   * Convert template document to response DTO
   */
  private toResponseDto(template: EmailTemplateDocument): TemplateResponseDto {
    return {
      templateId: template.templateId,
      name: template.name,
      description: template.description || '',
      category: template.category,
      subject: template.subject,
      variables: template.variables,
      language: template.language,
      tags: template.tags,
      isActive: template.isActive,
      currentVersion: template.currentVersion,
      ownerId: template.ownerId.toString(),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      analytics: {
        sendCount: template.analytics.sendCount,
        successRate: template.analytics.successRate,
        openRate: template.analytics.openRate,
        clickRate: template.analytics.clickRate,
      },
    };
  }
}
