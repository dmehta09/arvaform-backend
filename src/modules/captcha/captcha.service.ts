import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * CAPTCHA verification response interface
 */
export interface CaptchaVerificationResult {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  errors?: string[];
}

/**
 * CAPTCHA verification request interface
 */
export interface VerifyCaptchaDto {
  token: string;
  action?: string;
}

/**
 * Service for Google reCAPTCHA v3 verification
 *
 * Handles server-side verification of CAPTCHA tokens and provides
 * risk scoring to determine if requests are likely from bots.
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly secretKey: string;
  private readonly scoreThreshold: number = 0.5;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY', '');

    if (!this.secretKey) {
      this.logger.warn(
        'RECAPTCHA_SECRET_KEY not configured. CAPTCHA verification will be disabled.',
      );
    }
  }

  /**
   * Verify a reCAPTCHA v3 token
   *
   * @param token - reCAPTCHA token from frontend
   * @param expectedAction - Expected action name (optional)
   * @param remoteIp - Client IP address (optional)
   * @returns Promise<CaptchaVerificationResult> - Verification result
   */
  async verifyToken(
    token: string,
    expectedAction?: string,
    remoteIp?: string,
  ): Promise<CaptchaVerificationResult> {
    if (!this.secretKey) {
      this.logger.warn('CAPTCHA verification skipped - no secret key configured');
      return {
        success: true,
        score: 1.0,
        action: expectedAction,
      };
    }

    if (!token || token.trim() === '') {
      throw new BadRequestException('CAPTCHA token is required');
    }

    try {
      const response = await this.makeVerificationRequest(token, remoteIp);

      this.logger.debug('reCAPTCHA verification response', {
        success: response.success,
        score: response.score,
        action: response.action,
        expectedAction,
      });

      // Validate action if specified
      if (expectedAction && response.action !== expectedAction) {
        this.logger.warn('CAPTCHA action mismatch', {
          expected: expectedAction,
          received: response.action,
        });
        return {
          ...response,
          success: false,
          errors: ['Action mismatch'],
        };
      }

      // Check score threshold for reCAPTCHA v3
      if (response.score !== undefined && response.score < this.scoreThreshold) {
        this.logger.warn('CAPTCHA score below threshold', {
          score: response.score,
          threshold: this.scoreThreshold,
        });
        return {
          ...response,
          success: false,
          errors: ['Score below threshold'],
        };
      }

      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('CAPTCHA verification failed', {
        error: errorMessage,
        token: token.substring(0, 20) + '...',
      });

      throw new BadRequestException('CAPTCHA verification failed');
    }
  }

  /**
   * Verify CAPTCHA with action validation
   *
   * @param dto - Verification request data
   * @param remoteIp - Client IP address
   * @returns Promise<boolean> - Whether verification passed
   */
  async verifyCaptcha(dto: VerifyCaptchaDto, remoteIp?: string): Promise<boolean> {
    const result = await this.verifyToken(dto.token, dto.action, remoteIp);
    return result.success;
  }

  /**
   * Check if CAPTCHA is required for a specific action
   *
   * @param action - Action to check
   * @param userAgent - User agent string
   * @param requestCount - Number of recent requests
   * @returns boolean - Whether CAPTCHA is required
   */
  isCaptchaRequired(action: string, userAgent?: string, requestCount?: number): boolean {
    // Always require CAPTCHA for high-risk actions
    const highRiskActions = ['login', 'register', 'password-reset'];
    if (highRiskActions.includes(action)) {
      return true;
    }

    // Require CAPTCHA for suspicious user agents
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      return true;
    }

    // Require CAPTCHA after multiple requests
    if (requestCount && requestCount > 10) {
      return true;
    }

    return false;
  }

  /**
   * Make HTTP request to Google's verification endpoint
   *
   * @param token - reCAPTCHA token
   * @param remoteIp - Client IP address
   * @returns Promise<CaptchaVerificationResult> - Raw verification response
   */
  private async makeVerificationRequest(
    token: string,
    remoteIp?: string,
  ): Promise<CaptchaVerificationResult> {
    const params = new URLSearchParams({
      secret: this.secretKey,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    // Use native fetch (available in Node.js 18+)
    const response = await fetch(this.verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as CaptchaVerificationResult;
    return result;
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
