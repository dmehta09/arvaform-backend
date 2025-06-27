import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Email Delivery Status Enum
 * Comprehensive status tracking for email delivery lifecycle
 */
export enum EmailDeliveryStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  FAILED = 'failed',
  RETRY_SCHEDULED = 'retry_scheduled',
  PERMANENTLY_FAILED = 'permanently_failed',
}

/**
 * Email Delivery Priority Enum
 * Priority levels for queue processing order
 */
export enum EmailDeliveryPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Email Delivery Attempt Schema
 * Tracks individual delivery attempts with full details
 */
@Schema({ _id: false })
export class EmailDeliveryAttempt {
  @Prop({ required: true, default: Date.now })
  timestamp: Date;

  @Prop({ required: true, enum: EmailDeliveryStatus })
  status: EmailDeliveryStatus;

  @Prop({ required: true })
  providerId: string;

  @Prop()
  providerMessageId?: string;

  @Prop()
  responseCode?: number;

  @Prop()
  errorMessage?: string;

  @Prop()
  errorCode?: string;

  @Prop({ type: Object })
  providerResponse?: Record<string, unknown>;

  @Prop()
  duration?: number; // milliseconds
}

/**
 * Email Analytics Schema
 * Tracks email engagement metrics
 */
@Schema({ _id: false })
export class EmailAnalytics {
  @Prop({ default: false })
  opened: boolean;

  @Prop()
  openedAt?: Date;

  @Prop({ default: 0 })
  openCount: number;

  @Prop({ default: false })
  clicked: boolean;

  @Prop()
  clickedAt?: Date;

  @Prop({ default: 0 })
  clickCount: number;

  @Prop([String])
  clickedUrls: string[];

  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  location?: string;
}

/**
 * Email Delivery Entity
 *
 * Comprehensive tracking for email delivery with queue management,
 * retry logic, analytics, and audit trail capabilities.
 * Follows append-only pattern for data integrity and compliance.
 *
 * @class EmailDelivery
 * @extends Document
 * @since 2025-01-15
 */
@Schema({
  timestamps: true,
  collection: 'email_deliveries',
})
export class EmailDelivery extends Document {
  // Core delivery information
  @Prop({ required: true })
  recipientEmail: string;

  @Prop({ required: true })
  recipientName?: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  senderEmail: string;

  @Prop()
  senderName?: string;

  // Content and template information
  @Prop()
  htmlContent?: string;

  @Prop()
  textContent?: string;

  @Prop()
  templateId?: string;

  @Prop({ type: Object })
  templateVariables?: Record<string, unknown>;

  // Queue and delivery management
  @Prop({
    required: true,
    enum: EmailDeliveryStatus,
    default: EmailDeliveryStatus.QUEUED,
  })
  status: EmailDeliveryStatus;

  @Prop({
    required: true,
    enum: EmailDeliveryPriority,
    default: EmailDeliveryPriority.NORMAL,
  })
  priority: EmailDeliveryPriority;

  @Prop({ default: Date.now })
  scheduledAt: Date;

  @Prop()
  processedAt?: Date;

  @Prop()
  deliveredAt?: Date;

  // Retry logic and failure handling
  @Prop({ default: 0 })
  attemptCount: number;

  @Prop({ default: 3 })
  maxAttempts: number;

  @Prop()
  nextRetryAt?: Date;

  @Prop()
  lastErrorMessage?: string;

  @Prop()
  lastErrorCode?: string;

  @Prop()
  permanentFailureReason?: string;

  // Provider information
  @Prop()
  providerId?: string;

  @Prop()
  providerMessageId?: string;

  @Prop({ type: Object })
  providerMetadata?: Record<string, unknown>;

  // Business context
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Form' })
  formId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Submission' })
  submissionId?: Types.ObjectId;

  @Prop()
  category?: string; // notification, welcome, reset_password, etc.

  @Prop([String])
  tags: string[];

  // Attempt history (append-only for audit trail)
  @Prop({ type: [EmailDeliveryAttempt], default: [] })
  attempts: EmailDeliveryAttempt[];

  // Analytics and engagement tracking
  @Prop({ type: EmailAnalytics })
  analytics?: EmailAnalytics;

  // Webhooks and callbacks
  @Prop()
  webhookUrl?: string;

  @Prop({ type: Object })
  webhookHeaders?: Record<string, string>;

  @Prop({ default: false })
  webhookSent: boolean;

  @Prop()
  webhookSentAt?: Date;

  // Compliance and audit
  @Prop({ default: false })
  gdprProcessed: boolean;

  @Prop()
  retentionExpiresAt?: Date;

  @Prop({ type: Object })
  auditLog?: Record<string, unknown>;

  // Performance metrics
  @Prop()
  queuedDuration?: number; // Time in queue (ms)

  @Prop()
  processingDuration?: number; // Processing time (ms)

  @Prop()
  totalDeliveryTime?: number; // End-to-end delivery time (ms)

  // Bulk and batch processing
  @Prop()
  bulkEmailId?: string;

  @Prop()
  batchId?: string;
}

export const EmailDeliverySchema = SchemaFactory.createForClass(EmailDelivery);

// Create indexes for performance optimization
EmailDeliverySchema.index({ recipientEmail: 1 });
EmailDeliverySchema.index({ status: 1 });
EmailDeliverySchema.index({ priority: 1 });
EmailDeliverySchema.index({ scheduledAt: 1 });
EmailDeliverySchema.index({ userId: 1 });
EmailDeliverySchema.index({ formId: 1 });
EmailDeliverySchema.index({ submissionId: 1 });
EmailDeliverySchema.index({ category: 1 });
EmailDeliverySchema.index({ createdAt: 1 });
EmailDeliverySchema.index({ bulkEmailId: 1 });
EmailDeliverySchema.index({ batchId: 1 });

// Compound indexes for common query patterns
EmailDeliverySchema.index({ recipientEmail: 1, status: 1 });
EmailDeliverySchema.index({ userId: 1, status: 1 });
EmailDeliverySchema.index({ status: 1, scheduledAt: 1 });
EmailDeliverySchema.index({ formId: 1, createdAt: -1 });

// Document type with proper typing including timestamps and _id
export interface EmailDeliveryDocument extends EmailDelivery {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Add pre-save middleware for automatic field updates
EmailDeliverySchema.pre('save', function (next) {
  if (this.status === EmailDeliveryStatus.PROCESSING && !this.processedAt) {
    this.processedAt = new Date();
  }

  if (this.status === EmailDeliveryStatus.DELIVERED || this.status === EmailDeliveryStatus.SENT) {
    if (!this.deliveredAt) {
      this.deliveredAt = new Date();
    }

    // Calculate delivery times
    if (this.processedAt) {
      this.processingDuration = this.deliveredAt.getTime() - this.processedAt.getTime();
    }

    this.totalDeliveryTime = this.deliveredAt.getTime() - new Date().getTime();
  }

  next();
});

// Add post-save middleware for webhook notifications
EmailDeliverySchema.post('save', function (doc) {
  const delivery = doc as EmailDelivery;

  // Trigger webhook for status changes if configured
  if (
    delivery.webhookUrl &&
    !delivery.webhookSent &&
    [
      EmailDeliveryStatus.DELIVERED,
      EmailDeliveryStatus.FAILED,
      EmailDeliveryStatus.BOUNCED,
      EmailDeliveryStatus.PERMANENTLY_FAILED,
    ].includes(delivery.status)
  ) {
    // This will be handled by the webhook service
    // Note: We'll implement webhook delivery in a separate service to avoid circular dependencies
  }
});
