import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { EmailDeliveryService } from './delivery.service';
import {
  CreateBulkEmailDeliveryDto,
  CreateEmailDeliveryDto,
  EmailDeliveryQueryDto,
  EmailDeliveryResponseDto,
  EmailDeliveryStatsDto,
} from './dto/delivery.dto';
import {
  CreateTemplateDto,
  RenderTemplateDto,
  SendTemplateEmailDto,
  TemplatePreviewDto,
  TemplateQueryDto,
  TemplateResponseDto,
  UpdateTemplateDto,
} from './dto/template.dto';
import { EmailService } from './email.service';
import { TemplateService } from './template.service';

/**
 * Email Controller
 *
 * Comprehensive email management controller providing template CRUD operations,
 * email sending capabilities, delivery tracking, and analytics with proper authentication,
 * validation, and documentation following 2025 NestJS best practices.
 *
 * Features:
 * - Template management (CRUD operations)
 * - Template rendering and preview
 * - Email sending with templates
 * - Email delivery queue management
 * - Delivery tracking and analytics
 * - Template analytics and versioning
 * - Security and ownership validation
 *
 * @controller Email
 * @since 2025-01-15
 */
@ApiTags('Email Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailDeliveryService: EmailDeliveryService,
  ) {}

  // =============================================================================
  // EMAIL DELIVERY ENDPOINTS
  // =============================================================================

  /**
   * Queue a single email for delivery
   * @param createDeliveryDto Email delivery data
   * @param userId Current user ID from JWT token
   * @returns Email delivery record with queue information
   */
  @Post('deliveries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Queue email for delivery',
    description: 'Create and queue a single email for delivery with comprehensive tracking',
  })
  @ApiResponse({
    status: 201,
    description: 'Email queued successfully',
    type: EmailDeliveryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email delivery data',
  })
  async queueEmailDelivery(
    @Body(ValidationPipe) createDeliveryDto: CreateEmailDeliveryDto,
    @GetUser('id') userId: string,
  ): Promise<EmailDeliveryResponseDto> {
    // Set user context for the delivery
    const deliveryData = {
      ...createDeliveryDto,
      userId: userId,
    };

    const delivery = await this.emailDeliveryService.createEmailDelivery(deliveryData);

    return {
      id: delivery._id.toString(),
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      status: delivery.status,
      priority: delivery.priority,
      scheduledAt: delivery.scheduledAt,
      processedAt: delivery.processedAt,
      deliveredAt: delivery.deliveredAt,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt,
      providerId: delivery.providerId,
      providerMessageId: delivery.providerMessageId,
      lastErrorMessage: delivery.lastErrorMessage,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }

  /**
   * Queue multiple emails for bulk delivery
   * @param bulkDeliveryDto Bulk email delivery data
   * @param userId Current user ID from JWT token
   * @returns Array of email delivery records
   */
  @Post('deliveries/bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Queue bulk emails for delivery',
    description: 'Create and queue multiple emails for batch delivery processing',
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk emails queued successfully',
    type: [EmailDeliveryResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bulk delivery data',
  })
  async queueBulkEmailDelivery(
    @Body(ValidationPipe) bulkDeliveryDto: CreateBulkEmailDeliveryDto,
    @GetUser('id') userId: string,
  ): Promise<{
    deliveries: EmailDeliveryResponseDto[];
    total: number;
    bulkId: string;
  }> {
    // Add user context to all emails
    const emailsWithUser = bulkDeliveryDto.emails.map(email => ({
      ...email,
      userId: userId,
    }));

    const bulkData = {
      ...bulkDeliveryDto,
      emails: emailsWithUser,
      bulkEmailId: bulkDeliveryDto.bulkEmailId || `bulk-${Date.now()}`,
    };

    const deliveries = await this.emailDeliveryService.createBulkEmailDelivery(bulkData);

    const responseDeliveries = deliveries.map(delivery => ({
      id: delivery._id.toString(),
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      status: delivery.status,
      priority: delivery.priority,
      scheduledAt: delivery.scheduledAt,
      processedAt: delivery.processedAt,
      deliveredAt: delivery.deliveredAt,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt,
      providerId: delivery.providerId,
      providerMessageId: delivery.providerMessageId,
      lastErrorMessage: delivery.lastErrorMessage,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    }));

    return {
      deliveries: responseDeliveries,
      total: deliveries.length,
      bulkId: bulkData.bulkEmailId,
    };
  }

  /**
   * Get email deliveries with filtering and pagination
   * @param queryDto Query parameters for filtering
   * @param userId Current user ID from JWT token
   * @returns Paginated list of email deliveries
   */
  @Get('deliveries')
  @ApiOperation({
    summary: 'Get email deliveries',
    description: 'Retrieve email deliveries with filtering, pagination, and search capabilities',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by delivery status' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority' })
  @ApiQuery({ name: 'recipientEmail', required: false, description: 'Filter by recipient email' })
  @ApiQuery({ name: 'formId', required: false, description: 'Filter by form ID' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiResponse({
    status: 200,
    description: 'Email deliveries retrieved successfully',
  })
  async getEmailDeliveries(
    @Query(ValidationPipe) queryDto: EmailDeliveryQueryDto,
    @GetUser('id') userId: string,
  ): Promise<{
    deliveries: EmailDeliveryResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Add user filter to query
    const userFilteredQuery = {
      ...queryDto,
      userId: userId,
    };

    const result = await this.emailDeliveryService.getEmailDeliveries(userFilteredQuery);

    const responseDeliveries = result.deliveries.map(delivery => ({
      id: delivery._id.toString(),
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      status: delivery.status,
      priority: delivery.priority,
      scheduledAt: delivery.scheduledAt,
      processedAt: delivery.processedAt,
      deliveredAt: delivery.deliveredAt,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt,
      providerId: delivery.providerId,
      providerMessageId: delivery.providerMessageId,
      lastErrorMessage: delivery.lastErrorMessage,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    }));

    return {
      deliveries: responseDeliveries,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Get a specific email delivery by ID
   * @param deliveryId Email delivery identifier
   * @param userId Current user ID from JWT token
   * @returns Email delivery details
   */
  @Get('deliveries/:deliveryId')
  @ApiOperation({
    summary: 'Get email delivery by ID',
    description: 'Retrieve detailed information about a specific email delivery',
  })
  @ApiParam({
    name: 'deliveryId',
    description: 'Email delivery identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Email delivery retrieved successfully',
    type: EmailDeliveryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email delivery not found or access denied',
  })
  async getEmailDelivery(
    @Param('deliveryId') deliveryId: string,
    @GetUser('id') userId: string,
  ): Promise<EmailDeliveryResponseDto> {
    const delivery = await this.emailDeliveryService.getEmailDeliveryById(deliveryId);

    if (!delivery) {
      throw new Error('Email delivery not found');
    }

    // Verify user ownership
    if (delivery.userId && delivery.userId.toString() !== userId) {
      throw new Error('Access denied');
    }

    return {
      id: delivery._id.toString(),
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      status: delivery.status,
      priority: delivery.priority,
      scheduledAt: delivery.scheduledAt,
      processedAt: delivery.processedAt,
      deliveredAt: delivery.deliveredAt,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt,
      providerId: delivery.providerId,
      providerMessageId: delivery.providerMessageId,
      lastErrorMessage: delivery.lastErrorMessage,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }

  /**
   * Retry a failed email delivery
   * @param deliveryId Email delivery identifier
   * @param userId Current user ID from JWT token
   * @returns Updated email delivery information
   */
  @Post('deliveries/:deliveryId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry failed email delivery',
    description: 'Retry a failed email delivery if retry attempts are available',
  })
  @ApiParam({
    name: 'deliveryId',
    description: 'Email delivery identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Email delivery retried successfully',
    type: EmailDeliveryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Email delivery cannot be retried',
  })
  @ApiResponse({
    status: 404,
    description: 'Email delivery not found or access denied',
  })
  async retryEmailDelivery(
    @Param('deliveryId') deliveryId: string,
    @GetUser('id') userId: string,
  ): Promise<EmailDeliveryResponseDto> {
    // First verify ownership
    const existingDelivery = await this.emailDeliveryService.getEmailDeliveryById(deliveryId);
    if (!existingDelivery) {
      throw new Error('Email delivery not found');
    }

    if (existingDelivery.userId && existingDelivery.userId.toString() !== userId) {
      throw new Error('Access denied');
    }

    const delivery = await this.emailDeliveryService.retryEmailDelivery(deliveryId);

    return {
      id: delivery._id.toString(),
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      status: delivery.status,
      priority: delivery.priority,
      scheduledAt: delivery.scheduledAt,
      processedAt: delivery.processedAt,
      deliveredAt: delivery.deliveredAt,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextRetryAt: delivery.nextRetryAt,
      providerId: delivery.providerId,
      providerMessageId: delivery.providerMessageId,
      lastErrorMessage: delivery.lastErrorMessage,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }

  /**
   * Get email delivery statistics and analytics
   * @param startDate Statistics start date (optional)
   * @param endDate Statistics end date (optional)
   * @param userId Current user ID from JWT token
   * @returns Email delivery statistics
   */
  @Get('deliveries/stats/analytics')
  @ApiOperation({
    summary: 'Get email delivery statistics',
    description: 'Retrieve comprehensive analytics and performance metrics for email deliveries',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for statistics (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for statistics (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Email delivery statistics retrieved successfully',
    type: EmailDeliveryStatsDto,
  })
  async getEmailDeliveryStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @GetUser('id') _userId?: string,
  ): Promise<EmailDeliveryStatsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Note: In a real implementation, you'd filter by userId for user-specific stats
    // For now, we'll get global stats but this should be enhanced for user isolation

    return this.emailDeliveryService.getEmailDeliveryStats(start, end);
  }

  // =============================================================================
  // EXISTING TEMPLATE ENDPOINTS (unchanged)
  // =============================================================================

  /**
   * Create a new email template
   * @param createTemplateDto Template creation data
   * @param userId Current user ID from JWT token
   * @returns Created template data
   */
  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create email template',
    description: 'Create a new email template with Handlebars and optional MJML support',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
    type: TemplateResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid template data or compilation error',
  })
  @ApiResponse({
    status: 409,
    description: 'Template ID already exists',
  })
  async createTemplate(
    @Body(ValidationPipe) createTemplateDto: CreateTemplateDto,
    @GetUser('id') userId: string,
  ): Promise<TemplateResponseDto> {
    return this.templateService.createTemplate(createTemplateDto, userId);
  }

  /**
   * Get all templates for the current user
   * @param queryDto Query parameters for filtering and pagination
   * @param userId Current user ID from JWT token
   * @returns List of templates
   */
  @Get('templates')
  @ApiOperation({
    summary: 'Get user templates',
    description: 'Retrieve all email templates for the authenticated user with optional filtering',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by template category' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in template name and description',
  })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
    type: [TemplateResponseDto],
  })
  async getTemplates(
    @Query(ValidationPipe) queryDto: TemplateQueryDto,
    @GetUser('id') userId: string,
  ): Promise<{
    templates: TemplateResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.templateService.getTemplates(queryDto, userId);
  }

  /**
   * Get a specific template by ID
   * @param templateId Template identifier
   * @param userId Current user ID from JWT token
   * @returns Template data
   */
  @Get('templates/:templateId')
  @ApiOperation({
    summary: 'Get template by ID',
    description: 'Retrieve a specific email template by its identifier',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique template identifier',
    example: 'welcome-email',
  })
  @ApiResponse({
    status: 200,
    description: 'Template retrieved successfully',
    type: TemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found or access denied',
  })
  async getTemplate(
    @Param('templateId') templateId: string,
    @GetUser('id') userId: string,
  ): Promise<TemplateResponseDto> {
    return this.templateService.getTemplate(templateId, userId);
  }

  /**
   * Update an existing template
   * @param templateId Template identifier
   * @param updateTemplateDto Template update data
   * @param userId Current user ID from JWT token
   * @returns Updated template data
   */
  @Patch('templates/:templateId')
  @ApiOperation({
    summary: 'Update email template',
    description: 'Update an existing email template with versioning support',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique template identifier',
    example: 'welcome-email',
  })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
    type: TemplateResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid template data or compilation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found or access denied',
  })
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body(ValidationPipe) updateTemplateDto: UpdateTemplateDto,
    @GetUser('id') userId: string,
  ): Promise<TemplateResponseDto> {
    return this.templateService.updateTemplate(templateId, updateTemplateDto, userId);
  }

  /**
   * Delete a template
   * @param templateId Template identifier
   * @param userId Current user ID from JWT token
   */
  @Delete('templates/:templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete email template',
    description: 'Permanently delete an email template and all its versions',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique template identifier',
    example: 'welcome-email',
  })
  @ApiResponse({
    status: 204,
    description: 'Template deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found or access denied',
  })
  async deleteTemplate(
    @Param('templateId') templateId: string,
    @GetUser('id') userId: string,
  ): Promise<void> {
    return this.templateService.deleteTemplate(templateId, userId);
  }

  /**
   * Render template with variables for preview
   * @param renderDto Template rendering data
   * @param userId Current user ID from JWT token
   * @returns Rendered template content
   */
  @Post('templates/render')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Render template preview',
    description: 'Render an email template with variables for preview purposes',
  })
  @ApiResponse({
    status: 200,
    description: 'Template rendered successfully',
    type: TemplatePreviewDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Template rendering error or missing variables',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async renderTemplate(
    @Body(ValidationPipe) renderDto: RenderTemplateDto,
    @GetUser('id') userId: string,
  ): Promise<TemplatePreviewDto> {
    return this.templateService.renderTemplate(renderDto, userId);
  }

  /**
   * Send template email to a recipient
   * @param sendEmailDto Email sending data
   * @param userId Current user ID from JWT token
   * @returns Email sending result
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send template email',
    description: 'Send an email using a template with variable substitution',
  })
  @ApiResponse({
    status: 200,
    description: 'Email sent successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        messageId: { type: 'string', example: 'msg_1234567890' },
        providerId: { type: 'string', example: 'sendgrid' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email data or template rendering error',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async sendTemplateEmail(
    @Body(ValidationPipe) sendEmailDto: SendTemplateEmailDto,
    @GetUser('id') userId: string,
  ): Promise<{
    success: boolean;
    messageId?: string;
    providerId: string;
    timestamp: Date;
    error?: string;
  }> {
    // First render the template to validate and get content
    const rendered = await this.templateService.renderTemplate(
      {
        templateId: sendEmailDto.templateId,
        variables: sendEmailDto.variables,
        language: sendEmailDto.language,
      },
      userId,
    );

    // Send the email using the email service
    const result = await this.emailService.sendEmail(
      sendEmailDto.to,
      rendered.subject,
      rendered.htmlContent,
      sendEmailDto.from,
    );

    return result;
  }

  /**
   * Get template versions history
   * @param templateId Template identifier
   * @param userId Current user ID from JWT token
   * @returns Template version history
   */
  @Get('templates/:templateId/versions')
  @ApiOperation({
    summary: 'Get template versions',
    description: 'Retrieve version history for a specific template',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique template identifier',
    example: 'welcome-email',
  })
  @ApiResponse({
    status: 200,
    description: 'Template versions retrieved successfully',
    schema: {
      type: 'array',
      items: {
        properties: {
          version: { type: 'string', example: '1.2.0' },
          createdAt: { type: 'string', format: 'date-time' },
          createdBy: { type: 'string' },
          changeDescription: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found or access denied',
  })
  async getTemplateVersions(
    @Param('templateId') templateId: string,
    @GetUser('id') userId: string,
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
    return this.templateService.getTemplateVersions(templateId, userId);
  }

  /**
   * Get template analytics
   * @param templateId Template identifier
   * @param userId Current user ID from JWT token
   * @returns Template usage analytics
   */
  @Get('templates/:templateId/analytics')
  @ApiOperation({
    summary: 'Get template analytics',
    description: 'Retrieve usage analytics and performance metrics for a template',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique template identifier',
    example: 'welcome-email',
  })
  @ApiResponse({
    status: 200,
    description: 'Template analytics retrieved successfully',
    schema: {
      properties: {
        templateId: { type: 'string' },
        totalSends: { type: 'number' },
        successRate: { type: 'number' },
        openRate: { type: 'number' },
        clickRate: { type: 'number' },
        renderCount: { type: 'number' },
        lastSent: { type: 'string', format: 'date-time' },
        performance: {
          type: 'object',
          properties: {
            averageRenderTime: { type: 'number' },
            errorRate: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found or access denied',
  })
  async getTemplateAnalytics(
    @Param('templateId') templateId: string,
    @GetUser('id') userId: string,
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
    return this.templateService.getTemplateAnalytics(templateId, userId);
  }

  /**
   * Duplicate an existing template
   * @param templateId Source template identifier
   * @param newTemplateId New template identifier
   * @param userId Current user ID from JWT token
   * @returns Duplicated template data
   */
  @Post('templates/:templateId/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Duplicate email template',
    description: 'Create a copy of an existing template with a new identifier',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Source template identifier',
    example: 'welcome-email',
  })
  @ApiResponse({
    status: 201,
    description: 'Template duplicated successfully',
    type: TemplateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Source template not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Target template ID already exists',
  })
  async duplicateTemplate(
    @Param('templateId') templateId: string,
    @Body('newTemplateId') newTemplateId: string,
    @GetUser('id') userId: string,
  ): Promise<TemplateResponseDto> {
    return this.templateService.duplicateTemplate(templateId, newTemplateId, userId);
  }

  /**
   * Validate template syntax without saving
   * @param validateDto Template validation data
   * @returns Validation results
   */
  @Post('templates/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate template syntax',
    description: 'Validate Handlebars and MJML syntax without saving the template',
  })
  @ApiResponse({
    status: 200,
    description: 'Template validation completed',
    schema: {
      properties: {
        isValid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        securityScan: {
          type: 'object',
          properties: {
            isSecure: { type: 'boolean' },
            securityIssues: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  validateTemplate(
    @Body(ValidationPipe)
    validateDto: {
      handlebarsSource: string;
      subject: string;
      mjmlSource?: string;
    },
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    securityScan: {
      isSecure: boolean;
      securityIssues: string[];
    };
  } {
    return this.templateService.validateTemplate(validateDto);
  }
}
