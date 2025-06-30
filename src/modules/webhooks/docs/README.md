# Webhook Delivery Engine Documentation

## Overview

The ArvaForm Webhook Delivery Engine is a robust, scalable system for delivering
real-time notifications to external endpoints when events occur within the
platform. Built with NestJS, Bull queues, and Redis, it ensures reliable
delivery with comprehensive retry logic, monitoring, and analytics.

## Architecture

### Core Components

1. **WebhookDeliveryService** - Core service handling webhook payload delivery
2. **WebhookQueueService** - Queue processor for reliable background delivery
3. **WebhookDelivery Entity** - Data model for tracking delivery attempts
4. **Delivery DTOs** - Type-safe data transfer objects for API operations

### Technology Stack

- **NestJS 11** - Application framework
- **Bull 4.16** - Redis-based queue system
- **Redis** - Message broker and caching
- **MongoDB** - Delivery tracking and analytics storage
- **Axios** - HTTP client for webhook requests

## Features

### 🚀 Reliable Delivery

- Queue-based processing with Redis
- Exponential backoff retry logic
- Circuit breaker pattern for failing endpoints
- Dead letter queue for persistent failures

### 📊 Comprehensive Analytics

- Delivery success/failure rates
- Response time tracking
- Event type analytics
- Daily/hourly delivery statistics
- Error code analysis

### 🔒 Security

- HMAC-SHA256 payload signing
- Configurable webhook secrets
- Request timeout protection
- Rate limiting support

### 🎯 Advanced Filtering

- Event type subscriptions
- Conditional webhook triggering
- Field mapping and transformation
- Test mode support

## Quick Start

### 1. Configuration

Set up your environment variables:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT Secret for webhook signing
JWT_SECRET=your_jwt_secret

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/arvaform
```

### 2. Creating a Webhook

```typescript
import { WebhooksService } from './webhooks.service';
import { WebhookEventType, WebhookHttpMethod } from './entities/webhook.entity';

// Create a webhook
const webhook = await webhooksService.createWebhook(userId, {
  name: 'Form Submission Webhook',
  url: 'https://api.example.com/webhooks/forms',
  method: WebhookHttpMethod.POST,
  events: [WebhookEventType.FORM_SUBMISSION],
  secret: 'your-webhook-secret',
  config: {
    maxAttempts: 5,
    timeoutMs: 30000,
    retryDelayMs: 1000,
    exponentialBackoff: true,
  },
});
```

### 3. Triggering Webhook Delivery

```typescript
import { WebhookDeliveryService, WebhookEventData } from './delivery.service';

// Create event data
const eventData: WebhookEventData = {
  eventType: WebhookEventType.FORM_SUBMISSION,
  eventId: 'evt_123',
  timestamp: new Date(),
  userId: 'user_123',
  formId: 'form_456',
  submissionId: 'sub_789',
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    message: 'Hello World!',
  },
};

// Queue webhook delivery
const deliveryIds =
  await webhookDeliveryService.queueWebhookDelivery(eventData);
console.log(`Queued ${deliveryIds.length} webhook deliveries`);
```

## API Endpoints

### Webhook Management

```http
# Create webhook
POST /webhooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "My Webhook",
  "url": "https://api.example.com/webhook",
  "events": ["form_submission"],
  "secret": "webhook-secret"
}

# List webhooks
GET /webhooks?page=1&limit=20

# Update webhook
PATCH /webhooks/:id

# Delete webhook
DELETE /webhooks/:id

# Test webhook
POST /webhooks/:id/test
```

### Delivery Management

```http
# Get deliveries
GET /webhooks/:id/deliveries?status=failed&page=1&limit=20

# Retry failed deliveries
POST /webhooks/deliveries/retry
{
  "deliveryIds": ["del_123", "del_456"],
  "forceRetry": true
}

# Get delivery statistics
GET /webhooks/deliveries/stats?startDate=2025-01-01&endDate=2025-01-31

# Get system health
GET /webhooks/deliveries/health
```

## Webhook Payload Format

### Standard Payload Structure

```json
{
  "id": "evt_1234567890",
  "event": "form_submission",
  "timestamp": "2025-01-16T10:30:00Z",
  "api_version": "2025-01-01",
  "data": {
    "object": "submission",
    "id": "sub_987654321",
    "form_id": "form_123456789",
    "user_id": "user_111222333",
    "submitted_at": "2025-01-16T10:30:00Z",
    "data": {
      "email": "user@example.com",
      "name": "John Doe",
      "message": "Hello from ArvaForm!"
    },
    "metadata": {
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "referrer": "https://example.com"
    }
  }
}
```

### Event Types

| Event Type           | Description                     | Payload Data       |
| -------------------- | ------------------------------- | ------------------ |
| `form_submission`    | New form submission received    | Submission object  |
| `submission_created` | Submission processing completed | Submission object  |
| `submission_updated` | Submission data modified        | Updated submission |
| `form_published`     | Form published/activated        | Form object        |
| `form_unpublished`   | Form deactivated                | Form object        |
| `user_created`       | New user registered             | User object        |
| `payment_completed`  | Payment processed successfully  | Payment object     |
| `payment_failed`     | Payment processing failed       | Payment error      |

## Security

### Webhook Signature Verification

Each webhook payload is signed using HMAC-SHA256. Verify the signature in your
endpoint:

```typescript
import * as crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return expectedSignature === signature;
}

// Express middleware example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const payload = JSON.stringify(req.body);

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook...
  res.status(200).json({ received: true });
});
```

### Headers Sent

```http
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-signature>
X-Webhook-Event: <event-type>
X-Webhook-Delivery: <delivery-id>
X-Webhook-Timestamp: <unix-timestamp>
User-Agent: ArvaForm-Webhooks/1.0
```

## Monitoring & Analytics

### Delivery Statistics

```typescript
// Get comprehensive delivery stats
const stats = await webhookDeliveryService.getDeliveryStats(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);

console.log('Success Rate:', stats.successRate);
console.log('Average Response Time:', stats.avgResponseTimeMs);
console.log('Total Deliveries:', stats.totalDeliveries);
```

### Health Monitoring

```typescript
// Check system health
const health = await webhookQueueService.getQueueStats();

console.log('Queue Health:', health.health);
console.log('Active Jobs:', health.active);
console.log('Failed Jobs:', health.failed);
```

## Error Handling

### Common Error Codes

| Code               | Description                      | Retry Strategy      |
| ------------------ | -------------------------------- | ------------------- |
| `TIMEOUT`          | Request timeout exceeded         | Exponential backoff |
| `CONNECTION_ERROR` | Network connection failed        | Immediate retry     |
| `HTTP_4XX`         | Client error (malformed request) | No retry            |
| `HTTP_5XX`         | Server error                     | Exponential backoff |
| `INVALID_URL`      | Malformed webhook URL            | No retry            |
| `SIGNATURE_ERROR`  | Signature generation failed      | Immediate retry     |

### Retry Logic

```typescript
// Default retry configuration
const retryConfig = {
  maxAttempts: 5,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  backoffMultiplier: 2,
  maxRetryDelayMs: 60000,
};

// Retry intervals: 1s, 2s, 4s, 8s, 16s
```

## Performance Optimization

### Queue Configuration

```typescript
// Optimized queue settings
BullModule.registerQueue({
  name: 'webhook-delivery',
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 successful jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});
```

### Rate Limiting

```typescript
// Configure per-webhook rate limiting
{
  config: {
    rateLimitPerMinute: 60,  // Max 60 requests per minute
    batchEnabled: true,      // Enable batch processing
    batchSize: 10,           // Process 10 webhooks together
    batchTimeoutSeconds: 60  // Batch timeout
  }
}
```

## Testing

### Unit Tests

```bash
# Run webhook tests
npm test src/modules/webhooks

# Run with coverage
npm run test:cov src/modules/webhooks
```

### Integration Tests

```typescript
describe('Webhook Delivery Integration', () => {
  it('should deliver webhook successfully', async () => {
    const webhook = await createTestWebhook();
    const eventData = createTestEventData();

    const deliveryIds =
      await webhookDeliveryService.queueWebhookDelivery(eventData);
    expect(deliveryIds).toHaveLength(1);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const delivery = await webhookDeliveryModel.findOne({
      deliveryId: deliveryIds[0],
    });
    expect(delivery.status).toBe(WebhookDeliveryStatus.DELIVERED);
  });
});
```

## Troubleshooting

### Common Issues

1. **Webhooks not firing**

   - Check webhook status (active/paused)
   - Verify event type subscriptions
   - Check webhook filters

2. **High failure rate**

   - Verify webhook URL accessibility
   - Check endpoint response time
   - Review webhook secret configuration

3. **Queue backlog**
   - Monitor Redis memory usage
   - Scale webhook worker processes
   - Optimize webhook endpoint performance

### Debug Logging

```typescript
// Enable debug logging
const logger = new Logger('WebhookDelivery');
logger.debug('Processing webhook delivery', {
  deliveryId,
  webhookUrl: webhook.url,
  eventType: eventData.eventType,
});
```

## Best Practices

### Webhook Endpoint Implementation

1. **Respond quickly** - Acknowledge receipt with 200 status
2. **Process asynchronously** - Queue heavy processing
3. **Implement idempotency** - Handle duplicate deliveries
4. **Validate signatures** - Always verify webhook authenticity
5. **Handle errors gracefully** - Return appropriate HTTP status codes

### Example Endpoint

```typescript
app.post('/webhook', async (req, res) => {
  try {
    // 1. Verify signature
    if (!verifySignature(req.body, req.headers['x-webhook-signature'])) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Acknowledge receipt immediately
    res.status(200).json({ received: true });

    // 3. Process asynchronously
    setImmediate(() => {
      processWebhookData(req.body);
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Support

For issues and questions:

- Check the [troubleshooting guide](#troubleshooting)
- Review webhook delivery logs in your dashboard
- Contact support with delivery ID for specific issues

---

**Last Updated:** January 2025 **Version:** 1.0 **Compatibility:** NestJS 11+,
Bull 4.16+, Redis 6+
