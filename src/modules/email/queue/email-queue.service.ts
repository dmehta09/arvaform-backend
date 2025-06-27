import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Queue } from 'bull';
import { Model } from 'mongoose';
import { CreateEmailDeliveryDto } from '../dto/delivery.dto';
import { EmailService } from '../email.service';
import {
  EmailDelivery,
  EmailDeliveryAttempt,
  EmailDeliveryDocument,
  EmailDeliveryPriority,
  EmailDeliveryStatus,
} from '../entities/email-delivery.entity';
import { EmailSendResult } from '../interfaces/email-provider.interface';

/**
 * Email Queue Job Data Interface
 */
export interface EmailQueueJobData {
  deliveryId: string;
  recipientEmail: string;
  subject: string;
  priority: EmailDeliveryPriority;
  attemptNumber: number;
  originalScheduledAt: Date;
}

/**
 * Email Queue Configuration
 */
export const EMAIL_QUEUE_CONFIG = {
  QUEUE_NAME: 'email-delivery',
  JOBS: {
    SEND_EMAIL: 'send-email',
  },
};

/**
 * Email Queue Service
 * Manages email delivery through Bull queue system
 */
@Injectable()
@Processor(EMAIL_QUEUE_CONFIG.QUEUE_NAME)
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name);
  private isHealthy = true;
  private failureCount = 0;

  constructor(
    @InjectQueue(EMAIL_QUEUE_CONFIG.QUEUE_NAME)
    private readonly emailQueue: Queue<EmailQueueJobData>,
    @InjectModel(EmailDelivery.name)
    private readonly emailDeliveryModel: Model<EmailDeliveryDocument>,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.configureQueue();
      this.setupQueueEventListeners();
      await this.performHealthCheck();
      this.logger.log('Email queue service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email queue service:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.emailQueue.close();
      this.logger.log('Email Queue Service shut down successfully');
    } catch (error) {
      this.logger.error('Error during Email Queue Service shutdown', error);
    }
  }

  async queueEmail(emailData: CreateEmailDeliveryDto): Promise<EmailDeliveryDocument> {
    try {
      const delivery = new this.emailDeliveryModel({
        ...emailData,
        status: EmailDeliveryStatus.QUEUED,
        scheduledAt: emailData.scheduledAt ? new Date(emailData.scheduledAt) : new Date(),
        priority: emailData.priority || EmailDeliveryPriority.NORMAL,
      });

      await delivery.save();
      this.logger.debug(`Created email delivery record: ${String(delivery._id)}`);

      const jobData: EmailQueueJobData = {
        deliveryId: String(delivery._id),
        recipientEmail: delivery.recipientEmail,
        subject: delivery.subject,
        priority: delivery.priority,
        attemptNumber: 1,
        originalScheduledAt: delivery.scheduledAt,
      };

      const job = await this.emailQueue.add(EMAIL_QUEUE_CONFIG.JOBS.SEND_EMAIL, jobData, {
        priority: this.getPriorityValue(delivery.priority),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Queued email for ${delivery.recipientEmail} with job ID: ${job.id}`);
      return delivery;
    } catch (error) {
      this.logger.error('Failed to queue email', error);
      throw error;
    }
  }

  @Process(EMAIL_QUEUE_CONFIG.JOBS.SEND_EMAIL)
  async processEmailDelivery(job: Job<EmailQueueJobData>): Promise<void> {
    const { deliveryId } = job.data;

    try {
      const delivery = await this.emailDeliveryModel.findById(deliveryId);
      if (!delivery) {
        throw new Error(`Email delivery record not found: ${deliveryId}`);
      }

      await this.updateDeliveryStatus(delivery, EmailDeliveryStatus.PROCESSING);
      const sendResult = await this.attemptEmailSend(delivery);

      if (sendResult.success) {
        await this.updateDeliveryStatus(delivery, EmailDeliveryStatus.SENT);
        this.logger.log(`Email successfully sent to ${delivery.recipientEmail}`);
      } else {
        await this.updateDeliveryStatus(delivery, EmailDeliveryStatus.FAILED);
        throw new Error(sendResult.error || 'Failed to send email');
      }
    } catch (error) {
      this.logger.error(`Failed to process email delivery ${deliveryId}:`, error);
      throw error;
    }
  }

  private configureQueue(): void {
    // The @Process decorator handles this
  }

  private setupQueueEventListeners(): void {
    this.emailQueue.on('completed', (job, _result) => {
      this.logger.debug(`Job ${job.id} completed successfully`);
    });

    this.emailQueue.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} failed:`, err);
    });
  }

  private async performHealthCheck(): Promise<void> {
    try {
      await this.emailQueue.getWaiting();
      this.isHealthy = true;
    } catch (error) {
      this.isHealthy = false;
      this.logger.error('Email queue health check failed:', error);
    }
  }

  private async attemptEmailSend(delivery: EmailDeliveryDocument): Promise<EmailSendResult> {
    if (delivery.templateId) {
      const sanitizedVariables = this.sanitizeTemplateVariables(delivery.templateVariables);
      return this.emailService.sendTemplateEmail(
        delivery.recipientEmail,
        delivery.templateId,
        sanitizedVariables,
        delivery.senderEmail,
      );
    } else {
      const content = delivery.htmlContent || delivery.textContent || '';
      return this.emailService.sendEmail(
        delivery.recipientEmail,
        delivery.subject,
        content,
        delivery.senderEmail,
      );
    }
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
      }
    }
    return sanitized;
  }

  private async updateDeliveryStatus(
    delivery: EmailDeliveryDocument,
    status: EmailDeliveryStatus,
  ): Promise<void> {
    delivery.status = status;
    delivery.attemptCount += 1;

    const attempt: EmailDeliveryAttempt = {
      timestamp: new Date(),
      status,
      providerId: 'unknown',
    };

    delivery.attempts.push(attempt);
    await delivery.save();
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
}
