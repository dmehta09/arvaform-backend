import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { WebhookDeliveryStatus } from '../entities/webhook-delivery.entity';
import { WebhookEventType, WebhookHttpMethod, WebhookStatus } from '../entities/webhook.entity';

/**
 * Webhook Configuration DTO
 */
export class WebhookConfigDto {
  @ApiPropertyOptional({
    description: 'Maximum delivery attempts',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds',
    example: 30000,
    minimum: 1000,
    maximum: 120000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;

  @ApiPropertyOptional({
    description: 'Retry delay in milliseconds',
    example: 1000,
    minimum: 100,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  retryDelayMs?: number;

  @ApiPropertyOptional({ description: 'Enable exponential backoff for retries' })
  @IsOptional()
  @IsBoolean()
  exponentialBackoff?: boolean;

  @ApiPropertyOptional({ description: 'Enable signature verification' })
  @IsOptional()
  @IsBoolean()
  verifySignature?: boolean;

  @ApiPropertyOptional({
    description: 'Content type for webhook payload',
    example: 'application/json',
  })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({
    description: 'Rate limit per minute',
    example: 60,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  rateLimitPerMinute?: number;

  @ApiPropertyOptional({ description: 'Enable batch processing' })
  @IsOptional()
  @IsBoolean()
  batchEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Batch size for batch processing',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  batchSize?: number;

  @ApiPropertyOptional({
    description: 'Batch timeout in seconds',
    example: 60,
    minimum: 5,
    maximum: 300,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(300)
  batchTimeoutSeconds?: number;
}

/**
 * Webhook Field Mapping DTO
 */
export class WebhookFieldMappingDto {
  @ApiProperty({ description: 'Source field path', example: 'submission.data.email' })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiProperty({ description: 'Target field name in webhook payload', example: 'customer_email' })
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiPropertyOptional({ description: 'Transform function to apply', example: 'lowercase' })
  @IsOptional()
  @IsString()
  @IsIn(['lowercase', 'uppercase', 'trim', 'hash', 'encrypt'])
  transform?: string;

  @ApiPropertyOptional({ description: 'Default value if source is empty' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ description: 'Whether this field is required' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/**
 * Webhook Filter DTO
 */
export class WebhookFilterDto {
  @ApiProperty({ description: 'Field path to check', example: 'submission.data.type' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({
    description: 'Operator for comparison',
    enum: [
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'greater_than',
      'less_than',
      'exists',
      'not_exists',
    ],
  })
  @IsEnum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'exists',
    'not_exists',
  ])
  operator: string;

  @ApiPropertyOptional({ description: 'Value to compare against' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ description: 'Case sensitive comparison' })
  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;
}

/**
 * Create Webhook DTO
 */
export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook name', example: 'Form Submission Webhook' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Webhook description',
    example: 'Notifies external system of new form submissions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Webhook URL endpoint',
    example: 'https://api.example.com/webhooks/forms',
  })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({
    description: 'HTTP method for webhook delivery',
    enum: WebhookHttpMethod,
    default: WebhookHttpMethod.POST,
  })
  @IsOptional()
  @IsEnum(WebhookHttpMethod)
  method?: WebhookHttpMethod;

  @ApiProperty({
    description: 'Webhook events to subscribe to',
    enum: WebhookEventType,
    isArray: true,
    example: [WebhookEventType.FORM_SUBMISSION, WebhookEventType.SUBMISSION_CREATED],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WebhookEventType, { each: true })
  events: WebhookEventType[];

  @ApiPropertyOptional({
    description: 'Custom headers for webhook requests',
    example: { Authorization: 'Bearer token123', 'X-Custom-Header': 'value' },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Secret key for signature verification' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  secret?: string;

  @ApiPropertyOptional({ description: 'Associated form ID (leave empty for global webhooks)' })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({ description: 'Webhook configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookConfigDto)
  config?: WebhookConfigDto;

  @ApiPropertyOptional({ description: 'Field mappings for payload customization' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookFieldMappingDto)
  fieldMappings?: WebhookFieldMappingDto[];

  @ApiPropertyOptional({ description: 'Conditional filters for webhook triggering' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookFilterDto)
  filters?: WebhookFilterDto[];

  @ApiPropertyOptional({
    description: 'Tags for webhook organization',
    example: ['urgent', 'customer-facing'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Test mode flag' })
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;
}

/**
 * Update Webhook DTO
 */
export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {
  @ApiPropertyOptional({ description: 'Webhook status', enum: WebhookStatus })
  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @ApiPropertyOptional({ description: 'Webhook pause reason' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pauseReason?: string;

  @ApiPropertyOptional({ description: 'Webhook paused until timestamp' })
  @IsOptional()
  pausedUntil?: Date;
}

/**
 * Webhook Response DTO
 */
export class WebhookResponseDto {
  @ApiProperty({ description: 'Webhook ID' })
  id: string;

  @ApiProperty({ description: 'Webhook owner user ID' })
  userId: string;

  @ApiPropertyOptional({ description: 'Associated form ID' })
  formId?: string;

  @ApiProperty({ description: 'Webhook name' })
  name: string;

  @ApiPropertyOptional({ description: 'Webhook description' })
  description?: string;

  @ApiProperty({ description: 'Webhook URL endpoint' })
  url: string;

  @ApiProperty({ description: 'HTTP method for webhook delivery', enum: WebhookHttpMethod })
  method: WebhookHttpMethod;

  @ApiProperty({
    description: 'Webhook events subscribed to',
    enum: WebhookEventType,
    isArray: true,
  })
  events: WebhookEventType[];

  @ApiPropertyOptional({ description: 'Custom headers for webhook requests' })
  headers?: Record<string, string>;

  @ApiProperty({ description: 'Webhook status', enum: WebhookStatus })
  status: WebhookStatus;

  @ApiProperty({ description: 'Webhook configuration' })
  config: WebhookConfigDto;

  @ApiPropertyOptional({ description: 'Field mappings for payload customization' })
  fieldMappings?: WebhookFieldMappingDto[];

  @ApiPropertyOptional({ description: 'Conditional filters for webhook triggering' })
  filters?: WebhookFilterDto[];

  @ApiProperty({ description: 'Webhook analytics and metrics' })
  analytics: {
    totalAttempts: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    avgResponseTimeMs: number;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
    lastError?: string;
    successRate: number;
    consecutiveFailures: number;
  };

  @ApiPropertyOptional({ description: 'Tags for webhook organization' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Last time webhook was triggered' })
  lastTriggeredAt?: Date;

  @ApiPropertyOptional({ description: 'Webhook pause reason' })
  pauseReason?: string;

  @ApiPropertyOptional({ description: 'Webhook paused until timestamp' })
  pausedUntil?: Date;

  @ApiPropertyOptional({ description: 'Test mode flag' })
  isTestMode?: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Webhook health status' })
  healthStatus?: string;

  @ApiPropertyOptional({ description: 'Webhook domain' })
  domain?: string;
}

/**
 * Webhook Test DTO
 */
export class TestWebhookDto {
  @ApiPropertyOptional({
    description: 'Test payload to send',
    example: { test: true, message: 'Test webhook delivery' },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Event type to simulate', enum: WebhookEventType })
  @IsOptional()
  @IsEnum(WebhookEventType)
  eventType?: WebhookEventType;
}

/**
 * Webhook Delivery Query DTO
 */
export class WebhookDeliveryQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by delivery status', enum: WebhookDeliveryStatus })
  @IsOptional()
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;

  @ApiPropertyOptional({ description: 'Filter by event type', enum: WebhookEventType })
  @IsOptional()
  @IsEnum(WebhookEventType)
  eventType?: WebhookEventType;

  @ApiPropertyOptional({ description: 'Filter by form ID' })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({ description: 'Filter deliveries from date (ISO string)' })
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter deliveries to date (ISO string)' })
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Search by delivery ID' })
  @IsOptional()
  @IsString()
  deliveryId?: string;

  @ApiPropertyOptional({ description: 'Filter by test deliveries only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  testOnly?: boolean;
}

/**
 * Webhook Query DTO
 */
export class WebhookQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by webhook status', enum: WebhookStatus })
  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @ApiPropertyOptional({ description: 'Filter by event type', enum: WebhookEventType })
  @IsOptional()
  @IsEnum(WebhookEventType)
  eventType?: WebhookEventType;

  @ApiPropertyOptional({ description: 'Filter by form ID' })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['name', 'createdAt', 'lastTriggeredAt', 'status'],
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'lastTriggeredAt', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string = 'desc';
}

/**
 * Webhook Analytics Response DTO
 */
export class WebhookAnalyticsResponseDto {
  @ApiProperty({ description: 'Total webhooks count' })
  totalWebhooks: number;

  @ApiProperty({ description: 'Active webhooks count' })
  activeWebhooks: number;

  @ApiProperty({ description: 'Failed webhooks count' })
  failedWebhooks: number;

  @ApiProperty({ description: 'Total deliveries in period' })
  totalDeliveries: number;

  @ApiProperty({ description: 'Successful deliveries in period' })
  successfulDeliveries: number;

  @ApiProperty({ description: 'Failed deliveries in period' })
  failedDeliveries: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  avgResponseTime: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate: number;

  @ApiProperty({ description: 'Deliveries by status' })
  deliveriesByStatus: Record<string, number>;

  @ApiProperty({ description: 'Deliveries by event type' })
  deliveriesByEventType: Record<string, number>;

  @ApiProperty({ description: 'Daily delivery stats' })
  dailyStats: Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
  }>;
}

/**
 * Webhook Bulk Action DTO
 */
export class WebhookBulkActionDto {
  @ApiProperty({ description: 'Webhook IDs to perform action on' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  webhookIds: string[];

  @ApiProperty({
    description: 'Action to perform',
    enum: ['activate', 'pause', 'disable', 'delete', 'test'],
  })
  @IsEnum(['activate', 'pause', 'disable', 'delete', 'test'])
  action: string;

  @ApiPropertyOptional({ description: 'Reason for the action (required for pause/disable)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
