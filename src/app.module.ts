import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt.guard';
import { UsersModule } from './modules/users/users.module';

/**
 * Root application module for ArvaForm backend
 * - Loads configuration, database, and rate limiting modules
 * - Registers core controllers and providers
 */
@Module({
  // Register all modules required for the application
  imports: [
    // Load and validate environment variables using configuration schemas
    ConfigModule.forRoot({
      load: [appConfig, databaseConfig], // Load both app and database configurations
      isGlobal: true, // Make config available globally
      cache: true, // Enable config caching for performance
      envFilePath: ['.env.local', '.env'], // Load from these .env files
      expandVariables: true, // Allow variable expansion in .env
      validationOptions: {
        allowUnknown: false, // Disallow unknown env vars
        abortEarly: true, // Stop validation on first error
      },
    }),

    // Database module with MongoDB and Mongoose integration
    DatabaseModule,

    // Configure API rate limiting with multiple strategies
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          name: 'short', // Short-term burst limiter
          ttl: 1000, // Time window: 1 second
          limit: 10, // Max 10 requests per second
        },
        {
          name: 'medium', // Medium-term limiter
          ttl: 60000, // Time window: 1 minute
          limit: 100, // Max 100 requests per minute
        },
        {
          name: 'long', // Long-term limiter
          ttl: 3600000, // Time window: 1 hour
          limit: 1000, // Max 1000 requests per hour
        },
      ],
    }),

    // Feature modules
    AuthModule,
    UsersModule,

    // MongoDB connection
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/arvaform',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
  ],
  // Register the main application controller
  controllers: [AppController],
  // Register the main application service provider
  providers: [
    AppService,
    // Apply JWT guard globally to all routes
    // Routes can be made public using @Public() decorator
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {
  /**
   * AppModule constructor
   * Logs initialization for debugging and monitoring
   */
  constructor() {
    // Output a message when the AppModule is initialized
    console.log('🏗️  AppModule initialized successfully');
  }
}
