/**
 * Integrations Module
 * Module configuration for the integration framework
 *
 * @author ArvaForm Integration Team
 * @since 2025-01-14
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Integration, IntegrationSchema } from './entities/integration.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { OAuthService } from './services/oauth.service';

/**
 * Integration framework module
 * Provides OAuth 2.0 authentication, connector architecture, and integration management
 */
@Module({
  imports: [
    // MongoDB schema registration
    MongooseModule.forFeature([{ name: Integration.name, schema: IntegrationSchema }]),

    // Configuration support for OAuth credentials
    ConfigModule,

    // Schedule module for background tasks (token refresh, health checks)
    ScheduleModule.forRoot(),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, OAuthService],
  exports: [IntegrationsService, OAuthService],
})
export class IntegrationsModule {}
