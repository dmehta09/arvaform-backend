import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { WebhookDeliveryService, WebhookEventData } from '../delivery.service';

/**
 * Webhook Queue Job Data Interface
 */
export interface WebhookQueueJobData {
  deliveryId: string;
  webhookId: string;
  eventData: WebhookEventData;
  attempt: number;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Webhook Queue Service
 *
 * Manages webhook delivery queue processing with Bull/Redis.
 * Handles job scheduling, retry logic, dead letter queue, and monitoring.
 */
@Injectable()
@Processor('webhook-delivery')
export class WebhookQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookQueueService.name);

  constructor(
    @InjectQueue('webhook-delivery')
    private readonly webhookQueue: Queue<WebhookQueueJobData>,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  /**
   * Module initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Webhook Queue Service initialized');

    // Setup queue event listeners
    this.setupQueueEventListeners();

    // Resume any paused jobs
    await this.webhookQueue.resume();

    this.logger.log('Webhook delivery queue is ready');
  }

  /**
   * Module cleanup
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Webhook Queue Service');

    // Gracefully close the queue
    await this.webhookQueue.close();

    this.logger.log('Webhook Queue Service shut down complete');
  }

  /**
   * Add webhook delivery job to queue
   * @param eventData - Event data to deliver
   * @param options - Job options
   * @returns Promise<string[]> - Job IDs
   */
  async addWebhookDeliveryJob(
    eventData: WebhookEventData,
    options: {
      priority?: number;
      delay?: number;
      attempts?: number;
      removeOnComplete?: number;
      removeOnFail?: number;
    } = {},
  ): Promise<string[]> {
    try {
      this.logger.debug(`Adding webhook delivery job for event ${eventData.eventType}`, {
        eventType: eventData.eventType,
        eventId: eventData.eventId,
        userId: eventData.userId,
      });

      // Use the delivery service to queue the webhook
      const deliveryIds = await this.webhookDeliveryService.queueWebhookDelivery(
        eventData,
        options,
      );

      this.logger.log(`Added ${deliveryIds.length} webhook delivery jobs`, {
        eventType: eventData.eventType,
        eventId: eventData.eventId,
        deliveryCount: deliveryIds.length,
      });

      return deliveryIds;
    } catch (error) {
      this.logger.error('Failed to add webhook delivery job', {
        eventType: eventData.eventType,
        eventId: eventData.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process webhook delivery job
   * This is the main job processor that handles individual webhook deliveries
   */
  @Process('deliver-webhook')
  async processWebhookDelivery(job: Job<WebhookQueueJobData>): Promise<void> {
    const { deliveryId, webhookId, eventData, attempt } = job.data;

    this.logger.debug(`Processing webhook delivery job ${job.id}`, {
      jobId: job.id,
      deliveryId,
      webhookId,
      attempt,
      eventType: eventData.eventType,
    });

    try {
      // Update job progress
      await job.progress(10);

      // Process the delivery using the delivery service
      const success = await this.webhookDeliveryService.processWebhookDelivery(deliveryId, attempt);

      await job.progress(90);

      if (success) {
        this.logger.log(`Webhook delivery job ${job.id} completed successfully`, {
          jobId: job.id,
          deliveryId,
          webhookId,
          attempt,
        });
      } else {
        // This will trigger a retry if attempts are remaining
        throw new Error('Webhook delivery failed, will retry if attempts remaining');
      }

      await job.progress(100);
    } catch (error) {
      this.logger.error(`Webhook delivery job ${job.id} failed`, {
        jobId: job.id,
        deliveryId,
        webhookId,
        attempt,
        error: error instanceof Error ? error.message : String(error),
        attemptsRemaining: (job.opts.attempts || 1) - job.attemptsMade,
      });

      // Re-throw to let Bull handle retry logic
      throw error;
    }
  }

  /**
   * Get queue statistics and health information
   * @returns Promise<QueueStats>
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
    health: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.webhookQueue.getWaiting(),
        this.webhookQueue.getActive(),
        this.webhookQueue.getCompleted(),
        this.webhookQueue.getFailed(),
        this.webhookQueue.getDelayed(),
      ]);

      const isPaused = await this.webhookQueue.isPaused();

      // Determine health status
      let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const failureRate = failed.length / (completed.length + failed.length || 1);

      if (isPaused || failureRate > 0.5) {
        health = 'unhealthy';
      } else if (failureRate > 0.2 || active.length > 100) {
        health = 'degraded';
      }

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: isPaused,
        health,
      };
    } catch (error) {
      this.logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: true,
        health: 'unhealthy',
      };
    }
  }

  /**
   * Pause the webhook queue
   * @returns Promise<void>
   */
  async pauseQueue(): Promise<void> {
    await this.webhookQueue.pause();
    this.logger.warn('Webhook delivery queue paused');
  }

  /**
   * Resume the webhook queue
   * @returns Promise<void>
   */
  async resumeQueue(): Promise<void> {
    await this.webhookQueue.resume();
    this.logger.log('Webhook delivery queue resumed');
  }

  /**
   * Clean completed and failed jobs
   * @param olderThan - Clean jobs older than this (in milliseconds)
   * @returns Promise<void>
   */
  async cleanQueue(olderThan: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      this.logger.debug('Cleaning webhook queue', { olderThan });

      await Promise.all([
        this.webhookQueue.clean(olderThan, 'completed'),
        this.webhookQueue.clean(olderThan, 'failed'),
        this.webhookQueue.clean(olderThan, 'active'), // Clean stalled jobs
      ]);

      this.logger.log('Webhook queue cleaned successfully');
    } catch (error) {
      this.logger.error('Failed to clean webhook queue', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retry all failed jobs
   * @returns Promise<number> - Number of jobs retried
   */
  async retryFailedJobs(): Promise<number> {
    try {
      const failedJobs = await this.webhookQueue.getFailed();

      for (const job of failedJobs) {
        await job.retry();
      }

      this.logger.log(`Retried ${failedJobs.length} failed webhook delivery jobs`);
      return failedJobs.length;
    } catch (error) {
      this.logger.error('Failed to retry failed jobs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get failed jobs for manual inspection
   * @param limit - Maximum number of jobs to return
   * @returns Promise<Job[]>
   */
  async getFailedJobs(limit: number = 10): Promise<Job<WebhookQueueJobData>[]> {
    try {
      const failedJobs = await this.webhookQueue.getFailed(0, limit - 1);
      return failedJobs;
    } catch (error) {
      this.logger.error('Failed to get failed jobs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Remove specific job from queue
   * @param jobId - Job ID to remove
   * @returns Promise<boolean>
   */
  async removeJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.webhookQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.debug(`Removed job ${jobId} from webhook queue`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to remove job ${jobId}`, {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get job status and details
   * @param jobId - Job ID to inspect
   * @returns Promise<JobInfo | null>
   */
  async getJobInfo(jobId: string): Promise<{
    id: string;
    data: WebhookQueueJobData;
    progress: number;
    attemptsMade: number;
    processedOn?: number;
    finishedOn?: number;
    failedReason?: string;
    state: string;
  } | null> {
    try {
      const job = await this.webhookQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();

      return {
        id: job.id.toString(),
        data: job.data,
        progress: job.progress(),
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        state,
      };
    } catch (error) {
      this.logger.error(`Failed to get job info for ${jobId}`, {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Setup queue event listeners for monitoring and logging
   * @private
   */
  private setupQueueEventListeners(): void {
    // Job completion
    this.webhookQueue.on('completed', (job: Job<WebhookQueueJobData>) => {
      this.logger.debug(`Webhook delivery job ${job.id} completed`, {
        jobId: job.id,
        deliveryId: job.data.deliveryId,
        webhookId: job.data.webhookId,
        processingTime: job.finishedOn ? job.finishedOn - (job.processedOn || 0) : 0,
      });
    });

    // Job failure
    this.webhookQueue.on('failed', (job: Job<WebhookQueueJobData>, error: Error) => {
      this.logger.warn(`Webhook delivery job ${job.id} failed`, {
        jobId: job.id,
        deliveryId: job.data.deliveryId,
        webhookId: job.data.webhookId,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        error: error.message,
      });
    });

    // Job stalled
    this.webhookQueue.on('stalled', (job: Job<WebhookQueueJobData>) => {
      this.logger.warn(`Webhook delivery job ${job.id} stalled`, {
        jobId: job.id,
        deliveryId: job.data.deliveryId,
        webhookId: job.data.webhookId,
        attemptsMade: job.attemptsMade,
      });
    });

    // Job progress
    this.webhookQueue.on('progress', (job: Job<WebhookQueueJobData>, progress: number) => {
      if (progress % 25 === 0) {
        // Log every 25% progress
        this.logger.debug(`Webhook delivery job ${job.id} progress: ${progress}%`, {
          jobId: job.id,
          deliveryId: job.data.deliveryId,
          progress,
        });
      }
    });

    // Queue error
    this.webhookQueue.on('error', (error: Error) => {
      this.logger.error('Webhook delivery queue error', {
        error: error.message,
        stack: error.stack,
      });
    });

    // Queue drain (all jobs processed)
    this.webhookQueue.on('drained', () => {
      this.logger.debug('Webhook delivery queue drained (all jobs processed)');
    });

    // Queue paused
    this.webhookQueue.on('paused', () => {
      this.logger.warn('Webhook delivery queue paused');
    });

    // Queue resumed
    this.webhookQueue.on('resumed', () => {
      this.logger.log('Webhook delivery queue resumed');
    });
  }
}
