import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateBulkNotificationDto,
  CreateNotificationDto,
  NotificationListResponseDto,
  NotificationQueryDto,
  NotificationResponseDto,
  NotificationStatsResponseDto,
  UpdateNotificationDto,
  UpdateNotificationPreferenceDto,
} from './dto/notification.dto';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from './entities/notification-preference.entity';
import { Notification, NotificationDocument } from './entities/notification.entity';
import { NotificationQueueService } from './services/notification-queue.service';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationQueueJobData,
  NotificationStatus,
  NotificationType,
} from './types/notification.types';

/**
 * Notifications Service
 *
 * Main service for managing notifications across the entire application.
 * Provides comprehensive notification creation, delivery orchestration,
 * user preference management, analytics, and reporting capabilities.
 *
 * Features:
 * - Multi-channel notification creation and delivery
 * - User preference management with granular controls
 * - Bulk notification processing with batching
 * - Advanced querying and filtering
 * - Analytics and reporting
 * - Template integration
 * - Scheduled notification support
 * - Audit trail and compliance features
 *
 * @class NotificationsService
 * @since 2025-01-15
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(NotificationPreference.name)
    private readonly notificationPreferenceModel: Model<NotificationPreferenceDocument>,
    private readonly queueService: NotificationQueueService,
  ) {}

  /**
   * Creates and queues a new notification for delivery
   *
   * @param createNotificationDto - Notification creation data
   * @param options - Additional options for notification processing
   * @returns Created notification with processing details
   */
  async createNotification(
    createNotificationDto: CreateNotificationDto,
    options: {
      skipQueue?: boolean;
      priority?: NotificationPriority;
      delay?: number;
    } = {},
  ): Promise<NotificationResponseDto> {
    this.logger.debug('Creating new notification', {
      type: createNotificationDto.type,
      recipientId: createNotificationDto.recipientId,
      channels: createNotificationDto.channels,
      priority: createNotificationDto.priority,
    });

    try {
      // Validate recipient exists (basic validation)
      if (!Types.ObjectId.isValid(createNotificationDto.recipientId)) {
        throw new BadRequestException('Invalid recipient ID');
      }

      // Create notification document
      const notification = new this.notificationModel({
        ...createNotificationDto,
        recipientId: new Types.ObjectId(createNotificationDto.recipientId),
        formId: createNotificationDto.formId
          ? new Types.ObjectId(createNotificationDto.formId)
          : undefined,
        submissionId: createNotificationDto.submissionId
          ? new Types.ObjectId(createNotificationDto.submissionId)
          : undefined,
        status: NotificationStatus.DRAFT,
        priority: createNotificationDto.priority || NotificationPriority.NORMAL,
        scheduledAt: createNotificationDto.scheduledAt || new Date(),
        createdBy: 'system', // TODO: Get from current user context
      });

      await notification.save();

      this.logger.log(`Notification created: ${notification._id.toString()}`, {
        notificationId: notification._id.toString(),
        type: notification.type,
        recipientId: notification.recipientId.toString(),
        channels: notification.channels,
      });

      // Queue notification for processing unless explicitly skipped
      if (!options.skipQueue) {
        await this.queueNotificationForDelivery(notification, {
          priority: options.priority,
          delay: options.delay,
        });
      }

      return this.mapToResponseDto(notification);
    } catch (error) {
      this.logger.error('Failed to create notification', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        createData: createNotificationDto,
      });
      throw error;
    }
  }

  /**
   * Creates multiple notifications in bulk with batching support
   *
   * @param createBulkDto - Bulk notification creation data
   * @returns Processing summary and created notification IDs
   */
  async createBulkNotifications(createBulkDto: CreateBulkNotificationDto): Promise<{
    totalCreated: number;
    notificationIds: string[];
    batchId: string;
    processingStarted: boolean;
  }> {
    const batchId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notificationIds: string[] = [];

    this.logger.log(
      `Creating bulk notifications for ${createBulkDto.recipientIds.length} recipients`,
      {
        batchId,
        recipientCount: createBulkDto.recipientIds.length,
        notificationType: createBulkDto.baseNotification.type,
        channels: createBulkDto.baseNotification.channels,
      },
    );

    try {
      // Create all notification documents
      const notifications: NotificationDocument[] = [];
      for (const recipientId of createBulkDto.recipientIds) {
        const recipientData = createBulkDto.recipientData?.[recipientId] || {};

        const notification = new this.notificationModel({
          ...createBulkDto.baseNotification,
          recipientId: new Types.ObjectId(recipientId),
          batchId,
          status: NotificationStatus.DRAFT,
          templateVariables: {
            ...createBulkDto.baseNotification.templateVariables,
            ...recipientData,
          },
          createdBy: 'system', // TODO: Get from current user context
        });

        notifications.push(notification);
      }

      // Bulk insert notifications
      const savedNotifications = await this.notificationModel.insertMany(notifications);
      notificationIds.push(
        ...savedNotifications.map((n: NotificationDocument) => n._id.toString()),
      );

      this.logger.log(`Created ${savedNotifications.length} notifications for bulk processing`, {
        batchId,
        notificationIds: notificationIds.slice(0, 5), // Log first 5 for brevity
        totalCount: savedNotifications.length,
      });

      // Queue notifications for processing
      const queueJobs: NotificationQueueJobData[] = savedNotifications.map(
        (notification: NotificationDocument) => ({
          notificationId: notification._id.toString(),
          channels: notification.channels,
          priority: notification.priority,
          scheduledFor: notification.scheduledAt,
          metadata: {
            batchId,
            bulkProcessing: true,
          },
        }),
      );

      await this.queueService.addBulkNotificationJobs(queueJobs, createBulkDto.options);

      return {
        totalCreated: savedNotifications.length,
        notificationIds,
        batchId,
        processingStarted: true,
      };
    } catch (error) {
      this.logger.error('Failed to create bulk notifications', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        batchId,
        recipientCount: createBulkDto.recipientIds.length,
        createdCount: notificationIds.length,
      });
      throw error;
    }
  }

  /**
   * Updates an existing notification
   *
   * @param id - Notification ID
   * @param updateDto - Update data
   * @returns Updated notification
   */
  async updateNotification(
    id: string,
    updateDto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    this.logger.debug(`Updating notification ${id}`, updateDto);

    try {
      const notification = await this.notificationModel
        .findByIdAndUpdate(id, updateDto, { new: true })
        .exec();

      if (!notification) {
        throw new NotFoundException(`Notification ${id} not found`);
      }

      this.logger.log(`Notification updated: ${id}`, {
        notificationId: id,
        updatedFields: Object.keys(updateDto),
      });

      return this.mapToResponseDto(notification);
    } catch (error) {
      this.logger.error(`Failed to update notification ${id}`, {
        error: error instanceof Error ? error.message : String(error),
        notificationId: id,
        updateData: updateDto,
      });
      throw error;
    }
  }

  /**
   * Marks a notification as read
   *
   * @param id - Notification ID
   * @param userId - User ID (for validation)
   * @returns Updated notification
   */
  async markAsRead(id: string, userId: string): Promise<NotificationResponseDto> {
    this.logger.debug(`Marking notification ${id} as read for user ${userId}`);

    try {
      const notification = await this.notificationModel
        .findOneAndUpdate(
          { _id: id, recipientId: userId },
          {
            readAt: new Date(),
            'analytics.readAt': new Date(),
            $inc: { 'analytics.readCount': 1 },
          },
          { new: true },
        )
        .exec();

      if (!notification) {
        throw new NotFoundException(`Notification ${id} not found or not accessible`);
      }

      // Update user preference analytics
      await this.updateUserEngagementMetrics(userId, 'read');

      this.logger.log(`Notification marked as read: ${id}`, {
        notificationId: id,
        userId,
        readAt: notification.readAt,
      });

      return this.mapToResponseDto(notification);
    } catch (error) {
      this.logger.error(`Failed to mark notification ${id} as read`, {
        error: error instanceof Error ? error.message : String(error),
        notificationId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Tracks notification click/interaction
   *
   * @param id - Notification ID
   * @param userId - User ID (for validation)
   * @param clickedUrl - URL that was clicked
   * @returns Updated notification
   */
  async trackClick(
    id: string,
    userId: string,
    clickedUrl?: string,
  ): Promise<NotificationResponseDto> {
    this.logger.debug(`Tracking click for notification ${id} by user ${userId}`, { clickedUrl });

    try {
      interface UpdateData {
        'analytics.clickedAt': Date;
        $inc: { 'analytics.clickCount': number };
        $addToSet?: { 'analytics.clickedUrls': string };
      }

      const updateData: UpdateData = {
        'analytics.clickedAt': new Date(),
        $inc: { 'analytics.clickCount': 1 },
      };

      if (clickedUrl) {
        updateData.$addToSet = { 'analytics.clickedUrls': clickedUrl };
      }

      const notification = await this.notificationModel
        .findOneAndUpdate({ _id: id, recipientId: userId }, updateData, { new: true })
        .exec();

      if (!notification) {
        throw new NotFoundException(`Notification ${id} not found or not accessible`);
      }

      // Update user preference analytics
      await this.updateUserEngagementMetrics(userId, 'click');

      this.logger.log(`Notification click tracked: ${id}`, {
        notificationId: id,
        userId,
        clickedUrl,
        clickCount: notification.analytics?.clickCount,
      });

      return this.mapToResponseDto(notification);
    } catch (error) {
      this.logger.error(`Failed to track click for notification ${id}`, {
        error: error instanceof Error ? error.message : String(error),
        notificationId: id,
        userId,
        clickedUrl,
      });
      throw error;
    }
  }

  /**
   * Gets a single notification by ID
   *
   * @param id - Notification ID
   * @param userId - User ID (for access control)
   * @returns Notification details
   */
  async getNotification(id: string, userId?: string): Promise<NotificationResponseDto> {
    try {
      interface QueryFilter {
        _id: string;
        recipientId?: string;
      }

      const query: QueryFilter = { _id: id };
      if (userId) {
        query.recipientId = userId;
      }

      const notification = await this.notificationModel.findOne(query).exec();

      if (!notification) {
        throw new NotFoundException(`Notification ${id} not found`);
      }

      return this.mapToResponseDto(notification);
    } catch (error) {
      this.logger.error(`Failed to get notification ${id}`, {
        error: error instanceof Error ? error.message : String(error),
        notificationId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Gets notifications with filtering and pagination
   *
   * @param queryDto - Query parameters
   * @returns Paginated notification list
   */
  async getNotifications(queryDto: NotificationQueryDto): Promise<NotificationListResponseDto> {
    this.logger.debug('Querying notifications', queryDto);

    try {
      // Build MongoDB query
      const filter = this.buildNotificationFilter(queryDto);

      // Build sort options
      const sortField = queryDto.sortBy || 'createdAt';
      const sortOptions: Record<string, 1 | -1> = {};
      sortOptions[sortField] = queryDto.sortOrder === 'asc' ? 1 : -1;

      // Calculate pagination
      const limit = Math.min(queryDto.limit || 20, 100);
      const skip = ((queryDto.page || 1) - 1) * limit;

      // Execute queries
      const [notifications, total] = await Promise.all([
        this.notificationModel.find(filter).sort(sortOptions).skip(skip).limit(limit).exec(),
        this.notificationModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);
      const currentPage = queryDto.page || 1;

      const response: NotificationListResponseDto = {
        notifications: notifications.map(n => this.mapToResponseDto(n)),
        total,
        page: currentPage,
        limit,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      };

      this.logger.debug(`Retrieved ${notifications.length} notifications`, {
        total,
        page: currentPage,
        limit,
        totalPages,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to query notifications', {
        error: error instanceof Error ? error.message : String(error),
        query: queryDto,
      });
      throw error;
    }
  }

  /**
   * Gets notification statistics for analytics
   *
   * @param filters - Optional filters for statistics
   * @returns Comprehensive notification statistics
   */
  async getNotificationStats(
    filters: {
      startDate?: Date;
      endDate?: Date;
      recipientId?: string;
      type?: NotificationType;
      channels?: NotificationChannel[];
    } = {},
  ): Promise<NotificationStatsResponseDto> {
    this.logger.debug('Generating notification statistics', filters);

    try {
      const filter = this.buildStatsFilter(filters);

      // Aggregate statistics
      const [basicStats, channelStats, typeStats] = await Promise.all([
        this.getBasicStats(filter),
        Promise.resolve(this.getChannelStats(filter)),
        Promise.resolve(this.getTypeStats(filter)),
      ]);

      const response: NotificationStatsResponseDto = {
        totalSent: basicStats.totalSent,
        totalDelivered: basicStats.totalDelivered,
        totalRead: basicStats.totalRead,
        totalClicked: basicStats.totalClicked,
        deliveryRate:
          basicStats.totalSent > 0 ? (basicStats.totalDelivered / basicStats.totalSent) * 100 : 0,
        readRate:
          basicStats.totalDelivered > 0
            ? (basicStats.totalRead / basicStats.totalDelivered) * 100
            : 0,
        clickRate:
          basicStats.totalRead > 0 ? (basicStats.totalClicked / basicStats.totalRead) * 100 : 0,
        byChannel: channelStats,
        byType: typeStats,
      };

      this.logger.log('Generated notification statistics', {
        totalSent: response.totalSent,
        deliveryRate: response.deliveryRate,
        readRate: response.readRate,
        clickRate: response.clickRate,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to generate notification statistics', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Gets user notification preferences
   *
   * @param userId - User ID
   * @returns User preferences or default preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferenceDocument> {
    try {
      const preferences = await this.notificationPreferenceModel.findOne({ userId }).exec();

      if (!preferences) {
        // Create default preferences
        return await this.createDefaultPreferences(userId);
      }

      return preferences as NotificationPreferenceDocument;
    } catch (error) {
      this.logger.error(`Failed to get user preferences for ${userId}`, {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Updates user notification preferences
   *
   * @param userId - User ID
   * @param updateDto - Preference updates
   * @returns Updated preferences
   */
  async updateUserPreferences(
    userId: string,
    updateDto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceDocument> {
    this.logger.debug(`Updating notification preferences for user ${userId}`, updateDto);

    try {
      const preferences = await this.notificationPreferenceModel
        .findOneAndUpdate(
          { userId },
          {
            ...updateDto,
            lastModifiedBy: 'user', // TODO: Get from current user context
          },
          { new: true, upsert: true },
        )
        .exec();

      this.logger.log(`Updated notification preferences for user ${userId}`, {
        userId,
        preferencesId: preferences._id,
        updatedFields: Object.keys(updateDto),
      });

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to update user preferences for ${userId}`, {
        error: error instanceof Error ? error.message : String(error),
        userId,
        updateData: updateDto,
      });
      throw error;
    }
  }

  /**
   * Archives old notifications based on retention policies
   *
   * @param retentionDays - Number of days to retain notifications
   * @returns Number of archived notifications
   */
  async archiveOldNotifications(retentionDays: number = 90): Promise<number> {
    this.logger.log(`Archiving notifications older than ${retentionDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.notificationModel.updateMany(
        {
          createdAt: { $lt: cutoffDate },
          archived: false,
          status: {
            $in: [
              NotificationStatus.DELIVERED,
              NotificationStatus.FAILED,
              NotificationStatus.PERMANENTLY_FAILED,
            ],
          },
        },
        {
          archived: true,
          archivedAt: new Date(),
        },
      );

      this.logger.log(`Archived ${result.modifiedCount} old notifications`, {
        cutoffDate,
        archivedCount: result.modifiedCount,
      });

      return result.modifiedCount;
    } catch (error) {
      this.logger.error('Failed to archive old notifications', {
        error: error instanceof Error ? error.message : String(error),
        retentionDays,
      });
      throw error;
    }
  }

  /**
   * Queues a notification for delivery
   *
   * @private
   */
  private async queueNotificationForDelivery(
    notification: NotificationDocument,
    options: {
      priority?: NotificationPriority;
      delay?: number;
    } = {},
  ): Promise<void> {
    const jobData: NotificationQueueJobData = {
      notificationId: notification._id.toString(),
      channels: notification.channels,
      priority: options.priority || notification.priority,
      scheduledFor: notification.scheduledAt,
      metadata: {
        type: notification.type,
        recipientId: notification.recipientId.toString(),
      },
    };

    await this.queueService.addNotificationJob(jobData, {
      delay: options.delay,
      priority: options.priority ? this.mapPriorityToNumber(options.priority) : undefined,
    });

    // Update notification status
    await this.notificationModel.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.QUEUED,
    });

    this.logger.debug(`Notification queued for delivery: ${notification._id.toString()}`, {
      notificationId: notification._id.toString(),
      channels: notification.channels,
      priority: jobData.priority,
      scheduledFor: notification.scheduledAt,
    });
  }

  /**
   * Maps notification document to response DTO
   *
   * @private
   */
  private mapToResponseDto(notification: NotificationDocument): NotificationResponseDto {
    return {
      id: notification._id.toString(),
      type: notification.type,
      status: notification.status,
      priority: notification.priority,
      recipientId: notification.recipientId.toString(),
      recipientEmail: notification.recipientEmail,
      recipientName: notification.recipientName,
      content: notification.content,
      channels: notification.channels,
      deliveredChannels: notification.deliveredChannels,
      failedChannels: notification.failedChannels,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      scheduledAt: notification.scheduledAt,
      processedAt: notification.processedAt,
      deliveredAt: notification.deliveredAt,
      readAt: notification.readAt,
      expiresAt: notification.expiresAt,
      attemptCount: notification.attemptCount,
      maxAttempts: notification.maxAttempts,
      nextRetryAt: notification.nextRetryAt,
      lastErrorMessage: notification.lastErrorMessage,
      isRead: !!notification.readAt,
      isDelivered: notification.deliveredChannels.length > 0,
      deliveryRate:
        notification.channels.length > 0
          ? (notification.deliveredChannels.length / notification.channels.length) * 100
          : 0,
    };
  }

  /**
   * Builds MongoDB filter for notification queries
   *
   * @private
   */
  private buildNotificationFilter(queryDto: NotificationQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (queryDto.recipientId) filter.recipientId = queryDto.recipientId;
    if (queryDto.type) filter.type = queryDto.type;
    if (queryDto.status) filter.status = queryDto.status;
    if (queryDto.priority) filter.priority = queryDto.priority;
    if (queryDto.channels?.length) filter.channels = { $in: queryDto.channels };
    if (queryDto.sourceType) filter['context.sourceType'] = queryDto.sourceType;
    if (queryDto.sourceId) filter['context.sourceId'] = queryDto.sourceId;
    if (queryDto.tags?.length) filter['context.tags'] = { $in: queryDto.tags };
    if (queryDto.category) filter['context.category'] = queryDto.category;
    if (queryDto.batchId) filter.batchId = queryDto.batchId;
    if (typeof queryDto.isRead === 'boolean') {
      filter.readAt = queryDto.isRead ? { $ne: null } : null;
    }
    if (typeof queryDto.archived === 'boolean') filter.archived = queryDto.archived;

    // Date range filter
    if (queryDto.startDate || queryDto.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (queryDto.startDate) dateFilter.$gte = queryDto.startDate;
      if (queryDto.endDate) dateFilter.$lte = queryDto.endDate;
      filter.createdAt = dateFilter;
    }

    return filter;
  }

  /**
   * Builds filter for statistics queries
   *
   * @private
   */
  private buildStatsFilter(filters: {
    startDate?: Date;
    endDate?: Date;
    recipientId?: string;
    type?: NotificationType;
    channels?: NotificationChannel[];
  }): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (filters.recipientId) filter.recipientId = filters.recipientId;
    if (filters.type) filter.type = filters.type;
    if (filters.channels?.length) filter.channels = { $in: filters.channels };

    if (filters.startDate || filters.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filters.startDate) dateFilter.$gte = filters.startDate;
      if (filters.endDate) dateFilter.$lte = filters.endDate;
      filter.createdAt = dateFilter;
    }

    return filter;
  }

  /**
   * Gets basic notification statistics
   *
   * @private
   */
  private async getBasicStats(filter: Record<string, unknown>): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalClicked: number;
  }> {
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalDelivered: {
            $sum: { $cond: [{ $gt: [{ $size: '$deliveredChannels' }, 0] }, 1, 0] },
          },
          totalRead: {
            $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] },
          },
          totalClicked: {
            $sum: { $cond: [{ $gt: ['$analytics.clickCount', 0] }, 1, 0] },
          },
        },
      },
    ];

    const result = await this.notificationModel.aggregate(pipeline).exec();
    return result[0] || { totalSent: 0, totalDelivered: 0, totalRead: 0, totalClicked: 0 };
  }

  /**
   * Gets statistics by channel
   *
   * @private
   */
  private getChannelStats(_filter: Record<string, unknown>): Record<
    NotificationChannel,
    {
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    }
  > {
    // Simplified implementation - would need more complex aggregation in production
    return Object.values(NotificationChannel).reduce(
      (acc, channel) => {
        acc[channel] = { sent: 0, delivered: 0, failed: 0, deliveryRate: 0 };
        return acc;
      },
      {} as Record<
        NotificationChannel,
        { sent: number; delivered: number; failed: number; deliveryRate: number }
      >,
    );
  }

  /**
   * Gets statistics by notification type
   *
   * @private
   */
  private getTypeStats(_filter: Record<string, unknown>): Record<
    NotificationType,
    {
      sent: number;
      avgDeliveryTime: number;
      avgReadTime: number;
    }
  > {
    // Simplified implementation - would need more complex aggregation in production
    return Object.values(NotificationType).reduce(
      (acc, type) => {
        acc[type] = { sent: 0, avgDeliveryTime: 0, avgReadTime: 0 };
        return acc;
      },
      {} as Record<
        NotificationType,
        { sent: number; avgDeliveryTime: number; avgReadTime: number }
      >,
    );
  }

  /**
   * Creates default notification preferences for a user
   *
   * @private
   */
  private async createDefaultPreferences(userId: string): Promise<NotificationPreferenceDocument> {
    const preferences = new this.notificationPreferenceModel({
      userId: new Types.ObjectId(userId),
      globalEnabled: true,
      defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: false,
      webhookEnabled: false,
      consentGiven: true,
      consentGivenAt: new Date(),
    });

    const savedPreferences = await preferences.save();

    this.logger.log(`Created default notification preferences for user ${userId}`, {
      userId,
      preferencesId: savedPreferences._id,
    });

    return savedPreferences as NotificationPreferenceDocument;
  }

  /**
   * Updates user engagement metrics
   *
   * @private
   */
  private async updateUserEngagementMetrics(
    userId: string,
    action: 'read' | 'click',
  ): Promise<void> {
    interface EngagementUpdateData {
      $inc?: Record<string, number>;
      lastNotificationReadAt?: Date;
      lastNotificationClickedAt?: Date;
    }

    const updateData: EngagementUpdateData = {};

    if (action === 'read') {
      updateData.$inc = { totalNotificationsRead: 1 };
      updateData.lastNotificationReadAt = new Date();
    } else if (action === 'click') {
      updateData.$inc = { totalNotificationsClicked: 1 };
      updateData.lastNotificationClickedAt = new Date();
    }

    await this.notificationPreferenceModel.updateOne({ userId }, updateData);
  }

  /**
   * Maps NotificationPriority enum to numeric priority
   *
   * @private
   */
  private mapPriorityToNumber(priority: NotificationPriority): number {
    const priorityMap = {
      [NotificationPriority.CRITICAL]: 1,
      [NotificationPriority.URGENT]: 5,
      [NotificationPriority.HIGH]: 10,
      [NotificationPriority.NORMAL]: 50,
      [NotificationPriority.LOW]: 100,
    };

    return priorityMap[priority] || 50;
  }
}
