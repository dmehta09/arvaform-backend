import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailConfig, createEmailConfig } from '../../config/email.config';
import { EmailService } from './email.service';
import { EmailTemplate, EmailTemplateSchema } from './entities/email-template.entity';
import { AwsSesProvider } from './providers/aws-ses.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import { TemplateService } from './template.service';

/**
 * Email Module
 *
 * Global module providing comprehensive email functionality across the entire application.
 * Configures email providers (SendGrid, AWS SES), implements provider abstraction,
 * template management with Handlebars and MJML support, and exports services for DI.
 *
 * Features:
 * - Email service with provider abstraction and failover
 * - Template engine with Handlebars and MJML support
 * - Template versioning and analytics
 * - Security validation and caching
 * - MongoDB integration for template storage
 *
 * @module EmailModule
 * @global
 * @since 2025-01-15
 */
@Global()
@Module({
  imports: [
    // MongoDB schema registration
    MongooseModule.forFeature([{ name: EmailTemplate.name, schema: EmailTemplateSchema }]),
  ],
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
  ],
  exports: [EmailService, TemplateService, EmailConfig],
})
export class EmailModule {
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
  ) {
    // Module initialization is handled by service onModuleInit methods
  }
}
