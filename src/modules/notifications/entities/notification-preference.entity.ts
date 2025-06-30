import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationDigestType,
  NotificationFrequency,
  NotificationType,
} from '../types/notification.types';

/**
 * Quiet Hours Schema
 * Defines time periods when notifications should be suppressed
 */
@Schema({ _id: false })
export class QuietHoursSchema {
  @Prop({ required: true, default: true })
  enabled: boolean;

  @Prop({ required: true, default: '22:00' })
  startTime: string; // HH:MM format

  @Prop({ required: true, default: '08:00' })
  endTime: string; // HH:MM format

  @Prop({ required: true, default: 'UTC' })
  timezone: string;
}

/**
 * Channel Preference Schema
 * Per-channel notification settings
 */
@Schema({ _id: false })
export class ChannelPreferenceSchema {
  @Prop({ required: true, enum: NotificationChannel })
  channel: NotificationChannel;

  @Prop({ required: true, default: true })
  enabled: boolean;

  @Prop({
    required: true,
    enum: NotificationFrequency,
    default: NotificationFrequency.IMMEDIATE,
  })
  frequency: NotificationFrequency;

  @Prop({
    required: true,
    enum: NotificationDigestType,
    default: NotificationDigestType.NONE,
  })
  digestType: NotificationDigestType;

  @Prop({ type: QuietHoursSchema })
  quietHours?: QuietHoursSchema;

  @Prop({ type: Object })
  customSettings?: Record<string, unknown>;
}

/**
 * Type Preference Schema
 * Per-notification-type settings
 */
@Schema({ _id: false })
export class TypePreferenceSchema {
  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  @Prop({ required: true, default: true })
  enabled: boolean;

  @Prop([
    {
      type: String,
      enum: NotificationChannel,
    },
  ])
  allowedChannels: NotificationChannel[];

  @Prop([
    {
      type: String,
      enum: NotificationChannel,
    },
  ])
  preferredChannels: NotificationChannel[];

  @Prop({
    enum: NotificationFrequency,
    default: NotificationFrequency.IMMEDIATE,
  })
  frequency?: NotificationFrequency;

  @Prop({
    enum: NotificationDigestType,
    default: NotificationDigestType.NONE,
  })
  digestType?: NotificationDigestType;

  @Prop({ type: Object })
  customSettings?: Record<string, unknown>;
}

/**
 * Digest Schedule Schema
 * Configuration for digest notifications
 */
@Schema({ _id: false })
export class DigestScheduleSchema {
  @Prop({
    required: true,
    enum: NotificationDigestType,
  })
  type: NotificationDigestType;

  @Prop({ required: true, default: true })
  enabled: boolean;

  @Prop({ required: true, default: '09:00' })
  deliveryTime: string; // HH:MM format

  @Prop({ required: true, default: 'UTC' })
  timezone: string;

  @Prop({ default: 1 }) // 1 = Monday for weekly, 1 = 1st day for monthly
  dayOfWeek?: number;

  @Prop({ default: 1 }) // Day of month for monthly digest
  dayOfMonth?: number;

  @Prop({ default: 5 }) // Minimum notifications to trigger digest
  minNotifications: number;

  @Prop({ default: 50 }) // Maximum notifications in a single digest
  maxNotifications: number;

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
      enum: NotificationType,
    },
  ])
  includedTypes: NotificationType[];

  @Prop([
    {
      type: String,
      enum: NotificationType,
    },
  ])
  excludedTypes: NotificationType[];
}

/**
 * Notification Preference Entity
 *
 * Comprehensive user notification preference management system.
 * Provides granular control over notification delivery channels,
 * frequency settings, quiet hours, digest preferences, and per-type
 * customization.
 *
 * Features:
 * - Per-channel preference management
 * - Per-notification-type settings
 * - Quiet hours with timezone support
 * - Digest notification scheduling
 * - Global notification controls
 * - Custom settings support
 * - Audit trail for preference changes
 * - GDPR compliance features
 *
 * @class NotificationPreference
 * @extends Document
 * @since 2025-01-15
 */
@Schema({
  timestamps: true,
  collection: 'notification_preferences',
})
export class NotificationPreference extends Document {
  // User association
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  // Global notification settings
  @Prop({ required: true, default: true })
  globalEnabled: boolean;

  @Prop()
  globalDisabledUntil?: Date;

  @Prop()
  globalDisabledReason?: string;

  // Default preferences
  @Prop([
    {
      type: String,
      enum: NotificationChannel,
    },
  ])
  defaultChannels: NotificationChannel[];

  @Prop({
    enum: NotificationFrequency,
    default: NotificationFrequency.IMMEDIATE,
  })
  defaultFrequency: NotificationFrequency;

  @Prop({
    enum: NotificationDigestType,
    default: NotificationDigestType.NONE,
  })
  defaultDigestType: NotificationDigestType;

  // Channel-specific preferences
  @Prop({ type: [ChannelPreferenceSchema], default: [] })
  channelPreferences: ChannelPreferenceSchema[];

  // Type-specific preferences
  @Prop({ type: [TypePreferenceSchema], default: [] })
  typePreferences: TypePreferenceSchema[];

  // Global quiet hours
  @Prop({ type: QuietHoursSchema })
  globalQuietHours?: QuietHoursSchema;

  // Digest settings
  @Prop({ type: [DigestScheduleSchema], default: [] })
  digestSchedules: DigestScheduleSchema[];

  @Prop()
  lastDigestSent?: Date;

  @Prop()
  nextDigestScheduled?: Date;

  // Advanced settings
  @Prop({ default: true })
  allowMarketing: boolean;

  @Prop({ default: true })
  allowAnalytics: boolean;

  @Prop({ default: true })
  allowPersonalization: boolean;

  @Prop({ default: true })
  allowThirdPartyIntegrations: boolean;

  // Mobile and push settings
  @Prop()
  pushToken?: string;

  @Prop()
  pushPlatform?: string; // 'ios', 'android', 'web'

  @Prop({ default: true })
  pushEnabled: boolean;

  @Prop([String])
  deviceTokens: string[];

  // Email settings
  @Prop({ default: true })
  emailEnabled: boolean;

  @Prop()
  alternativeEmail?: string;

  @Prop({ default: 'html' })
  emailFormat: string; // 'html', 'text', 'both'

  // In-app notification settings
  @Prop({ default: true })
  inAppEnabled: boolean;

  @Prop({ default: 24 }) // Hours to keep in-app notifications
  inAppRetentionHours: number;

  @Prop({ default: true })
  inAppSoundEnabled: boolean;

  @Prop({ default: true })
  inAppBadgeEnabled: boolean;

  // Webhook settings
  @Prop({ default: false })
  webhookEnabled: boolean;

  @Prop()
  webhookUrl?: string;

  @Prop({ type: Object })
  webhookHeaders?: Record<string, string>;

  @Prop()
  webhookSecret?: string;

  // Language and localization
  @Prop({ default: 'en' })
  language: string;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({ default: 'en-US' })
  locale: string;

  // Custom preferences
  @Prop({ type: Object })
  customPreferences?: Record<string, unknown>;

  // Preference history and audit
  @Prop({ type: Object })
  preferenceHistory?: Record<string, unknown>;

  @Prop()
  lastModifiedBy?: string; // User ID or system

  @Prop()
  lastImportedFrom?: string; // Source of bulk import

  // GDPR and consent
  @Prop({ default: true })
  consentGiven: boolean;

  @Prop()
  consentGivenAt?: Date;

  @Prop()
  consentVersion?: string;

  @Prop()
  consentSource?: string; // 'registration', 'settings', 'import'

  @Prop({ default: false })
  marketingConsent: boolean;

  @Prop()
  marketingConsentAt?: Date;

  // Unsubscribe tracking
  @Prop([
    {
      type: {
        type: { type: String, enum: NotificationType },
        channel: { type: String, enum: NotificationChannel },
        unsubscribedAt: { type: Date, default: Date.now },
        reason: { type: String },
        source: { type: String }, // 'settings', 'email_link', 'complaint'
      },
    },
  ])
  unsubscribeHistory: Array<{
    type: NotificationType;
    channel: NotificationChannel;
    unsubscribedAt: Date;
    reason?: string;
    source?: string;
  }>;

  // Analytics and insights
  @Prop({ default: 0 })
  totalNotificationsReceived: number;

  @Prop({ default: 0 })
  totalNotificationsRead: number;

  @Prop({ default: 0 })
  totalNotificationsClicked: number;

  @Prop()
  lastNotificationReceivedAt?: Date;

  @Prop()
  lastNotificationReadAt?: Date;

  @Prop()
  lastNotificationClickedAt?: Date;

  @Prop({ default: 0 })
  engagementScore: number; // 0-100 calculated score

  @Prop()
  lastEngagementCalculatedAt?: Date;

  // Migration and versioning
  @Prop({ default: '1.0' })
  schemaVersion: string;

  @Prop()
  migratedFrom?: string; // Previous system or version

  @Prop()
  migrationMetadata?: Record<string, unknown>;

  // Temporary overrides
  @Prop([
    {
      type: {
        type: { type: String, enum: NotificationType },
        channels: [{ type: String, enum: NotificationChannel }],
        enabled: { type: Boolean },
        expiresAt: { type: Date },
        reason: { type: String },
      },
    },
  ])
  temporaryOverrides: Array<{
    type: NotificationType;
    channels: NotificationChannel[];
    enabled: boolean;
    expiresAt: Date;
    reason?: string;
  }>;

  // Smart delivery preferences
  @Prop({ default: false })
  smartDeliveryEnabled: boolean;

  @Prop({ default: false })
  adaptiveFrequencyEnabled: boolean;

  @Prop({ default: false })
  intelligentChannelSelectionEnabled: boolean;

  @Prop({ type: Object })
  deliveryPatterns?: Record<string, unknown>; // ML-based delivery insights
}

// Export schema and document type
export const NotificationPreferenceSchema = SchemaFactory.createForClass(NotificationPreference);

/**
 * Notification Preference Document interface
 */
export interface NotificationPreferenceDocument extends NotificationPreference {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for optimal query performance
NotificationPreferenceSchema.index({ userId: 1 }, { unique: true });
NotificationPreferenceSchema.index({ globalEnabled: 1 });
NotificationPreferenceSchema.index({
  'channelPreferences.channel': 1,
  'channelPreferences.enabled': 1,
});
NotificationPreferenceSchema.index({ 'typePreferences.type': 1, 'typePreferences.enabled': 1 });
NotificationPreferenceSchema.index({ 'digestSchedules.type': 1, 'digestSchedules.enabled': 1 });
NotificationPreferenceSchema.index({ pushToken: 1 });
NotificationPreferenceSchema.index({ webhookUrl: 1 });
NotificationPreferenceSchema.index({ consentGiven: 1, marketingConsent: 1 });
NotificationPreferenceSchema.index(
  { 'temporaryOverrides.expiresAt': 1 },
  { expireAfterSeconds: 0 },
);

// Virtual for effective preferences calculation
NotificationPreferenceSchema.virtual('effectivePreferences').get(function () {
  const now = new Date();

  // Apply temporary overrides that haven't expired
  const activeOverrides = this.temporaryOverrides.filter(override => override.expiresAt > now);

  // Calculate effective settings based on defaults, specific preferences, and overrides
  const effective = {
    channels: this.defaultChannels,
    frequency: this.defaultFrequency,
    digestType: this.defaultDigestType,
    globalEnabled: this.globalEnabled,
    activeOverrides,
  };

  return effective;
});

// Virtual for engagement rate calculation
NotificationPreferenceSchema.virtual('engagementRate').get(function () {
  if (this.totalNotificationsReceived === 0) return 0;
  return (this.totalNotificationsRead / this.totalNotificationsReceived) * 100;
});

// Virtual for click rate calculation
NotificationPreferenceSchema.virtual('clickRate').get(function () {
  if (this.totalNotificationsRead === 0) return 0;
  return (this.totalNotificationsClicked / this.totalNotificationsRead) * 100;
});

// Method to check if notifications are allowed for a specific type and channel
NotificationPreferenceSchema.methods.isNotificationAllowed = function (
  type: NotificationType,
  channel: NotificationChannel,
  currentTime?: Date,
): boolean {
  if (!this.globalEnabled) return false;

  const now = currentTime || new Date();

  // Check global disabled until
  if (this.globalDisabledUntil && this.globalDisabledUntil > now) {
    return false;
  }

  // Check temporary overrides
  const activeOverride = this.temporaryOverrides.find(
    override =>
      override.type === type && override.channels.includes(channel) && override.expiresAt > now,
  );

  if (activeOverride) {
    return activeOverride.enabled;
  }

  // Check type-specific preferences
  const typePreference = this.typePreferences.find(pref => pref.type === type);
  if (typePreference) {
    if (!typePreference.enabled) return false;
    if (!typePreference.allowedChannels.includes(channel)) return false;
  }

  // Check channel-specific preferences
  const channelPreference = this.channelPreferences.find(pref => pref.channel === channel);
  if (channelPreference && !channelPreference.enabled) {
    return false;
  }

  // Check quiet hours
  if (this.isInQuietHours(channel, now)) {
    return false;
  }

  return true;
};

// Method to check if current time is within quiet hours
NotificationPreferenceSchema.methods.isInQuietHours = function (
  channel: NotificationChannel,
  currentTime?: Date,
): boolean {
  const now = currentTime || new Date();

  // Check global quiet hours
  if (this.globalQuietHours?.enabled) {
    if (this.isTimeInQuietPeriod(this.globalQuietHours, now)) {
      return true;
    }
  }

  // Check channel-specific quiet hours
  const channelPreference = this.channelPreferences.find(pref => pref.channel === channel);
  if (channelPreference?.quietHours?.enabled) {
    return this.isTimeInQuietPeriod(channelPreference.quietHours, now);
  }

  return false;
};

// Helper method to check if time is in quiet period
NotificationPreferenceSchema.methods.isTimeInQuietPeriod = function (
  quietHours: QuietHoursSchema,
  currentTime: Date,
): boolean {
  // This would need proper timezone handling in a real implementation
  // For now, simplified version
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = quietHours.startTime.split(':').map(Number);
  const [endHour, endMinute] = quietHours.endTime.split(':').map(Number);

  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;

  if (startTimeMinutes <= endTimeMinutes) {
    // Same day quiet hours
    return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
  } else {
    // Quiet hours cross midnight
    return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
  }
};
