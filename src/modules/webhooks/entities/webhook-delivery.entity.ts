import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Document, Types } from 'mongoose';

/**
 * Webhook Delivery Status Enum
 */
export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  PERMANENTLY_FAILED = 'permanently_failed',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  CANCELLED = 'cancelled',
}

/**
 * Webhook Response Schema
 */
@Schema({ _id: false })
export class WebhookResponse {
  @ApiProperty({ description: 'HTTP status code received' })
  @Prop({ required: true })
  statusCode: number;

  @ApiPropertyOptional({ description: 'Response body' })
  @Prop()
  body?: string;

  @ApiPropertyOptional({ description: 'Response headers' })
  @Prop({ type: Object })
  headers?: Record<string, string>;

  @ApiProperty({ description: 'Response time in milliseconds' })
  @Prop({ required: true })
  responseTimeMs: number;

  @ApiProperty({ description: 'Response timestamp' })
  @Prop({ required: true, default: Date.now })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Content type of response' })
  @Prop()
  contentType?: string;

  @ApiPropertyOptional({ description: 'Response size in bytes' })
  @Prop()
  contentLength?: number;

  @ApiPropertyOptional({ description: 'Whether response indicates success' })
  @Prop()
  isSuccess?: boolean;
}

/**
 * Webhook Delivery Attempt Schema
 */
@Schema({ _id: false })
export class WebhookDeliveryAttempt {
  @ApiProperty({ description: 'Attempt number (1-based)' })
  @Prop({ required: true })
  attemptNumber: number;

  @ApiProperty({ description: 'Attempt timestamp' })
  @Prop({ required: true, default: Date.now })
  attemptedAt: Date;

  @ApiProperty({ description: 'Attempt status', enum: WebhookDeliveryStatus })
  @Prop({ required: true, enum: WebhookDeliveryStatus })
  status: WebhookDeliveryStatus;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  @Prop()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Error code if failed' })
  @Prop()
  errorCode?: string;

  @ApiPropertyOptional({ description: 'Duration of the attempt in milliseconds' })
  @Prop()
  durationMs?: number;

  @ApiPropertyOptional({ description: 'Response details' })
  @Prop({ type: WebhookResponse })
  response?: WebhookResponse;

  @ApiPropertyOptional({ description: 'Next retry scheduled at' })
  @Prop()
  nextRetryAt?: Date;

  @ApiPropertyOptional({ description: 'Retry delay in milliseconds' })
  @Prop()
  retryDelayMs?: number;

  @ApiPropertyOptional({ description: 'Whether this was a retry attempt' })
  @Prop({ default: false })
  isRetry: boolean;

  @ApiPropertyOptional({ description: 'Queue job ID for tracking' })
  @Prop()
  queueJobId?: string;
}

/**
 * Webhook Request Details Schema
 */
@Schema({ _id: false })
export class WebhookRequestDetails {
  @ApiProperty({ description: 'HTTP method used' })
  @Prop({ required: true })
  method: string;

  @ApiProperty({ description: 'Target URL' })
  @Prop({ required: true })
  url: string;

  @ApiPropertyOptional({ description: 'Request headers sent' })
  @Prop({ type: Object })
  headers?: Record<string, string>;

  @ApiProperty({ description: 'Request payload' })
  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Content type of request' })
  @Prop()
  contentType?: string;

  @ApiPropertyOptional({ description: 'Request body size in bytes' })
  @Prop()
  contentLength?: number;

  @ApiPropertyOptional({ description: 'User agent string used' })
  @Prop()
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Signature generated for verification' })
  @Prop()
  signature?: string;

  @ApiPropertyOptional({ description: 'Signature algorithm used' })
  @Prop()
  signatureAlgorithm?: string;

  @ApiPropertyOptional({ description: 'Request timeout in milliseconds' })
  @Prop()
  timeoutMs?: number;
}

/**
 * Webhook Event Context Schema
 */
@Schema({ _id: false })
export class WebhookEventContext {
  @ApiProperty({ description: 'Event type that triggered the webhook' })
  @Prop({ required: true })
  eventType: string;

  @ApiProperty({ description: 'Source object ID that triggered the event' })
  @Prop({ required: true })
  sourceId: string;

  @ApiPropertyOptional({ description: 'Source object type' })
  @Prop()
  sourceType?: string;

  @ApiProperty({ description: 'Event timestamp' })
  @Prop({ required: true, default: Date.now })
  eventTimestamp: Date;

  @ApiPropertyOptional({ description: 'User ID who triggered the event' })
  @Prop()
  triggeredBy?: string;

  @ApiPropertyOptional({ description: 'Additional event metadata' })
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Event version for schema evolution' })
  @Prop()
  eventVersion?: string;

  @ApiPropertyOptional({ description: 'Trace ID for request correlation' })
  @Prop()
  traceId?: string;
}

/**
 * Main Webhook Delivery Entity Schema
 */
@Schema({
  timestamps: true,
  collection: 'webhook_deliveries',
})
export class WebhookDelivery extends Document {
  @ApiProperty({ description: 'Reference to the webhook configuration' })
  @Prop({ type: Types.ObjectId, ref: 'Webhook', required: true, index: true })
  webhookId: Types.ObjectId;

  @ApiProperty({ description: 'Webhook owner user ID' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiPropertyOptional({ description: 'Associated form ID' })
  @Prop({ type: Types.ObjectId, ref: 'Form', index: true })
  formId?: Types.ObjectId;

  @ApiProperty({ description: 'Unique delivery ID for tracking' })
  @Prop({ required: true, unique: true, index: true })
  deliveryId: string;

  @ApiProperty({ description: 'Current delivery status', enum: WebhookDeliveryStatus })
  @Prop({ required: true, enum: WebhookDeliveryStatus, default: WebhookDeliveryStatus.PENDING })
  status: WebhookDeliveryStatus;

  @ApiProperty({ description: 'Event context that triggered this delivery' })
  @Prop({ type: WebhookEventContext, required: true })
  eventContext: WebhookEventContext;

  @ApiProperty({ description: 'Request details for this delivery' })
  @Prop({ type: WebhookRequestDetails, required: true })
  requestDetails: WebhookRequestDetails;

  @ApiProperty({ description: 'Delivery attempts made' })
  @Prop({ type: [WebhookDeliveryAttempt], default: [] })
  attempts: WebhookDeliveryAttempt[];

  @ApiProperty({ description: 'Current attempt number' })
  @Prop({ default: 0 })
  currentAttempt: number;

  @ApiProperty({ description: 'Maximum attempts allowed' })
  @Prop({ required: true })
  maxAttempts: number;

  @ApiPropertyOptional({ description: 'Final error message if permanently failed' })
  @Prop()
  finalError?: string;

  @ApiPropertyOptional({ description: 'Final error code if permanently failed' })
  @Prop()
  finalErrorCode?: string;

  @ApiProperty({ description: 'Scheduled for next attempt at' })
  @Prop({ index: true })
  scheduledAt: Date;

  @ApiPropertyOptional({ description: 'Started processing at' })
  @Prop()
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Completed at (success or permanent failure)' })
  @Prop()
  completedAt?: Date;

  @ApiProperty({ description: 'Total processing time in milliseconds' })
  @Prop({ default: 0 })
  totalProcessingTimeMs: number;

  @ApiPropertyOptional({ description: 'Delivery priority (higher = more urgent)' })
  @Prop({ default: 0, index: true })
  priority: number;

  @ApiPropertyOptional({ description: 'Batch ID for grouped deliveries' })
  @Prop({ index: true })
  batchId?: string;

  @ApiPropertyOptional({ description: 'Tags for delivery categorization' })
  @Prop({ type: [String], default: [] })
  tags: string[];

  @ApiPropertyOptional({ description: 'Test delivery flag' })
  @Prop({ default: false })
  isTest: boolean;

  @ApiPropertyOptional({ description: 'Delivery expiration time' })
  @Prop()
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Circuit breaker status' })
  @Prop()
  circuitBreakerTripped?: boolean;

  @ApiPropertyOptional({ description: 'Rate limit bucket key' })
  @Prop()
  rateLimitBucket?: string;

  @ApiPropertyOptional({ description: 'Delivery source (manual, automatic, retry)' })
  @Prop({ default: 'automatic' })
  source: string;

  @ApiPropertyOptional({ description: 'Additional delivery metadata' })
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Schema version for migrations' })
  @Prop({ default: '1.0' })
  schemaVersion: string;
}

// Create and export schema
export const WebhookDeliverySchema = SchemaFactory.createForClass(WebhookDelivery);

/**
 * Webhook Delivery Document interface
 */
export interface WebhookDeliveryDocument extends WebhookDelivery {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Create indexes for optimal query performance
WebhookDeliverySchema.index({ webhookId: 1, status: 1 });
WebhookDeliverySchema.index({ userId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ status: 1, scheduledAt: 1 });
WebhookDeliverySchema.index({ deliveryId: 1 }, { unique: true });
WebhookDeliverySchema.index({ batchId: 1 });
WebhookDeliverySchema.index({ 'eventContext.eventType': 1 });
WebhookDeliverySchema.index({ 'eventContext.sourceId': 1 });
WebhookDeliverySchema.index({ completedAt: 1 });
WebhookDeliverySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
WebhookDeliverySchema.index({ isTest: 1 });
WebhookDeliverySchema.index({ priority: -1, scheduledAt: 1 });

// Pre-save middleware to update timestamps and stats
WebhookDeliverySchema.pre('save', function (next) {
  // Update completion timestamp when status changes to final state
  if (this.isModified('status')) {
    const finalStates = [
      WebhookDeliveryStatus.DELIVERED,
      WebhookDeliveryStatus.PERMANENTLY_FAILED,
      WebhookDeliveryStatus.CANCELLED,
    ];

    if (finalStates.includes(this.status) && !this.completedAt) {
      this.completedAt = new Date();

      // Calculate total processing time
      if (this.startedAt) {
        this.totalProcessingTimeMs = this.completedAt.getTime() - this.startedAt.getTime();
      }
    }

    // Set started timestamp when status changes from pending
    if (this.status !== WebhookDeliveryStatus.PENDING && !this.startedAt) {
      this.startedAt = new Date();
    }
  }

  next();
});

// Virtual for success status
WebhookDeliverySchema.virtual('isSuccessful').get(function () {
  return this.status === WebhookDeliveryStatus.DELIVERED;
});

// Virtual for failure status
WebhookDeliverySchema.virtual('isFailed').get(function () {
  return [
    WebhookDeliveryStatus.FAILED,
    WebhookDeliveryStatus.PERMANENTLY_FAILED,
    WebhookDeliveryStatus.TIMEOUT,
  ].includes(this.status);
});

// Virtual for pending retry status
WebhookDeliverySchema.virtual('isPendingRetry').get(function () {
  return this.status === WebhookDeliveryStatus.RETRYING;
});

// Virtual for latest attempt
WebhookDeliverySchema.virtual('latestAttempt').get(function () {
  return this.attempts.length > 0 ? this.attempts[this.attempts.length - 1] : null;
});

// Virtual for average response time
WebhookDeliverySchema.virtual('averageResponseTime').get(function () {
  const successfulAttempts = this.attempts.filter(
    attempt => attempt.response && attempt.response.responseTimeMs > 0,
  );

  if (successfulAttempts.length === 0) return 0;

  const totalTime = successfulAttempts.reduce(
    (sum, attempt) => sum + (attempt.response?.responseTimeMs || 0),
    0,
  );

  return Math.round(totalTime / successfulAttempts.length);
});
