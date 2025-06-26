import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailConfig } from '../../config/email.config';
import {
  BulkEmailRequest,
  EmailBulkSendResult,
  EmailProvider,
  EmailProviderHealthCheck,
  EmailProviderStats,
  EmailSendResult,
} from './interfaces/email-provider.interface';
import { AwsSesProvider } from './providers/aws-ses.provider';
import { SendGridProvider } from './providers/sendgrid.provider';

/**
 * Email Service
 *
 * Main orchestration service for email functionality with provider abstraction,
 * failover support, rate limiting, retry logic, and comprehensive monitoring.
 * Follows the facade pattern to provide a simple interface for email operations.
 *
 * @class EmailService
 * @implements OnModuleInit
 * @since 2025-01-15
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private providers: Map<string, EmailProvider> = new Map();
  private primaryProvider: EmailProvider | null = null;
  private fallbackProviders: EmailProvider[] = [];

  private rateLimitCounters = {
    perSecond: 0,
    perMinute: 0,
    perHour: 0,
    perDay: 0,
    lastResetTimes: {
      second: Date.now(),
      minute: Date.now(),
      hour: Date.now(),
      day: Date.now(),
    },
  };

  constructor(
    private readonly emailConfig: EmailConfig,
    private readonly sendGridProvider: SendGridProvider,
    private readonly awsSesProvider: AwsSesProvider,
  ) {}

  /**
   * Initialize email service and providers on module startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Email Service...');

    try {
      // Register available providers
      this.registerProviders();

      // Set primary and fallback providers
      this.configurePrimaryProvider();

      // Perform initial health checks
      await this.performInitialHealthChecks();

      this.logger.log('Email Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Email Service', error);
      throw error;
    }
  }

  /**
   * Send a simple email with automatic provider selection and failover
   */
  async sendEmail(
    to: string,
    subject: string,
    content: string,
    from?: string,
  ): Promise<EmailSendResult> {
    // Check rate limits
    if (!this.checkRateLimit()) {
      return this.createRateLimitError();
    }

    // Try primary provider first, then fallback providers
    let lastError: string = 'No providers available';

    // Try primary provider
    if (this.primaryProvider) {
      try {
        const result = await this.sendWithRetry(
          () => this.primaryProvider!.sendEmail(to, subject, content, from),
          'primary',
        );

        if (result.success) {
          this.updateRateLimitCounters();
          return result;
        }
        lastError = result.error || 'Primary provider failed';
      } catch (error) {
        this.logger.warn(`Primary provider failed for ${to}`, error);
        lastError = error instanceof Error ? error.message : 'Primary provider error';
      }
    }

    // Try fallback providers
    for (const provider of this.fallbackProviders) {
      try {
        const result = await this.sendWithRetry(
          () => provider.sendEmail(to, subject, content, from),
          'fallback',
        );

        if (result.success) {
          this.updateRateLimitCounters();
          this.logger.warn(`Used fallback provider for ${to}`);
          return result;
        }
        lastError = result.error || 'Fallback provider failed';
      } catch (error) {
        this.logger.warn(`Fallback provider failed for ${to}`, error);
        lastError = error instanceof Error ? error.message : 'Fallback provider error';
      }
    }

    // All providers failed
    this.logger.error(`All email providers failed for ${to}. Last error: ${lastError}`);
    return {
      success: false,
      providerId: 'email-service',
      timestamp: new Date(),
      error: `All providers failed: ${lastError}`,
    };
  }

  /**
   * Send template email with automatic provider selection and failover
   */
  async sendTemplateEmail(
    to: string,
    templateId: string,
    variables: Record<string, string | number | boolean>,
    from?: string,
  ): Promise<EmailSendResult> {
    // Check rate limits
    if (!this.checkRateLimit()) {
      return this.createRateLimitError();
    }

    let lastError: string = 'No providers available';

    // Try primary provider first
    if (this.primaryProvider) {
      try {
        const result = await this.sendWithRetry(
          () => this.primaryProvider!.sendTemplateEmail(to, templateId, variables, from),
          'primary',
        );

        if (result.success) {
          this.updateRateLimitCounters();
          return result;
        }
        lastError = result.error || 'Primary provider failed';
      } catch (error) {
        this.logger.warn(`Primary provider template email failed for ${to}`, error);
        lastError = error instanceof Error ? error.message : 'Primary provider error';
      }
    }

    // Try fallback providers
    for (const provider of this.fallbackProviders) {
      try {
        const result = await this.sendWithRetry(
          () => provider.sendTemplateEmail(to, templateId, variables, from),
          'fallback',
        );

        if (result.success) {
          this.updateRateLimitCounters();
          this.logger.warn(`Used fallback provider for template email to ${to}`);
          return result;
        }
        lastError = result.error || 'Fallback provider failed';
      } catch (error) {
        this.logger.warn(`Fallback provider template email failed for ${to}`, error);
        lastError = error instanceof Error ? error.message : 'Fallback provider error';
      }
    }

    // All providers failed
    this.logger.error(`All template email providers failed for ${to}. Last error: ${lastError}`);
    return {
      success: false,
      providerId: 'email-service',
      timestamp: new Date(),
      error: `All providers failed: ${lastError}`,
    };
  }

  /**
   * Send bulk emails using the most appropriate provider
   */
  async sendBulkEmails(emails: BulkEmailRequest[]): Promise<EmailBulkSendResult> {
    if (!this.primaryProvider) {
      return {
        success: false,
        totalSent: 0,
        totalFailed: emails.length,
        results: emails.map(() => ({
          success: false,
          providerId: 'email-service',
          timestamp: new Date(),
          error: 'No email providers available',
        })),
        providerId: 'email-service',
        timestamp: new Date(),
      };
    }

    try {
      return await this.primaryProvider.sendBulkEmails(emails);
    } catch (error) {
      this.logger.error('Bulk email sending failed', error);

      return {
        success: false,
        totalSent: 0,
        totalFailed: emails.length,
        results: emails.map(() => ({
          success: false,
          providerId: 'email-service',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Bulk email failed',
        })),
        providerId: 'email-service',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get health status of all email providers
   */
  async getProvidersHealth(): Promise<EmailProviderHealthCheck[]> {
    const healthChecks: EmailProviderHealthCheck[] = [];

    for (const [providerId, provider] of this.providers) {
      try {
        const health = await provider.verifyConfiguration();
        healthChecks.push(health);
      } catch (error) {
        healthChecks.push({
          isHealthy: false,
          providerId,
          timestamp: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    }

    return healthChecks;
  }

  /**
   * Get statistics from all providers
   */
  async getProvidersStats(): Promise<EmailProviderStats[]> {
    const stats: EmailProviderStats[] = [];

    for (const [providerId, provider] of this.providers) {
      try {
        const providerStats = await provider.getProviderStats();
        stats.push(providerStats);
      } catch (error) {
        this.logger.warn(`Failed to get stats for provider ${providerId}`, error);
        // Create empty stats for failed provider
        stats.push({
          providerId,
          dailyEmailsSent: 0,
          monthlyEmailsSent: 0,
          deliveryRate: 0,
          bounceRate: 0,
          complaintRate: 0,
          lastUpdated: new Date(),
        });
      }
    }

    return stats;
  }

  /**
   * Register all available email providers
   * @private
   */
  private registerProviders(): void {
    // Register SendGrid if enabled
    if (this.emailConfig.sendgridEnabled) {
      this.providers.set('sendgrid', this.sendGridProvider);
      this.logger.log('SendGrid provider registered');
    }

    // Register AWS SES if enabled
    if (this.emailConfig.awsSesEnabled) {
      this.providers.set('aws-ses', this.awsSesProvider);
      this.logger.log('AWS SES provider registered');
    }

    if (this.providers.size === 0) {
      this.logger.warn('No email providers are enabled');
    }
  }

  /**
   * Configure primary and fallback providers based on configuration
   * @private
   */
  private configurePrimaryProvider(): void {
    const primaryId = this.emailConfig.primaryProvider;

    // Set primary provider
    this.primaryProvider = this.providers.get(primaryId) || null;

    if (this.primaryProvider) {
      this.logger.log(`Primary email provider set to: ${primaryId}`);
    } else {
      this.logger.warn(`Primary provider '${primaryId}' not available`);
    }

    // Set fallback providers (all other enabled providers)
    this.fallbackProviders = Array.from(this.providers.values()).filter(
      provider => provider !== this.primaryProvider,
    );

    if (this.fallbackProviders.length > 0) {
      this.logger.log(`Fallback providers configured: ${this.fallbackProviders.length}`);
    }
  }

  /**
   * Perform initial health checks on all providers
   * @private
   */
  private async performInitialHealthChecks(): Promise<void> {
    const healthChecks = await this.getProvidersHealth();

    for (const health of healthChecks) {
      if (health.isHealthy) {
        this.logger.log(`Provider ${health.providerId} is healthy`);
      } else {
        this.logger.warn(`Provider ${health.providerId} health check failed: ${health.error}`);
      }
    }
  }

  /**
   * Send email with retry logic and exponential backoff
   * @private
   */
  private async sendWithRetry(
    sendFunction: () => Promise<EmailSendResult>,
    providerType: 'primary' | 'fallback',
  ): Promise<EmailSendResult> {
    const maxRetries = this.emailConfig.retry.maxRetries;
    let lastError: string = 'Unknown error';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await sendFunction();

        if (result.success) {
          if (attempt > 0) {
            this.logger.log(`Email sent successfully on attempt ${attempt + 1} (${providerType})`);
          }
          return result;
        }

        lastError = result.error || 'Send operation failed';

        // If this isn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.warn(`Email send attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error occurred';

        if (attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.warn(
            `Email send attempt ${attempt + 1} threw error, retrying in ${delay}ms...`,
            error,
          );
          await this.delay(delay);
        }
      }
    }

    return {
      success: false,
      providerId: 'email-service',
      timestamp: new Date(),
      error: `Failed after ${maxRetries + 1} attempts: ${lastError}`,
      retryCount: maxRetries,
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   * @private
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.emailConfig.retry.initialRetryDelayMs;
    const maxDelay = this.emailConfig.retry.maxRetryDelayMs;

    if (!this.emailConfig.retry.useExponentialBackoff) {
      return Math.min(baseDelay, maxDelay);
    }

    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * Check if the current request is within rate limits
   * @private
   */
  private checkRateLimit(): boolean {
    this.resetRateLimitCounters();

    const limits = this.emailConfig.rateLimit;

    return (
      this.rateLimitCounters.perSecond < limits.maxEmailsPerSecond &&
      this.rateLimitCounters.perMinute < limits.maxEmailsPerMinute &&
      this.rateLimitCounters.perHour < limits.maxEmailsPerHour &&
      this.rateLimitCounters.perDay < limits.maxEmailsPerDay
    );
  }

  /**
   * Update rate limit counters after successful email send
   * @private
   */
  private updateRateLimitCounters(): void {
    this.rateLimitCounters.perSecond++;
    this.rateLimitCounters.perMinute++;
    this.rateLimitCounters.perHour++;
    this.rateLimitCounters.perDay++;
  }

  /**
   * Reset rate limit counters based on time intervals
   * @private
   */
  private resetRateLimitCounters(): void {
    const now = Date.now();

    // Reset per-second counter
    if (now - this.rateLimitCounters.lastResetTimes.second >= 1000) {
      this.rateLimitCounters.perSecond = 0;
      this.rateLimitCounters.lastResetTimes.second = now;
    }

    // Reset per-minute counter
    if (now - this.rateLimitCounters.lastResetTimes.minute >= 60000) {
      this.rateLimitCounters.perMinute = 0;
      this.rateLimitCounters.lastResetTimes.minute = now;
    }

    // Reset per-hour counter
    if (now - this.rateLimitCounters.lastResetTimes.hour >= 3600000) {
      this.rateLimitCounters.perHour = 0;
      this.rateLimitCounters.lastResetTimes.hour = now;
    }

    // Reset per-day counter
    if (now - this.rateLimitCounters.lastResetTimes.day >= 86400000) {
      this.rateLimitCounters.perDay = 0;
      this.rateLimitCounters.lastResetTimes.day = now;
    }
  }

  /**
   * Create rate limit error result
   * @private
   */
  private createRateLimitError(): EmailSendResult {
    return {
      success: false,
      providerId: 'email-service',
      timestamp: new Date(),
      error: 'Rate limit exceeded. Please try again later.',
    };
  }

  /**
   * Utility function to delay execution
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
