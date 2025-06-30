/**
 * Notification Types and Enums
 *
 * Comprehensive type definitions for the multi-channel notification system.
 * Supports email, in-app, push, and webhook notifications with user preferences,
 * delivery tracking, and analytics capabilities.
 *
 * @module NotificationTypes
 * @since 2025-01-15
 */

/**
 * Notification Channel Types
 * Defines all supported notification delivery channels
 */
export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
  PUSH = 'push',
  WEBHOOK = 'webhook',
  SMS = 'sms', // Future support
}

/**
 * Notification Types
 * Categorizes notifications by purpose and content
 */
export enum NotificationType {
  // Form-related notifications
  FORM_SUBMISSION = 'form_submission',
  FORM_PUBLISHED = 'form_published',
  FORM_UNPUBLISHED = 'form_unpublished',
  FORM_SHARED = 'form_shared',

  // User-related notifications
  USER_WELCOME = 'user_welcome',
  USER_PASSWORD_RESET = 'user_password_reset',
  USER_EMAIL_VERIFICATION = 'user_email_verification',
  USER_ACCOUNT_LOCKED = 'user_account_locked',

  // System notifications
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SYSTEM_UPDATE = 'system_update',
  SYSTEM_ALERT = 'system_alert',

  // Integration notifications
  INTEGRATION_CONNECTED = 'integration_connected',
  INTEGRATION_DISCONNECTED = 'integration_disconnected',
  INTEGRATION_ERROR = 'integration_error',

  // Analytics notifications
  ANALYTICS_REPORT = 'analytics_report',
  ANALYTICS_THRESHOLD = 'analytics_threshold',

  // Security notifications
  SECURITY_LOGIN_ATTEMPT = 'security_login_attempt',
  SECURITY_PASSWORD_CHANGED = 'security_password_changed',
  SECURITY_SUSPICIOUS_ACTIVITY = 'security_suspicious_activity',
}

/**
 * Notification Status
 * Tracks the delivery lifecycle of notifications
 */
export enum NotificationStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  CLICKED = 'clicked',
  FAILED = 'failed',
  RETRY_SCHEDULED = 'retry_scheduled',
  PERMANENTLY_FAILED = 'permanently_failed',
  CANCELLED = 'cancelled',
}

/**
 * Notification Priority
 * Determines processing order and delivery urgency
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

/**
 * Notification Frequency Preferences
 * Controls how often users receive notifications
 */
export enum NotificationFrequency {
  IMMEDIATE = 'immediate',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  DISABLED = 'disabled',
}

/**
 * Notification Digest Types
 * For grouped notification delivery
 */
export enum NotificationDigestType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Notification Template Variables
 * Common variables available in notification templates
 */
export interface NotificationTemplateVariables {
  // User information
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };

  // Form information
  form?: {
    id: string;
    title: string;
    description?: string;
    url?: string;
  };

  // Submission information
  submission?: {
    id: string;
    submittedAt: Date;
    data?: Record<string, unknown>;
  };

  // System information
  system?: {
    appName: string;
    appUrl: string;
    supportEmail: string;
    currentDate: Date;
  };

  // Custom variables
  custom?: Record<string, unknown>;
}

/**
 * Notification Delivery Attempt
 * Tracks individual delivery attempts across channels
 */
export interface NotificationDeliveryAttempt {
  timestamp: Date;
  channel: NotificationChannel;
  status: NotificationStatus;
  providerId?: string;
  providerMessageId?: string;
  responseCode?: number;
  errorMessage?: string;
  errorCode?: string;
  providerResponse?: Record<string, unknown>;
  duration?: number; // milliseconds
}

/**
 * Notification Analytics
 * Comprehensive tracking for notification engagement
 */
export interface NotificationAnalytics {
  // Delivery metrics
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;

  // Engagement metrics
  readCount: number;
  clickCount: number;
  clickedUrls: string[];

  // Device and location data
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
  location?: string;

  // Timing metrics
  deliveryDuration?: number; // Time to deliver (ms)
  timeToRead?: number; // Time from delivery to read (ms)
  timeToClick?: number; // Time from delivery to click (ms)
}

/**
 * Notification Preference Settings
 * Granular control over notification delivery
 */
export interface NotificationPreferenceSettings {
  enabled: boolean;
  channels: NotificationChannel[];
  frequency: NotificationFrequency;
  digestType: NotificationDigestType;
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
  };
  customSettings?: Record<string, unknown>;
}

/**
 * Notification Content
 * Multi-channel content structure
 */
export interface NotificationContent {
  // Universal content
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;

  // Channel-specific content
  email?: {
    subject: string;
    htmlContent?: string;
    textContent?: string;
    templateId?: string;
  };

  inApp?: {
    icon?: string;
    iconColor?: string;
    persistent?: boolean;
    actionable?: boolean;
  };

  push?: {
    badge?: number;
    sound?: string;
    category?: string;
    threadId?: string;
  };

  webhook?: {
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
  };
}

/**
 * Notification Context
 * Additional context information for notifications
 */
export interface NotificationContext {
  // Source information
  sourceType: 'form' | 'user' | 'system' | 'integration' | 'analytics' | 'security';
  sourceId?: string;

  // Trigger information
  triggeredBy?: string; // User ID who triggered the notification
  triggeredAt: Date;
  triggerEvent?: string;

  // Routing information
  audience?: 'user' | 'admin' | 'system' | 'public';
  audienceFilter?: Record<string, unknown>;

  // Scheduling information
  scheduledFor?: Date;
  timezone?: string;

  // Metadata
  tags: string[];
  category?: string;
  group?: string;

  // Related entities
  relatedEntities?: Array<{
    type: string;
    id: string;
  }>;
}

/**
 * Bulk Notification Options
 * Configuration for batch notification processing
 */
export interface BulkNotificationOptions {
  batchSize: number;
  delayBetweenBatches: number; // milliseconds
  maxConcurrency: number;
  failureThreshold: number; // percentage
  retryFailedBatches: boolean;
}

/**
 * Notification Queue Job Data
 * Structure for BullMQ job data
 */
export interface NotificationQueueJobData {
  notificationId: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  scheduledFor?: Date;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Notification Event Data
 * For event-driven notification triggers
 */
export interface NotificationEventData {
  eventType: string;
  eventSource: string;
  eventData: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

/**
 * Notification Report Data
 * Analytics and reporting structures
 */
export interface NotificationReportData {
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalClicked: number;
    deliveryRate: number;
    readRate: number;
    clickRate: number;
  };
  byChannel: Record<
    NotificationChannel,
    {
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    }
  >;
  byType: Record<
    NotificationType,
    {
      sent: number;
      avgDeliveryTime: number;
      avgReadTime: number;
    }
  >;
  trends: Array<{
    date: Date;
    sent: number;
    delivered: number;
    read: number;
  }>;
}
