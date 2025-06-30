import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  NotificationAnalytics,
  NotificationChannel,
  NotificationContent,
  NotificationContext,
  NotificationDeliveryAttempt,
  NotificationPriority,
  NotificationStatus,
  NotificationTemplateVariables,
  NotificationType,
} from '../types/notification.types';

/**
 * Notification Delivery Attempt Schema
 * Tracks individual delivery attempts with comprehensive details
 */
@Schema({ _id: false })
export class NotificationDeliveryAttemptSchema {
  @Prop({ required: true, default: Date.now })
  timestamp: Date;

  @Prop({ required: true, enum: NotificationChannel })
  channel: NotificationChannel;

  @Prop({ required: true, enum: NotificationStatus })
  status: NotificationStatus;

  @Prop()
  providerId?: string;

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
 * Notification Analytics Schema
 * Comprehensive engagement and performance tracking
 */
@Schema({ _id: false })
export class NotificationAnalyticsSchema {
  // Delivery metrics
  @Prop()
  sentAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;

  @Prop()
  clickedAt?: Date;

  // Engagement metrics
  @Prop({ default: 0 })
  readCount: number;

  @Prop({ default: 0 })
  clickCount: number;

  @Prop([String])
  clickedUrls: string[];

  // Device and location data
  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  deviceType?: string;

  @Prop()
  location?: string;

  // Timing metrics
  @Prop()
  deliveryDuration?: number; // Time to deliver (ms)

  @Prop()
  timeToRead?: number; // Time from delivery to read (ms)

  @Prop()
  timeToClick?: number; // Time from delivery to click (ms)
}

/**
 * Notification Content Schema
 * Multi-channel content structure
 */
@Schema({ _id: false })
export class NotificationContentSchema {
  // Universal content
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  actionUrl?: string;

  @Prop()
  actionText?: string;

  // Channel-specific content
  @Prop({
    type: {
      subject: { type: String },
      htmlContent: { type: String },
      textContent: { type: String },
      templateId: { type: String },
    },
  })
  email?: {
    subject: string;
    htmlContent?: string;
    textContent?: string;
    templateId?: string;
  };

  @Prop({
    type: {
      icon: { type: String },
      iconColor: { type: String },
      persistent: { type: Boolean },
      actionable: { type: Boolean },
    },
  })
  inApp?: {
    icon?: string;
    iconColor?: string;
    persistent?: boolean;
    actionable?: boolean;
  };

  @Prop({
    type: {
      badge: { type: Number },
      sound: { type: String },
      category: { type: String },
      threadId: { type: String },
    },
  })
  push?: {
    badge?: number;
    sound?: string;
    category?: string;
    threadId?: string;
  };

  @Prop({
    type: {
      payload: { type: Object },
      headers: { type: Object },
    },
  })
  webhook?: {
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
  };
}

/**
 * Notification Context Schema
 * Additional context information for notifications
 */
@Schema({ _id: false })
export class NotificationContextSchema {
  // Source information
  @Prop({
    required: true,
    enum: ['form', 'user', 'system', 'integration', 'analytics', 'security'],
  })
  sourceType: 'form' | 'user' | 'system' | 'integration' | 'analytics' | 'security';

  @Prop()
  sourceId?: string;

  // Trigger information
  @Prop()
  triggeredBy?: string; // User ID who triggered the notification

  @Prop({ required: true, default: Date.now })
  triggeredAt: Date;

  @Prop()
  triggerEvent?: string;

  // Routing information
  @Prop({ enum: ['user', 'admin', 'system', 'public'] })
  audience?: 'user' | 'admin' | 'system' | 'public';

  @Prop({ type: Object })
  audienceFilter?: Record<string, unknown>;

  // Scheduling information
  @Prop()
  scheduledFor?: Date;

  @Prop()
  timezone?: string;

  // Metadata
  @Prop([String])
  tags: string[];

  @Prop()
  category?: string;

  @Prop()
  group?: string;

  // Related entities
  @Prop([
    {
      type: { type: String, required: true },
      id: { type: String, required: true },
    },
  ])
  relatedEntities?: Array<{
    type: string;
    id: string;
  }>;
}

/**
 * Notification Entity
 *
 * Comprehensive notification tracking system supporting multiple delivery channels
 * (email, in-app, push, webhook) with user preferences, delivery analytics,
 * retry logic, and audit trail capabilities.
 *
 * Features:
 * - Multi-channel delivery support
 * - Comprehensive delivery tracking and analytics
 * - User preference integration
 * - Queue-based processing with retry logic
 * - Template variable support
 * - Audit trail and compliance features
 * - Performance metrics and monitoring
 *
 * @class Notification
 * @extends Document
 * @since 2025-01-15
 */
@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification extends Document {
  // Core notification information
  @Prop({
    required: true,
    enum: NotificationType,
  })
  type: NotificationType;

  @Prop({
    required: true,
    enum: NotificationStatus,
    default: NotificationStatus.DRAFT,
  })
  status: NotificationStatus;

  @Prop({
    required: true,
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority: NotificationPriority;

  // Recipient information
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId: Types.ObjectId;

  @Prop()
  recipientEmail?: string;

  @Prop()
  recipientName?: string;

  // Content and template information
  @Prop({ type: NotificationContentSchema, required: true })
  content: NotificationContent;

  @Prop({ type: Object })
  templateVariables?: NotificationTemplateVariables;

  // Context and metadata
  @Prop({ type: NotificationContextSchema, required: true })
  context: NotificationContext;

  // Delivery channel configuration
  @Prop([
    {
      type: String,
      enum: NotificationChannel,
    },
  ])
  channels: NotificationChannel[];

  @Prop([
    {
      type: String,
      enum: NotificationChannel,
    },
  ])
  deliveredChannels: NotificationChannel[];

  @Prop([
    {
      type: String,
      enum: NotificationChannel,
    },
  ])
  failedChannels: NotificationChannel[];

  // Scheduling and delivery management
  @Prop({ default: Date.now })
  scheduledAt: Date;

  @Prop()
  processedAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;

  @Prop()
  expiresAt?: Date;

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

  // Queue and batch information
  @Prop()
  queueJobId?: string;

  @Prop()
  batchId?: string;

  @Prop()
  bulkNotificationId?: string;

  // Related entities
  @Prop({ type: Types.ObjectId, ref: 'Form' })
  formId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Submission' })
  submissionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'EmailDelivery' })
  emailDeliveryId?: Types.ObjectId;

  // Delivery tracking
  @Prop({ type: [NotificationDeliveryAttemptSchema], default: [] })
  attempts: NotificationDeliveryAttempt[];

  @Prop({ type: NotificationAnalyticsSchema })
  analytics?: NotificationAnalytics;

  // Performance metrics
  @Prop()
  queuedDuration?: number; // Time in queue (ms)

  @Prop()
  processingDuration?: number; // Processing time (ms)

  @Prop()
  totalDeliveryTime?: number; // End-to-end delivery time (ms)

  // User preferences applied
  @Prop({ type: Object })
  appliedPreferences?: Record<string, unknown>;

  // Digest information
  @Prop({ default: false })
  isDigest: boolean;

  @Prop()
  digestPeriod?: string;

  @Prop([{ type: Types.ObjectId, ref: 'Notification' }])
  digestNotifications?: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Notification' })
  parentDigestId?: Types.ObjectId;

  // Archive and retention
  @Prop({ default: false })
  archived: boolean;

  @Prop()
  archivedAt?: Date;

  @Prop()
  retentionExpiresAt?: Date;

  // GDPR and compliance
  @Prop({ default: false })
  gdprProcessed: boolean;

  @Prop()
  gdprProcessedAt?: Date;

  @Prop({ default: false })
  userConsent: boolean;

  @Prop()
  consentVersion?: string;

  // Audit trail
  @Prop({ type: Object })
  auditLog?: Record<string, unknown>;

  @Prop()
  createdBy?: string; // User ID or system identifier

  @Prop()
  modifiedBy?: string;

  // A/B testing and personalization
  @Prop()
  experimentId?: string;

  @Prop()
  variantId?: string;

  @Prop()
  personalizationScore?: number;

  // Analytics and tracking pixels
  @Prop()
  trackingPixelUrl?: string;

  @Prop({ default: false })
  trackingPixelLoaded: boolean;

  @Prop()
  trackingPixelLoadedAt?: Date;

  // External system integration
  @Prop()
  externalId?: string;

  @Prop()
  externalSystem?: string;

  @Prop({ type: Object })
  externalMetadata?: Record<string, unknown>;
}

// Export schema and document type
export const NotificationSchema = SchemaFactory.createForClass(Notification);

/**
 * Notification Document interface
 */
export interface NotificationDocument extends Notification {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for optimal query performance
NotificationSchema.index({ recipientId: 1, status: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ 'context.sourceType': 1, 'context.sourceId': 1 });
NotificationSchema.index({ channels: 1, priority: 1 });
NotificationSchema.index({ batchId: 1 });
NotificationSchema.index({ bulkNotificationId: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ retentionExpiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ archived: 1, archivedAt: 1 });
NotificationSchema.index({ 'analytics.readAt': 1 });
NotificationSchema.index({ 'analytics.clickedAt': 1 });

// Virtual for delivery rate calculation
NotificationSchema.virtual('deliveryRate').get(function () {
  if (this.channels.length === 0) return 0;
  return (this.deliveredChannels.length / this.channels.length) * 100;
});

// Virtual for read status
NotificationSchema.virtual('isRead').get(function () {
  return !!this.readAt;
});

// Virtual for delivery status
NotificationSchema.virtual('isDelivered').get(function () {
  return this.deliveredChannels.length > 0;
});

// Virtual for failure status
NotificationSchema.virtual('hasFailed').get(function () {
  return this.failedChannels.length > 0;
});
