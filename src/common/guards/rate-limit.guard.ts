import { ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Enhanced rate limiting guard with security logging and custom error handling
 * Extends the default ThrottlerGuard to provide better monitoring and protection
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly logger = new Logger(RateLimitGuard.name);

  /**
   * Enhanced rate limit validation with security logging
   * @param context - Execution context
   * @returns Promise<boolean> - Whether request should proceed
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIP = this.getClientIP(request);
    const userAgent = request.get('User-Agent') || 'Unknown';
    const endpoint = `${request.method} ${request.route?.path || request.url}`;

    try {
      const canProceed = await super.canActivate(context);

      // Log successful requests for monitoring
      this.logger.debug(`Rate limit check passed for ${clientIP} on ${endpoint}`, {
        ip: clientIP,
        userAgent,
        endpoint,
        timestamp: new Date().toISOString(),
      });

      return canProceed;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Rate limit exceeded';

      // Enhanced logging for rate limit violations
      this.logger.warn(`Rate limit exceeded for ${clientIP} on ${endpoint}`, {
        ip: clientIP,
        userAgent,
        endpoint,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });

      // Track suspicious activity patterns
      this.trackSuspiciousActivity(clientIP, userAgent, endpoint);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          timestamp: new Date().toISOString(),
          path: request.url,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Extract client IP address with proxy support
   * @param request - Express request object
   * @returns string - Client IP address
   */
  private getClientIP(request: Request): string {
    const xForwardedFor = request.get('X-Forwarded-For');
    const xRealIP = request.get('X-Real-IP');
    const cfConnectingIP = request.get('CF-Connecting-IP');

    return (
      cfConnectingIP ||
      xRealIP ||
      (xForwardedFor && xForwardedFor.split(',')[0].trim()) ||
      request.ip ||
      request.connection?.remoteAddress ||
      'Unknown'
    );
  }

  /**
   * Track patterns of suspicious activity for advanced security
   * @param ip - Client IP address
   * @param userAgent - User agent string
   * @param endpoint - Requested endpoint
   */
  private trackSuspiciousActivity(ip: string, userAgent: string, endpoint: string): void {
    // Log high-priority security event
    this.logger.error(`SECURITY ALERT: Potential abuse detected from ${ip}`, {
      ip,
      userAgent,
      endpoint,
      timestamp: new Date().toISOString(),
      severity: 'HIGH',
      type: 'RATE_LIMIT_VIOLATION',
    });

    // In production, this could trigger additional security measures:
    // - IP blacklisting
    // - Enhanced monitoring
    // - Security team notifications
    // - SIEM integration
  }

  /**
   * Generate unique key for rate limiting
   * Combines IP with user agent for more granular control
   */
  protected generateKey(context: ExecutionContext, suffix: string): string {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIP(request);
    const userAgent = request.get('User-Agent') || 'Unknown';

    // Create composite key for more precise rate limiting
    return `${ip}-${Buffer.from(userAgent).toString('base64').slice(0, 20)}-${suffix}`;
  }
}
