import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Analytics time period enumeration
 */
export enum AnalyticsPeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

/**
 * Analytics metric types for filtering
 */
export enum AnalyticsMetric {
  SUBMISSIONS = 'submissions',
  VIEWS = 'views',
  COMPLETION_RATE = 'completion_rate',
  BOUNCE_RATE = 'bounce_rate',
  CONVERSION_RATE = 'conversion_rate',
  REVENUE = 'revenue',
  FIELD_ANALYTICS = 'field_analytics',
  GEOGRAPHIC = 'geographic',
  DEVICES = 'devices',
  PERFORMANCE = 'performance',
}

/**
 * Query DTO for analytics data retrieval
 */
export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Form ID to retrieve analytics for',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  formId: string;

  @ApiPropertyOptional({
    description: 'Analytics time period',
    enum: AnalyticsPeriod,
    default: AnalyticsPeriod.DAY,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.DAY;

  @ApiPropertyOptional({
    description: 'Start date for analytics range (ISO string)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics range (ISO string)',
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Specific metrics to include in response',
    type: [String],
    enum: AnalyticsMetric,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AnalyticsMetric, { each: true })
  metrics?: AnalyticsMetric[];

  @ApiPropertyOptional({
    description: 'Country code for geographic filtering',
    example: 'US',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Device type filtering',
    example: 'mobile',
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional({
    description: 'Include real-time data',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  realTime?: boolean = false;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

/**
 * Overview metrics response DTO
 */
export class AnalyticsOverviewDto {
  @ApiProperty({ description: 'Total form submissions' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total form views' })
  totalViews: number;

  @ApiProperty({ description: 'Unique visitors count' })
  uniqueVisitors: number;

  @ApiProperty({ description: 'Form completion rate percentage' })
  completionRate: number;

  @ApiProperty({ description: 'Average completion time in seconds' })
  avgCompletionTime: number;

  @ApiProperty({ description: 'Total revenue from payments' })
  totalRevenue: number;

  @ApiProperty({ description: 'Bounce rate percentage' })
  bounceRate: number;

  @ApiProperty({ description: 'Spam rate percentage' })
  spamRate: number;

  @ApiProperty({ description: 'Overall quality score' })
  qualityScore: number;

  @ApiProperty({ description: 'Period start date' })
  periodStart: Date;

  @ApiProperty({ description: 'Period end date' })
  periodEnd: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  lastUpdated: Date;
}

/**
 * Geographic analytics response DTO
 */
export class GeographicAnalyticsDto {
  @ApiProperty({ description: 'Country name' })
  country: string;

  @ApiProperty({ description: 'City name' })
  city: string;

  @ApiProperty({ description: 'Submission count' })
  count: number;

  @ApiProperty({ description: 'Geographic coordinates', type: [Number] })
  coordinates?: [number, number];

  @ApiProperty({ description: 'Percentage of total submissions' })
  percentage: number;
}

/**
 * Device analytics response DTO
 */
export class DeviceAnalyticsDto {
  @ApiProperty({ description: 'Device type' })
  type: string;

  @ApiProperty({ description: 'Browser name' })
  browser: string;

  @ApiProperty({ description: 'Operating system' })
  os: string;

  @ApiProperty({ description: 'Usage count' })
  count: number;

  @ApiProperty({ description: 'Average completion time' })
  avgCompletionTime?: number;

  @ApiProperty({ description: 'Percentage of total usage' })
  percentage: number;
}

/**
 * Field analytics response DTO
 */
export class FieldAnalyticsDto {
  @ApiProperty({ description: 'Field identifier' })
  fieldId: string;

  @ApiProperty({ description: 'Field type' })
  fieldType: string;

  @ApiProperty({ description: 'Field views count' })
  views: number;

  @ApiProperty({ description: 'Field interactions count' })
  interactions: number;

  @ApiProperty({ description: 'Field completions count' })
  completions: number;

  @ApiProperty({ description: 'Field validation errors count' })
  validationErrors: number;

  @ApiProperty({ description: 'Average time spent on field' })
  avgTimeSpent?: number;

  @ApiProperty({ description: 'Drop-off rate percentage' })
  dropOffRate?: number;

  @ApiProperty({ description: 'Field completion rate' })
  completionRate: number;
}

/**
 * Time series data point
 */
export class TimeSeriesDataPoint {
  @ApiProperty({ description: 'Time period timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Data value for the period' })
  value: number;

  @ApiProperty({ description: 'Period label' })
  label: string;
}

/**
 * Performance metrics response DTO
 */
export class PerformanceMetricsDto {
  @ApiProperty({ description: 'Average page load time in milliseconds' })
  avgLoadTime?: number;

  @ApiProperty({ description: 'Average form submission time in seconds' })
  avgSubmissionTime?: number;

  @ApiProperty({ description: 'Total error count' })
  errorCount: number;

  @ApiProperty({ description: 'Error rate percentage' })
  errorRate?: number;

  @ApiProperty({ description: 'Bounce rate percentage' })
  bounceRate?: number;
}

/**
 * Comprehensive analytics response DTO
 */
export class AnalyticsResponseDto {
  @ApiProperty({ description: 'Form ID' })
  formId: string;

  @ApiProperty({ description: 'Analytics period' })
  period: AnalyticsPeriod;

  @ApiProperty({ description: 'Overview metrics', type: AnalyticsOverviewDto })
  overview: AnalyticsOverviewDto;

  @ApiPropertyOptional({
    description: 'Time series data',
    type: [TimeSeriesDataPoint],
  })
  timeSeries?: TimeSeriesDataPoint[];

  @ApiPropertyOptional({
    description: 'Geographic analytics',
    type: [GeographicAnalyticsDto],
  })
  geographic?: GeographicAnalyticsDto[];

  @ApiPropertyOptional({
    description: 'Device analytics',
    type: [DeviceAnalyticsDto],
  })
  devices?: DeviceAnalyticsDto[];

  @ApiPropertyOptional({
    description: 'Field analytics',
    type: [FieldAnalyticsDto],
  })
  fields?: FieldAnalyticsDto[];

  @ApiPropertyOptional({
    description: 'Performance metrics',
    type: PerformanceMetricsDto,
  })
  performance?: PerformanceMetricsDto;

  @ApiProperty({ description: 'Response generated timestamp' })
  generatedAt: Date;

  @ApiProperty({ description: 'Data freshness indicator' })
  dataFreshness: 'realtime' | 'cached' | 'stale';
}

/**
 * Analytics refresh request DTO
 */
export class RefreshAnalyticsDto {
  @ApiProperty({
    description: 'Form ID to refresh analytics for',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  formId: string;

  @ApiPropertyOptional({
    description: 'Force refresh even if recent data exists',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean = false;

  @ApiPropertyOptional({
    description: 'Specific periods to refresh',
    type: [String],
    enum: AnalyticsPeriod,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AnalyticsPeriod, { each: true })
  periods?: AnalyticsPeriod[];
}

/**
 * Bulk analytics query DTO for multiple forms
 */
export class BulkAnalyticsQueryDto {
  @ApiProperty({
    description: 'Array of form IDs',
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray()
  @IsMongoId({ each: true })
  formIds: string[];

  @ApiPropertyOptional({
    description: 'Analytics time period',
    enum: AnalyticsPeriod,
    default: AnalyticsPeriod.DAY,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.DAY;

  @ApiPropertyOptional({
    description: 'Specific metrics to include',
    type: [String],
    enum: AnalyticsMetric,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AnalyticsMetric, { each: true })
  metrics?: AnalyticsMetric[];
}
