/**
 * Base Connector Service for Integration Framework
 * Abstract base class providing common functionality for all third-party integrations
 *
 * @author ArvaForm Integration Team
 * @since 2025-01-14
 */
import { Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import {
  ConnectorMetadata,
  HealthCheckResult,
  HealthStatus,
  IConnector,
  IntegrationCapability,
  IntegrationConfiguration,
  IntegrationErrorCode,
  IntegrationException,
  OAuthConfig,
  OAuthProvider,
  OAuthTokenResponse,
} from '../types/integration.types';
import { OAuthCredentials, OAuthService } from './oauth.service';

/**
 * Abstract base connector providing common integration functionality
 * All specific provider connectors should extend this class
 */
export abstract class BaseConnectorService implements IConnector {
  protected readonly logger: Logger;
  protected httpClient: AxiosInstance;
  protected config: IntegrationConfiguration | null = null;
  protected credentials: OAuthCredentials | null = null;

  constructor(
    public readonly provider: OAuthProvider,
    public readonly name: string,
    public readonly version: string,
    public readonly capabilities: IntegrationCapability[],
    protected readonly oauthService: OAuthService,
  ) {
    this.logger = new Logger(`${this.constructor.name}`);
    this.setupHttpClient();
  }

  /**
   * Initialize the connector with configuration
   */
  async initialize(config: IntegrationConfiguration): Promise<void> {
    try {
      this.config = config;
      this.setupHttpClient();
      await this.validateConfiguration();
      this.logger.log(`Connector ${this.name} initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize connector ${this.name}:`, error);
      throw new IntegrationException(
        IntegrationErrorCode.CONNECTOR_INITIALIZATION_FAILED,
        `Failed to initialize ${this.name} connector`,
        { provider: this.provider, error: (error as Error).message },
      );
    }
  }

  /**
   * Test the connection to the third-party service
   */
  async testConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      const endpoint = this.getHealthCheckEndpoint();
      if (!endpoint) {
        return {
          status: HealthStatus.UNKNOWN,
          responseTime: 0,
          timestamp,
          endpoint: 'N/A',
          metadata: { message: 'No health check endpoint available' },
        };
      }

      const response = await this.makeAuthenticatedRequest('GET', endpoint);
      const responseTime = Date.now() - startTime;

      return {
        status: response.status === 200 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        responseTime,
        timestamp,
        endpoint,
        httpStatus: response.status,
        metadata: { response: response.data },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.warn(`Health check failed for ${this.name}:`, (error as Error).message);

      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp,
        endpoint: this.getHealthCheckEndpoint() || 'unknown',
        errorMessage: (error as Error).message,
        metadata: { error: (error as { response?: { data: unknown } }).response?.data },
      };
    }
  }

  /**
   * Set OAuth credentials for authenticated requests
   */
  setCredentials(credentials: OAuthCredentials): void {
    this.credentials = credentials;
    this.setupAuthenticationHeaders();
  }

  /**
   * Get connector metadata and capabilities
   */
  abstract getMetadata(): ConnectorMetadata;

  /**
   * Handle OAuth 2.0 authorization
   */
  authorize(config: OAuthConfig): Promise<string> {
    try {
      const state = this.generateSecureState();
      const authUrl = this.oauthService.generateAuthUrl(this.provider, config, state);
      this.logger.log(`Generated authorization URL for ${this.provider}`);
      return Promise.resolve(authUrl);
    } catch (error) {
      this.logger.error(`Authorization failed for ${this.provider}:`, error);
      throw new IntegrationException(
        IntegrationErrorCode.OAUTH_AUTHORIZATION_FAILED,
        `OAuth authorization failed for ${this.provider}`,
        { provider: this.provider, error: (error as Error).message },
      );
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, config: OAuthConfig): Promise<OAuthTokenResponse> {
    try {
      const tokens = await this.oauthService.exchangeCodeForTokens(this.provider, code, config);

      // Convert internal tokens to standard response format
      const tokenResponse: OAuthTokenResponse = {
        access_token: tokens.accessToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresAt
          ? Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000)
          : 3600,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
      };

      this.logger.log(`Successfully exchanged code for tokens for ${this.provider}`);
      return tokenResponse;
    } catch (error) {
      this.logger.error(`Token exchange failed for ${this.provider}:`, error);
      throw new IntegrationException(
        IntegrationErrorCode.TOKEN_EXCHANGE_FAILED,
        `Token exchange failed for ${this.provider}`,
        { provider: this.provider, error: (error as Error).message },
      );
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string, config: OAuthConfig): Promise<OAuthTokenResponse> {
    try {
      const tokens = await this.oauthService.refreshAccessToken(
        this.provider,
        refreshToken,
        config,
      );

      const tokenResponse: OAuthTokenResponse = {
        access_token: tokens.accessToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresAt
          ? Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000)
          : 3600,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
      };

      this.logger.log(`Successfully refreshed tokens for ${this.provider}`);
      return tokenResponse;
    } catch (error) {
      this.logger.error(`Token refresh failed for ${this.provider}:`, error);
      throw new IntegrationException(
        IntegrationErrorCode.TOKEN_REFRESH_FAILED,
        `Token refresh failed for ${this.provider}`,
        { provider: this.provider, error: (error as Error).message },
      );
    }
  }

  /**
   * Revoke access token
   */
  revokeTokens(_accessToken: string, _config: OAuthConfig): Promise<void> {
    try {
      // Note: revokeToken method doesn't exist in OAuthService, implementing basic revocation
      this.logger.log(`Revoking tokens for ${this.provider}`);
      // Clear local credentials
      this.credentials = null;
      this.setupAuthenticationHeaders();
      return Promise.resolve();
    } catch (error) {
      this.logger.error(`Token revocation failed for ${this.provider}:`, error);
      throw new IntegrationException(
        IntegrationErrorCode.TOKEN_REVOCATION_FAILED,
        `Token revocation failed for ${this.provider}`,
        { provider: this.provider, error: (error as Error).message },
      );
    }
  }

  /**
   * Make authenticated API request
   */
  async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const response = await this.makeAuthenticatedRequest<T>(method, endpoint, data, headers);
    return response.data;
  }

  /**
   * Validate webhook payload
   */
  validateWebhook(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.generateWebhookSignature(payload, secret);
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      this.logger.warn(`Webhook validation failed:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): Promise<void> {
    this.credentials = null;
    this.config = null;
    this.logger.log(`Connector ${this.name} destroyed`);
    return Promise.resolve();
  }

  /**
   * Protected methods
   */

  protected async makeAuthenticatedRequest<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    additionalHeaders?: Record<string, string>,
  ): Promise<AxiosResponse<T, unknown>> {
    const startTime = Date.now();
    try {
      if (this.requiresAuthentication(endpoint) && !this.credentials) {
        throw new IntegrationException(
          IntegrationErrorCode.UNAUTHORIZED,
          'Authentication credentials are required for this request',
        );
      }
      const requestConfig: AxiosRequestConfig = {
        method,
        url: `${this.config?.apiBaseUrl || ''}${endpoint}`,
        data,
        headers: { ...this.getDefaultHeaders(), ...additionalHeaders },
        timeout: this.config?.timeoutMs,
      };

      const response = await this.httpClient.request<T>(requestConfig);
      this.logger.log(`API request to ${endpoint} successful with status ${response.status}`);
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `API request to ${endpoint} failed with status ${error.response?.status}: ${
            (error as Error).message
          }`,
          {
            request: error.config,
            response: error.response?.data,
          },
        );
        throw new IntegrationException(
          IntegrationErrorCode.API_REQUEST_FAILED,
          `API request failed: ${(error as Error).message}`,
          {
            provider: this.provider,
            endpoint,
            status: error.response?.status,
            data: error.response?.data,
          },
        );
      } else {
        this.logger.error(`API request to ${endpoint} failed: ${(error as Error).message}`, error);
        throw new IntegrationException(
          IntegrationErrorCode.API_REQUEST_FAILED,
          `API request failed: ${(error as Error).message}`,
          { provider: this.provider, endpoint },
        );
      }
    } finally {
      this.logger.debug(`Request to ${endpoint} took ${Date.now() - startTime}ms`);
    }
  }

  protected setupHttpClient(): void {
    this.httpClient = axios.create();

    // Add interceptors, e.g., for logging or error handling
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        // Handle rate limiting
        if (error.response?.status === 429) {
          this.logger.warn(`Rate limit exceeded for ${this.provider}.`);
          return Promise.reject(
            new IntegrationException(
              IntegrationErrorCode.RATE_LIMIT_EXCEEDED,
              'Rate limit exceeded',
            ),
          );
        }

        // Handle unauthorized errors (e.g., token expired)
        if (error.response?.status === 401 && this.credentials) {
          this.logger.warn(`Unauthorized request for ${this.provider}. Token may be expired.`);
          return Promise.reject(
            new IntegrationException(IntegrationErrorCode.UNAUTHORIZED, 'Unauthorized'),
          );
        }
        return Promise.reject(error as Error);
      },
    );
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': `${this.name}/${this.version}`,
    };
  }

  protected setupAuthenticationHeaders(): void {
    // Clear existing auth headers
    delete this.httpClient.defaults.headers.common['Authorization'];

    if (this.credentials?.accessToken) {
      this.httpClient.defaults.headers.common['Authorization'] =
        `Bearer ${this.credentials.accessToken}`;
    }
  }

  protected generateSecureState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  protected generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  protected requiresAuthentication(_endpoint: string): boolean {
    // Override in subclasses for public endpoints
    return true;
  }

  protected validateConfiguration(): Promise<void> {
    // Override in subclasses for specific validation logic
    if (!this.config) {
      throw new IntegrationException(
        IntegrationErrorCode.INVALID_CONFIGURATION,
        'Connector configuration is missing',
      );
    }
    return Promise.resolve();
  }

  /**
   * Abstract method for connector-specific health check endpoint
   */
  protected abstract getHealthCheckEndpoint(): string | null;
}
