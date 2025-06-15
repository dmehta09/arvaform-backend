import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DatabaseConfigType } from '../config/database.config';

/**
 * Database connection health status interface
 */
export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy' | 'connecting' | 'disconnected';
  message: string;
  timestamp: Date;
  connectionCount?: number;
  uptime?: number;
}

/**
 * Database service for MongoDB connection management
 * Provides health checks, connection monitoring, and utility functions
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly databaseConfig: DatabaseConfigType;
  private healthCheckInterval?: NodeJS.Timeout;
  private isHealthy = false;
  private connectionStartTime = Date.now();

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<DatabaseConfigType>('database');
    if (!config) {
      throw new Error('Database configuration not found');
    }
    this.databaseConfig = config;
    this.setupConnectionEventListeners();
  }

  /**
   * Module initialization lifecycle hook
   * Sets up health monitoring and initial connection verification
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🔄 Initializing database service...');

    try {
      // Wait for connection to be ready
      await this.waitForConnection();

      // Perform initial health check
      const health = await this.checkHealth();
      this.isHealthy = health.status === 'healthy';

      if (this.isHealthy) {
        this.logger.log('✅ Database service initialized successfully');
        this.startHealthMonitoring();
      } else {
        this.logger.error('❌ Database service initialization failed', health.message);
      }
    } catch (error) {
      this.logger.error('💥 Database service initialization error:', error);
      throw error;
    }
  }

  /**
   * Module destruction lifecycle hook
   * Cleans up monitoring and closes connections gracefully
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('🔄 Destroying database service...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    try {
      if (this.connection.readyState === 1) {
        await this.connection.close();
        this.logger.log('✅ Database connection closed gracefully');
      }
    } catch (error) {
      this.logger.error('❌ Error closing database connection:', error);
    }
  }

  /**
   * Comprehensive database health check
   * Returns detailed health status with metrics
   */
  async checkHealth(): Promise<DatabaseHealth> {
    const timestamp = new Date();

    try {
      // Check connection state
      if (this.connection.readyState !== 1) {
        return {
          status: this.getConnectionStatus(),
          message: `Connection state: ${this.getConnectionStateMessage()}`,
          timestamp,
        };
      }

      // Perform database ping to verify connectivity
      const startTime = Date.now();
      const db = this.connection.db;
      if (db) {
        await db.admin().ping();
      }
      const responseTime = Date.now() - startTime;

      // Get connection statistics
      const stats = await this.getConnectionStats();

      return {
        status: 'healthy',
        message: `Database healthy - Response time: ${responseTime}ms`,
        timestamp,
        connectionCount: stats.connectionCount,
        uptime: Date.now() - this.connectionStartTime,
      };
    } catch (error) {
      this.logger.error('❌ Database health check failed:', error);
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      };
    }
  }

  /**
   * Get database connection statistics
   */
  async getConnectionStats(): Promise<{ connectionCount: number; dbName: string }> {
    try {
      const db = this.connection.db;
      if (!db) {
        return { connectionCount: 0, dbName: 'unknown' };
      }

      const adminDb = db.admin();
      const serverStatus = await adminDb.serverStatus();
      const connections = serverStatus?.connections;

      return {
        connectionCount:
          connections && typeof connections.current === 'number' ? connections.current : 0,
        dbName: db.databaseName || 'unknown',
      };
    } catch (error) {
      this.logger.warn('⚠️  Could not retrieve connection stats:', error);
      const db = this.connection.db;
      return {
        connectionCount: 0,
        dbName: db?.databaseName || 'unknown',
      };
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): DatabaseHealth['status'] {
    const readyState = this.connection.readyState;
    if (readyState === 0) return 'disconnected';
    if (readyState === 1) return 'healthy';
    if (readyState === 2) return 'connecting';
    if (readyState === 3) return 'disconnected';
    return 'unhealthy';
  }

  /**
   * Get human-readable connection state message
   */
  private getConnectionStateMessage(): string {
    const readyState = this.connection.readyState;
    if (readyState === 0) return 'Disconnected';
    if (readyState === 1) return 'Connected';
    if (readyState === 2) return 'Connecting';
    if (readyState === 3) return 'Disconnecting';
    return 'Unknown';
  }

  /**
   * Wait for database connection to be established
   */
  private async waitForConnection(timeoutMs = 10000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        if (this.connection.readyState === 1) {
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Database connection timeout'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  /**
   * Set up connection event listeners for monitoring
   */
  private setupConnectionEventListeners(): void {
    this.connection.on('connected', () => {
      this.logger.log('🟢 Database connected');
      this.isHealthy = true;
      this.connectionStartTime = Date.now();
    });

    this.connection.on('disconnected', () => {
      this.logger.warn('🔴 Database disconnected');
      this.isHealthy = false;
    });

    this.connection.on('reconnected', () => {
      this.logger.log('🟡 Database reconnected');
      this.isHealthy = true;
    });

    this.connection.on('error', error => {
      this.logger.error('💥 Database connection error:', error);
      this.isHealthy = false;
    });

    this.connection.on('close', () => {
      this.logger.log('🔒 Database connection closed');
      this.isHealthy = false;
    });

    // Log query monitoring if enabled
    if (this.databaseConfig.debug && this.databaseConfig.logQueries) {
      this.connection.on('command-started', event => {
        this.logger.debug(`📝 DB Query: ${event.commandName}`);
      });
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.databaseConfig.healthCheckInterval <= 0) {
      this.logger.log('⏭️  Health monitoring disabled');
      return;
    }

    this.logger.log(
      `⏰ Starting health monitoring (interval: ${this.databaseConfig.healthCheckInterval}ms)`,
    );

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        const wasHealthy = this.isHealthy;
        this.isHealthy = health.status === 'healthy';

        // Log status changes
        if (wasHealthy !== this.isHealthy) {
          const statusIcon = this.isHealthy ? '✅' : '❌';
          this.logger.log(`${statusIcon} Database health status changed: ${health.status}`);
        }

        // Log periodic health status (debug level)
        if (this.databaseConfig.debug) {
          this.logger.debug(`🏥 Health check: ${health.status} - ${health.message}`);
        }
      } catch (error) {
        this.logger.error('💥 Health monitoring error:', error);
      }
    }, this.databaseConfig.healthCheckInterval);
  }

  /**
   * Get current health status
   */
  get healthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Get database connection instance
   */
  get databaseConnection(): Connection {
    return this.connection;
  }

  /**
   * Get database configuration
   */
  get config(): DatabaseConfigType {
    return this.databaseConfig;
  }
}
