import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsOverviewDto,
  AnalyticsQueryDto,
  AnalyticsResponseDto,
  BulkAnalyticsQueryDto,
  RefreshAnalyticsDto,
} from './dto/analytics-query.dto';

/**
 * Analytics controller for form submission data insights
 * Provides comprehensive analytics endpoints for form owners
 */
@Controller('api/analytics')
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get comprehensive analytics data for a specific form
   */
  @Get('forms/:formId')
  @ApiOperation({
    summary: 'Get form analytics',
    description:
      'Retrieve comprehensive analytics data for a specific form with filtering and caching support',
  })
  @ApiParam({
    name: 'formId',
    description: 'Form ID to retrieve analytics for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics data retrieved successfully',
    type: AnalyticsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'Form not found',
  })
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  async getFormAnalytics(
    @Param('formId') formId: string,
    @Query(ValidationPipe) query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    try {
      this.logger.debug(`Getting analytics for form ${formId}`);
      return await this.analyticsService.getAnalytics({ ...query, formId });
    } catch (error) {
      this.logger.error(`Failed to get analytics for form ${formId}:`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Get overview metrics for quick dashboard display
   */
  @Get('forms/:formId/overview')
  @ApiOperation({
    summary: 'Get form overview metrics',
    description: 'Retrieve key performance indicators for quick dashboard display',
  })
  @ApiParam({
    name: 'formId',
    description: 'Form ID to retrieve overview for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Overview metrics retrieved successfully',
    type: AnalyticsOverviewDto,
  })
  @Throttle({ default: { limit: 200, ttl: 60000 } }) // 200 requests per minute for overview
  async getFormOverview(@Param('formId') formId: string): Promise<AnalyticsOverviewDto> {
    try {
      this.logger.debug(`Getting overview metrics for form ${formId}`);
      return await this.analyticsService.getOverviewMetrics(formId);
    } catch (error) {
      this.logger.error(
        `Failed to get overview metrics for form ${formId}:`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Refresh analytics data for a specific form
   */
  @Post('forms/:formId/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Refresh form analytics',
    description: 'Trigger analytics data refresh for a specific form with optional force flag',
  })
  @ApiParam({
    name: 'formId',
    description: 'Form ID to refresh analytics for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 202,
    description: 'Analytics refresh initiated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid refresh parameters',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Limited refresh requests
  async refreshFormAnalytics(
    @Param('formId') formId: string,
    @Body(ValidationPipe) refreshDto: RefreshAnalyticsDto,
  ): Promise<{ message: string; formId: string }> {
    try {
      this.logger.debug(`Refreshing analytics for form ${formId}`);
      await this.analyticsService.refreshAnalytics({ ...refreshDto, formId });
      return {
        message: 'Analytics refresh initiated successfully',
        formId,
      };
    } catch (error) {
      this.logger.error(`Failed to refresh analytics for form ${formId}:`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Get bulk analytics for multiple forms (dashboard overview)
   */
  @Post('bulk')
  @ApiOperation({
    summary: 'Get bulk analytics',
    description: 'Retrieve analytics data for multiple forms in a single request',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk analytics retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: {
        $ref: '#/components/schemas/AnalyticsOverviewDto',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bulk query parameters',
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // Limited bulk requests
  async getBulkAnalytics(
    @Body(ValidationPipe) query: BulkAnalyticsQueryDto,
  ): Promise<Record<string, AnalyticsOverviewDto>> {
    try {
      this.logger.debug(`Getting bulk analytics for ${query.formIds.length} forms`);
      return await this.analyticsService.getBulkAnalytics(query);
    } catch (error) {
      this.logger.error(`Failed to get bulk analytics:`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Get real-time analytics data (WebSocket alternative)
   */
  @Get('forms/:formId/realtime')
  @ApiOperation({
    summary: 'Get real-time analytics',
    description: 'Retrieve the most current analytics data without caching',
  })
  @ApiParam({
    name: 'formId',
    description: 'Form ID to retrieve real-time analytics for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Real-time analytics retrieved successfully',
    type: AnalyticsResponseDto,
  })
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // Limited real-time requests
  async getRealtimeAnalytics(
    @Param('formId') formId: string,
    @Query(ValidationPipe) query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    try {
      this.logger.debug(`Getting real-time analytics for form ${formId}`);
      // Placeholder for real-time implementation (e.g., WebSockets)
      return await this.analyticsService.getAnalytics({ ...query, formId });
    } catch (error) {
      this.logger.error(`Failed to get real-time analytics for ${formId}:`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Health check endpoint for analytics service
   */
  @Get('health')
  @ApiOperation({ summary: 'Analytics service health check' })
  @ApiResponse({ status: 200, description: 'Analytics service is healthy' })
  healthCheck(): { status: string; timestamp: string; service: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'analytics',
    };
  }
}
