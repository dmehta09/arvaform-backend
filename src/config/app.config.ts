import { registerAs } from '@nestjs/config';

/**
 * Application configuration interface
 * Defines the structure of application configuration with type safety
 */
export interface AppConfig {
  // Server configuration
  port: number;
  nodeEnv: string;
  apiPrefix: string;

  // Database configuration
  mongodbUri: string;

  // CORS configuration
  corsOrigins: string[];

  // Security configuration
  jwtSecret?: string;
  apiKey?: string;

  // Logging configuration
  logLevel: string;
  enableRequestLogging: boolean;

  // Rate limiting configuration
  throttle: {
    short: { limit: number; ttl: number };
    medium: { limit: number; ttl: number };
    long: { limit: number; ttl: number };
  };

  // Development tools
  enableSwagger: boolean;
  swaggerServerUrl: string;
}

/**
 * Application configuration factory
 * Loads and validates environment variables with proper defaults
 * Registered with ConfigModule to provide type-safe configuration access
 */
export const appConfig = registerAs('app', (): AppConfig => {
  // Helper function to parse boolean environment variables
  const parseBoolean = (
    value: string | undefined,
    defaultValue: boolean,
  ): boolean => {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  // Helper function to parse integer environment variables
  const parseInteger = (
    value: string | undefined,
    defaultValue: number,
  ): number => {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // Helper function to parse comma-separated values
  const parseArray = (
    value: string | undefined,
    defaultValue: string[],
  ): string[] => {
    if (!value) return defaultValue;
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  // Get environment variables with proper defaults
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInteger(process.env.PORT, 3001);
  const apiPrefix = process.env.API_PREFIX || 'api';

  // Database configuration
  const mongodbUri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/arvaform';

  // CORS configuration
  const corsOrigins = parseArray(process.env.CORS_ORIGINS, [
    'http://localhost:3000',
  ]);

  // Security configuration (optional)
  const jwtSecret = process.env.JWT_SECRET;
  const apiKey = process.env.API_KEY;

  // Logging configuration
  const logLevel = process.env.LOG_LEVEL || 'log';
  const enableRequestLogging = parseBoolean(
    process.env.ENABLE_REQUEST_LOGGING,
    nodeEnv === 'development',
  );

  // Rate limiting configuration with environment overrides
  const throttleConfig = {
    short: {
      limit: parseInteger(process.env.THROTTLE_SHORT_LIMIT, 10),
      ttl: parseInteger(process.env.THROTTLE_SHORT_TTL, 1000),
    },
    medium: {
      limit: parseInteger(process.env.THROTTLE_MEDIUM_LIMIT, 100),
      ttl: parseInteger(process.env.THROTTLE_MEDIUM_TTL, 60000),
    },
    long: {
      limit: parseInteger(process.env.THROTTLE_LONG_LIMIT, 1000),
      ttl: parseInteger(process.env.THROTTLE_LONG_TTL, 3600000),
    },
  };

  // Development tools configuration
  const enableSwagger = parseBoolean(
    process.env.ENABLE_SWAGGER,
    nodeEnv === 'development',
  );
  const swaggerServerUrl =
    process.env.SWAGGER_SERVER_URL || `http://localhost:${port}`;

  // Validate critical configuration
  if (!mongodbUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  if (nodeEnv === 'production' && !jwtSecret) {
    console.warn('WARNING: JWT_SECRET not set in production environment');
  }

  // Log configuration summary (excluding sensitive data)
  console.log('📋 Configuration loaded:', {
    nodeEnv,
    port,
    apiPrefix,
    mongodbUri: mongodbUri.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
    corsOrigins,
    logLevel,
    enableRequestLogging,
    enableSwagger,
    hasJwtSecret: !!jwtSecret,
    hasApiKey: !!apiKey,
  });

  return {
    port,
    nodeEnv,
    apiPrefix,
    mongodbUri,
    corsOrigins,
    jwtSecret,
    apiKey,
    logLevel,
    enableRequestLogging,
    throttle: throttleConfig,
    enableSwagger,
    swaggerServerUrl,
  };
});

/**
 * Type-safe configuration getter
 * Provides typed access to configuration values throughout the application
 */
export type AppConfigType = ReturnType<typeof appConfig>;
