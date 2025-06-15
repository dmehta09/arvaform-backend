import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';

/**
 * Root application module for ArvaForm backend
 * - Loads configuration, database, and rate limiting modules
 * - Registers core controllers and providers
 */
@Module({
  // Register all modules required for the application
  imports: [
    // Load and validate environment variables using appConfig schema
    ConfigModule.forRoot({
      load: [appConfig], // Load custom configuration
      isGlobal: true, // Make config available globally
      cache: true, // Enable config caching for performance
      envFilePath: ['.env.local', '.env'], // Load from these .env files
      expandVariables: true, // Allow variable expansion in .env
      validationOptions: {
        allowUnknown: false, // Disallow unknown env vars
        abortEarly: true, // Stop validation on first error
      },
    }),

    // Asynchronously connect to MongoDB using Mongoose
    MongooseModule.forRootAsync({
      useFactory: () => ({
        // Use MONGODB_URI from env or fallback to local instance
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/arvaform',
        retryWrites: true, // Enable retryable writes for reliability
        w: 'majority', // Write concern: majority of nodes must acknowledge
        // Connection pool settings for efficient resource usage
        maxPoolSize: 10, // Maximum number of connections in pool
        minPoolSize: 2, // Minimum number of connections in pool
        maxIdleTimeMS: 30000, // Max idle time for a connection (ms)
        serverSelectionTimeoutMS: 5000, // Timeout for server selection (ms)
        socketTimeoutMS: 45000, // Socket inactivity timeout (ms)
        // Disable command buffering for immediate error feedback
        bufferCommands: false,
        // Enable command monitoring for debugging and performance
        monitorCommands: true,
      }),
    }),

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

    // Placeholder for future feature modules (e.g., UsersModule, FormsModule)
  ],
  // Register the main application controller
  controllers: [AppController],
  // Register the main application service provider
  providers: [AppService],
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
