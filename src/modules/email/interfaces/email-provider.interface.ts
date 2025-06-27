/**
 * Email Provider Interface
 *
 * Abstract interface for email service providers (SendGrid, AWS SES, etc.)
 * Follows the strategy pattern for provider abstraction and supports
 * modern email functionality including templates, attachments, and tracking.
 *
 * @interface EmailProvider
 * @since 2025-01-15
 */
export interface EmailProvider {
  /**
   * Send a simple email with basic content
   * @param to - Recipient email address
   * @param subject - Email subject line
   * @param content - Email content (HTML or plain text)
   * @param from - Sender email address (optional, uses default if not provided)
   * @returns Promise<EmailSendResult>
   */
  sendEmail(to: string, subject: string, content: string, from?: string): Promise<EmailSendResult>;

  /**
   * Send email with template and variables
   * @param to - Recipient email address
   * @param templateId - Template identifier
   * @param variables - Template variables for dynamic content
   * @param from - Sender email address (optional)
   * @returns Promise<EmailSendResult>
   */
  sendTemplateEmail(
    to: string,
    templateId: string,
    variables: Record<string, string | number | boolean>,
    from?: string,
  ): Promise<EmailSendResult>;

  /**
   * Send bulk emails to multiple recipients
   * @param emails - Array of email objects
   * @returns Promise<EmailBulkSendResult>
   */
  sendBulkEmails(emails: BulkEmailRequest[]): Promise<EmailBulkSendResult>;

  /**
   * Verify the provider configuration and connectivity
   * @returns Promise<EmailProviderHealthCheck>
   */
  verifyConfiguration(): Promise<EmailProviderHealthCheck>;

  /**
   * Get provider-specific statistics and quotas
   * @returns Promise<EmailProviderStats>
   */
  getProviderStats(): Promise<EmailProviderStats>;
}

/**
 * Email send result interface
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  providerId: string;
  timestamp: Date;
  error?: string;
  retryCount?: number;
  errorCode?: string;
  responseCode?: number;
}

/**
 * Bulk email request interface
 */
export interface BulkEmailRequest {
  to: string;
  subject: string;
  content?: string;
  templateId?: string;
  variables?: Record<string, string | number | boolean>;
  from?: string;
}

/**
 * Bulk email send result interface
 */
export interface EmailBulkSendResult {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  results: EmailSendResult[];
  providerId: string;
  timestamp: Date;
}

/**
 * Email provider health check result
 */
export interface EmailProviderHealthCheck {
  isHealthy: boolean;
  providerId: string;
  timestamp: Date;
  responseTime: number;
  error?: string;
  quotaInfo?: {
    dailyLimit: number;
    dailyUsed: number;
    monthlyLimit: number;
    monthlyUsed: number;
  };
}

/**
 * Email provider statistics
 */
export interface EmailProviderStats {
  providerId: string;
  dailyEmailsSent: number;
  monthlyEmailsSent: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  lastUpdated: Date;
}

/**
 * Email provider configuration interface
 */
export interface EmailProviderConfig {
  providerId: string;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: number;
  rateLimit: {
    maxPerSecond: number;
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
  retryConfig: {
    maxRetries: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
  };
}
