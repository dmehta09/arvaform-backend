import { registerAs } from '@nestjs/config';

/**
 * Database configuration interface
 * Defines MongoDB connection settings with comprehensive options
 */
export interface DatabaseConfig {
  // Connection settings
  uri: string;
  name: string;

  // Connection pool settings
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  connectTimeoutMS: number;

  // Write concern and reliability
  retryWrites: boolean;
  writeConcern: string;
  readPreference: string;

  // Monitoring and debugging
  monitorCommands: boolean;
  bufferCommands: boolean;

  // Performance optimizations
  enableUtf8Validation: boolean;
  compressors: string[];

  // Health check settings
  healthCheckInterval: number;
  healthCheckTimeout: number;

  // Development settings
  debug: boolean;
  logQueries: boolean;
}

/**
 * Database configuration factory
 * Loads MongoDB configuration from environment variables with validation
 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  // Helper functions for parsing environment variables
  const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  const parseInteger = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const parseArray = (value: string | undefined, defaultValue: string[]): string[] => {
    if (!value) return defaultValue;
    return value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  // Environment configuration
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';

  // Database connection URI with fallback
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arvaform';

  // Extract database name from URI or use default
  const name =
    process.env.MONGODB_NAME ||
    (uri.includes('/') ? uri.split('/').pop()?.split('?')[0] : 'arvaform') ||
    'arvaform';

  // Connection pool configuration
  const maxPoolSize = parseInteger(process.env.MONGODB_MAX_POOL_SIZE, isProduction ? 20 : 10);
  const minPoolSize = parseInteger(process.env.MONGODB_MIN_POOL_SIZE, isProduction ? 5 : 2);
  const maxIdleTimeMS = parseInteger(process.env.MONGODB_MAX_IDLE_TIME_MS, 30000);
  const serverSelectionTimeoutMS = parseInteger(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    5000,
  );
  const socketTimeoutMS = parseInteger(process.env.MONGODB_SOCKET_TIMEOUT_MS, 45000);
  const connectTimeoutMS = parseInteger(process.env.MONGODB_CONNECT_TIMEOUT_MS, 10000);

  // Write concern and reliability settings
  const retryWrites = parseBoolean(process.env.MONGODB_RETRY_WRITES, true);
  const writeConcern = process.env.MONGODB_WRITE_CONCERN || (isProduction ? 'majority' : '1');
  const readPreference = process.env.MONGODB_READ_PREFERENCE || 'primary';

  // Monitoring and debugging
  const monitorCommands = parseBoolean(process.env.MONGODB_MONITOR_COMMANDS, isDevelopment);
  const bufferCommands = parseBoolean(process.env.MONGODB_BUFFER_COMMANDS, false);

  // Performance optimizations
  const enableUtf8Validation = parseBoolean(process.env.MONGODB_UTF8_VALIDATION, true);
  const compressors = parseArray(
    process.env.MONGODB_COMPRESSORS,
    isProduction ? ['zstd', 'zlib'] : [],
  );

  // Health check settings
  const healthCheckInterval = parseInteger(process.env.MONGODB_HEALTH_CHECK_INTERVAL, 30000);
  const healthCheckTimeout = parseInteger(process.env.MONGODB_HEALTH_CHECK_TIMEOUT, 5000);

  // Development settings
  const debug = parseBoolean(process.env.MONGODB_DEBUG, isDevelopment);
  const logQueries = parseBoolean(process.env.MONGODB_LOG_QUERIES, isDevelopment);

  // Validate critical configuration
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  // Log configuration summary (hide sensitive data)
  console.log('🗄️  Database configuration loaded:', {
    name,
    uri: uri.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
    maxPoolSize,
    minPoolSize,
    writeConcern,
    readPreference,
    isProduction,
    debug,
  });

  return {
    uri,
    name,
    maxPoolSize,
    minPoolSize,
    maxIdleTimeMS,
    serverSelectionTimeoutMS,
    socketTimeoutMS,
    connectTimeoutMS,
    retryWrites,
    writeConcern,
    readPreference,
    monitorCommands,
    bufferCommands,
    enableUtf8Validation,
    compressors,
    healthCheckInterval,
    healthCheckTimeout,
    debug,
    logQueries,
  };
});

/**
 * Type-safe database configuration getter
 */
export type DatabaseConfigType = ReturnType<typeof databaseConfig>;
