import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import * as redisStore from 'cache-manager-redis-store';
import { Submission, SubmissionSchema } from '../submissions/entities/submission.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Analytics, AnalyticsSchema } from './entities/analytics.entity';
import { DataAggregationService } from './services/data-aggregation.service';

/**
 * Analytics module for form submission data analysis
 * Provides data aggregation, caching, and scheduled processing
 * Following 2025 NestJS architecture patterns
 */
@Module({
  imports: [
    // Import scheduling for background jobs
    ScheduleModule.forRoot(),

    // Configure Redis caching with environment-based settings
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_DB', 1), // Use separate DB for analytics cache
        ttl: 300, // Default TTL of 5 minutes
        max: 1000, // Maximum number of items in cache
        retryAttempts: 3,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),

    // Register MongoDB schemas for analytics data
    MongooseModule.forFeature([
      { name: Analytics.name, schema: AnalyticsSchema },
      { name: Submission.name, schema: SubmissionSchema }, // For aggregation queries
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, DataAggregationService],
  exports: [
    AnalyticsService,
    CacheModule, // Export cache for other modules if needed
  ],
})
export class AnalyticsModule {
  constructor() {
    console.log('📊 Analytics module initialized with Redis caching and scheduling');
  }
}
