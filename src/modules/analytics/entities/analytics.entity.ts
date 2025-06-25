import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Geographic analytics data
 */
@Schema({ _id: false })
export class GeographicMetrics {
  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true, default: 0 })
  count: number;

  @Prop({ type: [Number], required: false })
  coordinates?: [number, number];
}

/**
 * Device and browser analytics
 */
@Schema({ _id: false })
export class DeviceMetrics {
  @Prop({ required: true })
  type: string; // mobile, desktop, tablet

  @Prop({ required: true })
  browser: string;

  @Prop({ required: true })
  os: string;

  @Prop({ required: true, default: 0 })
  count: number;

  @Prop({ required: false })
  avgCompletionTime?: number;
}

/**
 * Field-level analytics for form optimization
 */
@Schema({ _id: false })
export class FieldMetrics {
  @Prop({ required: true })
  fieldId: string;

  @Prop({ required: true })
  fieldType: string;

  @Prop({ required: true, default: 0 })
  views: number;

  @Prop({ required: true, default: 0 })
  interactions: number;

  @Prop({ required: true, default: 0 })
  completions: number;

  @Prop({ required: true, default: 0 })
  validationErrors: number;

  @Prop({ required: false })
  avgTimeSpent?: number; // in seconds

  @Prop({ required: false })
  dropOffRate?: number; // percentage
}

/**
 * Conversion funnel analytics
 */
@Schema({ _id: false })
export class ConversionFunnel {
  @Prop({ required: true })
  step: string;

  @Prop({ required: true, default: 0 })
  views: number;

  @Prop({ required: true, default: 0 })
  completions: number;

  @Prop({ required: false })
  conversionRate?: number; // percentage
}

/**
 * Performance metrics for form optimization
 */
@Schema({ _id: false })
export class PerformanceMetrics {
  @Prop({ required: false })
  avgLoadTime?: number; // in milliseconds

  @Prop({ required: false })
  avgSubmissionTime?: number; // in seconds

  @Prop({ required: true, default: 0 })
  errorCount: number;

  @Prop({ required: false })
  errorRate?: number; // percentage

  @Prop({ required: false })
  bounceRate?: number; // percentage
}

/**
 * Time-based analytics aggregation
 */
@Schema({ _id: false })
export class TimeMetrics {
  @Prop({ required: true })
  hour: number; // 0-23

  @Prop({ required: true })
  dayOfWeek: number; // 0-6

  @Prop({ required: true })
  dayOfMonth: number; // 1-31

  @Prop({ required: true })
  month: number; // 1-12

  @Prop({ required: true })
  year: number;

  @Prop({ required: true, default: 0 })
  submissions: number;

  @Prop({ required: true, default: 0 })
  views: number;
}

/**
 * Analytics aggregation entity
 * Stores computed analytics metrics for efficient dashboard rendering
 */
@Schema({
  timestamps: true,
  collection: 'analytics',
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Analytics {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Form', index: true })
  formId: Types.ObjectId;

  @Prop({ required: true, index: true })
  period: string; // 'hour', 'day', 'week', 'month'

  @Prop({ required: true, index: true })
  periodStart: Date;

  @Prop({ required: true, index: true })
  periodEnd: Date;

  @Prop({ required: true, default: 0 })
  totalSubmissions: number;

  @Prop({ required: true, default: 0 })
  totalViews: number;

  @Prop({ required: true, default: 0 })
  uniqueVisitors: number;

  @Prop({ required: false })
  completionRate?: number; // percentage

  @Prop({ required: false })
  avgCompletionTime?: number; // in seconds

  @Prop({ required: true, default: 0 })
  totalRevenue: number; // for payment forms

  @Prop({ type: [GeographicMetrics], default: [] })
  geographic: GeographicMetrics[];

  @Prop({ type: [DeviceMetrics], default: [] })
  devices: DeviceMetrics[];

  @Prop({ type: [FieldMetrics], default: [] })
  fields: FieldMetrics[];

  @Prop({ type: [ConversionFunnel], default: [] })
  conversionFunnel: ConversionFunnel[];

  @Prop({ type: PerformanceMetrics })
  performance?: PerformanceMetrics;

  @Prop({ type: [TimeMetrics], default: [] })
  timeDistribution: TimeMetrics[];

  @Prop({ required: false })
  spamRate?: number; // percentage of spam submissions

  @Prop({ required: false })
  qualityScore?: number; // overall form quality score

  @Prop({ default: Date.now })
  computedAt: Date;

  @Prop({ index: true })
  lastUpdated: Date;
}

export type AnalyticsDocument = Analytics & Document;

export const AnalyticsSchema = SchemaFactory.createForClass(Analytics);

// Compound indexes for efficient querying
AnalyticsSchema.index({ formId: 1, period: 1, periodStart: 1 });
AnalyticsSchema.index({ formId: 1, computedAt: -1 });
AnalyticsSchema.index({ periodStart: 1, periodEnd: 1 });

// TTL index for automatic cleanup of old analytics data (365 days)
AnalyticsSchema.index({ computedAt: 1 }, { expireAfterSeconds: 31536000 });
