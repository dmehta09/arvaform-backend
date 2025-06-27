import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BackoffOptions, Queue } from 'bull';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import {
  CreateBulkEmailDeliveryDto,
  CreateEmailDeliveryDto,
  EmailDeliveryQueryDto,
  EmailDeliveryStatsDto,
  UpdateEmailDeliveryStatusDto,
} from './dto/delivery.dto';
import { EmailService } from './email.service';
import {
  EmailDelivery,
  EmailDeliveryAttempt,
  EmailDeliveryDocument,
  EmailDeliveryPriority,
  EmailDeliveryStatus,
} from './entities/email-delivery.entity';
import { EmailSendResult } from './interfaces/email-provider.interface';

interface EmailStatsAggregationResult {
  _id: null;
  totalEmails: number;
  delivered: number;
  failed: number;
  processing: number;
  queued: number;
  bounced: number;
  opened: number;
  clicked: number;
  avgDeliveryTime: number;
}

/**
 * Email Delivery Service
 *
 * Manages email delivery through queue system with comprehensive tracking,
 * retry logic, and analytics. Implements 2025 best practices for resilient
 * email delivery and monitoring.
 *
 * @class EmailDeliveryService
 * @since 2025-01-15
 */
@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(
    @InjectModel(EmailDelivery.name)
    private readonly emailDeliveryModel: Model<EmailDeliveryDocument>,
    @InjectQueue('email-delivery')
    private readonly emailQueue: Queue,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create and queue a single email for delivery
   */
  async createEmailDelivery(createDto: CreateEmailDeliveryDto): Promise<EmailDeliveryDocument> {
    try {
      this.logger.debug(`Creating email delivery for ${createDto.recipientEmail}`);

      // Create delivery record
      const delivery = new this.emailDeliveryModel({
        ...createDto,
        status: EmailDeliveryStatus.QUEUED,
        scheduledAt: createDto.scheduledAt ? new Date(createDto.scheduledAt) : new Date(),
        priority: createDto.priority || EmailDeliveryPriority.NORMAL,
        maxAttempts: createDto.maxAttempts || 3,
      });

      await delivery.save();

      // Queue for processing
      this.logger.log(
        `Queuing email delivery for ${delivery.recipientEmail} (ID: ${String(delivery._id)})`,
      );

      try {
        await this.queueEmailDelivery(delivery);
        this.logger.debug(`Successfully queued email delivery: ${String(delivery._id)}`);
        return delivery;
      } catch (error) {
        this.logger.error('Failed to queue email delivery:', error);
        throw error;
      }
    } catch (error) {
      this.logger.error('Failed to create email delivery:', error);
      throw error;
    }
  }

  /**
   * Create and queue multiple emails for bulk delivery
   */
  async createBulkEmailDelivery(
    bulkDto: CreateBulkEmailDeliveryDto,
  ): Promise<EmailDeliveryDocument[]> {
    try {
      this.logger.log(`Creating bulk email delivery for ${bulkDto.emails.length} emails`);

      const deliveries: EmailDeliveryDocument[] = [];
      const batchSize = 50; // Process in smaller batches

      for (let i = 0; i < bulkDto.emails.length; i += batchSize) {
        const batch = bulkDto.emails.slice(i, i + batchSize);

        for (const emailData of batch) {
          const delivery = await this.createEmailDelivery({
            ...emailData,
            priority: bulkDto.priority || emailData.priority || EmailDeliveryPriority.NORMAL,
            bulkEmailId: bulkDto.bulkEmailId,
            batchId: bulkDto.batchId || `batch-${Math.floor(i / batchSize) + 1}`,
          });

          deliveries.push(delivery);
        }

        // Small delay between batches
        if (i + batchSize < bulkDto.emails.length) {
          await this.delay(100);
        }
      }

      this.logger.log(`Bulk email delivery created: ${deliveries.length} emails queued`);
      return deliveries;
    } catch (error) {
      this.logger.error('Failed to create bulk email delivery:', error);
      throw error;
    }
  }

  /**
   * Get email deliveries with filtering and pagination
   */
  async getEmailDeliveries(query: EmailDeliveryQueryDto): Promise<{
    deliveries: EmailDeliveryDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const filter = this.buildFilterQuery(query);
      const sort = this.buildSortOptions(query);
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [deliveries, total] = await Promise.all([
        this.emailDeliveryModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
        this.emailDeliveryModel.countDocuments(filter),
      ]);

      return {
        deliveries,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Failed to get email deliveries:', error);
      throw error;
    }
  }

  /**
   * Get a single email delivery by ID
   */
  async getEmailDeliveryById(id: string): Promise<EmailDeliveryDocument | null> {
    try {
      return await this.emailDeliveryModel.findById(id).exec();
    } catch (error) {
      this.logger.error(`Failed to get email delivery ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update email delivery status
   */
  async updateEmailDeliveryStatus(
    id: string,
    updateDto: UpdateEmailDeliveryStatusDto,
  ): Promise<EmailDeliveryDocument> {
    try {
      const delivery = await this.emailDeliveryModel.findById(id);
      if (!delivery) {
        throw new Error(`Email delivery not found: ${id}`);
      }

      // Create attempt record
      const attempt: EmailDeliveryAttempt = {
        timestamp: new Date(),
        status: updateDto.status,
        providerId: updateDto.providerId || 'unknown',
        providerMessageId: updateDto.providerMessageId,
        responseCode: updateDto.responseCode,
        errorMessage: updateDto.errorMessage,
        errorCode: updateDto.errorCode,
        providerResponse: updateDto.providerResponse,
        duration: updateDto.duration,
      };

      // Update delivery record
      delivery.status = updateDto.status;
      delivery.attemptCount += 1;
      delivery.attempts.push(attempt);

      if (updateDto.providerId) {
        delivery.providerId = updateDto.providerId;
      }

      if (updateDto.providerMessageId) {
        delivery.providerMessageId = updateDto.providerMessageId;
      }

      if (updateDto.errorMessage) {
        delivery.lastErrorMessage = updateDto.errorMessage;
      }

      if (updateDto.errorCode) {
        delivery.lastErrorCode = updateDto.errorCode;
      }

      await delivery.save();

      this.logger.debug(`Updated email delivery ${id} status to ${updateDto.status}`);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to update email delivery status for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Retry failed email delivery
   */
  async retryEmailDelivery(id: string): Promise<EmailDeliveryDocument> {
    try {
      const delivery = await this.emailDeliveryModel.findById(id);
      if (!delivery) {
        throw new Error(`Email delivery not found: ${id}`);
      }

      if (
        ![EmailDeliveryStatus.FAILED, EmailDeliveryStatus.PERMANENTLY_FAILED].includes(
          delivery.status,
        )
      ) {
        throw new Error(`Cannot retry email delivery with status: ${delivery.status}`);
      }

      if (delivery.attemptCount >= delivery.maxAttempts) {
        throw new Error('Maximum retry attempts exceeded');
      }

      // Reset for retry
      delivery.status = EmailDeliveryStatus.QUEUED;
      delivery.nextRetryAt = undefined;
      delivery.lastErrorMessage = undefined;
      delivery.lastErrorCode = undefined;

      await delivery.save();

      // Re-queue for processing
      await this.queueEmailDelivery(delivery);

      this.logger.log(`Email delivery ${id} queued for retry`);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to retry email delivery ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get email delivery statistics
   */
  async getEmailDeliveryStats(startDate?: Date, endDate?: Date): Promise<EmailDeliveryStatsDto> {
    try {
      const filter = this.buildDateFilter(startDate, endDate);

      const statsResult: EmailStatsAggregationResult[] = await this.emailDeliveryModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalEmails: { $sum: 1 },
            delivered: {
              $sum: {
                $cond: [{ $eq: ['$status', EmailDeliveryStatus.DELIVERED] }, 1, 0],
              },
            },
            failed: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      [EmailDeliveryStatus.FAILED, EmailDeliveryStatus.PERMANENTLY_FAILED],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            processing: {
              $sum: {
                $cond: [{ $eq: ['$status', EmailDeliveryStatus.PROCESSING] }, 1, 0],
              },
            },
            queued: {
              $sum: {
                $cond: [{ $eq: ['$status', EmailDeliveryStatus.QUEUED] }, 1, 0],
              },
            },
            bounced: {
              $sum: {
                $cond: [{ $eq: ['$status', EmailDeliveryStatus.BOUNCED] }, 1, 0],
              },
            },
            opened: {
              $sum: { $cond: [{ $ifNull: ['$analytics.opened', false] }, 1, 0] },
            },
            clicked: {
              $sum: { $cond: [{ $ifNull: ['$analytics.clicked', false] }, 1, 0] },
            },
            avgDeliveryTime: {
              $avg: {
                $cond: [{ $ifNull: ['$totalDeliveryTime', false] }, '$totalDeliveryTime', null],
              },
            },
          },
        },
      ]);

      if (statsResult.length === 0) {
        return {
          total: 0,
          totalEmails: 0,
          delivered: 0,
          failed: 0,
          processing: 0,
          queued: 0,
          bounced: 0,
          opened: 0,
          clicked: 0,
          successRate: 0,
          openRate: 0,
          clickRate: 0,
          avgDeliveryTime: 0,
          periodStart: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          periodEnd: endDate || new Date(),
        };
      }

      const stats = statsResult[0];

      return {
        total: stats.totalEmails,
        totalEmails: stats.totalEmails,
        delivered: stats.delivered,
        failed: stats.failed,
        processing: stats.processing,
        queued: stats.queued,
        bounced: stats.bounced,
        opened: stats.opened,
        clicked: stats.clicked,
        successRate: stats.totalEmails > 0 ? (stats.delivered / stats.totalEmails) * 100 : 0,
        openRate: stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0,
        clickRate: stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0,
        avgDeliveryTime: stats.avgDeliveryTime || 0,
        periodStart: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: endDate || new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get email delivery stats:', error);
      throw error;
    }
  }

  /**
   * Process scheduled emails (called by queue processor)
   */
  async processEmailDelivery(deliveryId: string): Promise<void> {
    try {
      const delivery = await this.emailDeliveryModel.findById(deliveryId);
      if (!delivery) {
        throw new Error(`Email delivery not found: ${deliveryId}`);
      }

      this.logger.debug(`Processing email delivery: ${deliveryId}`);

      // Update status to processing
      delivery.status = EmailDeliveryStatus.PROCESSING;
      delivery.processedAt = new Date();
      await delivery.save();

      // Attempt to send email
      let sendResult: EmailSendResult;

      if (delivery.templateId) {
        // Template-based email
        const sanitizedVariables = this.sanitizeTemplateVariables(delivery.templateVariables);
        sendResult = await this.emailService.sendTemplateEmail(
          delivery.recipientEmail,
          delivery.templateId,
          sanitizedVariables,
          delivery.senderEmail,
        );
      } else {
        // Direct content email
        const content = delivery.htmlContent || delivery.textContent || '';
        sendResult = await this.emailService.sendEmail(
          delivery.recipientEmail,
          delivery.subject,
          content,
          delivery.senderEmail,
        );
      }

      // Update delivery status based on result
      if (sendResult.success) {
        await this.updateEmailDeliveryStatus(deliveryId, {
          status: EmailDeliveryStatus.SENT,
          providerId: sendResult.providerId,
          providerMessageId: sendResult.messageId,
          responseCode: 200,
        });

        this.logger.log(`Email successfully sent to ${delivery.recipientEmail}`);
      } else {
        // Handle failure
        await this.handleDeliveryFailure(delivery, sendResult);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to process email delivery ${deliveryId}:`, error);

      // Update delivery status to failed
      await this.updateEmailDeliveryStatus(deliveryId, {
        status: EmailDeliveryStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: 'PROCESSING_ERROR',
      });

      throw error;
    }
  }

  // Private helper methods

  private async queueEmailDelivery(delivery: EmailDeliveryDocument): Promise<void> {
    const priority = this.getPriorityValue(delivery.priority);
    const delay = this.calculateDelay(delivery.scheduledAt);

    await this.emailQueue.add(
      'process-email',
      { deliveryId: delivery._id.toString() },
      {
        priority,
        delay,
        attempts: delivery.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: 2000,
        } as BackoffOptions,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  private async handleDeliveryFailure(
    delivery: EmailDeliveryDocument,
    result: EmailSendResult,
  ): Promise<void> {
    if (delivery.attemptCount >= delivery.maxAttempts) {
      // Permanent failure
      await this.updateEmailDeliveryStatus(delivery._id.toString(), {
        status: EmailDeliveryStatus.PERMANENTLY_FAILED,
        errorMessage: result.error,
        errorCode: result.errorCode,
        responseCode: result.responseCode,
      });

      delivery.permanentFailureReason = result.error;
      await delivery.save();

      this.logger.error(
        `Email permanently failed for ${delivery.recipientEmail} after ${delivery.attemptCount} attempts`,
      );
    } else {
      // Schedule retry
      const retryDelay = this.calculateRetryDelay(delivery.attemptCount);
      const retryAt = new Date(Date.now() + retryDelay);

      await this.updateEmailDeliveryStatus(delivery._id.toString(), {
        status: EmailDeliveryStatus.RETRY_SCHEDULED,
        errorMessage: result.error,
        errorCode: result.errorCode,
        responseCode: result.responseCode,
      });

      delivery.nextRetryAt = retryAt;
      await delivery.save();

      // Re-queue with delay
      await this.emailQueue.add(
        'process-email',
        { deliveryId: delivery._id.toString() },
        {
          delay: retryDelay,
          attempts: delivery.maxAttempts - delivery.attemptCount,
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.warn(
        `Email delivery failed for ${delivery.recipientEmail}, retrying in ${retryDelay}ms`,
      );
    }
  }

  private buildFilterQuery(query: EmailDeliveryQueryDto): FilterQuery<EmailDeliveryDocument> {
    const filter: FilterQuery<EmailDeliveryDocument> = {};

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.recipientEmail)
      filter.recipientEmail = { $regex: query.recipientEmail, $options: 'i' };
    if (query.userId) filter.userId = query.userId;
    if (query.formId) filter.formId = query.formId;
    if (query.category) filter.category = query.category;
    if (query.providerId) filter.providerId = query.providerId;

    if (query.scheduledAfter || query.scheduledBefore) {
      filter.scheduledAt = {};
      if (query.scheduledAfter)
        (filter.scheduledAt as Record<string, Date>).$gte = new Date(query.scheduledAfter);
      if (query.scheduledBefore)
        (filter.scheduledAt as Record<string, Date>).$lte = new Date(query.scheduledBefore);
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }

    return filter;
  }

  private buildSortOptions(query: EmailDeliveryQueryDto): { [key: string]: SortOrder } {
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    return { [sortBy]: sortOrder };
  }

  private buildDateFilter(startDate?: Date, endDate?: Date): FilterQuery<EmailDeliveryDocument> {
    const filter: FilterQuery<EmailDeliveryDocument> = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) (filter.createdAt as Record<string, Date>).$gte = startDate;
      if (endDate) (filter.createdAt as Record<string, Date>).$lte = endDate;
    }

    return filter;
  }

  private getPriorityValue(priority: EmailDeliveryPriority): number {
    switch (priority) {
      case EmailDeliveryPriority.URGENT:
        return 10;
      case EmailDeliveryPriority.HIGH:
        return 5;
      case EmailDeliveryPriority.NORMAL:
        return 0;
      case EmailDeliveryPriority.LOW:
        return -5;
      default:
        return 0;
    }
  }

  private calculateDelay(scheduledAt: Date): number {
    const now = new Date();
    return Math.max(0, scheduledAt.getTime() - now.getTime());
  }

  private calculateRetryDelay(attemptNumber: number): number {
    const baseDelay = 2000; // 2 seconds
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
    const jitter = exponentialDelay * 0.1 * Math.random();
    return Math.min(exponentialDelay + jitter, 300000); // Max 5 minutes
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private sanitizeTemplateVariables(
    variables: Record<string, unknown> | undefined,
  ): Record<string, string | number | boolean> {
    if (!variables) {
      return {};
    }

    const sanitized: Record<string, string | number | boolean> = {};
    for (const key in variables) {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        const value = variables[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = value;
        } else if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        }
        // Other types like objects, arrays, null, undefined will be ignored
      }
    }
    return sanitized;
  }
}
