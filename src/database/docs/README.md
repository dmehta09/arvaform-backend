# Database Module Documentation

## Overview

The Database Module provides comprehensive MongoDB integration for the ArvaForm
backend using Mongoose ODM. It includes connection management, health
monitoring, schema organization, and a complete migration system.

## Architecture

```
src/database/
├── docs/                    # Documentation files
│   ├── README.md           # This file - main documentation
│   ├── CONFIGURATION.md    # Configuration guide
│   ├── MIGRATIONS.md       # Migration system guide
│   ├── SCHEMAS.md          # Schema management guide
│   └── TROUBLESHOOTING.md  # Common issues and solutions
├── migrations/             # Database migration files
│   └── index.ts           # Migration system implementation
├── schemas/               # Database schema definitions
│   └── index.ts          # Schema exports and utilities
├── database.module.ts     # Main database module
└── database.service.ts    # Database service and health checks
```

## Features

### ✅ Core Features

- **Connection Management**: Robust MongoDB connection with automatic retries
- **Health Monitoring**: Real-time health checks with detailed metrics
- **Configuration Management**: Environment-based configuration with validation
- **Schema Organization**: Centralized schema management system
- **Migration System**: Complete database migration framework
- **Development Tools**: Docker Compose setup for local development

### ✅ Production Ready

- Connection pooling with configurable limits
- Comprehensive error handling and logging
- Graceful startup and shutdown procedures
- Performance monitoring and optimization
- Security considerations and best practices

## Quick Start

### 1. Environment Setup

Create your `.env.local` file with database configuration:

```bash
# Basic MongoDB connection
MONGODB_URI=mongodb://localhost:27017/arvaform

# Or with authentication
MONGODB_URI=mongodb://admin:password123@localhost:27017/arvaform?authSource=admin

# Connection pool settings (optional)
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2
```

### 2. Start Local Development Environment

```bash
# Start MongoDB with Docker Compose
docker-compose -f docker-compose.dev.yml up -d mongodb

# Or start all services including Mongo Express
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Import Database Module

The DatabaseModule is already imported globally in `app.module.ts`, so you can
use it anywhere in your application:

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class YourService {
  constructor(private readonly databaseService: DatabaseService) {}

  async checkDatabaseHealth() {
    return await this.databaseService.checkHealth();
  }
}
```

## Database Service Usage

### Health Checks

```typescript
// Get current health status
const isHealthy = this.databaseService.healthy;

// Perform detailed health check
const healthInfo = await this.databaseService.checkHealth();
console.log('Health Status:', healthInfo);
```

### Connection Information

```typescript
// Get database connection
const connection = this.databaseService.databaseConnection;

// Get configuration
const config = this.databaseService.config;
```

### Connection Statistics

```typescript
// Get connection statistics
const stats = await this.databaseService.getConnectionStats();
console.log('Active connections:', stats.connectionCount);
console.log('Database name:', stats.dbName);
```

## Schema Management

### Creating a New Schema

1. Create your schema file in `src/database/schemas/`:

```typescript
// src/database/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ createdAt: -1 });
```

2. Export it in `src/database/schemas/index.ts`:

```typescript
export { User, UserSchema } from './user.schema';
```

3. Register in your feature module:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../database/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  // ... rest of module
})
export class UsersModule {}
```

## Migration System

### Creating a Migration

```typescript
// src/database/migrations/002_add_user_indexes.ts
import { Migration } from './index';
import { Connection } from 'mongoose';

export const addUserIndexesMigration: Migration = {
  name: '002_add_user_indexes',
  version: '1.1.0',
  description: 'Add performance indexes to users collection',
  createdAt: new Date('2025-06-15'),

  async up(connection: Connection): Promise<void> {
    const collection = connection.collection('users');

    // Add indexes
    await collection.createIndex({ email: 1 }, { unique: true });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ status: 1 });
  },

  async down(connection: Connection): Promise<void> {
    const collection = connection.collection('users');

    // Remove indexes
    await collection.dropIndex({ email: 1 });
    await collection.dropIndex({ createdAt: -1 });
    await collection.dropIndex({ status: 1 });
  },
};
```

### Running Migrations

```typescript
import { DatabaseService } from '../database/database.service';
import { MigrationRunner } from '../database/migrations';

// In your service or CLI command
const connection = this.databaseService.databaseConnection;
const migrationRunner = new MigrationRunner(connection);

// Register your migrations
migrationRunner.registerMigration(addUserIndexesMigration);

// Run pending migrations
await migrationRunner.runPendingMigrations();
```

## Configuration Options

### Environment Variables

| Variable                        | Default                              | Description                 |
| ------------------------------- | ------------------------------------ | --------------------------- |
| `MONGODB_URI`                   | `mongodb://localhost:27017/arvaform` | MongoDB connection string   |
| `MONGODB_MAX_POOL_SIZE`         | `10`                                 | Maximum connections in pool |
| `MONGODB_MIN_POOL_SIZE`         | `2`                                  | Minimum connections in pool |
| `MONGODB_HEALTH_CHECK_INTERVAL` | `30000`                              | Health check interval (ms)  |
| `MONGODB_DEBUG`                 | `true` (dev)                         | Enable debug logging        |

See [CONFIGURATION.md](./CONFIGURATION.md) for complete configuration options.

## Monitoring and Health Checks

### Health Check Response

```typescript
interface DatabaseHealth {
  status: 'healthy' | 'unhealthy' | 'connecting' | 'disconnected';
  message: string;
  timestamp: Date;
  connectionCount?: number;
  uptime?: number;
}
```

### Health Check Endpoint

Create a health check endpoint in your controller:

```typescript
@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('database')
  async checkDatabase() {
    return await this.databaseService.checkHealth();
  }
}
```

## Development Tools

### Docker Compose Services

- **MongoDB**: Primary database service on port 27017
- **Mongo Express**: Database admin UI on port 8081
- **Redis**: Caching service on port 6379 (optional)

### Accessing Services

```bash
# MongoDB CLI
mongosh mongodb://admin:password123@localhost:27017/arvaform

# Mongo Express UI
open http://localhost:8081
# Login: admin / admin123

# Redis CLI
redis-cli -h localhost -p 6379 -a redis123
```

## Best Practices

### 1. Schema Design

- Use TypeScript interfaces that match your schemas
- Add proper indexes for query performance
- Use validation and default values appropriately
- Consider embedding vs referencing based on access patterns

### 2. Connection Management

- Always use the DatabaseService for health checks
- Monitor connection pool usage in production
- Set appropriate timeouts for your use case

### 3. Error Handling

- Catch and handle database connection errors gracefully
- Use proper logging for debugging production issues
- Implement retry logic for transient failures

### 4. Performance

- Use indexes appropriately for your queries
- Monitor query performance with `explain()`
- Consider read preferences for read-heavy workloads
- Use connection pooling efficiently

## Security Considerations

### 1. Authentication

- Always use authentication in production
- Use strong passwords and connection strings
- Consider using MongoDB Atlas for managed security

### 2. Network Security

- Restrict database access to application servers only
- Use VPC or private networks when possible
- Enable SSL/TLS for connections

### 3. Data Protection

- Encrypt sensitive data at rest
- Use appropriate field-level encryption for PII
- Implement proper backup and disaster recovery

## Troubleshooting

For common issues and solutions, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Related Documentation

- [Configuration Guide](./CONFIGURATION.md) - Detailed configuration options
- [Migration System](./MIGRATIONS.md) - Complete migration guide
- [Schema Management](./SCHEMAS.md) - Schema design patterns
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

## Support

For issues related to the database module:

1. Check the [troubleshooting guide](./TROUBLESHOOTING.md)
2. Review the application logs for connection errors
3. Verify your environment configuration
4. Test database connectivity with MongoDB CLI tools
