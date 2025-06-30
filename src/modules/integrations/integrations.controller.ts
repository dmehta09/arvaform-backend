/**
 * Integrations Controller
 * REST API endpoints for managing third-party integrations
 *
 * @author ArvaForm Integration Team
 * @since 2025-01-14
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import {
  ConnectorMetadataDto,
  CreateIntegrationDto,
  HealthCheckResponseDto,
  IntegrationAnalyticsDto,
  IntegrationQueryDto,
  IntegrationResponseDto,
  OAuthCallbackDto,
  SystemHealthDto,
  UpdateIntegrationDto,
} from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';
import {
  ConnectorMetadata,
  HealthCheckResult,
  IntegrationCapability,
  IntegrationStatus,
  OAuthProvider,
} from './types/integration.types';

/**
 * Controller for integration management
 * Provides REST API endpoints for CRUD operations, OAuth flows, and monitoring
 */
@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * Create a new integration
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new integration',
    description: 'Creates a new integration configuration for a third-party service',
  })
  @ApiResponse({
    status: 201,
    description: 'Integration created successfully',
    type: IntegrationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid integration data' })
  @ApiResponse({ status: 409, description: 'Integration already exists' })
  async create(
    @GetUser('id') userId: string,
    @Body(ValidationPipe) createDto: CreateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    this.logger.log(`Creating integration for user ${userId}`);
    return this.integrationsService.create(userId, createDto);
  }

  /**
   * Get all integrations for current user
   */
  @Get()
  @ApiOperation({
    summary: 'Get all integrations',
    description: 'Retrieves all integrations for the current user with optional filtering',
  })
  @ApiQuery({ name: 'provider', enum: OAuthProvider, required: false })
  @ApiQuery({ name: 'status', enum: IntegrationStatus, required: false })
  @ApiQuery({ name: 'capability', enum: IntegrationCapability, required: false })
  @ApiQuery({ name: 'sortBy', type: String, required: false })
  @ApiQuery({ name: 'sortOrder', enum: ['asc', 'desc'], required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: 'Integrations retrieved successfully',
    type: [IntegrationResponseDto],
  })
  async findAll(
    @GetUser('id') userId: string,
    @Query(ValidationPipe) query: IntegrationQueryDto,
  ): Promise<IntegrationResponseDto[]> {
    this.logger.log(`Retrieving integrations for user ${userId}`);
    return this.integrationsService.findAll(userId, query);
  }

  /**
   * Get integration by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get integration by ID',
    description: 'Retrieves a specific integration by its ID',
  })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Integration retrieved successfully',
    type: IntegrationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<IntegrationResponseDto> {
    this.logger.log(`Retrieving integration ${id} for user ${userId}`);
    return this.integrationsService.findOne(id, userId);
  }

  /**
   * Update integration
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update integration',
    description: 'Updates an existing integration configuration',
  })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Integration updated successfully',
    type: IntegrationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  async update(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body(ValidationPipe) updateDto: UpdateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    this.logger.log(`Updating integration ${id} for user ${userId}`);
    return this.integrationsService.update(id, userId, updateDto);
  }

  /**
   * Delete integration
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete integration',
    description: 'Deletes an integration and revokes associated tokens',
  })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 204, description: 'Integration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async remove(@Param('id') id: string, @GetUser('id') userId: string): Promise<void> {
    this.logger.log(`Deleting integration ${id} for user ${userId}`);
    return this.integrationsService.remove(id, userId);
  }

  /**
   * Start OAuth authorization flow
   */
  @Post(':id/oauth/authorize')
  @ApiOperation({
    summary: 'Start OAuth authorization',
    description: 'Initiates OAuth 2.0 authorization flow for an integration',
  })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        authUrl: { type: 'string', description: 'OAuth authorization URL' },
        state: { type: 'string', description: 'OAuth state parameter' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiResponse({ status: 400, description: 'Integration already connected' })
  async startOAuthFlow(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body('redirectUri') redirectUri: string,
  ): Promise<{ authUrl: string; state: string }> {
    this.logger.log(`Starting OAuth flow for integration ${id}`);
    return this.integrationsService.startOAuthFlow(id, userId, redirectUri);
  }

  /**
   * Handle OAuth callback
   */
  @Post('oauth/callback')
  @ApiOperation({
    summary: 'Handle OAuth callback',
    description: 'Processes OAuth callback and exchanges authorization code for tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth flow completed successfully',
    type: IntegrationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid OAuth callback data' })
  async handleOAuthCallback(
    @Body(ValidationPipe) callbackDto: OAuthCallbackDto,
  ): Promise<IntegrationResponseDto> {
    this.logger.log(`Handling OAuth callback with state ${callbackDto.state}`);
    return this.integrationsService.handleOAuthCallback(callbackDto);
  }

  /**
   * Test integration connection
   */
  @Post(':id/test')
  @ApiOperation({
    summary: 'Test integration connection',
    description: 'Tests the connection to the third-party service',
  })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Connection test completed',
    type: HealthCheckResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiResponse({ status: 400, description: 'Integration not active' })
  async testConnection(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<HealthCheckResult> {
    this.logger.log(`Testing connection for integration ${id}`);
    return this.integrationsService.testConnection(id, userId);
  }

  /**
   * Get available providers
   */
  @Get('providers/available')
  @ApiOperation({
    summary: 'Get available providers',
    description: 'Retrieves a list of all available integration providers and their metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Available providers retrieved successfully',
    type: [ConnectorMetadataDto],
  })
  getAvailableProviders(): ConnectorMetadata[] {
    this.logger.log('Fetching available integration providers');
    return this.integrationsService.getAvailableProviders();
  }

  /**
   * Get analytics for an integration
   */
  @Get(':id/analytics')
  @ApiOperation({
    summary: 'Get integration analytics',
    description: 'Retrieves analytics data for a specific integration',
  })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Analytics data retrieved successfully',
    type: IntegrationAnalyticsDto,
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async getAnalytics(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<IntegrationAnalyticsDto> {
    this.logger.log(`Fetching analytics for integration ${id}`);
    return this.integrationsService.getAnalytics(id, userId);
  }

  /**
   * Refresh OAuth tokens for an integration
   */
  @Post(':id/refresh-tokens')
  @ApiOperation({
    summary: 'Refresh OAuth tokens',
    description: 'Manually triggers a refresh of the OAuth tokens for an integration',
  })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: IntegrationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async refreshTokens(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<IntegrationResponseDto> {
    this.logger.log(`Refreshing tokens for integration ${id}`);
    return this.integrationsService.refreshTokens(id, userId);
  }

  /**
   * Get overall system health for integrations
   */
  @Get('system/health')
  @ApiOperation({
    summary: 'Get system health',
    description: 'Provides a health check of the integrations subsystem',
  })
  @ApiResponse({
    status: 200,
    description: 'System health status retrieved successfully',
    type: SystemHealthDto,
  })
  getSystemHealth(): SystemHealthDto {
    this.logger.log('Checking integrations system health');
    return this.integrationsService.getSystemHealth();
  }
}
