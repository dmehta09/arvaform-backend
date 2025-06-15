import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AppService } from './app.service';

/**
 * Interface for health check response
 * Provides type safety for the health endpoint response
 */
export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    status: string;
    connected: boolean;
  };
}

/**
 * Interface for application information response
 * Provides type safety for the root endpoint response
 */
export interface AppInfoResponse {
  name: string;
  description: string;
  version: string;
  environment: string;
  timestamp: string;
  endpoints: {
    health: string;
    docs: string;
  };
}

/**
 * Root application controller
 * Provides basic application information and health check functionality
 */
@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Root endpoint that provides basic application information
   * Useful for verifying the API is accessible and providing navigation links
   *
   * @returns Application information including version, environment, and available endpoints
   */
  @Get()
  @ApiOperation({
    summary: 'Get application information',
    description:
      'Returns basic information about the ArvaForm API including version, environment, and available endpoints',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'ArvaForm API' },
        description: {
          type: 'string',
          example: 'Form management platform backend API',
        },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'development' },
        timestamp: { type: 'string', example: '2025-06-14T10:30:00.000Z' },
        endpoints: {
          type: 'object',
          properties: {
            health: { type: 'string', example: '/api/health' },
            docs: { type: 'string', example: '/api/docs' },
          },
        },
      },
    },
  })
  @Throttle({ short: { limit: 20, ttl: 1000 } }) // Allow more requests for root endpoint
  getAppInfo(): AppInfoResponse {
    return this.appService.getAppInfo();
  }

  /**
   * Health check endpoint for monitoring and load balancer verification
   * Provides detailed system status including memory usage and database connectivity
   * Essential for production deployment and monitoring systems
   *
   * @returns Comprehensive health status information
   */
  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint',
    description:
      'Returns comprehensive health status of the application including system resources and database connectivity',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Health check successful',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2025-06-14T10:30:00.000Z' },
        environment: { type: 'string', example: 'development' },
        version: { type: 'string', example: '1.0.0' },
        uptime: { type: 'number', example: 3600.5 },
        memory: {
          type: 'object',
          properties: {
            used: { type: 'number', example: 134217728 },
            total: { type: 'number', example: 268435456 },
            percentage: { type: 'number', example: 50.0 },
          },
        },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'connected' },
            connected: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      'Service unhealthy - database connection issues or system problems',
  })
  @Throttle({ short: { limit: 30, ttl: 1000 } }) // Allow frequent health checks
  async getHealth(): Promise<HealthCheckResponse> {
    return await this.appService.getHealthStatus();
  }
}
