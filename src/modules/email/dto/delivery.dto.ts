import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { EmailDeliveryPriority, EmailDeliveryStatus } from '../entities/email-delivery.entity';

/**
 * Create Email Delivery DTO
 * Data transfer object for creating new email delivery records
 */
export class CreateEmailDeliveryDto {
  @ApiPropertyOptional({
    description: 'User ID who owns this delivery',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'recipient@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  recipientEmail: string;

  @ApiPropertyOptional({
    description: 'Recipient display name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiProperty({
    description: 'Email subject line',
    example: 'Welcome to Our Platform',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'Sender email address',
    example: 'noreply@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  senderEmail: string;

  @ApiPropertyOptional({
    description: 'Sender display name',
    example: 'Our Platform Team',
  })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({
    description: 'HTML email content',
  })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({
    description: 'Plain text email content',
  })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({
    description: 'Template ID for template-based emails',
    example: 'welcome-email',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Template variables for dynamic content',
    additionalProperties: true,
    example: { userName: 'John', formName: 'Contact Form' },
  })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Email delivery priority',
    enum: EmailDeliveryPriority,
    default: EmailDeliveryPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(EmailDeliveryPriority)
  priority?: EmailDeliveryPriority;

  @ApiPropertyOptional({
    description: 'Maximum number of delivery attempts',
    example: 3,
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Scheduled delivery time (for delayed sending)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date;

  @ApiPropertyOptional({
    description: 'Form ID associated with this email',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({
    description: 'Submission ID that triggered this email',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional({
    description: 'Email category for organization',
    example: 'form-notification',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Custom tags for email categorization',
    example: ['urgent', 'marketing'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Custom webhook headers',
    additionalProperties: true,
    example: { 'X-Custom-Header': 'value' },
  })
  @IsOptional()
  @IsObject()
  webhookHeaders?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Webhook URL for delivery notifications',
    example: 'https://api.example.com/webhooks/email-delivery',
  })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiPropertyOptional({
    description: 'Batch ID for grouping related emails',
    example: 'batch-2025-01-15-001',
  })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({
    description: 'Bulk email operation ID for tracking',
    example: 'bulk-newsletter-2025-01-15',
  })
  @IsOptional()
  @IsString()
  bulkEmailId?: string;
}

/**
 * Bulk Email Creation DTO
 * For creating multiple email deliveries at once
 */
export class CreateBulkEmailDeliveryDto {
  @ApiProperty({
    description: 'Array of email delivery configurations',
    type: [CreateEmailDeliveryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEmailDeliveryDto)
  emails: CreateEmailDeliveryDto[];

  @ApiPropertyOptional({
    description: 'Bulk operation identifier',
    example: 'bulk-newsletter-2025-01-15',
  })
  @IsOptional()
  @IsString()
  bulkEmailId?: string;

  @ApiPropertyOptional({
    description: 'Batch ID for the entire bulk operation',
    example: 'batch-2025-01-15-001',
  })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({
    description: 'Priority for all emails in the bulk operation',
    enum: EmailDeliveryPriority,
    default: EmailDeliveryPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(EmailDeliveryPriority)
  priority?: EmailDeliveryPriority;
}

/**
 * Email Delivery Query DTO
 * For filtering and searching email deliveries
 */
export class EmailDeliveryQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by delivery status',
    enum: EmailDeliveryStatus,
  })
  @IsOptional()
  @IsEnum(EmailDeliveryStatus)
  status?: EmailDeliveryStatus;

  @ApiPropertyOptional({
    description: 'Filter by delivery priority',
    enum: EmailDeliveryPriority,
  })
  @IsOptional()
  @IsEnum(EmailDeliveryPriority)
  priority?: EmailDeliveryPriority;

  @ApiPropertyOptional({
    description: 'Filter by recipient email (partial match)',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by form ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'form-notification',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by end date',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by provider ID',
    example: 'sendgrid',
  })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by scheduled date (start)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter by scheduled date (end)',
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledBefore?: Date;

  @ApiPropertyOptional({
    description: 'Filter by tags',
    example: ['urgent', 'marketing'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

/**
 * Update Email Delivery Status DTO
 * For updating delivery status and tracking information
 */
export class UpdateEmailDeliveryStatusDto {
  @ApiProperty({
    description: 'New delivery status',
    enum: EmailDeliveryStatus,
  })
  @IsEnum(EmailDeliveryStatus)
  status: EmailDeliveryStatus;

  @ApiPropertyOptional({
    description: 'Error message if delivery failed',
  })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({
    description: 'Provider message ID',
    example: 'msg_123456789',
  })
  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @ApiPropertyOptional({
    description: 'Provider response metadata',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  providerResponse?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Email provider identifier',
    example: 'sendgrid',
  })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({
    description: 'Error code if delivery failed',
    example: 'SMTP_ERROR',
  })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional({
    description: 'HTTP response code from provider',
    example: 200,
  })
  @IsOptional()
  @IsNumber()
  responseCode?: number;

  @ApiPropertyOptional({
    description: 'Processing duration in milliseconds',
    example: 1250,
  })
  @IsOptional()
  @IsNumber()
  duration?: number;
}

/**
 * Email Analytics Update DTO
 * For tracking email engagement metrics
 */
export class UpdateEmailAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Email was opened',
  })
  @IsOptional()
  @IsBoolean()
  opened?: boolean;

  @ApiPropertyOptional({
    description: 'Email was clicked',
  })
  @IsOptional()
  @IsBoolean()
  clicked?: boolean;

  @ApiPropertyOptional({
    description: 'Clicked URLs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clickedUrls?: string[];

  @ApiPropertyOptional({
    description: 'User agent string',
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'IP address',
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Geographic location',
  })
  @IsOptional()
  @IsString()
  location?: string;
}

/**
 * Email Delivery Response DTO
 * Response format for email delivery operations
 */
export class EmailDeliveryResponseDto {
  @ApiProperty({
    description: 'Email delivery ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'recipient@example.com',
  })
  recipientEmail: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Welcome to Our Platform',
  })
  subject: string;

  @ApiProperty({
    description: 'Current delivery status',
    enum: EmailDeliveryStatus,
  })
  status: EmailDeliveryStatus;

  @ApiProperty({
    description: 'Delivery priority',
    enum: EmailDeliveryPriority,
  })
  priority: EmailDeliveryPriority;

  @ApiPropertyOptional({
    description: 'Scheduled delivery time',
  })
  scheduledAt?: Date;

  @ApiPropertyOptional({
    description: 'Processing start time',
  })
  processedAt?: Date;

  @ApiPropertyOptional({
    description: 'Successful delivery time',
  })
  deliveredAt?: Date;

  @ApiProperty({
    description: 'Number of delivery attempts',
    example: 1,
  })
  attemptCount: number;

  @ApiProperty({
    description: 'Maximum allowed attempts',
    example: 3,
  })
  maxAttempts: number;

  @ApiPropertyOptional({
    description: 'Next retry time if applicable',
  })
  nextRetryAt?: Date;

  @ApiPropertyOptional({
    description: 'Email provider identifier',
    example: 'sendgrid',
  })
  providerId?: string;

  @ApiPropertyOptional({
    description: 'Provider message ID',
    example: 'msg_123456789',
  })
  providerMessageId?: string;

  @ApiPropertyOptional({
    description: 'Last error message',
  })
  lastErrorMessage?: string;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

/**
 * Email Delivery Statistics DTO
 * Analytics and performance metrics
 */
export class EmailDeliveryStatsDto {
  @ApiProperty({
    description: 'Total number of emails processed',
    example: 1250,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of emails (alias for total)',
    example: 1250,
  })
  totalEmails: number;

  @ApiProperty({
    description: 'Number of successfully delivered emails',
    example: 1180,
  })
  delivered: number;

  @ApiProperty({
    description: 'Number of failed deliveries',
    example: 45,
  })
  failed: number;

  @ApiProperty({
    description: 'Number of emails currently being processed',
    example: 15,
  })
  processing: number;

  @ApiProperty({
    description: 'Number of emails queued for delivery',
    example: 10,
  })
  queued: number;

  @ApiProperty({
    description: 'Number of bounced emails',
    example: 8,
  })
  bounced: number;

  @ApiProperty({
    description: 'Number of opened emails',
    example: 890,
  })
  opened: number;

  @ApiProperty({
    description: 'Number of clicked emails',
    example: 234,
  })
  clicked: number;

  @ApiProperty({
    description: 'Success rate percentage',
    example: 94.4,
  })
  successRate: number;

  @ApiProperty({
    description: 'Open rate percentage',
    example: 75.4,
  })
  openRate: number;

  @ApiProperty({
    description: 'Click rate percentage',
    example: 26.3,
  })
  clickRate: number;

  @ApiPropertyOptional({
    description: 'Average delivery time in milliseconds',
    example: 2340,
  })
  avgDeliveryTime?: number;

  @ApiProperty({
    description: 'Statistics time period start',
  })
  periodStart: Date;

  @ApiProperty({
    description: 'Statistics time period end',
  })
  periodEnd: Date;
}
