import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Document, Types } from 'mongoose';

/**
 * Webhook Event Types
 * Defines all possible events that can trigger webhooks
 */
export enum WebhookEventType {
  // Form events
  FORM_SUBMISSION = 'form.submission.created',
  FORM_CREATED = 'form.created',
  FORM_UPDATED = 'form.updated',
  FORM_DELETED = 'form.deleted',
  FORM_PUBLISHED = 'form.published',
  FORM_UNPUBLISHED = 'form.unpublished',

  // Submission events
  SUBMISSION_CREATED = 'submission.created',
  SUBMISSION_UPDATED = 'submission.updated',
  SUBMISSION_DELETED = 'submission.deleted',
  SUBMISSION_VALIDATED = 'submission.validated',
  SUBMISSION_REJECTED = 'submission.rejected',

  // User events
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_UPDATED = 'user.updated',

  // Payment events
  PAYMENT_SUCCESSFUL = 'payment.successful',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',

  // System events
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_ERROR = 'system.error',
  SYSTEM_UPDATE = 'system.update',

  // Notification events
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_DELIVERED = 'notification.delivered',
  NOTIFICATION_FAILED = 'notification.failed',

  // Analytics events
  ANALYTICS_REPORT_GENERATED = 'analytics.report.generated',
  ANALYTICS_THRESHOLD_REACHED = 'analytics.threshold.reached',
}

/**
 * Webhook Status Enum
 */
export enum WebhookStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISABLED = 'disabled',
  ERROR = 'error',
}

/**
 * Webhook HTTP Method Enum
 */
export enum WebhookHttpMethod {
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
}

/**
 * Webhook Configuration Schema
 */
@Schema({ _id: false })
export class WebhookConfig {
  @ApiProperty({ description: 'Maximum delivery attempts', example: 5 })
  @Prop({ default: 5, min: 1, max: 10 })
  maxAttempts: number;

  @ApiProperty({ description: 'Timeout in milliseconds', example: 30000 })
  @Prop({ default: 30000, min: 1000, max: 120000 })
  timeoutMs: number;

  @ApiProperty({ description: 'Retry delay in milliseconds', example: 1000 })
  @Prop({ default: 1000, min: 100, max: 60000 })
  retryDelayMs: number;

  @ApiPropertyOptional({ description: 'Enable exponential backoff for retries' })
  @Prop({ default: true })
  exponentialBackoff: boolean;

  @ApiPropertyOptional({ description: 'Enable signature verification' })
  @Prop({ default: true })
  verifySignature: boolean;

  @ApiPropertyOptional({ description: 'Content type for webhook payload' })
  @Prop({ default: 'application/json' })
  contentType: string;

  @ApiPropertyOptional({ description: 'Rate limit per minute', example: 60 })
  @Prop({ default: 60, min: 1, max: 1000 })
  rateLimitPerMinute: number;

  @ApiPropertyOptional({ description: 'Enable batch processing' })
  @Prop({ default: false })
  batchEnabled: boolean;

  @ApiPropertyOptional({ description: 'Batch size for batch processing', example: 10 })
  @Prop({ default: 10, min: 1, max: 100 })
  batchSize: number;

  @ApiPropertyOptional({ description: 'Batch timeout in seconds', example: 60 })
  @Prop({ default: 60, min: 5, max: 300 })
  batchTimeoutSeconds: number;
}

/**
 * Webhook Field Mapping Schema
 */
@Schema({ _id: false })
export class WebhookFieldMapping {
  @ApiProperty({ description: 'Source field path', example: 'submission.data.email' })
  @Prop({ required: true })
  source: string;

  @ApiProperty({ description: 'Target field name in webhook payload', example: 'customer_email' })
  @Prop({ required: true })
  target: string;

  @ApiPropertyOptional({ description: 'Transform function to apply', example: 'lowercase' })
  @Prop()
  transform?: string;

  @ApiPropertyOptional({ description: 'Default value if source is empty' })
  @Prop()
  defaultValue?: string;

  @ApiPropertyOptional({ description: 'Whether this field is required' })
  @Prop({ default: false })
  required: boolean;
}

/**
 * Webhook Conditional Filter Schema
 */
@Schema({ _id: false })
export class WebhookFilter {
  @ApiProperty({ description: 'Field path to check', example: 'submission.data.type' })
  @Prop({ required: true })
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
  @Prop({
    required: true,
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
  operator: string;

  @ApiPropertyOptional({ description: 'Value to compare against' })
  @Prop()
  value?: string;

  @ApiPropertyOptional({ description: 'Case sensitive comparison' })
  @Prop({ default: false })
  caseSensitive: boolean;
}

/**
 * Webhook Analytics Schema
 */
@Schema({ _id: false })
export class WebhookAnalytics {
  @ApiProperty({ description: 'Total delivery attempts' })
  @Prop({ default: 0 })
  totalAttempts: number;

  @ApiProperty({ description: 'Successful deliveries' })
  @Prop({ default: 0 })
  successfulDeliveries: number;

  @ApiProperty({ description: 'Failed deliveries' })
  @Prop({ default: 0 })
  failedDeliveries: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  @Prop({ default: 0 })
  avgResponseTimeMs: number;

  @ApiProperty({ description: 'Last successful delivery timestamp' })
  @Prop()
  lastSuccessAt?: Date;

  @ApiProperty({ description: 'Last failed delivery timestamp' })
  @Prop()
  lastFailureAt?: Date;

  @ApiProperty({ description: 'Last error message' })
  @Prop()
  lastError?: string;

  @ApiProperty({ description: 'Success rate percentage' })
  @Prop({ default: 0 })
  successRate: number;

  @ApiProperty({ description: 'Current consecutive failures' })
  @Prop({ default: 0 })
  consecutiveFailures: number;
}

/**
 * Main Webhook Entity Schema
 */
@Schema({
  timestamps: true,
  collection: 'webhooks',
})
export class Webhook extends Document {
  @ApiProperty({ description: 'Webhook owner user ID' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'Associated form ID (optional for global webhooks)' })
  @Prop({ type: Types.ObjectId, ref: 'Form', index: true })
  formId?: Types.ObjectId;

  @ApiProperty({ description: 'Webhook name' })
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @ApiPropertyOptional({ description: 'Webhook description' })
  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @ApiProperty({ description: 'Webhook URL endpoint' })
  @Prop({ required: true, validate: /^https?:\/\/.+/ })
  url: string;

  @ApiProperty({ description: 'HTTP method for webhook delivery', enum: WebhookHttpMethod })
  @Prop({ required: true, enum: WebhookHttpMethod, default: WebhookHttpMethod.POST })
  method: WebhookHttpMethod;

  @ApiProperty({
    description: 'Webhook events to subscribe to',
    enum: WebhookEventType,
    isArray: true,
  })
  @Prop({ type: [String], enum: WebhookEventType, required: true })
  events: WebhookEventType[];

  @ApiPropertyOptional({ description: 'Custom headers for webhook requests' })
  @Prop({ type: Map, of: String })
  headers?: Map<string, string>;

  @ApiPropertyOptional({ description: 'Secret key for signature verification' })
  @Prop({ select: false }) // Don't include in queries by default
  secret?: string;

  @ApiProperty({ description: 'Webhook status', enum: WebhookStatus })
  @Prop({ enum: WebhookStatus, default: WebhookStatus.ACTIVE })
  status: WebhookStatus;

  @ApiProperty({ description: 'Webhook configuration' })
  @Prop({ type: WebhookConfig, default: () => new WebhookConfig() })
  config: WebhookConfig;

  @ApiPropertyOptional({ description: 'Field mappings for payload customization' })
  @Prop({ type: [WebhookFieldMapping], default: [] })
  fieldMappings: WebhookFieldMapping[];

  @ApiPropertyOptional({ description: 'Conditional filters for webhook triggering' })
  @Prop({ type: [WebhookFilter], default: [] })
  filters: WebhookFilter[];

  @ApiProperty({ description: 'Webhook analytics and metrics' })
  @Prop({ type: WebhookAnalytics, default: () => new WebhookAnalytics() })
  analytics: WebhookAnalytics;

  @ApiPropertyOptional({ description: 'Tags for webhook organization' })
  @Prop({ type: [String], default: [] })
  tags: string[];

  @ApiPropertyOptional({ description: 'Last time webhook was triggered' })
  @Prop()
  lastTriggeredAt?: Date;

  @ApiPropertyOptional({ description: 'Next scheduled trigger (for recurring webhooks)' })
  @Prop()
  nextTriggerAt?: Date;

  @ApiPropertyOptional({ description: 'Webhook pause reason' })
  @Prop()
  pauseReason?: string;

  @ApiPropertyOptional({ description: 'Webhook paused until timestamp' })
  @Prop()
  pausedUntil?: Date;

  @ApiPropertyOptional({ description: 'External service integration metadata' })
  @Prop({ type: Object })
  integrationMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Test mode flag' })
  @Prop({ default: false })
  isTestMode: boolean;

  @ApiPropertyOptional({ description: 'Schema version for migrations' })
  @Prop({ default: '1.0' })
  schemaVersion: string;
}

// Create and export schema
export const WebhookSchema = SchemaFactory.createForClass(Webhook);

/**
 * Webhook Document interface
 */
export interface WebhookDocument extends Webhook {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Create indexes for optimal query performance
WebhookSchema.index({ userId: 1, formId: 1 });
WebhookSchema.index({ status: 1 });
WebhookSchema.index({ events: 1 });
WebhookSchema.index({ 'analytics.consecutiveFailures': 1 });
WebhookSchema.index({ lastTriggeredAt: 1 });
WebhookSchema.index({ nextTriggerAt: 1 });
WebhookSchema.index({ tags: 1 });

// Pre-save middleware to update analytics
WebhookSchema.pre('save', function (next) {
  if (this.analytics) {
    // Calculate success rate
    const total = this.analytics.totalAttempts;
    if (total > 0) {
      this.analytics.successRate = (this.analytics.successfulDeliveries / total) * 100;
    }
  }
  next();
});

// Virtual for webhook health status
WebhookSchema.virtual('healthStatus').get(function () {
  const analytics = this.analytics;
  if (!analytics || analytics.totalAttempts === 0) {
    return 'unknown';
  }

  if (analytics.consecutiveFailures >= 5) {
    return 'critical';
  } else if (analytics.successRate < 50) {
    return 'warning';
  } else if (analytics.successRate >= 95) {
    return 'excellent';
  } else {
    return 'good';
  }
});

// Virtual for webhook URL domain
WebhookSchema.virtual('domain').get(function () {
  try {
    return new URL(this.url).hostname;
  } catch {
    return 'invalid-url';
  }
});
