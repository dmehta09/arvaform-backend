import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * DTO for creating a form element
 */
export class CreateFormElementDto {
  @ApiProperty({
    description: 'Unique identifier for the form element',
    example: 'text-input-1',
  })
  @IsString()
  @MinLength(1)
  id: string;

  @ApiProperty({
    description: 'Type of form element',
    enum: [
      'text',
      'email',
      'number',
      'textarea',
      'select',
      'checkbox',
      'radio',
      'file',
      'date',
      'address',
      'payment',
      'signature',
      'widget',
      'heading',
      'paragraph',
      'page_break',
    ],
    example: 'text',
  })
  @IsEnum([
    'text',
    'email',
    'number',
    'textarea',
    'select',
    'checkbox',
    'radio',
    'file',
    'date',
    'address',
    'payment',
    'signature',
    'widget',
    'heading',
    'paragraph',
    'page_break',
  ])
  type: string;

  @ApiProperty({
    description: 'Label for the form element',
    example: 'Your Name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label: string;

  @ApiPropertyOptional({
    description: 'Placeholder text for the element',
    example: 'Enter your full name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeholder?: string;

  @ApiPropertyOptional({
    description: 'Help text for the element',
    example: 'Please enter your legal name as it appears on your ID',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @ApiPropertyOptional({
    description: 'Whether the element is required',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    description: 'Validation rules for the element',
    example: { min: 2, max: 50 },
  })
  @IsOptional()
  validation?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Properties specific to the element type',
    example: { allowMultiple: false },
  })
  @IsOptional()
  properties?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Styling configuration for the element',
    example: { width: '100%', margin: '10px' },
  })
  @IsOptional()
  styles?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Options for select, radio, or checkbox elements',
    example: ['Option 1', 'Option 2', 'Option 3'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({
    description: 'Display order of the element',
    example: 1,
    default: 0,
  })
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    description: 'Parent element ID for nested elements',
    example: 'fieldset-1',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}

/**
 * DTO for creating form page configuration
 */
export class CreateFormPageDto {
  @ApiProperty({
    description: 'Unique identifier for the page',
    example: 'page-1',
  })
  @IsString()
  @MinLength(1)
  id: string;

  @ApiProperty({
    description: 'Title of the page',
    example: 'Personal Information',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the page',
    example: 'Please provide your personal details',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Array of element IDs on this page',
    example: ['text-input-1', 'email-input-1'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  elements?: string[];
}

/**
 * DTO for creating form settings
 */
export class CreateFormSettingsDto {
  @ApiPropertyOptional({
    description: 'Form layout type',
    enum: ['classic', 'card'],
    example: 'classic',
    default: 'classic',
  })
  @IsOptional()
  @IsEnum(['classic', 'card'])
  layout?: 'classic' | 'card';

  @ApiPropertyOptional({
    description: 'Encryption settings',
    example: { enabled: false },
  })
  @IsOptional()
  encryption?: {
    enabled: boolean;
    algorithm?: string;
  };

  @ApiPropertyOptional({
    description: 'Theme configuration',
    example: { themeId: '507f1f77bcf86cd799439011' },
  })
  @IsOptional()
  theme?: {
    themeId?: string;
    customStyles?: {
      css: string;
      variables: Record<string, string>;
    };
  };

  @ApiPropertyOptional({
    description: 'Branding configuration',
    example: {
      logo: { url: 'https://example.com/logo.png', alt: 'Company Logo' },
      colors: { primary: '#007bff', secondary: '#6c757d' },
    },
  })
  @IsOptional()
  branding?: {
    logo?: {
      url: string;
      alt: string;
      width?: number;
      height?: number;
    };
    colors?: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

/**
 * Main DTO for creating a form
 */
export class CreateFormDto {
  @ApiProperty({
    description: 'Title of the form',
    example: 'Contact Us Form',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the form',
    example: 'Please fill out this form to get in touch with us',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'URL-friendly slug for the form (lowercase, hyphen-separated)',
    example: 'contact-us-form',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase and contain only letters, numbers, and hyphens',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Status of the form',
    enum: ['draft', 'published', 'archived', 'disabled'],
    example: 'draft',
    default: 'draft',
  })
  @IsOptional()
  @IsEnum(['draft', 'published', 'archived', 'disabled'])
  status?: 'draft' | 'published' | 'archived' | 'disabled';

  @ApiPropertyOptional({
    description: 'Organization ID (if form belongs to an organization)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Form settings and configuration',
    type: CreateFormSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFormSettingsDto)
  settings?: CreateFormSettingsDto;

  @ApiPropertyOptional({
    description: 'Array of form elements',
    type: [CreateFormElementDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormElementDto)
  elements?: CreateFormElementDto[];

  @ApiPropertyOptional({
    description: 'Array of form pages for multi-page forms',
    type: [CreateFormPageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormPageDto)
  pages?: CreateFormPageDto[];
}
