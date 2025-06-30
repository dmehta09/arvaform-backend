import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  IntegrationCapability,
  IntegrationStatus,
  OAuthProvider,
} from '../types/integration.types';

/**
 * DTO for connector rate limits.
 */
class ConnectorRateLimitsDto {
  @ApiProperty()
  requestsPerMinute: number;

  @ApiProperty()
  requestsPerDay: number;
}

/**
 * DTO for connector metadata.
 */
export class ConnectorMetadataDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  version: string;

  @ApiProperty({ enum: OAuthProvider })
  provider: OAuthProvider;

  @ApiProperty({ enum: IntegrationCapability, isArray: true })
  capabilities: IntegrationCapability[];

  @ApiProperty({ isArray: true })
  requiredScopes: string[];

  @ApiProperty({ isArray: true })
  optionalScopes: string[];

  @ApiProperty()
  authorizationUrl: string;

  @ApiProperty()
  tokenUrl: string;

  @ApiProperty()
  docsUrl: string;

  @ApiProperty({ isArray: true })
  supportedEvents: string[];

  @ApiProperty({ type: ConnectorRateLimitsDto })
  rateLimits: ConnectorRateLimitsDto;

  @ApiProperty()
  webhookSupport: boolean;

  @ApiProperty()
  batchSupport: boolean;
}

/**
 * Integration Configuration DTO
 */
export class IntegrationConfigDto {
  @ApiProperty({
    description: 'API base URL for the integration',
    example: 'https://api.service.com/v1',
  })
  @IsNotEmpty()
  @IsUrl()
  apiBaseUrl: string;

  @ApiPropertyOptional({
    description: 'API version to use',
    example: 'v1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  apiVersion?: string;

  @ApiProperty({
    description: 'Rate limit per minute',
    example: 100,
    minimum: 1,
    maximum: 10000,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimitPerMinute: number;

  @ApiProperty({
    description: 'Request timeout in milliseconds',
    example: 30000,
    minimum: 1000,
    maximum: 300000,
  })
  @IsInt()
  @Min(1000)
  @Max(300000)
  timeoutMs: number;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsInt()
  @Min(0)
  @Max(10)
  retryAttempts: number;

  @ApiProperty({
    description: 'Retry delay in milliseconds',
    example: 1000,
    minimum: 100,
    maximum: 60000,
  })
  @IsInt()
  @Min(100)
  @Max(60000)
  retryDelayMs: number;

  @ApiProperty({
    description: 'Health check interval in milliseconds',
    example: 300000,
    minimum: 60000,
    maximum: 3600000,
  })
  @IsInt()
  @Min(60000)
  @Max(3600000)
  healthCheckIntervalMs: number;

  @ApiPropertyOptional({
    description: 'Custom headers for API requests',
    example: { 'X-Custom-Header': 'value' },
  })
  @IsOptional()
  customHeaders?: Record<string, string>;
}

/**
 * Create Integration DTO
 */
export class CreateIntegrationDto {
  @ApiProperty({
    description: 'Integration name',
    example: 'My Salesforce Integration',
    minLength: 1,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Integration description',
    example: 'Integration to sync form submissions with Salesforce',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'OAuth provider type',
    enum: OAuthProvider,
    example: OAuthProvider.SALESFORCE,
  })
  @IsEnum(OAuthProvider)
  provider: OAuthProvider;

  @ApiProperty({
    description: 'Integration capabilities',
    enum: IntegrationCapability,
    isArray: true,
    example: [IntegrationCapability.READ_DATA, IntegrationCapability.WRITE_DATA],
  })
  @IsArray()
  @IsEnum(IntegrationCapability, { each: true })
  capabilities: IntegrationCapability[];

  @ApiProperty({
    description: 'Integration configuration',
    type: IntegrationConfigDto,
  })
  @ValidateNested()
  @Type(() => IntegrationConfigDto)
  config: IntegrationConfigDto;

  @ApiProperty({
    description: 'OAuth client ID',
    example: 'your-client-id',
  })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiProperty({
    description: 'OAuth client secret',
    example: 'your-client-secret',
  })
  @IsNotEmpty()
  @IsString()
  clientSecret: string;

  @ApiProperty({
    description: 'OAuth scopes requested',
    example: ['read', 'write'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @ApiProperty({
    description: 'OAuth redirect URI',
    example: 'https://your-app.com/oauth/callback',
  })
  @IsNotEmpty()
  @IsUrl()
  redirectUri: string;

  @ApiPropertyOptional({
    description: 'Integration tags for organization',
    example: ['production', 'crm'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Associated form ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({
    description: 'Test mode flag',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;
}

/**
 * Update Integration DTO
 */
export class UpdateIntegrationDto extends PartialType(CreateIntegrationDto) {
  @ApiPropertyOptional({
    description: 'Integration status',
    enum: IntegrationStatus,
    example: IntegrationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @ApiPropertyOptional({
    description: 'Integration enabled flag',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * Integration Response DTO
 */
export class IntegrationResponseDto {
  @ApiProperty({
    description: 'Integration ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Integration name',
    example: 'My Salesforce Integration',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Integration description',
    example: 'Integration to sync form submissions with Salesforce',
  })
  description?: string;

  @ApiProperty({
    description: 'OAuth provider type',
    enum: OAuthProvider,
    example: OAuthProvider.SALESFORCE,
  })
  provider: OAuthProvider;

  @ApiProperty({
    description: 'Integration status',
    enum: IntegrationStatus,
    example: IntegrationStatus.ACTIVE,
  })
  status: IntegrationStatus;

  @ApiProperty({
    description: 'Integration capabilities',
    enum: IntegrationCapability,
    isArray: true,
    example: [IntegrationCapability.READ_DATA, IntegrationCapability.WRITE_DATA],
  })
  capabilities: IntegrationCapability[];

  @ApiProperty({
    description: 'Integration configuration',
    type: IntegrationConfigDto,
  })
  config: IntegrationConfigDto;

  @ApiProperty({
    description: 'OAuth scopes requested',
    example: ['read', 'write'],
    isArray: true,
  })
  scopes: string[];

  @ApiProperty({
    description: 'OAuth redirect URI',
    example: 'https://your-app.com/oauth/callback',
  })
  redirectUri: string;

  @ApiPropertyOptional({
    description: 'Integration tags',
    example: ['production', 'crm'],
    isArray: true,
  })
  tags?: string[];

  @ApiProperty({
    description: 'Integration enabled flag',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Test mode flag',
    example: false,
  })
  isTestMode: boolean;

  @ApiPropertyOptional({
    description: 'Last synchronization timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  lastSyncAt?: Date;

  @ApiPropertyOptional({
    description: 'Next scheduled synchronization',
    example: '2025-01-15T11:30:00Z',
  })
  nextSyncAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'OAuth grant type',
    example: 'authorization_code',
  })
  grantType?: string;

  @ApiPropertyOptional({
    description: 'Integration configuration',
    example: { apiBaseUrl: 'https://api.service.com', timeout: 30000 },
  })
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Integration analytics',
    example: {
      totalRequests: 1500,
      successfulRequests: 1450,
      failedRequests: 50,
      averageResponseTime: 250,
      errorRate: 3.33,
      uptime: 96.67,
    },
  })
  analytics?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Last connection timestamp',
    example: '2025-01-15T10:00:00Z',
  })
  lastConnected?: Date;

  @ApiPropertyOptional({
    description: 'Last error message',
    example: 'Token expired',
  })
  lastError?: string;
}

/**
 * Integration List Query DTO
 */
export class IntegrationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by provider',
    enum: OAuthProvider,
    example: OAuthProvider.SALESFORCE,
  })
  @IsOptional()
  @IsEnum(OAuthProvider)
  provider?: OAuthProvider;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: IntegrationStatus,
    example: IntegrationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @ApiPropertyOptional({
    description: 'Filter by capability',
    enum: IntegrationCapability,
    example: IntegrationCapability.READ_DATA,
  })
  @IsOptional()
  @IsEnum(IntegrationCapability)
  capability?: IntegrationCapability;

  @ApiPropertyOptional({
    description: 'Number of items to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Filter by enabled status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by tags',
    example: 'production',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    description: 'Search in name and description',
    example: 'salesforce',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'createdAt',
    enum: ['name', 'provider', 'status', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['name', 'provider', 'status', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: string = 'desc';
}

/**
 * Integration List Response DTO
 */
export class IntegrationListResponseDto {
  @ApiProperty({
    description: 'List of integrations',
    type: [IntegrationResponseDto],
  })
  integrations: IntegrationResponseDto[];

  @ApiProperty({
    description: 'Total number of integrations',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Has next page',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Has previous page',
    example: false,
  })
  hasPrev: boolean;
}

/**
 * Integration Health DTO
 */
export class IntegrationHealthDto {
  @ApiProperty({
    description: 'Integration ID',
    example: '507f1f77bcf86cd799439011',
  })
  integrationId: string;

  @ApiProperty({
    description: 'Health status',
    example: 'healthy',
  })
  status: string;

  @ApiProperty({
    description: 'Response time in milliseconds',
    example: 250,
  })
  responseTimeMs: number;

  @ApiProperty({
    description: 'Last health check timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  lastCheckedAt: Date;

  @ApiProperty({
    description: 'Uptime percentage',
    example: 99.5,
  })
  uptimePercentage: number;

  @ApiPropertyOptional({
    description: 'Error message if unhealthy',
    example: 'Connection timeout',
  })
  errorMessage?: string;
}

/**
 * Integration Test Connection DTO
 */
export class TestConnectionDto {
  @ApiProperty({
    description: 'Test successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response time in milliseconds',
    example: 250,
  })
  responseTimeMs: number;

  @ApiProperty({
    description: 'Test timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  timestamp: Date;

  @ApiPropertyOptional({
    description: 'Error message if test failed',
    example: 'Invalid credentials',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Additional test metadata',
    example: { endpoint: '/api/v1/test', httpStatus: 200 },
  })
  metadata?: Record<string, string>;
}

/**
 * OAuth Callback DTO
 */
export class OAuthCallbackDto {
  @ApiProperty({
    description: 'OAuth authorization code',
    example: 'auth_code_12345',
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({
    description: 'OAuth state parameter for CSRF protection',
    example: 'random_state_value',
  })
  @IsNotEmpty()
  @IsString()
  state: string;

  @ApiPropertyOptional({
    description: 'OAuth error if authorization failed',
    example: 'access_denied',
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({
    description: 'OAuth error description',
    example: 'User denied access',
  })
  @IsOptional()
  @IsString()
  error_description?: string;

  @ApiPropertyOptional({
    description: 'Redirect URI used in OAuth flow',
    example: 'https://your-app.com/oauth/callback',
  })
  @IsOptional()
  @IsUrl()
  redirectUri?: string;
}

/**
 * Health Check Response DTO
 */
export class HealthCheckResponseDto {
  @ApiProperty({
    description: 'Health status',
    example: 'healthy',
    enum: ['healthy', 'degraded', 'unhealthy', 'unknown'],
  })
  status: string;

  @ApiProperty({
    description: 'Response time in milliseconds',
    example: 250,
  })
  responseTime: number;

  @ApiProperty({
    description: 'Health check timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Endpoint checked',
    example: '/api/v1/health',
  })
  endpoint: string;

  @ApiPropertyOptional({
    description: 'HTTP status code',
    example: 200,
  })
  httpStatus?: number;

  @ApiPropertyOptional({
    description: 'Error message if unhealthy',
    example: 'Connection timeout',
  })
  errorMessage?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { provider: 'google', region: 'us-east-1' },
  })
  metadata?: Record<string, unknown>;
}

/**
 * Integration Analytics DTO
 */
export class IntegrationAnalyticsDto {
  @ApiProperty({ description: 'Total number of API requests made', example: 1500 })
  totalRequests: number;

  @ApiProperty({ description: 'Number of successful requests', example: 1450 })
  successfulRequests: number;

  @ApiProperty({ description: 'Number of failed requests', example: 50 })
  failedRequests: number;

  @ApiProperty({ description: 'Average response time in milliseconds', example: 250 })
  averageResponseTime: number;

  @ApiProperty({ description: 'Error rate percentage', example: 3.33 })
  errorRate: number;

  @ApiPropertyOptional({ description: 'Timestamp of the last request' })
  lastRequestAt?: Date;

  @ApiPropertyOptional({ description: 'Timestamp of the last successful request' })
  lastSuccessAt?: Date;

  @ApiPropertyOptional({ description: 'Timestamp of the last failed request' })
  lastFailureAt?: Date;

  @ApiPropertyOptional({ description: 'Total bytes transferred' })
  bytesTransferred?: number;

  @ApiPropertyOptional({ description: 'Total webhook deliveries' })
  webhookDeliveries?: number;
}

/**
 * System Health DTO
 */
export class SystemHealthDto {
  @ApiProperty({ description: 'Overall system status', example: 'healthy' })
  status: string;

  @ApiProperty({ description: 'Timestamp of the health check' })
  timestamp: Date;

  @ApiProperty({ description: 'Details of checked services' })
  services: { name: string; status: string; message?: string }[];
}
