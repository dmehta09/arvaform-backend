import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Response DTO for form element
 */
export class FormElementResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the form element',
    example: 'text-input-1',
  })
  id: string;

  @ApiProperty({
    description: 'Type of form element',
    example: 'text',
  })
  type: string;

  @ApiProperty({
    description: 'Label for the form element',
    example: 'Your Name',
  })
  label: string;

  @ApiPropertyOptional({
    description: 'Placeholder text for the element',
    example: 'Enter your full name',
  })
  placeholder?: string;

  @ApiPropertyOptional({
    description: 'Help text for the element',
    example: 'Please enter your legal name as it appears on your ID',
  })
  helpText?: string;

  @ApiProperty({
    description: 'Whether the element is required',
    example: true,
  })
  required: boolean;

  @ApiPropertyOptional({
    description: 'Validation rules for the element',
    example: { min: 2, max: 50 },
  })
  validation?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Properties specific to the element type',
    example: { allowMultiple: false },
  })
  properties?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Styling configuration for the element',
    example: { width: '100%', margin: '10px' },
  })
  styles?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Options for select, radio, or checkbox elements',
    example: ['Option 1', 'Option 2', 'Option 3'],
  })
  options?: string[];

  @ApiProperty({
    description: 'Display order of the element',
    example: 1,
  })
  order: number;

  @ApiPropertyOptional({
    description: 'Parent element ID for nested elements',
    example: 'fieldset-1',
  })
  parentId?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-14T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-14T15:45:00Z',
  })
  updatedAt: Date;
}

/**
 * Response DTO for form page
 */
export class FormPageResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the page',
    example: 'page-1',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the page',
    example: 'Personal Information',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the page',
    example: 'Please provide your personal details',
  })
  description?: string;

  @ApiProperty({
    description: 'Array of element IDs on this page',
    example: ['text-input-1', 'email-input-1'],
  })
  elements: string[];

  @ApiProperty({
    description: 'Navigation configuration for the page',
    example: {
      nextButton: { text: 'Next', style: 'primary' },
      backButton: { text: 'Back', style: 'secondary' },
    },
  })
  navigation: {
    nextButton: {
      text: string;
      style?: string;
    };
    backButton: {
      text: string;
      style?: string;
    };
  };
}

/**
 * Response DTO for form condition
 */
export class FormConditionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the condition',
    example: 'condition-1',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the condition',
    example: 'Show additional fields if email is provided',
  })
  name: string;

  @ApiProperty({
    description: 'Trigger configuration for the condition',
    example: {
      elementId: 'email-input-1',
      operator: 'is_not_empty',
      value: null,
    },
  })
  trigger: {
    elementId: string;
    operator: string;
    value: unknown;
  };

  @ApiProperty({
    description: 'Actions to execute when condition is met',
    example: [
      {
        type: 'show',
        targetId: 'phone-input-1',
      },
    ],
  })
  actions: {
    type: string;
    targetId: string;
    value?: unknown;
  }[];

  @ApiProperty({
    description: 'Whether the condition is active',
    example: true,
  })
  isActive: boolean;
}

/**
 * Response DTO for form collaborator
 */
export class FormCollaboratorResponseDto {
  @ApiProperty({
    description: 'User ID of the collaborator',
    example: '507f1f77bcf86cd799439011',
  })
  userId: string;

  @ApiProperty({
    description: 'Role of the collaborator',
    example: 'editor',
  })
  role: 'editor' | 'viewer';

  @ApiProperty({
    description: 'When the collaborator was added',
    example: '2025-01-14T10:30:00Z',
  })
  addedAt: Date;

  @ApiPropertyOptional({
    description: 'When the collaboration expires',
    example: '2025-02-14T10:30:00Z',
  })
  expiresAt?: Date;
}

/**
 * Response DTO for form settings
 */
export class FormSettingsResponseDto {
  @ApiProperty({
    description: 'Encryption configuration',
    example: { enabled: false },
  })
  encryption: {
    enabled: boolean;
    algorithm?: string;
  };

  @ApiProperty({
    description: 'Form layout type',
    example: 'classic',
  })
  layout: 'classic' | 'card';

  @ApiPropertyOptional({
    description: 'Theme configuration',
    example: { themeId: '507f1f77bcf86cd799439011' },
  })
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
 * Response DTO for post-submission configuration
 */
export class PostSubmissionConfigResponseDto {
  @ApiProperty({
    description: 'Thank you page configuration',
    example: { type: 'default' },
  })
  thankYouPage: {
    type: 'default' | 'custom' | 'redirect';
    content?: string;
    redirectUrl?: string;
  };

  @ApiProperty({
    description: 'Email configuration',
    example: {
      notifications: { enabled: false, recipients: [] },
      autoresponder: { enabled: false },
    },
  })
  emails: {
    notifications: {
      enabled: boolean;
      recipients: string[];
      template: string;
      subject: string;
    };
    autoresponder: {
      enabled: boolean;
      template: string;
      subject: string;
      fromEmail: string;
      fromName: string;
    };
  };
}

/**
 * Response DTO for form integration
 */
export class FormIntegrationResponseDto {
  @ApiProperty({
    description: 'Type of integration',
    example: 'webhook',
  })
  type: 'webhook' | 'email' | 'google_sheets' | 'salesforce' | 'mailchimp' | 'slack';

  @ApiProperty({
    description: 'Integration configuration',
    example: { url: 'https://api.example.com/webhook' },
  })
  config: Record<string, unknown>;

  @ApiProperty({
    description: 'Whether the integration is active',
    example: true,
  })
  isActive: boolean;
}

/**
 * Response DTO for form publishing configuration
 */
export class FormPublishingConfigResponseDto {
  @ApiProperty({
    description: 'Whether the form is published',
    example: true,
  })
  isPublished: boolean;

  @ApiPropertyOptional({
    description: 'Public URL for the form',
    example: 'https://forms.arvaform.com/contact-us-form',
  })
  publicUrl?: string;

  @ApiPropertyOptional({
    description: 'Embed codes for the form',
    example: {
      script: '<script src="..."></script>',
      iframe: '<iframe src="..."></iframe>',
      wordpress: '[arvaform id="..."]',
    },
  })
  embedCode?: {
    script: string;
    iframe: string;
    wordpress: string;
  };

  @ApiProperty({
    description: 'Sharing configuration',
    example: {
      allowPublicAccess: true,
      requireLogin: false,
    },
  })
  sharing: {
    allowPublicAccess: boolean;
    requireLogin: boolean;
    expiresAt?: Date;
  };
}

/**
 * Response DTO for form analytics
 */
export class FormAnalyticsResponseDto {
  @ApiProperty({
    description: 'Number of form views',
    example: 1234,
  })
  views: number;

  @ApiProperty({
    description: 'Number of form submissions',
    example: 89,
  })
  submissions: number;

  @ApiProperty({
    description: 'Conversion rate percentage',
    example: 7.2,
  })
  conversionRate: number;

  @ApiPropertyOptional({
    description: 'Timestamp of last submission',
    example: '2025-01-14T15:45:00Z',
  })
  lastSubmissionAt?: Date;
}

/**
 * Main response DTO for form
 */
export class FormResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the form',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Title of the form',
    example: 'Contact Us Form',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the form',
    example: 'Please fill out this form to get in touch with us',
  })
  description?: string;

  @ApiProperty({
    description: 'URL-friendly slug for the form',
    example: 'contact-us-form',
  })
  slug: string;

  @ApiProperty({
    description: 'Status of the form',
    example: 'published',
  })
  status: 'draft' | 'published' | 'archived' | 'disabled';

  @ApiProperty({
    description: 'User ID of the form owner',
    example: '507f1f77bcf86cd799439011',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Organization ID (if form belongs to an organization)',
    example: '507f1f77bcf86cd799439011',
  })
  organizationId?: string;

  @ApiProperty({
    description: 'Form collaborators',
    type: [FormCollaboratorResponseDto],
  })
  @Type(() => FormCollaboratorResponseDto)
  collaborators: FormCollaboratorResponseDto[];

  @ApiProperty({
    description: 'Form settings and configuration',
    type: FormSettingsResponseDto,
  })
  @Type(() => FormSettingsResponseDto)
  settings: FormSettingsResponseDto;

  @ApiProperty({
    description: 'Array of form elements',
    type: [FormElementResponseDto],
  })
  @Type(() => FormElementResponseDto)
  elements: FormElementResponseDto[];

  @ApiProperty({
    description: 'Array of form pages',
    type: [FormPageResponseDto],
  })
  @Type(() => FormPageResponseDto)
  pages: FormPageResponseDto[];

  @ApiProperty({
    description: 'Array of form conditions',
    type: [FormConditionResponseDto],
  })
  @Type(() => FormConditionResponseDto)
  conditions: FormConditionResponseDto[];

  @ApiProperty({
    description: 'Post-submission configuration',
    type: PostSubmissionConfigResponseDto,
  })
  @Type(() => PostSubmissionConfigResponseDto)
  postSubmission: PostSubmissionConfigResponseDto;

  @ApiProperty({
    description: 'Form integrations',
    type: [FormIntegrationResponseDto],
  })
  @Type(() => FormIntegrationResponseDto)
  integrations: FormIntegrationResponseDto[];

  @ApiProperty({
    description: 'Publishing configuration',
    type: FormPublishingConfigResponseDto,
  })
  @Type(() => FormPublishingConfigResponseDto)
  publishing: FormPublishingConfigResponseDto;

  @ApiProperty({
    description: 'Form analytics',
    type: FormAnalyticsResponseDto,
  })
  @Type(() => FormAnalyticsResponseDto)
  analytics: FormAnalyticsResponseDto;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-14T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-14T15:45:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Soft delete timestamp',
    example: '2025-01-14T20:00:00Z',
  })
  deletedAt?: Date;

  @ApiPropertyOptional({
    description: 'ID of user who deleted the form',
    example: '507f1f77bcf86cd799439011',
  })
  deletedBy?: string;

  @ApiPropertyOptional({
    description: 'Public URL for the form (virtual field)',
    example: '/forms/contact-us-form',
  })
  publicUrl?: string;
}
