# Email Service Module

## Overview

The Email Service Module provides a robust, scalable, and reliable email
infrastructure for ArvaForm. It implements a provider abstraction pattern with
automatic failover, retry logic, rate limiting, and comprehensive monitoring
capabilities.

## Features

- **Multi-Provider Support**: SendGrid and AWS SES integration with automatic
  failover
- **Provider Abstraction**: Common interface for all email providers
- **Reliability**: Retry logic with exponential backoff
- **Rate Limiting**: Configurable rate limits to prevent API quota violations
- **Health Monitoring**: Real-time provider health checks and statistics
- **Template Support**: Dynamic email templates with variable injection
- **Bulk Operations**: Efficient bulk email sending capabilities
- **Security**: Secure credential management and validation

## Architecture

### Core Components

1. **EmailService**: Main orchestration service with provider management
2. **EmailProvider Interface**: Abstract interface for all email providers
3. **Provider Implementations**: SendGrid and AWS SES providers
4. **EmailConfig**: Configuration management with validation
5. **Email Module**: NestJS module configuration

### Provider Hierarchy

```
EmailService
├── Primary Provider (configurable)
└── Fallback Providers (automatic failover)
```

## Quick Start

### 1. Environment Configuration

```bash
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_ENABLED=true

# AWS SES Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_SES_ENABLED=true

# Email Service Configuration
EMAIL_PRIMARY_PROVIDER=sendgrid
EMAIL_DEFAULT_FROM_EMAIL=noreply@arvaform.com
EMAIL_DEFAULT_FROM_NAME=ArvaForm

# Rate Limiting
EMAIL_MAX_PER_SECOND=5
EMAIL_MAX_PER_MINUTE=100
EMAIL_MAX_PER_HOUR=1000
EMAIL_MAX_PER_DAY=10000

# Retry Configuration
EMAIL_MAX_RETRIES=3
EMAIL_INITIAL_RETRY_DELAY=1000
EMAIL_USE_EXPONENTIAL_BACKOFF=true
EMAIL_MAX_RETRY_DELAY=30000
```

### 2. Basic Usage

```typescript
import { EmailService } from './modules/email/email.service';

@Injectable()
export class NotificationService {
  constructor(private readonly emailService: EmailService) {}

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    const result = await this.emailService.sendEmail(
      userEmail,
      'Welcome to ArvaForm!',
      `<h1>Welcome ${userName}!</h1><p>Thank you for joining ArvaForm.</p>`,
      'welcome@arvaform.com',
    );

    if (!result.success) {
      throw new Error(`Failed to send welcome email: ${result.error}`);
    }
  }
}
```

### 3. Template Emails

```typescript
async sendFormSubmissionNotification(
  ownerEmail: string,
  formTitle: string,
  submissionCount: number
): Promise<void> {
  const result = await this.emailService.sendTemplateEmail(
    ownerEmail,
    'form-submission-notification',
    {
      formTitle,
      submissionCount,
      dashboardUrl: 'https://app.arvaform.com/dashboard'
    }
  );

  if (!result.success) {
    throw new Error(`Failed to send notification: ${result.error}`);
  }
}
```

## API Reference

### EmailService Methods

#### sendEmail(to, subject, content, from?)

Sends a simple email with automatic provider selection and failover.

**Parameters:**

- `to` (string): Recipient email address
- `subject` (string): Email subject line
- `content` (string): HTML or plain text content
- `from` (string, optional): Sender email address

**Returns:** `Promise<EmailSendResult>`

#### sendTemplateEmail(to, templateId, variables, from?)

Sends a template-based email with variable substitution.

**Parameters:**

- `to` (string): Recipient email address
- `templateId` (string): Template identifier
- `variables` (Record<string, string | number | boolean>): Template variables
- `from` (string, optional): Sender email address

**Returns:** `Promise<EmailSendResult>`

#### sendBulkEmails(emails)

Sends multiple emails efficiently with batch processing.

**Parameters:**

- `emails` (BulkEmailRequest[]): Array of email requests

**Returns:** `Promise<EmailBulkSendResult>`

#### getProvidersHealth()

Returns health status for all configured providers.

**Returns:** `Promise<EmailProviderHealthCheck[]>`

#### getProvidersStats()

Returns statistics and metrics for all providers.

**Returns:** `Promise<EmailProviderStats[]>`

## Configuration

### EmailConfig Properties

| Property                | Type                    | Default    | Description                  |
| ----------------------- | ----------------------- | ---------- | ---------------------------- |
| `defaultFromEmail`      | string                  | -          | Default sender email address |
| `defaultFromName`       | string                  | -          | Default sender name          |
| `primaryProvider`       | 'sendgrid' \| 'aws-ses' | 'sendgrid' | Primary email provider       |
| `sendgridEnabled`       | boolean                 | false      | Enable SendGrid provider     |
| `awsSesEnabled`         | boolean                 | false      | Enable AWS SES provider      |
| `rateLimit`             | object                  | -          | Rate limiting configuration  |
| `retry`                 | object                  | -          | Retry logic configuration    |
| `healthCheckIntervalMs` | number                  | 300000     | Health check interval        |

### Rate Limiting Configuration

```typescript
rateLimit: {
  maxEmailsPerSecond: 5,
  maxEmailsPerMinute: 100,
  maxEmailsPerHour: 1000,
  maxEmailsPerDay: 10000
}
```

### Retry Configuration

```typescript
retry: {
  maxRetries: 3,
  initialRetryDelayMs: 1000,
  useExponentialBackoff: true,
  maxRetryDelayMs: 30000
}
```

## Error Handling

The email service implements comprehensive error handling:

### Error Types

1. **Configuration Errors**: Invalid or missing configuration
2. **Rate Limit Errors**: API quota exceeded
3. **Provider Errors**: External service failures
4. **Validation Errors**: Invalid email addresses or content
5. **Network Errors**: Connection timeouts or failures

### Error Response Format

```typescript
interface EmailSendResult {
  success: boolean;
  messageId?: string;
  providerId: string;
  timestamp: Date;
  error?: string;
  retryCount?: number;
}
```

### Handling Failures

```typescript
const result = await emailService.sendEmail(to, subject, content);

if (!result.success) {
  // Log the error
  logger.error(`Email failed: ${result.error}`, {
    providerId: result.providerId,
    timestamp: result.timestamp,
    retryCount: result.retryCount,
  });

  // Handle based on error type
  if (result.error?.includes('Rate limit')) {
    // Wait and retry later
    await delay(60000);
  } else if (result.error?.includes('Invalid email')) {
    // Handle validation error
    throw new BadRequestException('Invalid email address');
  } else {
    // Generic error handling
    throw new InternalServerErrorException('Email service unavailable');
  }
}
```

## Monitoring and Health Checks

### Health Check Endpoint

The email service provides health check capabilities:

```typescript
const healthChecks = await emailService.getProvidersHealth();

healthChecks.forEach(check => {
  console.log(
    `Provider ${check.providerId}: ${check.isHealthy ? 'Healthy' : 'Unhealthy'}`,
  );
  if (!check.isHealthy) {
    console.log(`Error: ${check.error}`);
  }
});
```

### Provider Statistics

Monitor email delivery performance:

```typescript
const stats = await emailService.getProvidersStats();

stats.forEach(stat => {
  console.log(`Provider: ${stat.providerId}`);
  console.log(`Daily emails: ${stat.dailyEmailsSent}`);
  console.log(`Delivery rate: ${(stat.deliveryRate * 100).toFixed(2)}%`);
  console.log(`Bounce rate: ${(stat.bounceRate * 100).toFixed(2)}%`);
});
```

## Best Practices

### 1. Email Content

- Always use HTML content for better formatting
- Include plain text fallback when possible
- Keep subject lines under 50 characters
- Use responsive email templates

### 2. Error Handling

- Always check the `success` property of results
- Implement proper logging for debugging
- Use appropriate HTTP status codes in controllers
- Handle rate limiting gracefully

### 3. Performance

- Use bulk sending for multiple recipients
- Implement proper retry logic
- Monitor provider statistics regularly
- Consider email queuing for high-volume scenarios

### 4. Security

- Validate all email addresses
- Sanitize email content
- Use environment variables for credentials
- Implement proper authentication for email endpoints

## Testing

### Unit Tests

Run the email service tests:

```bash
npm run test src/modules/email/email.service.spec.ts
```

### Integration Tests

Test with real providers (requires configuration):

```bash
npm run test:e2e src/modules/email/email.integration.spec.ts
```

### Mock Testing

For development, use the test configuration:

```typescript
const testConfig: EmailConfig = {
  primaryProvider: 'sendgrid',
  sendgridEnabled: true,
  awsSesEnabled: false,
  // ... other test settings
};
```

## Troubleshooting

### Common Issues

1. **Provider Authentication Failures**

   - Verify API keys and credentials
   - Check provider account status
   - Ensure proper IAM permissions (AWS SES)

2. **Rate Limiting Issues**

   - Adjust rate limit configuration
   - Implement email queuing
   - Upgrade provider plan if needed

3. **High Bounce Rates**

   - Validate email addresses before sending
   - Clean email lists regularly
   - Check email content for spam triggers

4. **Template Errors**
   - Verify template exists in provider
   - Check variable names and types
   - Test templates before production use

### Debug Mode

Enable detailed logging:

```bash
EMAIL_ENABLE_DETAILED_LOGGING=true
```

This will log all email operations, provider responses, and error details.

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review provider documentation (SendGrid/AWS SES)
3. Enable debug logging for detailed error information
4. Contact the development team with logs and error details

## License

This module is part of the ArvaForm project and follows the same licensing
terms.
