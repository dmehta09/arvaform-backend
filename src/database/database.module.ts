import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseConfigType, databaseConfig } from '../config/database.config';
import { DatabaseService } from './database.service';

/**
 * Global database module for MongoDB integration
 * Provides database connection, configuration, and utilities
 * Made global to avoid re-importing in every feature module
 */
@Global()
@Module({
  imports: [
    // Register database configuration
    ConfigModule.forFeature(databaseConfig),

    // Configure MongoDB connection using Mongoose
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfigType>('database');

        if (!dbConfig) {
          throw new Error('Database configuration not found');
        }

        console.log('🔗 Configuring MongoDB connection...');

        return {
          uri: dbConfig.uri,
          retryWrites: dbConfig.retryWrites,

          // Connection pool settings
          maxPoolSize: dbConfig.maxPoolSize,
          minPoolSize: dbConfig.minPoolSize,
          maxIdleTimeMS: dbConfig.maxIdleTimeMS,
          serverSelectionTimeoutMS: dbConfig.serverSelectionTimeoutMS,
          socketTimeoutMS: dbConfig.socketTimeoutMS,
          connectTimeoutMS: dbConfig.connectTimeoutMS,

          // Performance and reliability settings
          bufferCommands: dbConfig.bufferCommands,

          // Development settings
          autoCreate: process.env.NODE_ENV === 'development',
          autoIndex: process.env.NODE_ENV === 'development',
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, MongooseModule],
})
export class DatabaseModule {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Static method to configure database module with custom options
   * Useful for testing or custom configurations
   */
  static forRoot(options?: { uri?: string; maxPoolSize?: number; enableDebug?: boolean }) {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useValue: options || {},
        },
      ],
    };
  }

  /**
   * Get database service instance
   * Useful for accessing database health and statistics
   */
  getDatabaseService(): DatabaseService {
    return this.databaseService;
  }
}
