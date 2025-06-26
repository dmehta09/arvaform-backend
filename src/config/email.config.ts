import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

/**
 * Email Configuration
 *
 * Centralized configuration for email service providers with environment
 * variable validation and type safety. Supports SendGrid and AWS SES
 * with comprehensive rate limiting and retry configurations.
 *
 * @class EmailConfig
 * @since 2025-01-15
 */
export class EmailConfig {
  // Default sender configuration
  @IsString()
  @IsOptional()
  defaultFromEmail?: string;

  @IsString()
  @IsOptional()
  defaultFromName?: string;

  // Provider selection
  @IsString()
  primaryProvider: 'sendgrid' | 'aws-ses' = 'sendgrid';

  // SendGrid configuration
  @IsString()
  @IsOptional()
  sendgridApiKey?: string;

  @IsBoolean()
  sendgridEnabled: boolean = false;

  // AWS SES configuration
  @IsString()
  @IsOptional()
  awsAccessKeyId?: string;

  @IsString()
  @IsOptional()
  awsSecretAccessKey?: string;

  @IsString()
  @IsOptional()
  awsRegion?: string;

  @IsBoolean()
  awsSesEnabled: boolean = false;

  // Rate limiting configuration
  @ValidateNested()
  @Type(() => RateLimitConfig)
  rateLimit: RateLimitConfig = new RateLimitConfig();

  // Retry configuration
  @ValidateNested()
  @Type(() => RetryConfig)
  retry: RetryConfig = new RetryConfig();

  // Health check configuration
  @IsNumber()
  healthCheckIntervalMs: number = 300000; // 5 minutes

  @IsNumber()
  healthCheckTimeoutMs: number = 10000; // 10 seconds

  // Monitoring and logging
  @IsBoolean()
  enableDetailedLogging: boolean = false;

  @IsBoolean()
  enableMetrics: boolean = true;
}

/**
 * Rate limiting configuration for email providers
 */
export class RateLimitConfig {
  @IsNumber()
  maxEmailsPerSecond: number = 5;

  @IsNumber()
  maxEmailsPerMinute: number = 100;

  @IsNumber()
  maxEmailsPerHour: number = 1000;

  @IsNumber()
  maxEmailsPerDay: number = 10000;
}

/**
 * Retry configuration for failed email deliveries
 */
export class RetryConfig {
  @IsNumber()
  maxRetries: number = 3;

  @IsNumber()
  initialRetryDelayMs: number = 1000;

  @IsBoolean()
  useExponentialBackoff: boolean = true;

  @IsNumber()
  maxRetryDelayMs: number = 30000;
}

/**
 * Email configuration factory function
 * Creates and validates email configuration from environment variables
 */
export function createEmailConfig(): EmailConfig {
  const config = new EmailConfig();

  // Default sender configuration
  config.defaultFromEmail = process.env.EMAIL_DEFAULT_FROM || 'noreply@arvaform.com';
  config.defaultFromName = process.env.EMAIL_DEFAULT_FROM_NAME || 'ArvaForm';

  // Provider selection
  config.primaryProvider =
    (process.env.EMAIL_PRIMARY_PROVIDER as 'sendgrid' | 'aws-ses') || 'sendgrid';

  // SendGrid configuration
  config.sendgridApiKey = process.env.SENDGRID_API_KEY;
  config.sendgridEnabled = !!config.sendgridApiKey && process.env.SENDGRID_ENABLED !== 'false';

  // AWS SES configuration
  config.awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  config.awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  config.awsRegion = process.env.AWS_REGION || 'us-east-1';
  config.awsSesEnabled =
    !!config.awsAccessKeyId &&
    !!config.awsSecretAccessKey &&
    process.env.AWS_SES_ENABLED !== 'false';

  // Rate limiting (with environment variable overrides)
  config.rateLimit.maxEmailsPerSecond = parseInt(
    process.env.EMAIL_RATE_LIMIT_PER_SECOND || '5',
    10,
  );
  config.rateLimit.maxEmailsPerMinute = parseInt(
    process.env.EMAIL_RATE_LIMIT_PER_MINUTE || '100',
    10,
  );
  config.rateLimit.maxEmailsPerHour = parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR || '1000', 10);
  config.rateLimit.maxEmailsPerDay = parseInt(process.env.EMAIL_RATE_LIMIT_PER_DAY || '10000', 10);

  // Retry configuration
  config.retry.maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES || '3', 10);
  config.retry.initialRetryDelayMs = parseInt(process.env.EMAIL_RETRY_DELAY_MS || '1000', 10);
  config.retry.useExponentialBackoff = process.env.EMAIL_EXPONENTIAL_BACKOFF !== 'false';
  config.retry.maxRetryDelayMs = parseInt(process.env.EMAIL_MAX_RETRY_DELAY_MS || '30000', 10);

  // Health check configuration
  config.healthCheckIntervalMs = parseInt(
    process.env.EMAIL_HEALTH_CHECK_INTERVAL_MS || '300000',
    10,
  );
  config.healthCheckTimeoutMs = parseInt(process.env.EMAIL_HEALTH_CHECK_TIMEOUT_MS || '10000', 10);

  // Monitoring
  config.enableDetailedLogging = process.env.EMAIL_DETAILED_LOGGING === 'true';
  config.enableMetrics = process.env.EMAIL_ENABLE_METRICS !== 'false';

  return config;
}

/**
 * Environment variables documentation for .env file
 */
export const EMAIL_ENV_VARS_DOCUMENTATION = `
# Email Service Configuration
# ===========================

# Default sender configuration
EMAIL_DEFAULT_FROM=noreply@arvaform.com
EMAIL_DEFAULT_FROM_NAME=ArvaForm

# Primary email provider (sendgrid or aws-ses)
EMAIL_PRIMARY_PROVIDER=sendgrid

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_ENABLED=true

# AWS SES Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=us-east-1
AWS_SES_ENABLED=true

# Rate Limiting
EMAIL_RATE_LIMIT_PER_SECOND=5
EMAIL_RATE_LIMIT_PER_MINUTE=100
EMAIL_RATE_LIMIT_PER_HOUR=1000
EMAIL_RATE_LIMIT_PER_DAY=10000

# Retry Configuration
EMAIL_MAX_RETRIES=3
EMAIL_RETRY_DELAY_MS=1000
EMAIL_EXPONENTIAL_BACKOFF=true
EMAIL_MAX_RETRY_DELAY_MS=30000

# Health Checks
EMAIL_HEALTH_CHECK_INTERVAL_MS=300000
EMAIL_HEALTH_CHECK_TIMEOUT_MS=10000

# Monitoring
EMAIL_DETAILED_LOGGING=false
EMAIL_ENABLE_METRICS=true
`;
