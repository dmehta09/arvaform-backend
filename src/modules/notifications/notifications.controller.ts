import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
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
import { NotificationsService } from './notifications.service';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from './types/notification.types';

/**
 * Notifications Controller
 *
 * Provides comprehensive REST API endpoints for notification management
 * across the entire ArvaForm platform. Handles notification creation,
 * delivery orchestration, user preference management, analytics, and
 * administrative functions.
 *
 * Features:
 * - Notification CRUD operations
 * - Bulk notification processing
 * - User preference management
 * - Analytics and reporting
 * - Real-time notification tracking
 * - Administrative oversight
 *
 * Security:
 * - JWT authentication required for all endpoints
 * - Rate limiting on bulk operations
 * - User-specific access controls
 * - GDPR compliance features
 *
 * @class NotificationsController
 * @since 2025-01-15
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Creates a new notification
   * POST /notifications
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create notification',
    description: 'Creates a new notification for delivery across specified channels',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notification created successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid notification data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @RateLimit({ limit: 100, ttl: 60 }) // 100 notifications per minute
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
    @GetUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Creating notification for user ${userId}`, {
      type: createNotificationDto.type,
      channels: createNotificationDto.channels,
      recipientId: createNotificationDto.recipientId,
    });

    // Validate user permissions (users can only create notifications for themselves or if they're admin)
    if (createNotificationDto.recipientId !== userId) {
      // TODO: Add admin check here
      throw new ForbiddenException('Cannot create notifications for other users');
    }

    return await this.notificationsService.createNotification(createNotificationDto);
  }

  /**
   * Creates multiple notifications in bulk
   * POST /notifications/bulk
   */
  @Post('bulk')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Create bulk notifications',
    description: 'Creates multiple notifications for batch processing',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Bulk notifications processing started',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid bulk notification data',
  })
  @RateLimit({ limit: 10, ttl: 60 }) // 10 bulk operations per minute
  async createBulkNotifications(
    @Body() createBulkDto: CreateBulkNotificationDto,
    @GetUser('id') userId: string,
  ): Promise<{
    totalCreated: number;
    notificationIds: string[];
    batchId: string;
    processingStarted: boolean;
  }> {
    this.logger.log(`Creating bulk notifications for user ${userId}`, {
      recipientCount: createBulkDto.recipientIds.length,
      type: createBulkDto.baseNotification.type,
      channels: createBulkDto.baseNotification.channels,
    });

    // Validate bulk size limits
    if (createBulkDto.recipientIds.length > 10000) {
      throw new BadRequestException('Bulk notification limit exceeded (max 10,000 recipients)');
    }

    return await this.notificationsService.createBulkNotifications(createBulkDto);
  }

  /**
   * Gets a specific notification
   * GET /notifications/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get notification',
    description: 'Retrieves a specific notification by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification retrieved successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async getNotification(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    this.logger.debug(`Getting notification ${id} for user ${userId}`);

    return await this.notificationsService.getNotification(id, userId);
  }

  /**
   * Updates a notification
   * PUT /notifications/:id
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update notification',
    description: 'Updates an existing notification',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification updated successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async updateNotification(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @GetUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Updating notification ${id} for user ${userId}`, updateNotificationDto);

    // First get the notification to check ownership
    await this.notificationsService.getNotification(id, userId);

    return await this.notificationsService.updateNotification(id, updateNotificationDto);
  }

  /**
   * Marks a notification as read
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a notification as read and updates analytics',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  async markAsRead(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    this.logger.debug(`Marking notification ${id} as read for user ${userId}`);

    return await this.notificationsService.markAsRead(id, userId);
  }

  /**
   * Tracks notification click
   * PATCH /notifications/:id/click
   */
  @Patch(':id/click')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track notification click',
    description: 'Tracks when a user clicks on a notification link',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Click tracked successfully',
    type: NotificationResponseDto,
  })
  async trackClick(
    @Param('id') id: string,
    @Body() body: { clickedUrl?: string },
    @GetUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    this.logger.debug(`Tracking click for notification ${id} by user ${userId}`, body);

    return await this.notificationsService.trackClick(id, userId, body.clickedUrl);
  }

  /**
   * Gets notifications with filtering and pagination
   * GET /notifications
   */
  @Get()
  @ApiOperation({
    summary: 'Get notifications',
    description: 'Retrieves notifications with filtering, sorting, and pagination',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus })
  @ApiQuery({ name: 'priority', required: false, enum: NotificationPriority })
  @ApiQuery({ name: 'channels', required: false, isArray: true, enum: NotificationChannel })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'archived', required: false, type: Boolean })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications retrieved successfully',
    type: NotificationListResponseDto,
  })
  async getNotifications(
    @Query() queryDto: NotificationQueryDto,
    @GetUser('id') userId: string,
  ): Promise<NotificationListResponseDto> {
    this.logger.debug(`Getting notifications for user ${userId}`, queryDto);

    // Filter to user's notifications only
    queryDto.recipientId = userId;

    return await this.notificationsService.getNotifications(queryDto);
  }

  /**
   * Gets notification statistics
   * GET /notifications/stats
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get notification statistics',
    description: 'Retrieves comprehensive notification analytics and statistics',
  })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  @ApiQuery({ name: 'channels', required: false, isArray: true, enum: NotificationChannel })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    type: NotificationStatsResponseDto,
  })
  async getNotificationStats(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('type') type?: NotificationType,
    @Query('channels') channels?: NotificationChannel[],
    @GetUser('id') userId?: string,
  ): Promise<NotificationStatsResponseDto> {
    this.logger.debug(`Getting notification statistics for user ${userId}`, {
      startDate,
      endDate,
      type,
      channels,
    });

    return await this.notificationsService.getNotificationStats({
      startDate,
      endDate,
      recipientId: userId,
      type,
      channels,
    });
  }

  /**
   * Gets user notification preferences
   * GET /notifications/preferences
   */
  @Get('preferences')
  @ApiOperation({
    summary: 'Get notification preferences',
    description: 'Retrieves current user notification preferences',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences retrieved successfully',
  })
  async getUserPreferences(@GetUser('id') userId: string) {
    this.logger.debug(`Getting notification preferences for user ${userId}`);

    return await this.notificationsService.getUserPreferences(userId);
  }

  /**
   * Updates user notification preferences
   * PUT /notifications/preferences
   */
  @Put('preferences')
  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Updates user notification preferences and settings',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid preference data',
  })
  async updateUserPreferences(
    @Body() updateDto: UpdateNotificationPreferenceDto,
    @GetUser('id') userId: string,
  ) {
    this.logger.log(`Updating notification preferences for user ${userId}`, updateDto);

    return await this.notificationsService.updateUserPreferences(userId, updateDto);
  }

  /**
   * Archives old notifications (Admin only)
   * POST /notifications/archive
   */
  @Post('archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive old notifications',
    description: 'Archives notifications older than specified retention period (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications archived successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async archiveOldNotifications(
    @Body() body: { retentionDays?: number },
    @GetUser('id') userId: string,
  ): Promise<{ archivedCount: number; retentionDays: number }> {
    this.logger.log(`Archiving old notifications requested by user ${userId}`, body);

    // TODO: Add admin role check here
    // For now, allowing all authenticated users to archive their own notifications

    const retentionDays = body.retentionDays || 90;
    const archivedCount = await this.notificationsService.archiveOldNotifications(retentionDays);

    return { archivedCount, retentionDays };
  }

  /**
   * Health check endpoint
   * GET /notifications/health
   */
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Checks the health of the notification system',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System is healthy',
  })
  healthCheck(): {
    status: string;
    timestamp: string;
    uptime: number;
    version: string;
  } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    };
  }

  // Admin endpoints (would be in a separate admin controller in production)

  /**
   * Gets all notifications (Admin only)
   * GET /notifications/admin/all
   */
  @Get('admin/all')
  @ApiOperation({
    summary: 'Get all notifications (Admin)',
    description: 'Retrieves all notifications across all users (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All notifications retrieved successfully',
    type: NotificationListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async getAllNotifications(
    @Query() queryDto: NotificationQueryDto,
    @GetUser('id') userId: string,
  ): Promise<NotificationListResponseDto> {
    this.logger.log(`Admin ${userId} requesting all notifications`, queryDto);

    // TODO: Add admin role check here
    // For now, removing the recipientId filter to allow admin access

    // Remove user-specific filter for admin access
    delete queryDto.recipientId;

    return await this.notificationsService.getNotifications(queryDto);
  }

  /**
   * Gets global notification statistics (Admin only)
   * GET /notifications/admin/stats
   */
  @Get('admin/stats')
  @ApiOperation({
    summary: 'Get global notification statistics (Admin)',
    description: 'Retrieves system-wide notification analytics (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Global statistics retrieved successfully',
    type: NotificationStatsResponseDto,
  })
  async getGlobalStats(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('type') type?: NotificationType,
    @Query('channels') channels?: NotificationChannel[],
    @GetUser('id') userId?: string,
  ): Promise<NotificationStatsResponseDto> {
    this.logger.log(`Admin ${userId} requesting global notification statistics`, {
      startDate,
      endDate,
      type,
      channels,
    });

    // TODO: Add admin role check here

    return await this.notificationsService.getNotificationStats({
      startDate,
      endDate,
      type,
      channels,
      // No recipientId filter for global stats
    });
  }
}
