import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  PublishRateLimit,
  PublishReadRateLimit,
  UnpublishRateLimit,
} from '../../common/decorators/publish-rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CreateFormDto } from './dto/create-form.dto';
import { FormQueryDto } from './dto/form-query.dto';
import { FormResponseDto } from './dto/form-response.dto';
import { PaginatedFormsDto } from './dto/paginated-forms.dto';
import {
  PublishFormDto,
  PublishResponseDto,
  PublishSharingDto,
  UpdatePublishSettingsDto,
} from './dto/publish-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormsService } from './forms.service';
import { FormOwnershipGuard } from './guards/form-ownership.guard';

/**
 * Controller for form management endpoints
 * Handles HTTP requests for form CRUD operations
 */
@ApiTags('forms')
@ApiBearerAuth()
@Controller('forms')
@UseGuards(JwtAuthGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  /**
   * Create a new form
   */
  @Post()
  @ApiOperation({ summary: 'Create a new form' })
  @ApiResponse({
    status: 201,
    description: 'Form created successfully',
    type: FormResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createFormDto: CreateFormDto,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<FormResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.create(createFormDto, userId);
  }

  /**
   * Get forms with advanced search, filtering, and pagination
   */
  @Get('search')
  @ApiOperation({
    summary: 'Get forms with advanced search, filtering, and pagination',
    description:
      'Retrieve forms with cursor-based pagination, text search, and filtering capabilities',
  })
  @ApiResponse({
    status: 200,
    description: 'Forms retrieved successfully with pagination metadata',
    type: PaginatedFormsDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findWithPagination(
    @Query() queryDto: FormQueryDto,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<PaginatedFormsDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.findWithPagination(userId, queryDto);
  }

  /**
   * Get all forms for the authenticated user
   */
  @Get()
  @ApiOperation({ summary: 'Get all forms for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Forms retrieved successfully',
    type: [FormResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll() // TODO: Replace with proper request typing once auth is implemented
  // @Req() req: AuthenticatedRequest
  : Promise<FormResponseDto[]> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.findAll(userId);
  }

  /**
   * Get a specific form by ID
   */
  @Get(':id')
  @UseGuards(FormOwnershipGuard)
  @ApiOperation({ summary: 'Get a specific form by ID' })
  @ApiResponse({
    status: 200,
    description: 'Form retrieved successfully',
    type: FormResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  async findOne(
    @Param('id') id: string,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<FormResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.findOne(id, userId);
  }

  /**
   * Update a form
   */
  @Patch(':id')
  @UseGuards(FormOwnershipGuard)
  @ApiOperation({ summary: 'Update a form' })
  @ApiResponse({
    status: 200,
    description: 'Form updated successfully',
    type: FormResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  async update(
    @Param('id') id: string,
    @Body() updateFormDto: UpdateFormDto,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<FormResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.update(id, updateFormDto, userId);
  }

  /**
   * Delete a form (soft delete)
   */
  @Delete(':id')
  @UseGuards(FormOwnershipGuard)
  @ApiOperation({ summary: 'Delete a form' })
  @ApiResponse({
    status: 200,
    description: 'Form deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  async remove(
    @Param('id') id: string,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<{ message: string }> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.remove(id, userId);
  }

  /**
   * Publish a form with access control settings
   */
  @Post(':id/publish')
  @UseGuards(FormOwnershipGuard)
  @PublishRateLimit()
  @ApiOperation({
    summary: 'Publish a form',
    description:
      'Publish a form with configurable access controls, sharing settings, and embed options',
  })
  @ApiResponse({
    status: 201,
    description: 'Form published successfully',
    type: PublishResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - form validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 429, description: 'Too many publishing attempts' })
  async publishForm(
    @Param('id') id: string,
    @Body() publishDto: PublishFormDto,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<PublishResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.updatePublishingSettings(id, publishDto, userId);
  }

  /**
   * Update form publishing settings
   */
  @Patch(':id/publish')
  @PublishRateLimit()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update form publishing settings',
    description: 'Update publishing configuration for a specific form',
  })
  @ApiParam({
    name: 'id',
    description: 'Form ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Publishing settings updated successfully',
    type: PublishResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Form not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  async updatePublishing(
    @Param('id') id: string,
    @Body() updateDto: UpdatePublishSettingsDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { id: string }).id;

    // Get current settings to merge with updates
    const existingSettings = await this.formsService.getPublishingSettings(id, userId);

    // Create full publish DTO by merging updates with existing settings
    const publishDto: PublishFormDto = {
      isPublished: existingSettings.isPublished as boolean,
      sharing: updateDto.sharing || (existingSettings.sharing as PublishSharingDto),
      customSlug: updateDto.customSlug,
      allowedDomains: updateDto.allowedDomains || (existingSettings.allowedDomains as string[]),
      metaTitle: updateDto.metaTitle || (existingSettings.metaTitle as string),
      metaDescription: updateDto.metaDescription || (existingSettings.metaDescription as string),
    };

    return this.formsService.updatePublishingSettings(id, publishDto, userId);
  }

  /**
   * Get form publishing status and settings
   */
  @Get(':id/publish')
  @UseGuards(FormOwnershipGuard)
  @PublishReadRateLimit()
  @ApiOperation({
    summary: 'Get form publishing settings',
    description: 'Retrieve current publishing status, settings, and generated URLs for a form',
  })
  @ApiResponse({
    status: 200,
    description: 'Publishing settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        isPublished: { type: 'boolean' },
        publicUrl: { type: 'string' },
        slug: { type: 'string' },
        sharing: {
          type: 'object',
          properties: {
            allowPublicAccess: { type: 'boolean' },
            requireLogin: { type: 'boolean' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        embedCode: {
          type: 'object',
          properties: {
            script: { type: 'string' },
            iframe: { type: 'string' },
            wordpress: { type: 'string' },
          },
        },
        metaTitle: { type: 'string' },
        metaDescription: { type: 'string' },
        allowedDomains: { type: 'array', items: { type: 'string' } },
        publishedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - no access to form' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 429, description: 'Too many requests for publishing settings' })
  async getPublishSettings(
    @Param('id') id: string,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ) {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.getPublishingSettings(id, userId);
  }

  /**
   * Unpublish a form
   */
  @Delete(':id/publish')
  @UseGuards(FormOwnershipGuard)
  @UnpublishRateLimit()
  @ApiOperation({
    summary: 'Unpublish a form',
    description: 'Unpublish a form, making it no longer accessible via public URL',
  })
  @ApiResponse({
    status: 200,
    description: 'Form unpublished successfully',
    type: FormResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 429, description: 'Too many unpublishing attempts' })
  async unpublishForm(
    @Param('id') id: string,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<FormResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.unpublishForm(id, userId);
  }
}
