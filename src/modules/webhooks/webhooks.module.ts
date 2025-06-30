import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookDeliveryService } from './delivery.service';
import { WebhookDelivery, WebhookDeliverySchema } from './entities/webhook-delivery.entity';
import { Webhook, WebhookSchema } from './entities/webhook.entity';
import { WebhookOwnershipGuard } from './guards/webhook-ownership.guard';
import { WebhookQueueService } from './queue/webhook-queue.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    // MongoDB schema registration
    MongooseModule.forFeature([
      { name: Webhook.name, schema: WebhookSchema },
      { name: WebhookDelivery.name, schema: WebhookDeliverySchema },
    ]),

    // JWT module for authentication
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'webhook-secret-key',
      signOptions: { expiresIn: '24h' },
    }),

    // Bull queue for webhook delivery processing
    BullModule.registerQueue({
      name: 'webhook-delivery',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryService, WebhookQueueService, WebhookOwnershipGuard],
  exports: [WebhooksService, WebhookDeliveryService, WebhookQueueService, MongooseModule],
})
export class WebhooksModule {}
