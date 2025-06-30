import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { WebhookDeliveryStatus } from '../entities/webhook-delivery.entity';
import { WebhookEventType, WebhookHttpMethod } from '../entities/webhook.entity';

/**
 * Webhook Delivery Attempt DTO
 */
export class WebhookDeliveryAttemptDto {
  @ApiProperty({ description: 'Attempt number', example: 1 })
  attemptNumber: number;

  @ApiProperty({ description: 'Attempt timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'HTTP status code', example: 200 })
  statusCode: number;

  @ApiProperty({ description: 'Response time in milliseconds', example: 245 })
  responseTimeMs: number;

  @ApiPropertyOptional({ description: 'Response body from webhook endpoint' })
  responseBody?: string;

  @ApiPropertyOptional({ description: 'Response headers from webhook endpoint' })
  responseHeaders?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Error message if attempt failed' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Error code if attempt failed' })
  errorCode?: string;

  @ApiProperty({ description: 'Whether this attempt was successful' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata for the attempt' })
  metadata?: Record<string, unknown>;
}

/**
 * Create Webhook Delivery DTO
 */
export class CreateWebhookDeliveryDto {
  @ApiProperty({ description: 'Webhook ID' })
  @IsString()
  webhookId: string;

  @ApiProperty({ description: 'Event type that triggered the delivery', enum: WebhookEventType })
  @IsEnum(WebhookEventType)
  eventType: WebhookEventType;

  @ApiProperty({ description: 'Unique event ID' })
  @IsString()
  eventId: string;

  @ApiProperty({ description: 'Event timestamp' })
  @IsDate()
  @Type(() => Date)
  eventTimestamp: Date;

  @ApiProperty({ description: 'User ID associated with the event' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: 'Form ID if event is form-related' })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({ description: 'Submission ID if event is submission-related' })
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiProperty({ description: 'Webhook payload to be delivered' })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiProperty({ description: 'Target URL for delivery' })
  @IsUrl()
  url: string;

  @ApiProperty({ description: 'HTTP method for delivery', enum: WebhookHttpMethod })
  @IsEnum(WebhookHttpMethod)
  method: WebhookHttpMethod;

  @ApiPropertyOptional({ description: 'Custom headers for the webhook request' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Webhook secret for signature generation' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({ description: 'Request timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Maximum delivery attempts' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Priority for queue processing' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Test delivery flag' })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata for the delivery' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Update Webhook Delivery DTO
 */
export class UpdateWebhookDeliveryDto {
  @ApiPropertyOptional({ description: 'Delivery status', enum: WebhookDeliveryStatus })
  @IsOptional()
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;

  @ApiPropertyOptional({ description: 'Number of delivery attempts made' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  attemptCount?: number;

  @ApiPropertyOptional({ description: 'Timestamp of last delivery attempt' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastAttemptAt?: Date;

  @ApiPropertyOptional({ description: 'Timestamp when delivery was completed' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Error message for failed deliveries' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Error code for failed deliveries' })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional({ description: 'Next retry timestamp for failed deliveries' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextRetryAt?: Date;

  @ApiPropertyOptional({ description: 'Total response time across all attempts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalResponseTimeMs?: number;

  @ApiPropertyOptional({ description: 'Delivery attempts history' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookDeliveryAttemptDto)
  attempts?: WebhookDeliveryAttemptDto[];

  @ApiPropertyOptional({ description: 'Additional metadata for the delivery' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Webhook Delivery Response DTO
 */
export class WebhookDeliveryResponseDto {
  @ApiProperty({ description: 'Unique delivery ID' })
  deliveryId: string;

  @ApiProperty({ description: 'Webhook ID' })
  webhookId: string;

  @ApiProperty({ description: 'Webhook name' })
  webhookName: string;

  @ApiProperty({ description: 'Delivery status', enum: WebhookDeliveryStatus })
  status: WebhookDeliveryStatus;

  @ApiProperty({ description: 'Event type that triggered the delivery', enum: WebhookEventType })
  eventType: WebhookEventType;

  @ApiProperty({ description: 'Event ID' })
  eventId: string;

  @ApiProperty({ description: 'Event timestamp' })
  eventTimestamp: Date;

  @ApiProperty({ description: 'User ID associated with the event' })
  userId: string;

  @ApiPropertyOptional({ description: 'Form ID if event is form-related' })
  formId?: string;

  @ApiPropertyOptional({ description: 'Submission ID if event is submission-related' })
  submissionId?: string;

  @ApiProperty({ description: 'Target URL for delivery' })
  url: string;

  @ApiProperty({ description: 'HTTP method used for delivery', enum: WebhookHttpMethod })
  method: WebhookHttpMethod;

  @ApiProperty({ description: 'Number of delivery attempts made' })
  attemptCount: number;

  @ApiProperty({ description: 'Maximum allowed attempts' })
  maxAttempts: number;

  @ApiProperty({ description: 'Delivery creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Timestamp of last delivery attempt' })
  lastAttemptAt?: Date;

  @ApiPropertyOptional({ description: 'Timestamp when delivery was completed' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Next retry timestamp for failed deliveries' })
  nextRetryAt?: Date;

  @ApiPropertyOptional({ description: 'Error message for failed deliveries' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Error code for failed deliveries' })
  errorCode?: string;

  @ApiProperty({ description: 'Total response time across all attempts in milliseconds' })
  totalResponseTimeMs: number;

  @ApiProperty({ description: 'Average response time per attempt in milliseconds' })
  avgResponseTimeMs: number;

  @ApiProperty({ description: 'Test delivery flag' })
  isTest: boolean;

  @ApiProperty({ description: 'Delivery attempts history' })
  attempts: WebhookDeliveryAttemptDto[];

  @ApiPropertyOptional({ description: 'Delivery payload size in bytes' })
  payloadSizeBytes?: number;

  @ApiPropertyOptional({ description: 'Additional metadata for the delivery' })
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

/**
 * Webhook Delivery List Response DTO
 */
export class WebhookDeliveryListResponseDto {
  @ApiProperty({ description: 'List of webhook deliveries', type: [WebhookDeliveryResponseDto] })
  deliveries: WebhookDeliveryResponseDto[];

  @ApiProperty({ description: 'Total number of deliveries' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there are more pages' })
  hasMore: boolean;
}

/**
 * Webhook Delivery Statistics DTO
 */
export class WebhookDeliveryStatsDto {
  @ApiProperty({ description: 'Total number of deliveries in period' })
  totalDeliveries: number;

  @ApiProperty({ description: 'Successful deliveries in period' })
  successfulDeliveries: number;

  @ApiProperty({ description: 'Failed deliveries in period' })
  failedDeliveries: number;

  @ApiProperty({ description: 'Pending deliveries in period' })
  pendingDeliveries: number;

  @ApiProperty({ description: 'Deliveries currently being retried' })
  retryingDeliveries: number;

  @ApiProperty({ description: 'Success rate as percentage (0-100)' })
  successRate: number;

  @ApiProperty({ description: 'Failure rate as percentage (0-100)' })
  failureRate: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  avgResponseTimeMs: number;

  @ApiProperty({ description: 'Median response time in milliseconds' })
  medianResponseTimeMs: number;

  @ApiProperty({ description: 'Total number of delivery attempts made' })
  totalAttempts: number;

  @ApiProperty({ description: 'Average attempts per delivery' })
  avgAttemptsPerDelivery: number;

  @ApiProperty({ description: 'Deliveries by status breakdown' })
  deliveriesByStatus: Record<WebhookDeliveryStatus, number>;

  @ApiProperty({ description: 'Deliveries by event type breakdown' })
  deliveriesByEventType: Record<WebhookEventType, number>;

  @ApiProperty({ description: 'Deliveries by webhook breakdown' })
  deliveriesByWebhook: Array<{
    webhookId: string;
    webhookName: string;
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  }>;

  @ApiProperty({ description: 'Daily delivery statistics' })
  dailyStats: Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
    pending: number;
    retrying: number;
    avgResponseTimeMs: number;
  }>;

  @ApiProperty({ description: 'Hourly delivery distribution' })
  hourlyDistribution: Array<{
    hour: number;
    count: number;
    successRate: number;
  }>;

  @ApiProperty({ description: 'Top error codes and their frequencies' })
  topErrorCodes: Array<{
    errorCode: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Response time percentiles' })
  responseTimePercentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };

  @ApiProperty({ description: 'Statistics calculation period start' })
  periodStart: Date;

  @ApiProperty({ description: 'Statistics calculation period end' })
  periodEnd: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  lastUpdated: Date;
}

/**
 * Webhook Delivery Health DTO
 */
export class WebhookDeliveryHealthDto {
  @ApiProperty({ description: 'Overall health status', enum: ['healthy', 'degraded', 'unhealthy'] })
  status: 'healthy' | 'degraded' | 'unhealthy';

  @ApiProperty({ description: 'Health score (0-100)' })
  healthScore: number;

  @ApiProperty({ description: 'Number of active deliveries' })
  activeDeliveries: number;

  @ApiProperty({ description: 'Number of failed deliveries in last hour' })
  recentFailures: number;

  @ApiProperty({ description: 'Average queue processing time' })
  avgQueueTimeMs: number;

  @ApiProperty({ description: 'Queue backlog size' })
  queueBacklog: number;

  @ApiProperty({ description: 'System performance indicators' })
  performance: {
    cpu: number;
    memory: number;
    redis: number;
  };

  @ApiProperty({ description: 'Health check timestamp' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Health issues if any' })
  issues?: string[];

  @ApiPropertyOptional({ description: 'Recommendations for improvement' })
  recommendations?: string[];
}

/**
 * Webhook Delivery Retry DTO
 */
export class RetryWebhookDeliveryDto {
  @ApiProperty({ description: 'Delivery IDs to retry' })
  @IsArray()
  @IsString({ each: true })
  deliveryIds: string[];

  @ApiPropertyOptional({ description: 'Force retry even if max attempts exceeded' })
  @IsOptional()
  @IsBoolean()
  forceRetry?: boolean;

  @ApiPropertyOptional({ description: 'Reset attempt count before retry' })
  @IsOptional()
  @IsBoolean()
  resetAttempts?: boolean;

  @ApiPropertyOptional({ description: 'Priority for retry jobs' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Delay before retry in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delayMs?: number;

  @ApiPropertyOptional({ description: 'Reason for manual retry' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Webhook Delivery Bulk Action DTO
 */
export class WebhookDeliveryBulkActionDto {
  @ApiProperty({ description: 'Delivery IDs to perform action on' })
  @IsArray()
  @IsString({ each: true })
  deliveryIds: string[];

  @ApiProperty({
    description: 'Action to perform',
    enum: ['retry', 'cancel', 'delete', 'mark_success', 'mark_failed'],
  })
  @IsEnum(['retry', 'cancel', 'delete', 'mark_success', 'mark_failed'])
  action: string;

  @ApiPropertyOptional({ description: 'Reason for the bulk action' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Force action even if not applicable' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
