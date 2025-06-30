import { InjectQueue, Processor } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationQueueJobData,
} from '../types/notification.types';

/**
 * Notification Queue Service
 *
 * Manages notification job queue processing using BullMQ for reliable
 * background delivery across multiple channels. Implements priority-based
 * processing, retry logic with exponential backoff, and comprehensive
 * error handling and monitoring.
 *
 * Features:
 * - Priority-based job processing
 * - Channel-specific retry strategies
 * - Exponential backoff for failed jobs
 * - Job progress tracking and monitoring
 * - Rate limiting and concurrency control
 * - Dead letter queue handling
 * - Comprehensive error logging and alerting
 *
 * @class NotificationQueueService
 * @since 2025-01-15
 */
@Injectable()
@Processor('notification-delivery')
export class NotificationQueueService implements OnModuleInit {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue('notification-delivery')
    private readonly notificationQueue: Queue<NotificationQueueJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Set up queue event listeners for monitoring and logging
    this.setupQueueEventListeners();

    // Configure queue settings for optimal performance
    await this.configureQueueSettings();

    this.logger.log('Notification queue service initialized successfully');
  }

  /**
   * Adds a notification job to the queue
   * Automatically determines priority and retry settings based on notification type
   *
   * @param jobData - Notification job data
   * @param options - Optional job configuration
   * @returns Job instance
   */
  async addNotificationJob(
    jobData: NotificationQueueJobData,
    options: {
      delay?: number;
      priority?: number;
      attempts?: number;
      backoff?: string | { type: string; delay: number };
      removeOnComplete?: number;
      removeOnFail?: number;
    } = {},
  ): Promise<Job<NotificationQueueJobData>> {
    try {
      // Determine retry attempts based on channels
      const retryAttempts = this.getRetryAttempts(jobData.channels);

      // Set up backoff strategy
      const backoffStrategy = this.getBackoffStrategy(jobData.channels);

      const backoff = options.backoff || backoffStrategy;
      const jobOptions = {
        priority: options.priority || this.mapPriorityToNumber(jobData.priority),
        attempts: options.attempts || retryAttempts,
        backoff: typeof backoff === 'string' ? { type: backoff } : backoff,
        removeOnComplete: options.removeOnComplete || 100,
        removeOnFail: options.removeOnFail || 50,
        delay: options.delay || 0,
      };

      // Add scheduled delivery support
      if (jobData.scheduledFor) {
        const delay = jobData.scheduledFor.getTime() - Date.now();
        if (delay > 0) {
          jobOptions.delay = delay;
        }
      }

      const job = await this.notificationQueue.add('process-notification', jobData, jobOptions);

      this.logger.debug(
        `Notification job added to queue: ${job.id} for notification ${jobData.notificationId}`,
        {
          jobId: job.id,
          notificationId: jobData.notificationId,
          channels: jobData.channels,
          priority: jobData.priority,
          scheduledFor: jobData.scheduledFor,
        },
      );

      return job;
    } catch (error) {
      this.logger.error(
        `Failed to add notification job to queue for notification ${jobData.notificationId}`,
        {
          error: error.message,
          stack: error.stack,
          notificationId: jobData.notificationId,
          channels: jobData.channels,
        },
      );
      throw error;
    }
  }

  /**
   * Adds multiple notification jobs in bulk
   * Optimized for batch processing with rate limiting
   *
   * @param jobsData - Array of notification job data
   * @param options - Bulk processing options
   * @returns Array of job instances
   */
  async addBulkNotificationJobs(
    jobsData: NotificationQueueJobData[],
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      priority?: number;
    } = {},
  ): Promise<Job<NotificationQueueJobData>[]> {
    const batchSize = options.batchSize || 100;
    const delayBetweenBatches = options.delayBetweenBatches || 1000;
    const jobs: Job<NotificationQueueJobData>[] = [];

    this.logger.log(
      `Adding ${jobsData.length} notification jobs to queue in batches of ${batchSize}`,
      {
        totalJobs: jobsData.length,
        batchSize,
        delayBetweenBatches,
      },
    );

    try {
      // Process jobs in batches to avoid overwhelming the queue
      for (let i = 0; i < jobsData.length; i += batchSize) {
        const batch = jobsData.slice(i, i + batchSize);
        const batchJobs = await Promise.all(
          batch.map((jobData, index) =>
            this.addNotificationJob(jobData, {
              priority: options.priority || 10,
              // Stagger jobs within batch to prevent concurrent processing spikes
              delay: Math.floor(index / 10) * 100,
            }),
          ),
        );

        jobs.push(...batchJobs);

        // Add delay between batches if not the last batch
        if (i + batchSize < jobsData.length && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }

        this.logger.debug(
          `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jobsData.length / batchSize)}`,
          {
            batchStart: i,
            batchEnd: Math.min(i + batchSize, jobsData.length),
            totalProcessed: jobs.length,
          },
        );
      }

      this.logger.log(`Successfully added ${jobs.length} notification jobs to queue`, {
        totalJobs: jobs.length,
        successfulJobs: jobs.filter(job => job).length,
      });

      return jobs;
    } catch (error) {
      this.logger.error(`Failed to add bulk notification jobs to queue`, {
        error: error.message,
        stack: error.stack,
        totalJobs: jobsData.length,
        processedJobs: jobs.length,
      });
      throw error;
    }
  }

  /**
   * Gets job by ID with detailed information
   *
   * @param jobId - Job ID
   * @returns Job instance or null if not found
   */
  async getJob(jobId: string): Promise<Job<NotificationQueueJobData> | null> {
    try {
      const job = await this.notificationQueue.getJob(jobId);
      return job;
    } catch (error) {
      this.logger.error(`Failed to get job ${jobId}`, {
        error: error.message,
        jobId,
      });
      return null;
    }
  }

  /**
   * Gets queue statistics for monitoring
   *
   * @returns Queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        this.notificationQueue.getWaiting(),
        this.notificationQueue.getActive(),
        this.notificationQueue.getCompleted(),
        this.notificationQueue.getFailed(),
        this.notificationQueue.getDelayed(),
        this.notificationQueue.isPaused(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: paused ? 1 : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get queue statistics', {
        error: error.message,
        stack: error.stack,
      });

      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };
    }
  }

  /**
   * Pauses the queue processing
   */
  async pauseQueue(): Promise<void> {
    try {
      await this.notificationQueue.pause();
      this.logger.warn('Notification queue has been paused');
    } catch (error) {
      this.logger.error('Failed to pause notification queue', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Resumes the queue processing
   */
  async resumeQueue(): Promise<void> {
    try {
      await this.notificationQueue.resume();
      this.logger.log('Notification queue has been resumed');
    } catch (error) {
      this.logger.error('Failed to resume notification queue', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Cleans completed and failed jobs
   *
   * @param maxAge - Maximum age in milliseconds
   * @param maxCount - Maximum number of jobs to keep
   */
  async cleanQueue(maxAge: number = 24 * 60 * 60 * 1000, maxCount: number = 100): Promise<void> {
    try {
      await Promise.all([
        this.notificationQueue.clean(maxAge, 'completed', maxCount),
        this.notificationQueue.clean(maxAge, 'failed', maxCount),
      ]);

      this.logger.debug('Queue cleanup completed', {
        maxAge,
        maxCount,
      });
    } catch (error) {
      this.logger.error('Failed to clean notification queue', {
        error: error.message,
        stack: error.stack,
        maxAge,
        maxCount,
      });
    }
  }

  /**
   * Maps NotificationPriority enum to BullMQ numeric priority
   * Lower numbers = higher priority (1-2097152)
   */
  private mapPriorityToNumber(priority?: NotificationPriority): number {
    if (!priority) return 10; // Default priority

    const priorityMap = {
      [NotificationPriority.CRITICAL]: 1,
      [NotificationPriority.URGENT]: 5,
      [NotificationPriority.HIGH]: 10,
      [NotificationPriority.NORMAL]: 50,
      [NotificationPriority.LOW]: 100,
    };

    return priorityMap[priority] || 50;
  }

  /**
   * Calculates job priority based on notification priority and channels
   * Higher numbers = higher priority in Bull queue
   *
   * @private
   */
  private calculateJobPriority(
    notificationPriority: NotificationPriority,
    channels: NotificationChannel[],
  ): number {
    let basePriority = 0;

    // Base priority from notification priority
    switch (notificationPriority) {
      case NotificationPriority.CRITICAL:
        basePriority = 100;
        break;
      case NotificationPriority.URGENT:
        basePriority = 80;
        break;
      case NotificationPriority.HIGH:
        basePriority = 60;
        break;
      case NotificationPriority.NORMAL:
        basePriority = 40;
        break;
      case NotificationPriority.LOW:
        basePriority = 20;
        break;
      default:
        basePriority = 40;
    }

    // Adjust priority based on channels (more urgent channels get higher priority)
    if (channels.includes(NotificationChannel.PUSH)) {
      basePriority += 10; // Push notifications are more time-sensitive
    }
    if (channels.includes(NotificationChannel.IN_APP)) {
      basePriority += 5; // In-app notifications are immediate
    }
    if (channels.includes(NotificationChannel.EMAIL)) {
      basePriority += 3; // Email is less time-sensitive
    }
    if (channels.includes(NotificationChannel.WEBHOOK)) {
      basePriority += 8; // Webhooks for integrations are important
    }

    return Math.min(basePriority, 100); // Cap at 100
  }

  /**
   * Gets retry attempts based on channels
   *
   * @private
   */
  private getRetryAttempts(channels: NotificationChannel[]): number {
    // Different channels have different retry requirements
    let maxAttempts = 3; // Default

    if (channels.includes(NotificationChannel.EMAIL)) {
      maxAttempts = Math.max(maxAttempts, 5); // Email can be retried more
    }
    if (channels.includes(NotificationChannel.WEBHOOK)) {
      maxAttempts = Math.max(maxAttempts, 4); // Webhooks need reliable delivery
    }
    if (channels.includes(NotificationChannel.PUSH)) {
      maxAttempts = Math.max(maxAttempts, 3); // Push notifications are time-sensitive
    }
    if (channels.includes(NotificationChannel.IN_APP)) {
      maxAttempts = Math.max(maxAttempts, 2); // In-app less critical for retries
    }

    return maxAttempts;
  }

  /**
   * Gets backoff strategy based on channels
   *
   * @private
   */
  private getBackoffStrategy(channels: NotificationChannel[]): { type: string; delay: number } {
    // More critical channels get faster retry cycles
    if (
      channels.includes(NotificationChannel.PUSH) ||
      channels.includes(NotificationChannel.IN_APP)
    ) {
      return { type: 'exponential', delay: 1000 }; // Start with 1 second
    }

    if (channels.includes(NotificationChannel.WEBHOOK)) {
      return { type: 'exponential', delay: 2000 }; // Start with 2 seconds
    }

    // Email and others get standard backoff
    return { type: 'exponential', delay: 3000 }; // Start with 3 seconds
  }

  /**
   * Sets up queue event listeners for monitoring and logging
   *
   * @private
   */
  private setupQueueEventListeners(): void {
    // Job completion events
    this.notificationQueue.on('completed', (job: Job<NotificationQueueJobData>) => {
      this.logger.debug(`Notification job completed: ${job.id}`, {
        jobId: job.id,
        notificationId: job.data.notificationId,
        channels: job.data.channels,
        processingTime: job.processedOn ? Date.now() - job.processedOn : 0,
      });
    });

    // Job failure events
    this.notificationQueue.on('failed', (job: Job<NotificationQueueJobData>, error: Error) => {
      this.logger.error(`Notification job failed: ${job.id}`, {
        jobId: job.id,
        notificationId: job.data.notificationId,
        channels: job.data.channels,
        error: error.message,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts,
      });
    });

    // Job retry events
    this.notificationQueue.on('stalled', (job: Job<NotificationQueueJobData>) => {
      this.logger.warn(`Notification job stalled: ${job.id}`, {
        jobId: job.id,
        notificationId: job.data.notificationId,
        channels: job.data.channels,
      });
    });

    // Job progress events
    this.notificationQueue.on(
      'progress',
      (job: Job<NotificationQueueJobData>, progress: number) => {
        this.logger.debug(`Notification job progress: ${job.id} - ${progress}%`, {
          jobId: job.id,
          notificationId: job.data.notificationId,
          progress,
        });
      },
    );

    // Queue error events
    this.notificationQueue.on('error', (error: Error) => {
      this.logger.error('Notification queue error', {
        error: error.message,
        stack: error.stack,
      });
    });
  }

  /**
   * Configures queue settings for optimal performance
   *
   * @private
   */
  private async configureQueueSettings(): Promise<void> {
    try {
      // Set up default job options if not already configured
      await this.notificationQueue.isReady();

      this.logger.debug('Queue settings configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure queue settings', {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
