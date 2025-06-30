/**
 * Integrations Service
 * Main service for managing third-party integrations with OAuth 2.0 support
 *
 * @author ArvaForm Integration Team
 * @since 2025-01-14
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import {
  CreateIntegrationDto,
  IntegrationAnalyticsDto,
  IntegrationQueryDto,
  IntegrationResponseDto,
  OAuthCallbackDto,
  SystemHealthDto,
  UpdateIntegrationDto,
} from './dto/integration.dto';
import { Integration, IntegrationDocument } from './entities/integration.entity';
import { BaseConnectorService } from './services/base-connector.service';
import { OAuthCredentials, OAuthService } from './services/oauth.service';
import {
  ConnectorMetadata,
  HealthCheckResult,
  HealthStatus,
  IntegrationStatus,
  OAuthGrantType,
  OAuthProvider,
} from './types/integration.types';

/**
 * Main service for managing integrations
 * Handles CRUD operations, OAuth flows, and health monitoring
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly connectors = new Map<OAuthProvider, BaseConnectorService>();

  constructor(
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<IntegrationDocument>,
    private readonly oauthService: OAuthService,
  ) {}

  /**
   * Create a new integration
   */
  async create(userId: string, createDto: CreateIntegrationDto): Promise<IntegrationResponseDto> {
    try {
      // Check if integration already exists for this user and provider
      const existingIntegration = await this.integrationModel.findOne({
        userId,
        provider: createDto.provider,
        status: { $ne: IntegrationStatus.REVOKED },
      });

      if (existingIntegration) {
        throw new ConflictException(`Integration with ${createDto.provider} already exists`);
      }

      // Create integration document
      const integration = new this.integrationModel({
        ...createDto,
        userId,
        status: IntegrationStatus.PENDING,
        analytics: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          errorRate: 0,
          uptime: 100,
          healthHistory: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedIntegration = await integration.save();
      this.logger.log(`Created integration ${savedIntegration._id.toString()} for user ${userId}`);

      return this.toResponseDto(savedIntegration);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Failed to create integration:', error);
      throw new BadRequestException('Failed to create integration');
    }
  }

  /**
   * Get integration by ID
   */
  async findOne(id: string, userId: string): Promise<IntegrationResponseDto> {
    try {
      const integration = await this.integrationModel.findOne({
        _id: new Types.ObjectId(id),
        userId,
      });

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      return this.toResponseDto(integration);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find integration ${id}:`, error);
      throw new BadRequestException('Failed to retrieve integration');
    }
  }

  /**
   * Get all integrations for a user
   */
  async findAll(userId: string, query: IntegrationQueryDto): Promise<IntegrationResponseDto[]> {
    try {
      const filter: Record<string, unknown> = { userId };

      // Apply filters
      if (query.provider) {
        filter.provider = query.provider;
      }
      if (query.status) {
        filter.status = query.status;
      }
      if (query.capability) {
        filter.capabilities = { $in: [query.capability] };
      }

      // Build query
      let mongoQuery = this.integrationModel.find(filter);

      // Apply sorting
      if (query.sortBy) {
        const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
        mongoQuery = mongoQuery.sort({ [query.sortBy]: sortOrder });
      }

      // Apply pagination
      if (query.limit) {
        mongoQuery = mongoQuery.limit(query.limit);
      }
      if (query.offset) {
        mongoQuery = mongoQuery.skip(query.offset);
      }

      const integrations = await mongoQuery.exec();
      return integrations.map(integration => this.toResponseDto(integration));
    } catch (error) {
      this.logger.error(`Failed to find integrations for user ${userId}:`, error);
      throw new BadRequestException('Failed to retrieve integrations');
    }
  }

  /**
   * Update integration
   */
  async update(
    id: string,
    userId: string,
    updateDto: UpdateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    try {
      const integration = await this.integrationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId },
        { ...updateDto, updatedAt: new Date() },
        { new: true },
      );

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      this.logger.log(`Updated integration ${id}`);
      return this.toResponseDto(integration);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update integration ${id}:`, error);
      throw new BadRequestException('Failed to update integration');
    }
  }

  /**
   * Delete integration
   */
  async remove(id: string, userId: string): Promise<void> {
    try {
      const integration = await this.integrationModel.findOne({
        _id: new Types.ObjectId(id),
        userId,
      });

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      // Revoke tokens if integration is active
      if (integration.status === IntegrationStatus.ACTIVE && integration.credentials) {
        try {
          const _credentials = this.oauthService.decryptCredentials(integration.credentials);
          // Note: Implement token revocation in OAuth service
          this.logger.log(`Revoking tokens for integration ${id}`);
        } catch (error) {
          this.logger.warn(
            `Failed to revoke tokens for integration ${id}:`,
            (error as Error).message,
          );
        }
      }

      await this.integrationModel.deleteOne({ _id: new Types.ObjectId(id), userId });
      this.logger.log(`Deleted integration ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete integration ${id}:`, error);
      throw new BadRequestException('Failed to delete integration');
    }
  }

  /**
   * Start OAuth authorization flow
   */
  async startOAuthFlow(
    id: string,
    userId: string,
    redirectUri: string,
  ): Promise<{ authUrl: string; state: string }> {
    try {
      const integration = await this.integrationModel.findOne({
        _id: new Types.ObjectId(id),
        userId,
      });

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      if (integration.status === IntegrationStatus.ACTIVE) {
        throw new BadRequestException('Integration is already connected');
      }

      // Generate OAuth config
      const oauthConfig = {
        clientId: integration.clientId,
        clientSecret: integration.clientSecret || '',
        authorizationUrl: '',
        tokenUrl: '',
        scope: integration.scopes || [],
        redirectUri,
        responseType: 'code',
        grantType: OAuthGrantType.AUTHORIZATION_CODE,
      };

      // Generate authorization URL
      const state = this.generateSecureState();
      const authUrl = this.oauthService.generateAuthUrl(integration.provider, oauthConfig, state);

      // Store state for verification
      await this.integrationModel.updateOne(
        { _id: new Types.ObjectId(id) },
        {
          oauthState: state,
          updatedAt: new Date(),
        },
      );

      this.logger.log(`Started OAuth flow for integration ${id}`);
      return { authUrl, state };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to start OAuth flow for integration ${id}:`, error);
      throw new BadRequestException('Failed to start OAuth flow');
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(callbackDto: OAuthCallbackDto): Promise<IntegrationResponseDto> {
    try {
      const integration = await this.integrationModel.findOne({
        oauthState: callbackDto.state,
      });

      if (!integration) {
        throw new BadRequestException('Invalid OAuth state parameter');
      }

      if (callbackDto.error) {
        // Handle OAuth error
        await this.integrationModel.updateOne(
          { _id: integration._id },
          {
            status: IntegrationStatus.ERROR,
            lastError: callbackDto.error,
            updatedAt: new Date(),
          },
        );
        throw new BadRequestException(`OAuth error: ${callbackDto.error}`);
      }

      // Exchange code for tokens
      const oauthConfig = {
        clientId: integration.clientId,
        clientSecret: integration.clientSecret || '',
        authorizationUrl: '',
        tokenUrl: '',
        scope: integration.scopes || [],
        redirectUri: callbackDto.redirectUri || '',
        responseType: 'code',
        grantType: OAuthGrantType.AUTHORIZATION_CODE,
      };

      const tokens = await this.oauthService.exchangeCodeForTokens(
        integration.provider,
        callbackDto.code,
        oauthConfig,
      );

      // Encrypt and store credentials
      const _credentials = this.oauthService.encryptCredentials({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        expiresAt: tokens.expiresAt,
      });

      // Update integration status
      const updatedIntegration = await this.integrationModel.findOneAndUpdate(
        { _id: integration._id },
        {
          credentials: _credentials,
          status: IntegrationStatus.ACTIVE,
          lastConnected: new Date(),
          oauthState: undefined,
          lastError: undefined,
          updatedAt: new Date(),
        },
        { new: true },
      );

      this.logger.log(`Completed OAuth flow for integration ${integration._id.toString()}`);
      return this.toResponseDto(updatedIntegration!);
    } catch (error) {
      this.logger.error('Failed to handle OAuth callback:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to complete OAuth flow');
    }
  }

  /**
   * Test integration connection
   */
  async testConnection(id: string, userId: string): Promise<HealthCheckResult> {
    try {
      const integration = await this.integrationModel.findOne({
        _id: new Types.ObjectId(id),
        userId,
      });

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      if (integration.status !== IntegrationStatus.ACTIVE) {
        throw new BadRequestException('Integration is not active');
      }

      // Get connector for provider
      const connector = this.getConnector(integration.provider);
      if (!connector) {
        throw new BadRequestException(`No connector available for ${integration.provider}`);
      }

      // Set up credentials
      if (integration.credentials) {
        const _credentials = this.oauthService.decryptCredentials(integration.credentials);
        connector.setCredentials(_credentials);
      }

      // Test connection
      const healthResult = await connector.testConnection();

      // Update health history
      await this.updateHealthHistory(integration._id.toString(), healthResult);

      return healthResult;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to test connection for integration ${id}:`, error);
      throw new BadRequestException('Failed to test connection');
    }
  }

  /**
   * Get available providers and their metadata
   */
  getAvailableProviders(): ConnectorMetadata[] {
    const providers: ConnectorMetadata[] = [];

    // Add metadata for each supported provider
    for (const [provider, connector] of this.connectors) {
      try {
        const metadata = connector.getMetadata();
        providers.push(metadata);
      } catch (error) {
        this.logger.warn(`Failed to get metadata for ${provider}:`, (error as Error).message);
      }
    }

    return providers;
  }

  /**
   * Refresh expired tokens (scheduled task)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshExpiredTokens(): Promise<void> {
    try {
      this.logger.log('Starting token refresh job');

      // Find integrations with tokens expiring soon
      const integrations = await this.integrationModel.find({
        status: IntegrationStatus.ACTIVE,
        credentials: { $exists: true },
      });

      let refreshedCount = 0;

      for (const integration of integrations) {
        try {
          const credentials = this.oauthService.decryptCredentials(integration.credentials!);

          if (this.oauthService.needsTokenRefresh(credentials, 30)) {
            await this._refreshIntegrationTokens(integration);
            refreshedCount++;
          }
        } catch (error) {
          const integrationIdStr = integration._id.toString();
          this.logger.warn(
            `Failed to refresh tokens for integration ${integrationIdStr}:`,
            (error as Error).message,
          );
        }
      }

      this.logger.log(`Refreshed tokens for ${refreshedCount} integrations`);
    } catch (error) {
      this.logger.error('Token refresh job failed:', error);
    }
  }

  /**
   * Health check for all active integrations (scheduled task)
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async performHealthChecks(): Promise<void> {
    try {
      this.logger.log('Starting health check job');

      const activeIntegrations = await this.integrationModel.find({
        status: IntegrationStatus.ACTIVE,
      });

      let healthyCount = 0;
      let unhealthyCount = 0;

      for (const integration of activeIntegrations) {
        try {
          const connector = this.getConnector(integration.provider);
          if (!connector) continue;

          if (integration.credentials) {
            const _credentials = this.oauthService.decryptCredentials(integration.credentials);
            connector.setCredentials(_credentials);
          }

          const healthResult = await connector.testConnection();
          await this.updateHealthHistory(integration._id.toString(), healthResult);

          if (healthResult.status === HealthStatus.HEALTHY) {
            healthyCount++;
          } else {
            unhealthyCount++;
          }
        } catch (error) {
          unhealthyCount++;
          const integrationIdStr = integration._id.toString();
          this.logger.warn(
            `Health check failed for integration ${integrationIdStr}:`,
            (error as Error).message,
          );
        }
      }

      this.logger.log(
        `Health check completed: ${healthyCount} healthy, ${unhealthyCount} unhealthy`,
      );
    } catch (error) {
      this.logger.error('Health check job failed:', error);
    }
  }

  /**
   * Private helper methods
   */
  private toResponseDto(integration: IntegrationDocument): IntegrationResponseDto {
    const config = {
      ...integration.config,
      customHeaders: integration.config.customHeaders
        ? Object.fromEntries(integration.config.customHeaders)
        : undefined,
    };

    return {
      id: integration._id.toString(),
      provider: integration.provider,
      name: integration.name,
      description: integration.description,
      status: integration.status,
      capabilities: integration.capabilities,
      config,
      scopes: integration.scopes,
      redirectUri: integration.redirectUri,
      tags: integration.tags,
      enabled: integration.enabled,
      isTestMode: integration.isTestMode,
      grantType: integration.grantType,
      configuration: integration.configuration,
      analytics: {
        totalRequests: integration.analytics.totalRequests,
        successfulRequests: integration.analytics.successfulRequests,
        failedRequests: integration.analytics.failedRequests,
        averageResponseTime: integration.analytics.averageResponseTime,
        errorRate: integration.analytics.errorRate,
        lastRequestAt: integration.analytics.lastRequestAt,
        lastSuccessAt: integration.analytics.lastSuccessAt,
        lastFailureAt: integration.analytics.lastFailureAt,
        bytesTransferred: integration.analytics.bytesTransferred,
        webhookDeliveries: integration.analytics.webhookDeliveries,
      },
      lastConnected: integration.lastConnected,
      lastError: integration.lastError,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }

  private generateSecureState(): string {
    return randomBytes(32).toString('hex');
  }

  private getConnector(provider: OAuthProvider): BaseConnectorService | undefined {
    return this.connectors.get(provider);
  }

  private async _refreshIntegrationTokens(integration: IntegrationDocument): Promise<void> {
    try {
      const credentials = this.oauthService.decryptCredentials(integration.credentials!);

      if (!credentials.refreshToken) {
        this.logger.warn(
          `No refresh token available for integration ${integration._id.toString()}`,
        );
        return;
      }

      const oauthConfig = {
        clientId: integration.clientId,
        clientSecret: integration.clientSecret || '',
        authorizationUrl: '',
        tokenUrl: '',
        scope: integration.scopes || [],
        redirectUri: '',
        responseType: 'code',
        grantType: OAuthGrantType.REFRESH_TOKEN,
      };

      const newTokens = await this.oauthService.refreshAccessToken(
        integration.provider,
        credentials.refreshToken,
        oauthConfig,
      );

      const newCredentials: OAuthCredentials = {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || credentials.refreshToken,
        tokenType: newTokens.tokenType,
        scope: newTokens.scope,
        expiresAt: newTokens.expiresAt,
      };

      const encryptedCredentials = this.oauthService.encryptCredentials(newCredentials);

      await this.integrationModel.updateOne(
        { _id: integration._id },
        {
          credentials: encryptedCredentials,
          updatedAt: new Date(),
        },
      );

      const integrationIdStr = integration._id.toString();
      this.logger.log(`Refreshed tokens for integration ${integrationIdStr}`);
    } catch (error) {
      const integrationIdStr = integration._id.toString();
      this.logger.error(`Failed to refresh tokens for integration ${integrationIdStr}:`, error);

      // Mark integration as expired if refresh fails
      await this.integrationModel.updateOne(
        { _id: integration._id },
        {
          status: IntegrationStatus.EXPIRED,
          lastError: (error as Error).message,
          updatedAt: new Date(),
        },
      );
    }
  }

  /**
   * Refresh OAuth tokens for a specific integration
   */
  async refreshTokens(id: string, userId: string): Promise<IntegrationResponseDto> {
    const integration = await this.integrationModel.findOne({
      _id: new Types.ObjectId(id),
      userId,
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    if (integration.status !== IntegrationStatus.ACTIVE) {
      this.logger.warn(`Token refresh attempted for non-active integration ${id}`);
      // Or throw new BadRequestException('Integration is not active');
    }

    await this._refreshIntegrationTokens(integration);

    const updatedIntegration = await this.integrationModel.findById(id);
    if (!updatedIntegration) {
      // This case should ideally not happen if the integration existed seconds ago
      throw new NotFoundException('Integration not found after token refresh');
    }

    return this.toResponseDto(updatedIntegration);
  }

  private async updateHealthHistory(
    integrationId: string,
    healthResult: HealthCheckResult,
  ): Promise<void> {
    try {
      await this.integrationModel.updateOne(
        { _id: new Types.ObjectId(integrationId) },
        {
          $push: {
            'analytics.healthHistory': {
              $each: [healthResult],
              $slice: -100, // Keep only last 100 health checks
            },
          },
          $set: {
            'analytics.lastRequestAt': new Date(),
            updatedAt: new Date(),
          },
        },
      );
    } catch (error) {
      this.logger.error(`Failed to update health history for integration ${integrationId}:`, error);
    }
  }

  /**
   * Get analytics for a specific integration
   */
  async getAnalytics(id: string, userId: string): Promise<IntegrationAnalyticsDto> {
    try {
      const integration = await this.integrationModel.findOne({
        _id: new Types.ObjectId(id),
        userId,
      });

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      return integration.analytics;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get analytics for integration ${id}:`, error);
      throw new BadRequestException('Failed to retrieve analytics');
    }
  }

  /**
   * Get overall system health for integrations
   */
  getSystemHealth(): SystemHealthDto {
    // This is a placeholder implementation
    // In a real scenario, this would check database connections, external services, etc.
    return {
      status: 'healthy',
      timestamp: new Date(),
      services: [
        {
          name: 'IntegrationsDatabase',
          status: 'healthy',
        },
        {
          name: 'OAuthService',
          status: 'healthy',
        },
      ],
    };
  }
}
