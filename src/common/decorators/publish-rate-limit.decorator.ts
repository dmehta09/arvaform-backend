import { RateLimit } from './rate-limit.decorator';

/**
 * Rate limit configurations for form publishing operations
 */
export const PUBLISH_RATE_LIMIT_CONFIGS = {
  /** Strict limits for publishing operations */
  PUBLISH: {
    limit: 10, // Number of requests
    ttl: 60, // Per 60 seconds
    message: 'Too many publishing attempts. Please slow down and try again in 1 minute.',
  },
  /** More lenient limits for reading publishing settings */
  PUBLISH_READ: {
    limit: 100, // Number of requests
    ttl: 60, // Per 60 seconds
    message: 'Too many requests for publishing settings. Please try again later.',
  },
  /** Very strict limits for unpublishing operations */
  UNPUBLISH: {
    limit: 5, // Number of requests
    ttl: 300, // Per 5 minutes
    message: 'Too many unpublishing attempts. Please try again in 5 minutes.',
  },
} as const;

/**
 * Rate limiting decorator specifically for form publishing operations
 * Applies stricter limits to prevent abuse of publishing functionality
 */
export function PublishRateLimit() {
  return RateLimit(PUBLISH_RATE_LIMIT_CONFIGS.PUBLISH);
}

/**
 * Rate limiting decorator for retrieving publishing settings
 * More lenient limits for read operations
 */
export function PublishReadRateLimit() {
  return RateLimit(PUBLISH_RATE_LIMIT_CONFIGS.PUBLISH_READ);
}

/**
 * Rate limiting decorator for unpublishing operations
 * Very strict limits for destructive operations
 */
export function UnpublishRateLimit() {
  return RateLimit(PUBLISH_RATE_LIMIT_CONFIGS.UNPUBLISH);
}
