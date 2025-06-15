import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

import { AppInfoResponse, HealthCheckResponse } from './app.controller';

/**
 * Root application service
 * Provides core application functionality including health checks and system information
 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {
    this.logger.debug('AppService initialized');
  }

  /**
   * Get basic application information
   * Returns static information about the API for the root endpoint
   *
   * @returns Application information object
   */
  getAppInfo(): AppInfoResponse {
    const apiPrefix = this.configService.get<string>('API_PREFIX', 'api');
    const environment = this.configService.get<string>(
      'NODE_ENV',
      'development',
    );

    this.logger.debug('Providing application information');

    return {
      name: 'ArvaForm API',
      description: 'Form management platform backend API',
      version: '1.0.0',
      environment,
      timestamp: new Date().toISOString(),
      endpoints: {
        health: `/${apiPrefix}/health`,
        docs:
          environment === 'development'
            ? `/${apiPrefix}/docs`
            : 'Not available in production',
      },
    };
  }

  /**
   * Comprehensive health check implementation
   * Monitors system resources, database connectivity, and application status
   * Critical for production monitoring and alerting systems
   *
   * @returns Promise resolving to detailed health status
   */
  async getHealthStatus(): Promise<HealthCheckResponse> {
    this.logger.debug('Performing health check');

    try {
      // Calculate application uptime in seconds
      const uptime = (Date.now() - this.startTime) / 1000;

      // Get memory usage statistics
      const memoryUsage = process.memoryUsage();
      const memoryInfo = {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage:
          Math.round(
            (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100 * 100,
          ) / 100,
      };

      // Check database connectivity
      const databaseStatus = await this.checkDatabaseHealth();

      const healthStatus: HealthCheckResponse = {
        status: databaseStatus.connected ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: this.configService.get<string>('NODE_ENV', 'development'),
        version: '1.0.0',
        uptime,
        memory: memoryInfo,
        database: databaseStatus,
      };

      // Log health check details for monitoring
      this.logger.debug('Health check completed', {
        status: healthStatus.status,
        uptime: healthStatus.uptime,
        memoryUsage: `${memoryInfo.percentage}%`,
        databaseConnected: databaseStatus.connected,
      });

      return healthStatus;
    } catch (error) {
      this.logger.error('Health check failed', error);

      // Return unhealthy status with minimal information
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: this.configService.get<string>('NODE_ENV', 'development'),
        version: '1.0.0',
        uptime: (Date.now() - this.startTime) / 1000,
        memory: {
          used: 0,
          total: 0,
          percentage: 0,
        },
        database: {
          status: 'error',
          connected: false,
        },
      };
    }
  }

  /**
   * Check database connection health
   * Verifies MongoDB connectivity and readiness state
   *
   * @returns Database health status information
   */
  private async checkDatabaseHealth(): Promise<{
    status: string;
    connected: boolean;
  }> {
    try {
      if (!this.mongoConnection.db) {
        this.logger.warn('Database object is undefined');
        return {
          status: 'disconnected',
          connected: false,
        };
      }
      // Check if connection is in ready state
      const isConnected =
        this.mongoConnection.readyState === ConnectionStates.connected;

      if (isConnected) {
        // Perform a simple ping to verify database responsiveness
        await this.mongoConnection.db.admin().ping();
        this.logger.debug('Database ping successful');

        return {
          status: 'connected',
          connected: true,
        };
      } else {
        this.logger.warn('Database connection not ready', {
          readyState: this.mongoConnection.readyState,
        });

        return {
          status: 'disconnected',
          connected: false,
        };
      }
    } catch (error) {
      this.logger.error('Database health check failed', error);

      return {
        status: 'error',
        connected: false,
      };
    }
  }
}
