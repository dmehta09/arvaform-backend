import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailModule } from '../email/email.module';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from './entities/notification-preference.entity';
import { Notification, NotificationSchema } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationConsumerService } from './services/notification-consumer.service';
import { NotificationQueueService } from './services/notification-queue.service';

/**
 * Notifications Module
 *
 * Comprehensive notification system module for ArvaForm platform.
 * Provides multi-channel notification capabilities with queue-based
 * processing, user preference management, analytics, and delivery tracking.
 *
 * Features:
 * - Multi-channel notifications (email, in-app, push, webhook, SMS)
 * - Queue-based processing with BullMQ
 * - User preference management with granular controls
 * - Comprehensive analytics and reporting
 * - Bulk notification processing
 * - Scheduled notification support
 * - Delivery tracking and retry logic
 * - GDPR compliance features
 *
 * Dependencies:
 * - MongoDB for notification and preference storage
 * - Redis for queue management and caching
 * - Email module for email delivery
 * - BullMQ for reliable background processing
 *
 * Architecture:
 * - Modular design with clear separation of concerns
 * - Service-oriented architecture with DI
 * - Event-driven processing with queues
 * - Scalable for high-volume scenarios
 *
 * @module NotificationsModule
 * @since 2025-01-15
 */
@Module({
  imports: [
    // MongoDB schemas for notification storage
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
    ]),

    // Bull queue configuration for notification processing
    BullModule.registerQueue({
      name: 'notifications',
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3, // Default retry attempts
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 second delay
        },
      },
      settings: {
        stalledInterval: 30 * 1000, // 30 seconds
        maxStalledCount: 1,
      },
    }),

    // Email queue for email notifications
    BullModule.registerQueue({
      name: 'email-notifications',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 5, // More retries for email delivery
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay for emails
        },
      },
    }),

    // Push notification queue
    BullModule.registerQueue({
      name: 'push-notifications',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    }),

    // Webhook notification queue
    BullModule.registerQueue({
      name: 'webhook-notifications',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 5, // More retries for webhooks
        backoff: {
          type: 'exponential',
          delay: 1000, // Faster retry for webhooks
        },
      },
    }),

    // SMS notification queue
    BullModule.registerQueue({
      name: 'sms-notifications',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),

    // In-app notification queue (for real-time processing)
    BullModule.registerQueue({
      name: 'in-app-notifications',
      defaultJobOptions: {
        removeOnComplete: 200, // Keep more for analytics
        removeOnFail: 50,
        attempts: 2, // Less retries for in-app
        backoff: {
          type: 'fixed',
          delay: 1000, // Fixed delay for in-app
        },
      },
    }),

    // Import email module for email delivery integration
    EmailModule,
  ],

  controllers: [NotificationsController],

  providers: [
    NotificationsService,
    NotificationQueueService,
    NotificationConsumerService,

    // Queue processors (consumers) for each notification type
    {
      provide: 'NOTIFICATION_QUEUE_PROCESSOR',
      useClass: NotificationConsumerService,
    },
  ],

  exports: [
    NotificationsService,
    NotificationQueueService,

    // Export for use in other modules
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
    ]),
  ],
})
export class NotificationsModule {
  /**
   * Module configuration hook
   * Performs any necessary initialization when the module is created
   */
  constructor() {
    // Log module initialization
    console.log('🔔 Notifications Module initialized');
    console.log('📧 Email notifications: Enabled');
    console.log('📱 In-app notifications: Enabled');
    console.log('🔔 Push notifications: Enabled');
    console.log('🌐 Webhook notifications: Enabled');
    console.log('📲 SMS notifications: Enabled');
    console.log('⚡ Queue processing: Active');
    console.log('📊 Analytics tracking: Enabled');
    console.log('🔒 GDPR compliance: Active');
  }
}

/**
 * Export notification module for global use
 */
export { NotificationsModule as default };

/**
 * Export all notification components for external use
 */
export {
  Notification,
  NotificationConsumerService,
  NotificationPreference,
  NotificationQueueService,
  NotificationsController,
  NotificationsService,
};

/**
 * Export notification types and DTOs
 */
export * from './dto/notification.dto';
export * from './types/notification.types';
