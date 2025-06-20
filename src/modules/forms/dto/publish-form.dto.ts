import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * DTO for sharing and access control configuration
 */
export class PublishSharingDto {
  @ApiProperty({
    description: 'Allow public access to the form',
    default: true,
  })
  @IsBoolean()
  allowPublicAccess: boolean = true;

  @ApiPropertyOptional({
    description: 'Require users to be logged in to submit',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requireLogin?: boolean = false;

  @ApiPropertyOptional({
    description: 'Form expiration date (ISO string)',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

/**
 * DTO for embed code configuration
 */
export class PublishEmbedDto {
  @ApiPropertyOptional({
    description: 'JavaScript embed script',
    example: '<script src="https://forms.arva.app/embed/form-123.js" async></script>',
  })
  @IsOptional()
  @IsString()
  script?: string;

  @ApiPropertyOptional({
    description: 'IFrame embed code',
    example: '<iframe src="https://forms.arva.app/f/my-form" width="100%" height="600"></iframe>',
  })
  @IsOptional()
  @IsString()
  iframe?: string;

  @ApiPropertyOptional({
    description: 'WordPress shortcode',
    example: '[arvaform id="form-123" slug="my-form"]',
  })
  @IsOptional()
  @IsString()
  wordpress?: string;
}

/**
 * DTO for publishing a form with access controls
 */
export class PublishFormDto {
  @ApiProperty({
    description: 'Whether the form should be published',
    default: true,
  })
  @IsBoolean()
  isPublished: boolean = true;

  @ApiPropertyOptional({
    description: 'Custom public URL slug for the form',
    example: 'customer-feedback-2025',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) =>
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-'),
  )
  customSlug?: string;

  @ApiPropertyOptional({
    description: 'Sharing and access control settings',
    type: PublishSharingDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublishSharingDto)
  sharing?: PublishSharingDto;

  @ApiPropertyOptional({
    description: 'SEO meta title for the form page',
    example: 'Customer Feedback Form | ArvaForm',
  })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description for the form page',
    example: 'Share your feedback with us through this easy-to-use form.',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Allowed domains for CORS (for embed functionality)',
    example: ['https://example.com', 'https://www.example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];
}

/**
 * DTO for form publishing response
 */
export class PublishResponseDto {
  @ApiProperty({
    description: 'Success or error message',
    example: 'Form published successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Public URL of the published form',
    example: 'https://forms.arva.app/f/customer-feedback-2025',
  })
  publicUrl: string;

  @ApiProperty({
    description: 'Form slug used in the URL',
    example: 'customer-feedback-2025',
  })
  slug: string;

  @ApiProperty({
    description: 'Whether the form is currently published',
    example: true,
  })
  isPublished: boolean;

  @ApiProperty({
    description: 'Publication timestamp (ISO string)',
    example: '2025-06-14T10:30:00.000Z',
  })
  publishedAt: string;

  @ApiPropertyOptional({
    description: 'Generated embed codes',
    type: PublishEmbedDto,
  })
  embedCode?: PublishEmbedDto;
}

/**
 * DTO for updating form publishing settings
 */
export class UpdatePublishSettingsDto {
  @ApiPropertyOptional({
    description: 'Update sharing and access control settings',
    type: PublishSharingDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublishSharingDto)
  sharing?: PublishSharingDto;

  @ApiPropertyOptional({
    description: 'Update custom slug',
    example: 'new-feedback-form-2025',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) =>
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-'),
  )
  customSlug?: string;

  @ApiPropertyOptional({
    description: 'Update allowed domains for CORS',
    example: ['https://newdomain.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @ApiPropertyOptional({
    description: 'Update SEO meta title',
    example: 'Updated Customer Feedback Form',
  })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'Update SEO meta description',
    example: 'Updated description for better SEO.',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}
