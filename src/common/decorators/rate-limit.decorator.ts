import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RateLimitGuard } from '../guards/rate-limit.guard';

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  /** Number of requests allowed */
  limit: number;
  /** Time window in seconds */
  ttl: number;
  /** Custom message for rate limit exceeded */
  message?: string;
  /** Skip rate limiting for authenticated users */
  skipSuccessfulRequests?: boolean;
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  /** Strict limits for authentication endpoints */
  AUTH: {
    limit: 5,
    ttl: 60, // 1 minute
    message: 'Too many authentication attempts. Please try again in 1 minute.',
  },
  /** Moderate limits for API endpoints */
  API: {
    limit: 100,
    ttl: 60, // 1 minute
    message: 'API rate limit exceeded. Please slow down your requests.',
  },
  /** Loose limits for public endpoints */
  PUBLIC: {
    limit: 30,
    ttl: 60, // 1 minute
    message: 'Request limit exceeded. Please try again later.',
  },
  /** Very strict limits for password reset */
  PASSWORD_RESET: {
    limit: 3,
    ttl: 300, // 5 minutes
    message: 'Too many password reset attempts. Please try again in 5 minutes.',
  },
  /** Strict limits for registration */
  REGISTRATION: {
    limit: 3,
    ttl: 300, // 5 minutes
    message: 'Too many registration attempts. Please try again in 5 minutes.',
  },
} as const;

/**
 * Custom rate limiting decorator with enhanced configuration
 *
 * @param config - Rate limit configuration
 * @returns Decorator function
 *
 * @example
 * ```typescript
 * @RateLimit(RATE_LIMIT_CONFIGS.AUTH)
 * @Post('login')
 * async login() { ... }
 *
 * @RateLimit({ limit: 10, ttl: 60 })
 * @Get('data')
 * async getData() { ... }
 * ```
 */
export const RateLimit = (config: RateLimitConfig) => {
  return applyDecorators(
    Throttle({ default: { limit: config.limit, ttl: config.ttl * 1000 } }),
    SetMetadata('rate-limit-config', config),
    UseGuards(RateLimitGuard),
  );
};

/**
 * Predefined rate limit decorators for common use cases
 */

/**
 * Apply authentication rate limits (5 requests per minute)
 * Suitable for login, logout, token refresh endpoints
 */
export const AuthRateLimit = () => RateLimit(RATE_LIMIT_CONFIGS.AUTH);

/**
 * Apply API rate limits (100 requests per minute)
 * Suitable for general API endpoints
 */
export const ApiRateLimit = () => RateLimit(RATE_LIMIT_CONFIGS.API);

/**
 * Apply public rate limits (30 requests per minute)
 * Suitable for public endpoints like form submissions
 */
export const PublicRateLimit = () => RateLimit(RATE_LIMIT_CONFIGS.PUBLIC);

/**
 * Apply strict password reset limits (3 requests per 5 minutes)
 * Suitable for password reset initiation
 */
export const PasswordResetRateLimit = () => RateLimit(RATE_LIMIT_CONFIGS.PASSWORD_RESET);

/**
 * Apply registration rate limits (3 requests per 5 minutes)
 * Suitable for user registration endpoints
 */
export const RegistrationRateLimit = () => RateLimit(RATE_LIMIT_CONFIGS.REGISTRATION);

/**
 * Metadata keys for rate limiting
 */
export const RATE_LIMIT_METADATA_KEY = 'rate-limit-config';
