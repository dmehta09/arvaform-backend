import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Document, Types } from 'mongoose';
import {
  HealthStatus,
  IntegrationCapability,
  IntegrationStatus,
  OAuthProvider,
} from '../types/integration.types';

/**
 * OAuth Credentials Schema (encrypted at rest)
 */
@Schema({ _id: false })
export class OAuthCredentials {
  @ApiProperty({ description: 'Encrypted access token' })
  @Prop({ required: true, select: false }) // Exclude from queries by default
  encryptedAccessToken: string;

  @ApiPropertyOptional({ description: 'Encrypted refresh token' })
  @Prop({ select: false })
  encryptedRefreshToken?: string;

  @ApiProperty({ description: 'Access token expiration timestamp' })
  @Prop({ required: true })
  accessTokenExpiresAt: Date;

  @ApiPropertyOptional({ description: 'Refresh token expiration timestamp' })
  @Prop()
  refreshTokenExpiresAt?: Date;

  @ApiProperty({ description: 'Token type (e.g., Bearer)' })
  @Prop({ required: true })
  tokenType: string;

  @ApiProperty({ description: 'OAuth scopes granted' })
  @Prop({ type: [String], required: true })
  scope: string[];

  @ApiProperty({ description: 'Encryption version for key rotation' })
  @Prop({ required: true, default: '1.0' })
  encryptionVersion: string;

  @ApiPropertyOptional({ description: 'Token metadata from provider' })
  @Prop({ type: Object })
  metadata?: Record<string, string>;
}

/**
 * Integration Configuration Schema
 */
@Schema({ _id: false })
export class IntegrationConfig {
  @ApiProperty({ description: 'API base URL for the integration' })
  @Prop({ required: true })
  apiBaseUrl: string;

  @ApiPropertyOptional({ description: 'API version to use' })
  @Prop()
  apiVersion?: string;

  @ApiProperty({ description: 'Rate limit per minute', example: 100 })
  @Prop({ required: true, min: 1, max: 10000, default: 100 })
  rateLimitPerMinute: number;

  @ApiProperty({ description: 'Request timeout in milliseconds', example: 30000 })
  @Prop({ required: true, min: 1000, max: 300000, default: 30000 })
  timeoutMs: number;

  @ApiProperty({ description: 'Number of retry attempts', example: 3 })
  @Prop({ required: true, min: 0, max: 10, default: 3 })
  retryAttempts: number;

  @ApiProperty({ description: 'Retry delay in milliseconds', example: 1000 })
  @Prop({ required: true, min: 100, max: 60000, default: 1000 })
  retryDelayMs: number;

  @ApiProperty({ description: 'Health check interval in milliseconds', example: 300000 })
  @Prop({ required: true, min: 60000, max: 3600000, default: 300000 })
  healthCheckIntervalMs: number;

  @ApiPropertyOptional({ description: 'Custom headers for API requests' })
  @Prop({ type: Map, of: String })
  customHeaders?: Map<string, string>;

  @ApiPropertyOptional({ description: 'Webhook configuration' })
  @Prop({ type: Object })
  webhookSettings?: {
    enabled: boolean;
    url?: string;
    secret?: string;
    events: string[];
    signatureHeader: string;
    signaturePrefix: string;
  };

  @ApiPropertyOptional({ description: 'Data mapping rules' })
  @Prop({ type: Array })
  dataMapping?: Array<{
    sourceField: string;
    targetField: string;
    transform?: string;
    defaultValue?: string;
    required: boolean;
  }>;
}

/**
 * Integration Health Check Schema
 */
@Schema({ _id: false })
export class IntegrationHealth {
  @ApiProperty({ description: 'Current health status', enum: HealthStatus })
  @Prop({ enum: HealthStatus, required: true, default: HealthStatus.UNKNOWN })
  status: HealthStatus;

  @ApiProperty({ description: 'Last health check timestamp' })
  @Prop({ required: true, default: Date.now })
  lastCheckedAt: Date;

  @ApiPropertyOptional({ description: 'Last successful health check' })
  @Prop()
  lastHealthyAt?: Date;

  @ApiProperty({ description: 'Response time in milliseconds' })
  @Prop({ required: true, default: 0 })
  responseTimeMs: number;

  @ApiPropertyOptional({ description: 'Current error message' })
  @Prop()
  errorMessage?: string;

  @ApiProperty({ description: 'Consecutive failure count' })
  @Prop({ required: true, default: 0 })
  consecutiveFailures: number;

  @ApiProperty({ description: 'Total health check attempts' })
  @Prop({ required: true, default: 0 })
  totalChecks: number;

  @ApiProperty({ description: 'Successful health check count' })
  @Prop({ required: true, default: 0 })
  successfulChecks: number;

  @ApiProperty({ description: 'Uptime percentage' })
  @Prop({ required: true, default: 0 })
  uptimePercentage: number;
}

/**
 * Integration Analytics Schema
 */
@Schema({ _id: false })
export class IntegrationAnalyticsSchema {
  @ApiProperty({ description: 'Total API requests made' })
  @Prop({ required: true, default: 0 })
  totalRequests: number;

  @ApiProperty({ description: 'Successful API requests' })
  @Prop({ required: true, default: 0 })
  successfulRequests: number;

  @ApiProperty({ description: 'Failed API requests' })
  @Prop({ required: true, default: 0 })
  failedRequests: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  @Prop({ required: true, default: 0 })
  averageResponseTime: number;

  @ApiPropertyOptional({ description: 'Last API request timestamp' })
  @Prop()
  lastRequestAt?: Date;

  @ApiPropertyOptional({ description: 'Last successful request timestamp' })
  @Prop()
  lastSuccessAt?: Date;

  @ApiPropertyOptional({ description: 'Last failed request timestamp' })
  @Prop()
  lastFailureAt?: Date;

  @ApiProperty({ description: 'Error rate percentage' })
  @Prop({ required: true, default: 0 })
  errorRate: number;

  @ApiProperty({ description: 'Data transferred in bytes' })
  @Prop({ required: true, default: 0 })
  bytesTransferred: number;

  @ApiProperty({ description: 'Webhook deliveries count' })
  @Prop({ required: true, default: 0 })
  webhookDeliveries: number;
}

/**
 * Integration Entity Schema
 *
 * Comprehensive schema for managing third-party integrations with OAuth 2.0 authentication,
 * health monitoring, analytics, and security features following 2025 standards.
 */
@Schema({
  timestamps: true,
  collection: 'integrations',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Integration extends Document {
  @ApiProperty({ description: 'Integration owner user ID' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiPropertyOptional({ description: 'Associated form ID (optional)' })
  @Prop({ type: Types.ObjectId, ref: 'Form', index: true })
  formId?: Types.ObjectId;

  @ApiProperty({ description: 'Integration name' })
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @ApiPropertyOptional({ description: 'Integration description' })
  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @ApiProperty({ description: 'OAuth provider type', enum: OAuthProvider })
  @Prop({ enum: OAuthProvider, required: true, index: true })
  provider: OAuthProvider;

  @ApiProperty({ description: 'Integration status', enum: IntegrationStatus })
  @Prop({
    enum: IntegrationStatus,
    required: true,
    default: IntegrationStatus.PENDING,
    index: true,
  })
  status: IntegrationStatus;

  @ApiProperty({
    description: 'Integration capabilities',
    enum: IntegrationCapability,
    isArray: true,
  })
  @Prop({ type: [String], enum: IntegrationCapability, required: true })
  capabilities: IntegrationCapability[];

  @ApiPropertyOptional({ description: 'OAuth credentials (encrypted)' })
  @Prop({ type: String, select: false })
  credentials?: string;

  @ApiProperty({ description: 'Integration configuration' })
  @Prop({ type: IntegrationConfig, required: true })
  config: IntegrationConfig;

  @ApiProperty({ description: 'Health monitoring data' })
  @Prop({ type: IntegrationHealth, default: () => new IntegrationHealth() })
  health: IntegrationHealth;

  @ApiProperty({ description: 'Analytics and metrics' })
  @Prop({ type: IntegrationAnalyticsSchema, default: () => new IntegrationAnalyticsSchema() })
  analytics: IntegrationAnalyticsSchema;

  @ApiPropertyOptional({ description: 'OAuth client ID' })
  @Prop({ required: true })
  clientId: string;

  @ApiPropertyOptional({ description: 'OAuth client secret (encrypted)' })
  @Prop({ select: false })
  encryptedClientSecret?: string;

  @ApiPropertyOptional({ description: 'OAuth client secret (plain text)' })
  @Prop({ select: false })
  clientSecret?: string;

  @ApiPropertyOptional({ description: 'OAuth grant type' })
  @Prop({ default: 'authorization_code' })
  grantType?: string;

  @ApiPropertyOptional({ description: 'Integration configuration object' })
  @Prop({ type: Object })
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Last connection timestamp' })
  @Prop()
  lastConnected?: Date;

  @ApiPropertyOptional({ description: 'Last error message' })
  @Prop()
  lastError?: string;

  @ApiPropertyOptional({ description: 'OAuth state for flow validation' })
  @Prop()
  oauthState?: string;

  @ApiProperty({ description: 'OAuth scopes requested' })
  @Prop({ type: [String], required: true })
  scopes: string[];

  @ApiProperty({ description: 'OAuth redirect URI' })
  @Prop({ required: true })
  redirectUri: string;

  @ApiPropertyOptional({ description: 'OAuth state parameter' })
  @Prop()
  state?: string;

  @ApiPropertyOptional({ description: 'Integration tags for organization' })
  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @ApiPropertyOptional({ description: 'External provider user ID' })
  @Prop()
  externalUserId?: string;

  @ApiPropertyOptional({ description: 'External provider user email' })
  @Prop()
  externalUserEmail?: string;

  @ApiPropertyOptional({ description: 'External provider organization ID' })
  @Prop()
  externalOrganizationId?: string;

  @ApiPropertyOptional({ description: 'Integration metadata from provider' })
  @Prop({ type: Object })
  metadata?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Last synchronization timestamp' })
  @Prop()
  lastSyncAt?: Date;

  @ApiPropertyOptional({ description: 'Next scheduled synchronization' })
  @Prop()
  nextSyncAt?: Date;

  @ApiPropertyOptional({ description: 'Synchronization interval in milliseconds' })
  @Prop()
  syncIntervalMs?: number;

  @ApiProperty({ description: 'Integration enabled flag' })
  @Prop({ required: true, default: true })
  enabled: boolean;

  @ApiProperty({ description: 'Test mode flag' })
  @Prop({ required: true, default: false })
  isTestMode: boolean;

  @ApiPropertyOptional({ description: 'Integration expiration date' })
  @Prop()
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Integration archive date' })
  @Prop()
  archivedAt?: Date;

  @ApiProperty({ description: 'Schema version for migrations' })
  @Prop({ required: true, default: '1.0' })
  schemaVersion: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

/**
 * Integration Document Type
 */
export interface IntegrationDocument extends Integration {
  _id: Types.ObjectId;
  id: string;
}

/**
 * Integration Schema Factory
 */
export const IntegrationSchema = SchemaFactory.createForClass(Integration);

// Indexes for performance optimization
IntegrationSchema.index({ userId: 1, provider: 1 });
IntegrationSchema.index({ userId: 1, status: 1 });
IntegrationSchema.index({ provider: 1, status: 1 });
IntegrationSchema.index({ tags: 1 });
IntegrationSchema.index({ 'health.status': 1 });
IntegrationSchema.index({ 'health.lastCheckedAt': 1 });
IntegrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
IntegrationSchema.index({ archivedAt: 1 });
IntegrationSchema.index({ createdAt: 1 });
IntegrationSchema.index({ updatedAt: 1 });

// Virtual for computed properties
IntegrationSchema.virtual('isExpired').get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

IntegrationSchema.virtual('isHealthy').get(function () {
  return this.health.status === HealthStatus.HEALTHY;
});

IntegrationSchema.virtual('successRate').get(function () {
  const total = this.analytics.totalRequests;
  return total > 0 ? (this.analytics.successfulRequests / total) * 100 : 0;
});

// Pre-save middleware for validation and computed fields
IntegrationSchema.pre('save', function (next) {
  // Update health metrics
  if (this.analytics) {
    const total = this.analytics.totalRequests;
    if (total > 0) {
      this.analytics.errorRate = (this.analytics.failedRequests / total) * 100;
    }
  }

  // Update health uptime
  if (this.health) {
    const total = this.health.totalChecks;
    if (total > 0) {
      this.health.uptimePercentage = (this.health.successfulChecks / total) * 100;
    }
  }

  next();
});

// Post-save middleware for event emission
IntegrationSchema.post('save', function (doc: IntegrationDocument) {
  // Emit integration events for monitoring
  // TODO: This check is not reliable in a post-save hook. isNew is not available.
  // if (this.isNew) {
  // Emit integration created event
  console.log(`Integration created: ${doc._id.toString()}`);
  // }
});

// Ensure credentials are never included in JSON unless explicitly requested
IntegrationSchema.set('toJSON', {
  transform: function (_doc, ret, _options) {
    delete ret.credentials;
    delete ret.encryptedClientSecret;
    return ret;
  },
});

export { Integration as IntegrationEntity };
