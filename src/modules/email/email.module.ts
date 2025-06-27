import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailConfig, createEmailConfig } from '../../config/email.config';
import { EmailDeliveryService } from './delivery.service';
import { EmailDeliveryController } from './email-delivery.controller';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailDelivery, EmailDeliverySchema } from './entities/email-delivery.entity';
import { EmailTemplate, EmailTemplateSchema } from './entities/email-template.entity';
import { AwsSesProvider } from './providers/aws-ses.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import { EmailQueueService } from './queue/email-queue.service';
import { TemplateService } from './template.service';

/**
 * Email Module
 *
 * Global module providing comprehensive email functionality across the entire application.
 * Configures email providers (SendGrid, AWS SES), implements provider abstraction,
 * template management with Handlebars and MJML support, queue-based delivery system
 * with retry logic, and exports services for DI.
 *
 * Features:
 * - Email service with provider abstraction and failover
 * - Template engine with Handlebars and MJML support
 * - Queue-based email delivery with Bull and Redis
 * - Comprehensive retry logic with exponential backoff
 * - Delivery tracking and analytics
 * - Template versioning and analytics
 * - Security validation and caching
 * - MongoDB integration for template and delivery storage
 *
 * @module EmailModule
 * @global
 * @since 2025-01-15
 */
@Global()
@Module({
  imports: [
    // MongoDB schema registration
    MongooseModule.forFeature([
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
      { name: EmailDelivery.name, schema: EmailDeliverySchema },
    ]),

    // Bull Queue configuration for email delivery
    BullModule.registerQueue({
      name: 'email-delivery',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3, // Default retry attempts
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 second delay
        },
      },
    }),
  ],
  controllers: [EmailController, EmailDeliveryController],
  providers: [
    // Configuration provider
    {
      provide: EmailConfig,
      useFactory: createEmailConfig,
    },

    // Email provider implementations
    SendGridProvider,
    AwsSesProvider,

    // Core email services
    EmailService,
    TemplateService,

    // Email delivery system
    EmailDeliveryService,
    EmailQueueService,
  ],
  exports: [EmailService, TemplateService, EmailConfig, EmailDeliveryService, EmailQueueService],
})
export class EmailModule {
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailDeliveryService: EmailDeliveryService,
  ) {
    // Module initialization is handled by service onModuleInit methods
  }
}
