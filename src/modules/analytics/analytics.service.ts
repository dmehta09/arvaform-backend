import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import { Model, Types } from 'mongoose';
import {
  AnalyticsOverviewDto,
  AnalyticsPeriod,
  AnalyticsQueryDto,
  AnalyticsResponseDto,
  BulkAnalyticsQueryDto,
  RefreshAnalyticsDto,
} from './dto/analytics-query.dto';
import {
  Analytics,
  AnalyticsDocument,
  DeviceMetrics,
  FieldMetrics,
  GeographicMetrics,
  TimeMetrics,
} from './entities/analytics.entity';
import { DataAggregationService } from './services/data-aggregation.service';

/**
 * Analytics service for form submission data analysis
 * Implements caching, scheduled aggregation, and optimized data retrieval
 * Following 2025 NestJS best practices with Redis caching and performance optimization
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes for real-time data
  private readonly CACHE_TTL_LONG = 3600; // 1 hour for historical data

  constructor(
    @InjectModel(Analytics.name)
    private analyticsModel: Model<AnalyticsDocument>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private dataAggregationService: DataAggregationService,
  ) {}

  /**
   * Get analytics data for a form with intelligent caching
   * Implements multi-layer caching strategy for optimal performance
   */
  async getAnalytics(query: AnalyticsQueryDto): Promise<AnalyticsResponseDto> {
    const { formId, period = AnalyticsPeriod.DAY, startDate, endDate, realTime } = query;

    // Generate cache key based on query parameters
    const cacheKey = this.generateCacheKey(query);

    try {
      // Check cache first (unless real-time is requested)
      if (!realTime) {
        const cached = await this.cacheManager.get<AnalyticsResponseDto>(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for analytics query: ${cacheKey}`);
          return {
            ...cached,
            dataFreshness: 'cached',
            generatedAt: new Date(),
          };
        }
      }

      this.logger.debug(`Cache miss, generating analytics for form: ${formId}`);

      // Calculate period boundaries if not provided
      const { start, end } = this.calculateDateRange(startDate, endDate, period);

      // Fetch or compute analytics data
      const analyticsData = await this.getOrComputeAnalytics(formId, period, start, end);

      // Transform to response format
      const response: AnalyticsResponseDto = {
        formId,
        period: period || AnalyticsPeriod.DAY,
        overview: this.transformToOverviewDto(analyticsData),
        timeSeries: this.generateTimeSeries(analyticsData, period),
        geographic: this.transformGeographicData(analyticsData.geographic),
        devices: this.transformDeviceData(analyticsData.devices),
        fields: this.transformFieldData(analyticsData.fields),
        performance: analyticsData.performance,
        generatedAt: new Date(),
        dataFreshness: realTime ? 'realtime' : 'cached',
      };

      // Cache the response with appropriate TTL
      const cacheTTL = this.getCacheTTL(period, realTime);
      await this.cacheManager.set(cacheKey, response, cacheTTL);

      this.logger.log(`Analytics generated and cached for form: ${formId}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get analytics for form ${formId}:`, (error as Error).stack);
      throw new Error(`Analytics retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get overview metrics for quick dashboard display
   */
  async getOverviewMetrics(formId: string): Promise<AnalyticsOverviewDto> {
    const cacheKey = `overview:${formId}`;

    try {
      // Check cache first
      const cached = await this.cacheManager.get<AnalyticsOverviewDto>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get the most recent analytics data
      const latestAnalytics = await this.analyticsModel
        .findOne({
          formId: new Types.ObjectId(formId),
        })
        .sort({ computedAt: -1 })
        .exec();

      if (!latestAnalytics) {
        // If no analytics exist, trigger computation for current day
        const { start, end } = this.calculateDateRange(undefined, undefined, AnalyticsPeriod.DAY);

        // For now, return default values - would trigger aggregation in production
        const defaultOverview: AnalyticsOverviewDto = {
          totalSubmissions: 0,
          totalViews: 0,
          uniqueVisitors: 0,
          completionRate: 0,
          avgCompletionTime: 0,
          totalRevenue: 0,
          bounceRate: 0,
          spamRate: 0,
          qualityScore: 100,
          periodStart: start,
          periodEnd: end,
          lastUpdated: new Date(),
        };

        // Cache for shorter time since it's empty data
        await this.cacheManager.set(cacheKey, defaultOverview, 60);
        return defaultOverview;
      }

      const overview = this.transformToOverviewDto(latestAnalytics);

      // Cache overview data for 5 minutes
      await this.cacheManager.set(cacheKey, overview, this.CACHE_TTL);

      return overview;
    } catch (error) {
      this.logger.error(
        `Failed to get overview metrics for form ${formId}:`,
        (error as Error).stack,
      );
      throw new Error(`Overview metrics retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh analytics data for a form
   */
  async refreshAnalytics(refreshDto: RefreshAnalyticsDto): Promise<void> {
    const { formId, force: _force = false } = refreshDto;

    this.logger.log(`Refreshing analytics for form ${formId}`);

    try {
      // Clear cache for this form
      await this.clearFormCache(formId);

      // Trigger recomputation by computing new analytics
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await this.getOrComputeAnalytics(formId, AnalyticsPeriod.DAY, oneDayAgo, now);

      this.logger.log(`Analytics refresh completed for form ${formId}`);
    } catch (error) {
      this.logger.error(`Failed to refresh analytics for form ${formId}:`, (error as Error).stack);
      throw new Error(`Analytics refresh failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get bulk analytics for multiple forms
   */
  async getBulkAnalytics(
    query: BulkAnalyticsQueryDto,
  ): Promise<Record<string, AnalyticsOverviewDto>> {
    const { formIds, period: _period = AnalyticsPeriod.DAY, metrics: _metrics } = query;

    this.logger.log(`Getting bulk analytics for ${formIds.length} forms`);

    try {
      const results: Record<string, AnalyticsOverviewDto> = {};

      // Process forms in parallel for better performance
      const analyticsPromises = formIds.map(async formId => {
        const overview = await this.getOverviewMetrics(formId);
        return { formId, overview };
      });

      const analyticsResults = await Promise.all(analyticsPromises);

      analyticsResults.forEach(({ formId, overview }) => {
        results[formId] = overview;
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to get bulk analytics:', (error as Error).message);
      throw new Error(`Bulk analytics failed: ${(error as Error).message}`);
    }
  }

  /**
   * Scheduled job to pre-compute analytics for active forms
   * Runs every hour to ensure fresh data
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledAnalyticsComputation(): Promise<void> {
    this.logger.log('Starting scheduled analytics computation');

    try {
      // Get list of active forms (would query forms service)
      // For now, use a placeholder implementation
      const activeForms = this.getActiveFormIds();

      let processed = 0;
      let failed = 0;

      for (const formId of activeForms) {
        try {
          await this.refreshAnalytics({ formId, force: false });
          processed++;
        } catch (error) {
          this.logger.warn(
            `Failed to compute analytics for form ${formId}:`,
            (error as Error).message,
          );
          failed++;
        }
      }

      this.logger.log(
        `Scheduled analytics computation completed. Processed: ${processed}, Failed: ${failed}`,
      );
    } catch (error) {
      this.logger.error('Scheduled analytics computation failed:', (error as Error).stack);
    }
  }

  /**
   * Generate cache key for analytics queries
   */
  private generateCacheKey(query: AnalyticsQueryDto): string {
    const { formId, period, startDate, endDate, metrics, country, deviceType } = query;
    const keyParts = [
      'analytics',
      formId,
      period || 'day',
      startDate || 'auto',
      endDate || 'auto',
      metrics?.join(',') || 'all',
      country || 'all',
      deviceType || 'all',
    ];
    return keyParts.join(':');
  }

  /**
   * Calculate appropriate cache TTL based on data type and period
   */
  private getCacheTTL(period?: AnalyticsPeriod, realTime?: boolean): number {
    if (realTime) return 60; // 1 minute for real-time data

    switch (period) {
      case AnalyticsPeriod.HOUR:
        return this.CACHE_TTL; // 5 minutes
      case AnalyticsPeriod.DAY:
        return this.CACHE_TTL * 2; // 10 minutes
      case AnalyticsPeriod.WEEK:
      case AnalyticsPeriod.MONTH:
        return this.CACHE_TTL_LONG; // 1 hour
      default:
        return this.CACHE_TTL;
    }
  }

  /**
   * Clear all cached data for a specific form
   */
  private async clearFormCache(formId: string): Promise<void> {
    // Redis pattern-based deletion would be used in production
    const cacheKeys = [`overview:${formId}`, `analytics:${formId}:*`];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }
  }

  /**
   * Calculate date range based on period type
   */
  private calculateDateRange(
    startDate?: string,
    endDate?: string,
    period?: AnalyticsPeriod,
  ): { start: Date; end: Date } {
    if (startDate && endDate) {
      return {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (period) {
      case AnalyticsPeriod.DAY:
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case AnalyticsPeriod.WEEK:
        start.setDate(start.getDate() - 7);
        break;
      case AnalyticsPeriod.MONTH:
        start.setMonth(start.getMonth() - 1);
        break;
      default:
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  /**
   * Get or compute analytics data
   */
  private async getOrComputeAnalytics(
    formId: string,
    period: AnalyticsPeriod,
    start: Date,
    end: Date,
  ): Promise<Analytics> {
    // Try to find existing analytics first
    const existing = await this.analyticsModel
      .findOne({
        formId: new Types.ObjectId(formId),
        period,
        periodStart: { $lte: start },
        periodEnd: { $gte: end },
      })
      .sort({ computedAt: -1 })
      .exec();

    if (existing && this.isDataFresh(existing.computedAt)) {
      return existing;
    }

    // Use DataAggregationService to compute new analytics
    try {
      this.logger.debug(
        `Computing analytics using aggregation service for form ${formId} from ${start.toISOString()} to ${end.toISOString()}`,
      );

      // Call the data aggregation service to compute new analytics
      const analyticsAggregator = this.dataAggregationService;
      const newAnalytics = await analyticsAggregator.aggregateFormAnalytics(
        formId,
        period,
        start,
        end,
      );

      this.logger.log(`Analytics computation completed for form ${formId}`);
      return newAnalytics;
    } catch (error) {
      this.logger.error(`Failed to compute analytics for form ${formId}:`, (error as Error).stack);
      throw new Error(`Analytics computation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if analytics data is fresh enough to use
   */
  private isDataFresh(computedAt: Date): boolean {
    const now = new Date();
    const ageMinutes = (now.getTime() - computedAt.getTime()) / (1000 * 60);
    return ageMinutes < 30; // Data is fresh if computed within last 30 minutes
  }

  /**
   * Transform analytics entity to overview DTO
   */
  private transformToOverviewDto(analytics: Analytics): AnalyticsOverviewDto {
    return {
      totalSubmissions: analytics.totalSubmissions,
      totalViews: analytics.totalViews,
      uniqueVisitors: analytics.uniqueVisitors,
      completionRate: analytics.completionRate || 0,
      avgCompletionTime: analytics.avgCompletionTime || 0,
      totalRevenue: analytics.totalRevenue,
      bounceRate: analytics.performance?.bounceRate || 0,
      spamRate: analytics.spamRate || 0,
      qualityScore: analytics.qualityScore || 100,
      periodStart: analytics.periodStart,
      periodEnd: analytics.periodEnd,
      lastUpdated: analytics.lastUpdated,
    };
  }

  /**
   * Generate time series data for charts
   */
  private generateTimeSeries(analytics: Analytics, period?: AnalyticsPeriod) {
    // Transform timeDistribution to time series format
    return (
      analytics.timeDistribution?.map(time => ({
        timestamp: new Date(time.year, time.month - 1, time.dayOfMonth, time.hour),
        value: time.submissions,
        label: this.formatTimeLabel(time, period),
      })) || []
    );
  }

  /**
   * Format time labels based on period
   */
  private formatTimeLabel(time: TimeMetrics, period?: AnalyticsPeriod): string {
    switch (period) {
      case AnalyticsPeriod.HOUR:
        return `${time.hour}:00`;
      case AnalyticsPeriod.DAY:
        return `${time.month}/${time.dayOfMonth}`;
      default:
        return `${time.month}/${time.dayOfMonth}`;
    }
  }

  /**
   * Transform geographic data with percentage calculations
   */
  private transformGeographicData(geographic: GeographicMetrics[]) {
    const total = geographic.reduce((sum, item) => sum + item.count, 0);
    return geographic.map(item => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }

  /**
   * Transform device data with percentage calculations
   */
  private transformDeviceData(devices: DeviceMetrics[]) {
    const total = devices.reduce((sum, item) => sum + item.count, 0);
    return devices.map(item => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }

  /**
   * Transform field data with completion rate calculations
   */
  private transformFieldData(fields: FieldMetrics[]) {
    if (!fields || fields.length === 0) {
      return [];
    }

    return fields.map(field => ({
      ...field,
      validationErrors: field.validationErrors || 0,
      completionRate: field.views > 0 ? (field.completions / field.views) * 100 : 0,
    }));
  }

  /**
   * Get active form IDs for scheduled analytics
   */
  getActiveFormIds(): string[] {
    // Placeholder - in a real app, this would query the forms service
    return [];
  }
}
