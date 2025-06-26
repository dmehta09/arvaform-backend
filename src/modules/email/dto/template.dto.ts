import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TemplateVariable } from '../entities/email-template.entity';

/**
 * Template Variable DTO
 * Validates template variable definitions for security and type safety
 */
export class TemplateVariableDto {
  @ApiProperty({
    description: 'Variable name (alphanumeric, underscores, hyphens only)',
    example: 'user_name',
    pattern: '^[a-zA-Z][a-zA-Z0-9_-]*$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_-]*$/, {
    message:
      'Variable name must start with letter and contain only letters, numbers, underscores, and hyphens',
  })
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Variable data type for validation',
    enum: ['string', 'number', 'boolean', 'date', 'array', 'object'],
    example: 'string',
  })
  @IsEnum(['string', 'number', 'boolean', 'date', 'array', 'object'])
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

  @ApiProperty({
    description: 'Human-readable description of the variable',
    example: "The user's display name",
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({
    description: 'Whether this variable is required for template rendering',
    example: true,
  })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({
    description: 'Default value if variable is not provided',
    example: 'Guest User',
  })
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any;

  @ApiPropertyOptional({
    description: 'Validation pattern for string variables (regex)',
    example: '^[A-Za-z\\s]+$',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pattern?: string;

  @ApiPropertyOptional({
    description: 'Allowed values for enum-like variables',
    example: ['active', 'inactive', 'pending'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enumValues?: string[];
}

/**
 * Create Email Template DTO
 * Validates data for creating new email templates
 */
export class CreateTemplateDto {
  @ApiProperty({
    description: 'Unique template identifier (URL-safe)',
    example: 'welcome-email',
    pattern: '^[a-z0-9-_]+$',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-_]+$/, {
    message: 'Template ID must contain only lowercase letters, numbers, hyphens, and underscores',
  })
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  templateId: string;

  @ApiProperty({
    description: 'Human-readable template name',
    example: 'Welcome Email Template',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the template',
    example: 'Welcome email sent to new users after registration',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: string }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Template category for organization',
    enum: [
      'form-submission',
      'welcome',
      'password-reset',
      'notification',
      'marketing',
      'transactional',
      'system',
      'custom',
    ],
    example: 'welcome',
  })
  @IsEnum([
    'form-submission',
    'welcome',
    'password-reset',
    'notification',
    'marketing',
    'transactional',
    'system',
    'custom',
  ])
  category: string;

  @ApiProperty({
    description: 'Email subject line (supports Handlebars variables)',
    example: 'Welcome to {{company_name}}, {{user_name}}!',
    maxLength: 300,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: string }) => value?.trim())
  subject: string;

  @ApiProperty({
    description: 'Handlebars template source code',
    example: '<h1>Welcome {{user_name}}!</h1><p>Thank you for joining {{company_name}}.</p>',
  })
  @IsString()
  @IsNotEmpty()
  handlebarsSource: string;

  @ApiPropertyOptional({
    description: 'MJML source for responsive email design',
    example:
      '<mjml><mj-body><mj-section><mj-column><mj-text>Welcome {{user_name}}!</mj-text></mj-column></mj-section></mj-body></mjml>',
  })
  @IsOptional()
  @IsString()
  mjmlSource?: string;

  @ApiPropertyOptional({
    description: 'Template variables for dynamic content',
    type: [TemplateVariableDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables?: TemplateVariableDto[];

  @ApiPropertyOptional({
    description: 'Template language for i18n support',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
    example: 'en',
    default: 'en',
  })
  @IsOptional()
  @IsEnum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'])
  language?: string;

  @ApiPropertyOptional({
    description: 'Template tags for categorization',
    example: ['welcome', 'user-onboarding', 'marketing'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Transform(({ value }: { value: string[] }) =>
    value?.map((tag: string) => tag.trim().toLowerCase()),
  )
  tags?: string[];
}

/**
 * Update Email Template DTO
 * Partial update for existing templates
 */
export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {
  @ApiPropertyOptional({
    description: 'Whether the template is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Template Rendering DTO
 * Validates data for rendering templates with variables
 */
export class RenderTemplateDto {
  @ApiProperty({
    description: 'Template identifier to render',
    example: 'welcome-email',
  })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({
    description: 'Variables to inject into the template',
    example: {
      user_name: 'John Doe',
      company_name: 'ArvaForm',
      activation_link: 'https://example.com/activate/abc123',
    },
  })
  @IsObject()
  variables: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    description: 'Language for template rendering (if multi-language)',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
    example: 'en',
  })
  @IsOptional()
  @IsEnum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'])
  language?: string;
}

/**
 * Send Template Email DTO
 * Validates data for sending emails using templates
 */
export class SendTemplateEmailDto extends RenderTemplateDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({
    description: 'Sender email address (overrides default)',
    example: 'noreply@arvaform.com',
  })
  @IsOptional()
  @IsEmail()
  from?: string;

  @ApiPropertyOptional({
    description: 'Additional email headers',
    example: { 'X-Campaign-ID': 'welcome-2024' },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Email priority (1=highest, 5=lowest)',
    example: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumberString()
  priority?: string;
}

/**
 * Template Query DTO
 * Validates query parameters for template search and filtering
 */
export class TemplateQueryDto {
  @ApiPropertyOptional({
    description: 'Template category filter',
    enum: [
      'form-submission',
      'welcome',
      'password-reset',
      'notification',
      'marketing',
      'transactional',
      'system',
      'custom',
    ],
  })
  @IsOptional()
  @IsEnum([
    'form-submission',
    'welcome',
    'password-reset',
    'notification',
    'marketing',
    'transactional',
    'system',
    'custom',
  ])
  category?: string;

  @ApiPropertyOptional({
    description: 'Template language filter',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
  })
  @IsOptional()
  @IsEnum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'])
  language?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search term for name and description',
    example: 'welcome',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated)',
    example: 'welcome,onboarding',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) =>
    value?.split(',').map((tag: string) => tag.trim().toLowerCase()),
  )
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Number of templates per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value) || 20)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of templates to skip',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value) || 0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'name', 'usage'],
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'updatedAt', 'name', 'usage'])
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/**
 * Template Response DTO
 * Response format for template API endpoints
 */
export class TemplateResponseDto {
  @ApiProperty({
    description: 'Template identifier',
    example: 'welcome-email',
  })
  templateId: string;

  @ApiProperty({
    description: 'Template name',
    example: 'Welcome Email Template',
  })
  name: string;

  @ApiProperty({
    description: 'Template description',
    example: 'Welcome email sent to new users',
  })
  description: string;

  @ApiProperty({
    description: 'Template category',
    example: 'welcome',
  })
  category: string;

  @ApiProperty({
    description: 'Template subject line',
    example: 'Welcome to {{company_name}}!',
  })
  subject: string;

  @ApiProperty({
    description: 'Template variables',
    type: [TemplateVariableDto],
  })
  variables: TemplateVariable[];

  @ApiProperty({
    description: 'Template language',
    example: 'en',
  })
  language: string;

  @ApiProperty({
    description: 'Template tags',
    example: ['welcome', 'onboarding'],
  })
  tags: string[];

  @ApiProperty({
    description: 'Whether template is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Current version',
    example: '1.0.0',
  })
  currentVersion: string;

  @ApiProperty({
    description: 'Template owner ID',
    example: '507f1f77bcf86cd799439011',
  })
  ownerId: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Template usage analytics',
  })
  analytics: {
    sendCount: number;
    successRate: number;
    openRate: number;
    clickRate: number;
  };
}

/**
 * Template Preview DTO
 * Response for template preview functionality
 */
export class TemplatePreviewDto {
  @ApiProperty({
    description: 'Rendered HTML content',
    example: '<h1>Welcome John Doe!</h1><p>Thank you for joining ArvaForm.</p>',
  })
  htmlContent: string;

  @ApiProperty({
    description: 'Rendered subject line',
    example: 'Welcome to ArvaForm, John Doe!',
  })
  subject: string;

  @ApiProperty({
    description: 'Variables used in rendering',
    example: { user_name: 'John Doe', company_name: 'ArvaForm' },
  })
  variables: Record<string, string | number | boolean>;

  @ApiProperty({
    description: 'Template metadata',
  })
  metadata: {
    templateId: string;
    version: string;
    language: string;
    renderedAt: Date;
  };
}
