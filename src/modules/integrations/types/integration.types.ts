/**
 * Integration Framework Types
 *
 * Comprehensive type definitions for the integration framework including OAuth 2.0,
 * connector architecture, and third-party service abstractions following 2025 security standards.
 *
 * @fileoverview Core types for integration framework
 * @module IntegrationTypes
 * @since 2025-01-15
 */

/**
 * OAuth 2.0 Provider Types
 */
export enum OAuthProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
  SALESFORCE = 'salesforce',
  HUBSPOT = 'hubspot',
  MAILCHIMP = 'mailchimp',
  SLACK = 'slack',
  ZAPIER = 'zapier',
  WEBHOOK = 'webhook',
  CUSTOM = 'custom',
}

/**
 * Integration Status Enum
 */
export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  ERROR = 'error',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  TESTING = 'testing',
}

/**
 * OAuth 2.0 Grant Types
 */
export enum OAuthGrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
  REFRESH_TOKEN = 'refresh_token',
  IMPLICIT = 'implicit',
}

/**
 * Integration Capabilities
 */
export enum IntegrationCapability {
  READ_DATA = 'read_data',
  WRITE_DATA = 'write_data',
  WEBHOOK_DELIVERY = 'webhook_delivery',
  REAL_TIME_SYNC = 'real_time_sync',
  BATCH_PROCESSING = 'batch_processing',
  FILE_UPLOAD = 'file_upload',
  USER_MANAGEMENT = 'user_management',
  ANALYTICS = 'analytics',
}

/**
 * Health Check Status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * OAuth 2.0 Token Response Interface
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * OAuth 2.0 Configuration Interface
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scope: string[];
  redirectUri: string;
  responseType: string;
  grantType: OAuthGrantType;
  pkceEnabled?: boolean;
  state?: string;
}

/**
 * Encrypted OAuth Credentials
 */
export interface EncryptedOAuthCredentials {
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt?: Date;
  tokenType: string;
  scope: string[];
  encryptionVersion: string;
}

/**
 * Integration Configuration Interface
 */
export interface IntegrationConfiguration {
  apiBaseUrl: string;
  apiVersion?: string;
  rateLimitPerMinute: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  healthCheckIntervalMs: number;
  customHeaders?: Record<string, string>;
  webhookSettings?: WebhookSettings;
  dataMapping?: DataMappingRule[];
}

/**
 * Webhook Settings for Integration
 */
export interface WebhookSettings {
  enabled: boolean;
  url?: string;
  secret?: string;
  events: string[];
  signatureHeader: string;
  signaturePrefix: string;
}

/**
 * Data Mapping Rule Interface
 */
export interface DataMappingRule {
  sourceField: string;
  targetField: string;
  transform?: string;
  defaultValue?: unknown;
  required: boolean;
}

/**
 * Health Check Result Interface
 */
export interface HealthCheckResult {
  status: HealthStatus;
  responseTime: number;
  timestamp: Date;
  endpoint: string;
  httpStatus?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Integration Analytics Interface
 */
export interface IntegrationAnalytics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  errorRate: number;
  uptime: number;
  healthHistory: HealthCheckResult[];
}

/**
 * Connector Interface - Base contract for all integrations
 */
export interface IConnector {
  provider: OAuthProvider;
  name: string;
  version: string;
  capabilities: IntegrationCapability[];

  /**
   * Initialize the connector with configuration
   */
  initialize(config: IntegrationConfiguration): Promise<void>;

  /**
   * Test the connection to the third-party service
   */
  testConnection(): Promise<HealthCheckResult>;

  /**
   * Get connector metadata and capabilities
   */
  getMetadata(): ConnectorMetadata;

  /**
   * Handle OAuth 2.0 authorization
   */
  authorize(config: OAuthConfig): Promise<string>;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string, config: OAuthConfig): Promise<OAuthTokenResponse>;

  /**
   * Refresh access token
   */
  refreshAccessToken(refreshToken: string, config: OAuthConfig): Promise<OAuthTokenResponse>;

  /**
   * Revoke access token
   */
  revokeTokens(accessToken: string, config: OAuthConfig): Promise<void>;

  /**
   * Make authenticated API request
   */
  makeRequest<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T>;

  /**
   * Validate webhook payload
   */
  validateWebhook(payload: string, signature: string, secret: string): boolean;

  /**
   * Clean up resources
   */
  destroy(): Promise<void>;
}

/**
 * Connector Metadata Interface
 */
export interface ConnectorMetadata {
  name: string;
  description: string;
  version: string;
  provider: OAuthProvider;
  capabilities: IntegrationCapability[];
  requiredScopes: string[];
  optionalScopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  docsUrl: string;
  supportedEvents: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  webhookSupport: boolean;
  batchSupport: boolean;
}

/**
 * Integration Event Types
 */
export enum IntegrationEventType {
  CONNECTED = 'integration.connected',
  DISCONNECTED = 'integration.disconnected',
  ERROR = 'integration.error',
  TOKEN_REFRESHED = 'integration.token.refreshed',
  TOKEN_EXPIRED = 'integration.token.expired',
  HEALTH_CHECK_FAILED = 'integration.health.failed',
  HEALTH_CHECK_RECOVERED = 'integration.health.recovered',
  DATA_SYNCED = 'integration.data.synced',
  WEBHOOK_RECEIVED = 'integration.webhook.received',
}

/**
 * Integration Event Interface
 */
export interface IntegrationEvent {
  type: IntegrationEventType;
  integrationId: string;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * OAuth 2.0 Authorization Request
 */
export interface OAuthAuthorizationRequest {
  provider: OAuthProvider;
  scopes: string[];
  state?: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/**
 * OAuth 2.0 Token Exchange Request
 */
export interface OAuthTokenExchangeRequest {
  provider: OAuthProvider;
  code: string;
  state?: string;
  codeVerifier?: string;
  redirectUri: string;
}

/**
 * Integration Discovery Response
 */
export interface IntegrationDiscoveryResponse {
  available: ConnectorMetadata[];
  total: number;
  categories: Record<string, ConnectorMetadata[]>;
}

/**
 * Error Codes for Integration Framework
 */
export enum IntegrationErrorCode {
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  OAUTH_AUTHORIZATION_FAILED = 'OAUTH_AUTHORIZATION_FAILED',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  TOKEN_REVOCATION_FAILED = 'TOKEN_REVOCATION_FAILED',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  CONNECTOR_NOT_FOUND = 'CONNECTOR_NOT_FOUND',
  CONNECTOR_INITIALIZATION_FAILED = 'CONNECTOR_INITIALIZATION_FAILED',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  WEBHOOK_VALIDATION_FAILED = 'WEBHOOK_VALIDATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Custom Integration Exception
 */
export class IntegrationException extends Error {
  constructor(
    public readonly code: IntegrationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'IntegrationException';
  }
}
