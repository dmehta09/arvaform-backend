import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PublicRateLimit } from '../../common/decorators/rate-limit.decorator';
import { CaptchaService, VerifyCaptchaDto } from './captcha.service';

/**
 * CAPTCHA verification response
 */
interface CaptchaResponse {
  success: boolean;
  message: string;
  score?: number;
}

/**
 * Controller for CAPTCHA verification and testing
 *
 * Provides endpoints for verifying CAPTCHA tokens and testing
 * CAPTCHA requirements for different actions.
 */
@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  /**
   * Verify a CAPTCHA token
   *
   * @param dto - CAPTCHA verification data
   * @param request - Express request object
   * @returns Promise<CaptchaResponse> - Verification result
   */
  @Post('verify')
  @PublicRateLimit()
  @HttpCode(HttpStatus.OK)
  async verifyCaptcha(
    @Body() dto: VerifyCaptchaDto,
    @Request() request: ExpressRequest,
  ): Promise<CaptchaResponse> {
    const clientIP = this.getClientIP(request);
    const result = await this.captchaService.verifyToken(dto.token, dto.action, clientIP);

    return {
      success: result.success,
      message: result.success ? 'CAPTCHA verification successful' : 'CAPTCHA verification failed',
      score: result.score,
    };
  }

  /**
   * Check if CAPTCHA is required for an action
   *
   * @param request - Express request object
   * @returns Object indicating if CAPTCHA is required
   */
  @Get('required')
  @PublicRateLimit()
  isCaptchaRequired(@Request() request: ExpressRequest) {
    const userAgent = request.get('User-Agent');
    const action = (request.query.action as string) || 'unknown';

    // In a real implementation, you might track request counts per IP
    const requestCount = 0;

    const required = this.captchaService.isCaptchaRequired(action, userAgent, requestCount);

    return {
      required,
      action,
      reason: required ? this.getCaptchaRequiredReason(action, userAgent, requestCount) : null,
    };
  }

  /**
   * Health check endpoint for CAPTCHA service
   *
   * @returns Service status information
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'captcha',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Extract client IP address from request
   *
   * @param request - Express request object
   * @returns string - Client IP address
   */
  private getClientIP(request: ExpressRequest): string {
    const xForwardedFor = request.get('X-Forwarded-For');
    const xRealIP = request.get('X-Real-IP');
    const cfConnectingIP = request.get('CF-Connecting-IP');

    return (
      cfConnectingIP ||
      xRealIP ||
      (xForwardedFor && xForwardedFor.split(',')[0].trim()) ||
      request.ip ||
      request.connection.remoteAddress ||
      'Unknown'
    );
  }

  /**
   * Get reason why CAPTCHA is required
   *
   * @param action - Action being performed
   * @param userAgent - User agent string
   * @param requestCount - Number of recent requests
   * @returns string - Reason for CAPTCHA requirement
   */
  private getCaptchaRequiredReason(
    action: string,
    userAgent?: string,
    requestCount?: number,
  ): string {
    const highRiskActions = ['login', 'register', 'password-reset'];

    if (highRiskActions.includes(action)) {
      return 'High-risk action requires verification';
    }

    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      return 'Suspicious user agent detected';
    }

    if (requestCount && requestCount > 10) {
      return 'High request volume detected';
    }

    return 'Security verification required';
  }

  /**
   * Check if user agent appears suspicious
   *
   * @param userAgent - User agent string
   * @returns boolean - Whether user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /headless/i,
      /phantom/i,
      /selenium/i,
      /curl/i,
      /wget/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }
}
