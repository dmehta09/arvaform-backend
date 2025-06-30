import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationDigestType,
  NotificationFrequency,
  NotificationPriority,
  NotificationStatus,
  NotificationTemplateVariables,
  NotificationType,
} from '../types/notification.types';

/**
 * Notification Content DTOs
 */
export class NotificationEmailContentDto {
  @ApiProperty({ description: 'Email subject line' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({ description: 'HTML email content' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({ description: 'Plain text email content' })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({ description: 'Email template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;
}

export class NotificationInAppContentDto {
  @ApiPropertyOptional({ description: 'Notification icon' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Icon color hex code' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Icon color must be a valid hex color' })
  iconColor?: string;

  @ApiPropertyOptional({ description: 'Whether notification persists until dismissed' })
  @IsOptional()
  @IsBoolean()
  persistent?: boolean;

  @ApiPropertyOptional({ description: 'Whether notification includes action buttons' })
  @IsOptional()
  @IsBoolean()
  actionable?: boolean;
}

export class NotificationPushContentDto {
  @ApiPropertyOptional({ description: 'Badge number for push notification' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  badge?: number;

  @ApiPropertyOptional({ description: 'Sound file for push notification' })
  @IsOptional()
  @IsString()
  sound?: string;

  @ApiPropertyOptional({ description: 'Push notification category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Thread ID for grouping notifications' })
  @IsOptional()
  @IsString()
  threadId?: string;
}

export class NotificationWebhookContentDto {
  @ApiProperty({ description: 'Webhook payload data' })
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Custom headers for webhook request' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class NotificationContentDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Action URL for notification' })
  @IsOptional()
  @IsUrl()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Action button text' })
  @IsOptional()
  @IsString()
  actionText?: string;

  @ApiPropertyOptional({ description: 'Email-specific content' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationEmailContentDto)
  email?: NotificationEmailContentDto;

  @ApiPropertyOptional({ description: 'In-app notification specific content' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationInAppContentDto)
  inApp?: NotificationInAppContentDto;

  @ApiPropertyOptional({ description: 'Push notification specific content' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPushContentDto)
  push?: NotificationPushContentDto;

  @ApiPropertyOptional({ description: 'Webhook specific content' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationWebhookContentDto)
  webhook?: NotificationWebhookContentDto;
}

/**
 * Notification Context DTOs
 */
export class NotificationContextDto {
  @ApiProperty({
    description: 'Source type of the notification',
    enum: ['form', 'user', 'system', 'integration', 'analytics', 'security'],
  })
  @IsString()
  @IsIn(['form', 'user', 'system', 'integration', 'analytics', 'security'])
  sourceType: 'form' | 'user' | 'system' | 'integration' | 'analytics' | 'security';

  @ApiPropertyOptional({ description: 'Source entity ID' })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'User ID who triggered the notification' })
  @IsOptional()
  @IsMongoId()
  triggeredBy?: string;

  @ApiProperty({ description: 'When the notification was triggered' })
  @IsDate()
  @Type(() => Date)
  triggeredAt: Date;

  @ApiPropertyOptional({ description: 'Trigger event name' })
  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @ApiPropertyOptional({
    description: 'Target audience',
    enum: ['user', 'admin', 'system', 'public'],
  })
  @IsOptional()
  @IsIn(['user', 'admin', 'system', 'public'])
  audience?: 'user' | 'admin' | 'system' | 'public';

  @ApiPropertyOptional({ description: 'Audience filter criteria' })
  @IsOptional()
  @IsObject()
  audienceFilter?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Scheduled delivery time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledFor?: Date;

  @ApiPropertyOptional({ description: 'Timezone for scheduling' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ description: 'Notification tags for categorization' })
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  tags: string[];

  @ApiPropertyOptional({ description: 'Notification category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Notification group' })
  @IsOptional()
  @IsString()
  group?: string;
}

/**
 * Create Notification DTOs
 */
export class CreateNotificationDto {
  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Recipient user ID' })
  @IsMongoId()
  recipientId: string;

  @ApiPropertyOptional({ description: 'Recipient email address' })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiPropertyOptional({ description: 'Recipient display name' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiProperty({ description: 'Notification content', type: NotificationContentDto })
  @ValidateNested()
  @Type(() => NotificationContentDto)
  content: NotificationContentDto;

  @ApiPropertyOptional({ description: 'Template variables for dynamic content' })
  @IsOptional()
  @IsObject()
  templateVariables?: NotificationTemplateVariables;

  @ApiProperty({ description: 'Notification context', type: NotificationContextDto })
  @ValidateNested()
  @Type(() => NotificationContextDto)
  context: NotificationContextDto;

  @ApiProperty({
    description: 'Delivery channels',
    enum: NotificationChannel,
    isArray: true,
  })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  @ArrayNotEmpty()
  @ArrayUnique()
  channels: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'Notification priority',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Scheduled delivery time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date;

  @ApiPropertyOptional({ description: 'Notification expiration time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Related form ID' })
  @IsOptional()
  @IsMongoId()
  formId?: string;

  @ApiPropertyOptional({ description: 'Related submission ID' })
  @IsOptional()
  @IsMongoId()
  submissionId?: string;

  @ApiPropertyOptional({ description: 'Batch ID for grouped notifications' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Whether notification is part of a digest' })
  @IsOptional()
  @IsBoolean()
  isDigest?: boolean;

  @ApiPropertyOptional({ description: 'User consent for notification' })
  @IsOptional()
  @IsBoolean()
  userConsent?: boolean;

  @ApiPropertyOptional({ description: 'External system ID' })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ description: 'External system name' })
  @IsOptional()
  @IsString()
  externalSystem?: string;
}

/**
 * Update Notification DTO
 */
export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @ApiPropertyOptional({ description: 'Notification status', enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ description: 'Whether notification has been read' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readAt?: Date;

  @ApiPropertyOptional({ description: 'Whether notification is archived' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

/**
 * Bulk Notification DTOs
 */
export class BulkNotificationOptionsDto {
  @ApiProperty({ description: 'Batch size for processing', default: 100 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  batchSize: number = 100;

  @ApiProperty({ description: 'Delay between batches in milliseconds', default: 1000 })
  @IsNumber()
  @Min(0)
  delayBetweenBatches: number = 1000;

  @ApiProperty({ description: 'Maximum concurrent processing', default: 5 })
  @IsNumber()
  @Min(1)
  @Max(50)
  maxConcurrency: number = 5;

  @ApiProperty({ description: 'Failure threshold percentage', default: 10 })
  @IsNumber()
  @Min(0)
  @Max(100)
  failureThreshold: number = 10;

  @ApiProperty({ description: 'Whether to retry failed batches', default: true })
  @IsBoolean()
  retryFailedBatches: boolean = true;
}

export class CreateBulkNotificationDto {
  @ApiProperty({ description: 'Base notification data', type: CreateNotificationDto })
  @ValidateNested()
  @Type(() => CreateNotificationDto)
  baseNotification: Omit<CreateNotificationDto, 'recipientId' | 'recipientEmail' | 'recipientName'>;

  @ApiProperty({ description: 'List of recipient user IDs' })
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayNotEmpty()
  recipientIds: string[];

  @ApiPropertyOptional({ description: 'Bulk processing options' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BulkNotificationOptionsDto)
  options?: BulkNotificationOptionsDto;

  @ApiPropertyOptional({ description: 'Custom data per recipient' })
  @IsOptional()
  @IsObject()
  recipientData?: Record<string, Record<string, unknown>>;
}

/**
 * Notification Query DTOs
 */
export class NotificationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by recipient ID' })
  @IsOptional()
  @IsMongoId()
  recipientId?: string;

  @ApiPropertyOptional({ description: 'Filter by notification type', enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filter by status', enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    description: 'Filter by channels',
    enum: NotificationChannel,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({ description: 'Filter by source type' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Filter by source ID' })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'Filter by archived status' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Notification Preference DTOs
 */
export class QuietHoursDto {
  @ApiProperty({ description: 'Whether quiet hours are enabled' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Start time in HH:MM format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:MM format' })
  startTime: string;

  @ApiProperty({ description: 'End time in HH:MM format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:MM format' })
  endTime: string;

  @ApiProperty({ description: 'Timezone for quiet hours' })
  @IsString()
  timezone: string;
}

export class ChannelPreferenceDto {
  @ApiProperty({ description: 'Notification channel', enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Whether channel is enabled' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Notification frequency', enum: NotificationFrequency })
  @IsEnum(NotificationFrequency)
  frequency: NotificationFrequency;

  @ApiProperty({ description: 'Digest type', enum: NotificationDigestType })
  @IsEnum(NotificationDigestType)
  digestType: NotificationDigestType;

  @ApiPropertyOptional({ description: 'Channel-specific quiet hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @ApiPropertyOptional({ description: 'Custom channel settings' })
  @IsOptional()
  @IsObject()
  customSettings?: Record<string, unknown>;
}

export class TypePreferenceDto {
  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Whether type is enabled' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Allowed channels', enum: NotificationChannel, isArray: true })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  allowedChannels: NotificationChannel[];

  @ApiProperty({ description: 'Preferred channels', enum: NotificationChannel, isArray: true })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  preferredChannels: NotificationChannel[];

  @ApiPropertyOptional({ description: 'Type-specific frequency', enum: NotificationFrequency })
  @IsOptional()
  @IsEnum(NotificationFrequency)
  frequency?: NotificationFrequency;

  @ApiPropertyOptional({ description: 'Type-specific digest type', enum: NotificationDigestType })
  @IsOptional()
  @IsEnum(NotificationDigestType)
  digestType?: NotificationDigestType;
}

export class UpdateNotificationPreferenceDto {
  @ApiPropertyOptional({ description: 'Global notification toggle' })
  @IsOptional()
  @IsBoolean()
  globalEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Default channels',
    enum: NotificationChannel,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  defaultChannels?: NotificationChannel[];

  @ApiPropertyOptional({ description: 'Default frequency', enum: NotificationFrequency })
  @IsOptional()
  @IsEnum(NotificationFrequency)
  defaultFrequency?: NotificationFrequency;

  @ApiPropertyOptional({ description: 'Default digest type', enum: NotificationDigestType })
  @IsOptional()
  @IsEnum(NotificationDigestType)
  defaultDigestType?: NotificationDigestType;

  @ApiPropertyOptional({ description: 'Channel preferences' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelPreferenceDto)
  channelPreferences?: ChannelPreferenceDto[];

  @ApiPropertyOptional({ description: 'Type preferences' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TypePreferenceDto)
  typePreferences?: TypePreferenceDto[];

  @ApiPropertyOptional({ description: 'Global quiet hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  globalQuietHours?: QuietHoursDto;

  @ApiPropertyOptional({ description: 'Email enabled' })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Push notifications enabled' })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'In-app notifications enabled' })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Webhook notifications enabled' })
  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Webhook URL' })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({ description: 'Push token for mobile notifications' })
  @IsOptional()
  @IsString()
  pushToken?: string;

  @ApiPropertyOptional({ description: 'Language preference' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Timezone preference' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Marketing consent' })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}

/**
 * Response DTOs
 */
export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ description: 'Notification status', enum: NotificationStatus })
  status: NotificationStatus;

  @ApiProperty({ description: 'Notification priority', enum: NotificationPriority })
  priority: NotificationPriority;

  @ApiProperty({ description: 'Recipient user ID' })
  recipientId: string;

  @ApiPropertyOptional({ description: 'Recipient email' })
  recipientEmail?: string;

  @ApiPropertyOptional({ description: 'Recipient name' })
  recipientName?: string;

  @ApiProperty({ description: 'Notification content' })
  content: NotificationContentDto;

  @ApiProperty({ description: 'Delivery channels', enum: NotificationChannel, isArray: true })
  channels: NotificationChannel[];

  @ApiProperty({
    description: 'Successfully delivered channels',
    enum: NotificationChannel,
    isArray: true,
  })
  deliveredChannels: NotificationChannel[];

  @ApiProperty({
    description: 'Failed delivery channels',
    enum: NotificationChannel,
    isArray: true,
  })
  failedChannels: NotificationChannel[];

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Scheduled delivery time' })
  scheduledAt?: Date;

  @ApiPropertyOptional({ description: 'Processing start time' })
  processedAt?: Date;

  @ApiPropertyOptional({ description: 'Delivery completion time' })
  deliveredAt?: Date;

  @ApiPropertyOptional({ description: 'Read timestamp' })
  readAt?: Date;

  @ApiPropertyOptional({ description: 'Expiration time' })
  expiresAt?: Date;

  @ApiProperty({ description: 'Number of delivery attempts' })
  attemptCount: number;

  @ApiProperty({ description: 'Maximum allowed attempts' })
  maxAttempts: number;

  @ApiPropertyOptional({ description: 'Next retry timestamp' })
  nextRetryAt?: Date;

  @ApiPropertyOptional({ description: 'Last error message' })
  lastErrorMessage?: string;

  @ApiProperty({ description: 'Whether notification is read' })
  isRead: boolean;

  @ApiProperty({ description: 'Whether notification is delivered' })
  isDelivered: boolean;

  @ApiProperty({ description: 'Delivery success rate percentage' })
  deliveryRate: number;
}

export class NotificationListResponseDto {
  @ApiProperty({ description: 'List of notifications', type: [NotificationResponseDto] })
  notifications: NotificationResponseDto[];

  @ApiProperty({ description: 'Total number of notifications' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}

export class NotificationStatsResponseDto {
  @ApiProperty({ description: 'Total notifications sent' })
  totalSent: number;

  @ApiProperty({ description: 'Total notifications delivered' })
  totalDelivered: number;

  @ApiProperty({ description: 'Total notifications read' })
  totalRead: number;

  @ApiProperty({ description: 'Total notifications clicked' })
  totalClicked: number;

  @ApiProperty({ description: 'Overall delivery rate percentage' })
  deliveryRate: number;

  @ApiProperty({ description: 'Overall read rate percentage' })
  readRate: number;

  @ApiProperty({ description: 'Overall click rate percentage' })
  clickRate: number;

  @ApiProperty({ description: 'Statistics by channel' })
  byChannel: Record<
    NotificationChannel,
    {
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    }
  >;

  @ApiProperty({ description: 'Statistics by notification type' })
  byType: Record<
    NotificationType,
    {
      sent: number;
      avgDeliveryTime: number;
      avgReadTime: number;
    }
  >;
}
