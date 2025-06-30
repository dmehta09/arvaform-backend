import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios, { AxiosResponse } from 'axios';
import { Queue } from 'bull';
import * as crypto from 'crypto';
import { FilterQuery, Model, Types, UpdateQuery } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryDocument,
  WebhookDeliveryStatus,
} from './entities/webhook-delivery.entity';
import {
  Webhook,
  WebhookDocument,
  WebhookEventType,
  WebhookFieldMapping,
  WebhookStatus,
} from './entities/webhook.entity';

/**
 * Webhook Event Data Interface
 */
export interface WebhookEventData {
  eventType: WebhookEventType;
  eventId: string;
  timestamp: Date;
  userId: string;
  formId?: string;
  submissionId?: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Webhook Delivery Options
 */
export interface WebhookDeliveryOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Webhook Delivery Service
 *
 * Handles webhook payload delivery with HTTP requests, signature verification,
 * retry logic, and comprehensive error handling. Integrates with the queue system
 * for reliable background processing.
 */
@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly USER_AGENT = 'ArvaForm-Webhooks/1.0';

  constructor(
    @InjectModel(Webhook.name)
    private readonly webhookModel: Model<WebhookDocument>,
    @InjectModel(WebhookDelivery.name)
    private readonly webhookDeliveryModel: Model<WebhookDeliveryDocument>,
    @InjectQueue('webhook-delivery')
    private readonly webhookQueue: Queue,
  ) {
    this.logger.log('WebhookDeliveryService initialized');
  }

  /**
   * Queue webhook delivery for processing
   * @param eventData - Event data to be delivered
   * @param options - Delivery options
   * @returns Promise<string> - Delivery ID for tracking
   */
  async queueWebhookDelivery(
    eventData: WebhookEventData,
    options: WebhookDeliveryOptions = {},
  ): Promise<string[]> {
    try {
      this.logger.debug(`Queueing webhook delivery for event ${eventData.eventType}`, {
        eventType: eventData.eventType,
        eventId: eventData.eventId,
        userId: eventData.userId,
        formId: eventData.formId,
      });

      // Find all active webhooks that should receive this event
      const webhooks = await this.findMatchingWebhooks(eventData);

      if (webhooks.length === 0) {
        this.logger.debug(`No matching webhooks found for event ${eventData.eventType}`, {
          eventType: eventData.eventType,
          eventId: eventData.eventId,
        });
        return [];
      }

      const deliveryIds: string[] = [];

      // Create delivery records and queue jobs for each webhook
      for (const webhook of webhooks) {
        try {
          const deliveryId = await this.createDeliveryRecord(webhook, eventData);
          deliveryIds.push(deliveryId);

          // Queue the delivery job
          await this.webhookQueue.add(
            'deliver-webhook',
            {
              deliveryId,
              webhookId: webhook._id.toString(),
              eventData,
              attempt: 1,
            },
            {
              priority: options.priority || 0,
              delay: options.delay || 0,
              attempts: options.attempts || webhook.config.maxAttempts,
              removeOnComplete: 100,
              removeOnFail: 50,
              backoff: webhook.config.exponentialBackoff
                ? {
                    type: 'exponential',
                    delay: webhook.config.retryDelayMs,
                  }
                : {
                    type: 'fixed',
                    delay: webhook.config.retryDelayMs,
                  },
            },
          );

          this.logger.debug(`Queued webhook delivery for webhook ${webhook._id.toString()}`, {
            webhookId: webhook._id.toString(),
            deliveryId,
            eventType: eventData.eventType,
          });
        } catch (error) {
          this.logger.error(
            `Failed to queue webhook delivery for webhook ${webhook._id.toString()}`,
            {
              webhookId: webhook._id.toString(),
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }

      this.logger.log(
        `Queued ${deliveryIds.length} webhook deliveries for event ${eventData.eventType}`,
        {
          eventType: eventData.eventType,
          eventId: eventData.eventId,
          deliveryCount: deliveryIds.length,
        },
      );

      return deliveryIds;
    } catch (error) {
      this.logger.error(`Failed to queue webhook deliveries for event ${eventData.eventType}`, {
        eventType: eventData.eventType,
        eventId: eventData.eventId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Process webhook delivery immediately (used by queue processor)
   * @param deliveryId - Delivery ID to process
   * @param attempt - Current attempt number
   * @returns Promise<boolean> - Success status
   */
  async processWebhookDelivery(deliveryId: string, attempt: number = 1): Promise<boolean> {
    try {
      this.logger.debug(`Processing webhook delivery ${deliveryId}, attempt ${attempt}`);

      // Get delivery record
      const delivery = await this.webhookDeliveryModel
        .findOne({ deliveryId })
        .populate('webhookId')
        .exec();

      if (!delivery) {
        throw new Error(`Delivery ${deliveryId} not found`);
      }

      const webhook = delivery.webhookId as unknown as WebhookDocument;
      if (!webhook) {
        throw new Error(`Webhook not found for delivery ${deliveryId}`);
      }

      // Check if webhook is still active
      if (webhook.status !== WebhookStatus.ACTIVE) {
        this.logger.warn(`Webhook ${webhook._id.toString()} is not active, skipping delivery`, {
          webhookId: webhook._id.toString(),
          deliveryId,
          status: webhook.status,
        });

        await this.updateDeliveryStatus(
          delivery,
          WebhookDeliveryStatus.CANCELLED,
          'Webhook is not active',
        );
        return false;
      }

      // Update delivery status
      await this.updateDeliveryStatus(delivery, WebhookDeliveryStatus.SENDING);

      // Prepare payload
      const payload = this.buildWebhookPayload(delivery, webhook);

      // Generate signature if secret is configured
      const signature = webhook.secret
        ? this.generateWebhookSignature(payload, webhook.secret)
        : undefined;

      // Prepare headers
      const headers = this.buildWebhookHeaders(webhook, signature, payload);

      // Record attempt start
      const attemptStart = Date.now();

      try {
        // Make HTTP request
        const response = await this.makeWebhookRequest(webhook, payload, headers);

        // Record successful delivery
        await this.recordDeliveryAttempt(
          delivery,
          attempt,
          WebhookDeliveryStatus.SENT,
          response,
          Date.now() - attemptStart,
        );

        await this.updateDeliveryStatus(delivery, WebhookDeliveryStatus.DELIVERED);

        // Update webhook analytics
        await this.updateWebhookAnalytics(webhook, true, Date.now() - attemptStart);

        this.logger.log(`Successfully delivered webhook ${deliveryId}`, {
          deliveryId,
          webhookId: webhook._id.toString(),
          attempt,
          responseStatus: response.status,
          duration: Date.now() - attemptStart,
        });

        return true;
      } catch (error) {
        const duration = Date.now() - attemptStart;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = this.getErrorCode(error);

        // Record failed attempt
        await this.recordDeliveryAttempt(
          delivery,
          attempt,
          WebhookDeliveryStatus.FAILED,
          this.getErrorResponse(error),
          duration,
          errorMessage,
        );

        // Check if we should retry
        if (attempt < webhook.config.maxAttempts) {
          await this.updateDeliveryStatus(delivery, WebhookDeliveryStatus.RETRYING, errorMessage);

          this.logger.warn(`Webhook delivery ${deliveryId} failed, will retry`, {
            deliveryId,
            webhookId: webhook._id.toString(),
            attempt,
            maxAttempts: webhook.config.maxAttempts,
            error: errorMessage,
            duration,
          });

          return false; // Will be retried by queue
        } else {
          // Permanent failure
          await this.updateDeliveryStatus(
            delivery,
            WebhookDeliveryStatus.PERMANENTLY_FAILED,
            errorMessage,
            errorCode,
          );

          // Update webhook analytics
          await this.updateWebhookAnalytics(webhook, false, duration, errorMessage);

          this.logger.error(`Webhook delivery ${deliveryId} permanently failed`, {
            deliveryId,
            webhookId: webhook._id.toString(),
            attempt,
            maxAttempts: webhook.config.maxAttempts,
            error: errorMessage,
            duration,
          });

          return false;
        }
      }
    } catch (error) {
      this.logger.error(`Error processing webhook delivery ${deliveryId}`, {
        deliveryId,
        attempt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Find webhooks that match the event criteria
   * @private
   */
  private async findMatchingWebhooks(eventData: WebhookEventData): Promise<WebhookDocument[]> {
    const { eventType, formId, userId } = eventData;

    const filter: FilterQuery<WebhookDocument> = {
      status: WebhookStatus.ACTIVE,
      events: { $in: [eventType, 'form.*', 'submission.*'] },
      $or: [{ formId: { $exists: false } }, { formId: null }],
    };

    if (formId) {
      filter.$or = [
        { formId: new Types.ObjectId(formId) },
        { formId: { $exists: false } },
        { formId: null },
      ];
    }

    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const webhooks = await this.webhookModel.find(filter).exec();
    return webhooks.filter(webhook => this.evaluateWebhookFilters(webhook, eventData));
  }

  /**
   * Evaluate webhook filters against event data
   * @private
   */
  private evaluateWebhookFilters(webhook: WebhookDocument, eventData: WebhookEventData): boolean {
    if (!webhook.filters || webhook.filters.length === 0) {
      return true;
    }

    return webhook.filters.every(filter => {
      const value = this.getFieldValue(eventData.data, filter.field);
      // Implement filter logic based on operator
      // This is a simplified example
      return value === filter.value;
    });
  }

  /**
   * Get field value from nested object
   * @private
   */
  private getFieldValue(data: Record<string, unknown>, fieldPath: string): unknown {
    return fieldPath.split('.').reduce((acc, part) => {
      if (acc && typeof acc === 'object' && part in acc) {
        return acc[part];
      }
      return undefined;
    }, data);
  }

  /**
   * Create delivery record
   * @private
   */
  private async createDeliveryRecord(
    webhook: WebhookDocument,
    eventData: WebhookEventData,
  ): Promise<string> {
    const deliveryId = `whd_${uuidv4()}`;

    const delivery = new this.webhookDeliveryModel({
      deliveryId,
      webhookId: webhook._id,
      userId: webhook.userId,
      formId: webhook.formId,
      status: WebhookDeliveryStatus.PENDING,
      eventContext: {
        eventType: eventData.eventType,
        sourceId: eventData.eventId,
        eventTimestamp: eventData.timestamp,
        triggeredBy: eventData.userId,
        metadata: eventData.metadata,
      },
      requestDetails: {
        method: webhook.method,
        url: webhook.url,
      },
      maxAttempts: webhook.config.maxAttempts,
      isTest: webhook.isTestMode,
    });

    await delivery.save();
    return deliveryId;
  }

  /**
   * Build the payload for a webhook delivery
   * @private
   */
  private buildWebhookPayload(
    delivery: WebhookDeliveryDocument,
    webhook: WebhookDocument,
  ): Record<string, unknown> {
    const basePayload = {
      webhookId: webhook._id.toString(),
      deliveryId: delivery.deliveryId,
      eventType: delivery.eventContext.eventType,
      eventId: delivery.eventContext.sourceId,
      timestamp: delivery.eventContext.eventTimestamp.toISOString(),
      eventVersion: delivery.eventContext.eventVersion || '1.0',
      payload: delivery.eventContext.metadata,
    };

    if (webhook.fieldMappings && webhook.fieldMappings.length > 0) {
      return this.applyFieldMappings(basePayload, webhook.fieldMappings);
    }

    return basePayload;
  }

  /**
   * Apply field mappings to the payload
   * @private
   */
  private applyFieldMappings(
    payload: Record<string, unknown>,
    mappings: WebhookFieldMapping[],
  ): Record<string, unknown> {
    const mappedPayload: Record<string, unknown> = {};

    for (const mapping of mappings) {
      const sourceValue = this.getFieldValue(payload, mapping.source);
      mappedPayload[mapping.target] = sourceValue ?? mapping.defaultValue;
    }
    return mappedPayload;
  }

  private setFieldValue(obj: Record<string, unknown>, fieldPath: string, value: unknown): void {
    const parts = fieldPath.split('.');
    const last = parts.pop();
    if (!last) return;

    const finalObj = parts.reduce((acc, part) => {
      if (!acc[part] || typeof acc[part] !== 'object') {
        acc[part] = {};
      }
      return acc[part] as Record<string, unknown>;
    }, obj);

    finalObj[last] = value;
  }

  private removeFieldValue(obj: Record<string, unknown>, fieldPath: string): void {
    const parts = fieldPath.split('.');
    const last = parts.pop();
    if (!last) return;

    const finalObj = parts.reduce((acc, part) => {
      if (!acc || !acc[part] || typeof acc[part] !== 'object') {
        return undefined;
      }
      return acc[part] as Record<string, unknown>;
    }, obj);

    if (finalObj && last in finalObj) {
      delete finalObj[last];
    }
  }

  /**
   * Generate webhook signature for payload verification
   * @private
   */
  private generateWebhookSignature(payload: Record<string, unknown>, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString, 'utf8')
      .digest('hex');

    return `sha256=${signature}`;
  }

  /**
   * Build HTTP headers for webhook request
   * @private
   */
  private buildWebhookHeaders(
    webhook: WebhookDocument,
    signature?: string,
    payload?: Record<string, unknown>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': webhook.config.contentType,
      'User-Agent': this.USER_AGENT,
      'X-ArvaForm-Event': webhook.events[0], // Use first event as primary
      'X-ArvaForm-Webhook-Id': webhook._id.toString(),
      'X-ArvaForm-Delivery-Id': Date.now().toString(),
      'X-ArvaForm-Timestamp': new Date().toISOString(),
    };

    // Add signature header if available
    if (signature) {
      headers['X-ArvaForm-Signature'] = signature;
      headers['X-ArvaForm-Signature-Algorithm'] = 'sha256';
    }

    // Add custom headers from webhook configuration
    if (webhook.headers) {
      for (const [key, value] of webhook.headers.entries()) {
        headers[key] = value;
      }
    }

    // Add content length
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(JSON.stringify(payload), 'utf8').toString();
    }

    return headers;
  }

  /**
   * Make HTTP request to webhook endpoint
   * @private
   */
  private async makeWebhookRequest(
    webhook: WebhookDocument,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<AxiosResponse> {
    const requestConfig = {
      method: webhook.method.toLowerCase() as 'post' | 'put' | 'patch',
      url: webhook.url,
      data: payload,
      headers,
      timeout: webhook.config.timeoutMs,
      validateStatus: (status: number) => status >= 200 && status < 300,
      maxRedirects: 3,
      // Security settings
      maxContentLength: 10 * 1024 * 1024, // 10MB max response
      maxBodyLength: 1 * 1024 * 1024, // 1MB max request body
    };

    return axios(requestConfig);
  }

  /**
   * Record delivery attempt
   * @private
   */
  private async recordDeliveryAttempt(
    delivery: WebhookDeliveryDocument,
    attemptNumber: number,
    status: WebhookDeliveryStatus,
    response?: AxiosResponse,
    duration?: number,
    errorMessage?: string,
  ): Promise<void> {
    const attempt: WebhookDeliveryAttempt = {
      attemptNumber,
      attemptedAt: new Date(),
      status,
      durationMs: duration,
      errorMessage,
      isRetry: attemptNumber > 1,
      response: response
        ? {
            statusCode: response.status,
            headers: Object.fromEntries(
              Object.entries(response.headers).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(', ') : String(value),
              ]),
            ),
            body:
              typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data, null, 2),
            responseTimeMs: duration || 0,
            timestamp: new Date(),
          }
        : undefined,
    };

    delivery.attempts.push(attempt);
    delivery.currentAttempt = attemptNumber;

    await this.webhookDeliveryModel.findByIdAndUpdate(delivery._id, {
      $push: { attempts: attempt },
      $set: {
        currentAttempt: attemptNumber,
      },
    });
  }

  /**
   * Update delivery status
   * @private
   */
  private async updateDeliveryStatus(
    delivery: WebhookDeliveryDocument,
    status: WebhookDeliveryStatus,
    errorMessage?: string,
    errorCode?: string,
  ): Promise<void> {
    const update: UpdateQuery<WebhookDeliveryDocument> = {
      status,
      ...(errorMessage && { finalError: errorMessage }),
      ...(errorCode && { finalErrorCode: errorCode }),
    };

    if (
      [WebhookDeliveryStatus.DELIVERED, WebhookDeliveryStatus.PERMANENTLY_FAILED].includes(status)
    ) {
      update.completedAt = new Date();
    }

    await this.webhookDeliveryModel.findByIdAndUpdate(delivery._id, { $set: update }).exec();
  }

  /**
   * Update webhook analytics
   * @private
   */
  private async updateWebhookAnalytics(
    webhook: WebhookDocument,
    success: boolean,
    responseTime: number,
    errorMessage?: string,
  ): Promise<void> {
    const update: UpdateQuery<WebhookDocument> = {
      $inc: {
        'analytics.totalAttempts': 1,
        ...(success
          ? { 'analytics.successfulDeliveries': 1 }
          : { 'analytics.failedDeliveries': 1 }),
      },
      $set: {
        'analytics.lastTriggeredAt': new Date(),
        ...(success
          ? { 'analytics.lastSuccessAt': new Date(), 'analytics.consecutiveFailures': 0 }
          : { 'analytics.lastFailureAt': new Date(), 'analytics.lastError': errorMessage }),
      },
    };

    await this.webhookModel.findByIdAndUpdate(webhook._id, update).exec();
  }

  /**
   * Get error code from axios error
   * @private
   */
  private getErrorCode(error: unknown): string | undefined {
    if (axios.isAxiosError(error)) {
      return error.code;
    }
    if (error instanceof Error) {
      return error.name;
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get error response object
   * @private
   */
  private getErrorResponse(error: unknown): AxiosResponse | undefined {
    if (axios.isAxiosError(error)) {
      return error.response;
    }
    return undefined;
  }
}
