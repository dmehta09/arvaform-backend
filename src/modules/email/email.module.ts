import { Global, Module } from '@nestjs/common';
import { EmailConfig, createEmailConfig } from '../../config/email.config';
import { EmailService } from './email.service';
import { AwsSesProvider } from './providers/aws-ses.provider';
import { SendGridProvider } from './providers/sendgrid.provider';

/**
 * Email Module
 *
 * Global module providing email functionality across the entire application.
 * Configures email providers (SendGrid, AWS SES), implements provider abstraction,
 * and exports the main EmailService for dependency injection.
 *
 * @module EmailModule
 * @global
 * @since 2025-01-15
 */
@Global()
@Module({
  providers: [
    // Configuration provider
    {
      provide: EmailConfig,
      useFactory: createEmailConfig,
    },

    // Email provider implementations
    SendGridProvider,
    AwsSesProvider,

    // Main email service
    EmailService,
  ],
  exports: [EmailService, EmailConfig],
})
export class EmailModule {
  constructor(private readonly emailService: EmailService) {
    // Module initialization is handled by EmailService.onModuleInit()
  }
}
