# Database Configuration Guide

## Overview

This guide covers all configuration options available for the ArvaForm database
module, including environment variables, connection options, and performance
tuning parameters.

## Environment Variables

### Required Variables

| Variable      | Description               | Example                              |
| ------------- | ------------------------- | ------------------------------------ |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/arvaform` |

### Optional Variables

| Variable                           | Default       | Description                        | Example      |
| ---------------------------------- | ------------- | ---------------------------------- | ------------ |
| `MONGODB_MAX_POOL_SIZE`            | `10`          | Maximum connections in pool        | `15`         |
| `MONGODB_MIN_POOL_SIZE`            | `2`           | Minimum connections in pool        | `3`          |
| `MONGODB_SERVER_SELECTION_TIMEOUT` | `30000`       | Server selection timeout (ms)      | `45000`      |
| `MONGODB_SOCKET_TIMEOUT`           | `45000`       | Socket timeout (ms)                | `60000`      |
| `MONGODB_CONNECT_TIMEOUT`          | `30000`       | Connection timeout (ms)            | `40000`      |
| `MONGODB_HEALTH_CHECK_INTERVAL`    | `30000`       | Health check interval (ms)         | `60000`      |
| `MONGODB_MAX_IDLE_TIME`            | `30000`       | Max idle time for connections (ms) | `45000`      |
| `MONGODB_DEBUG`                    | `false`       | Enable debug logging               | `true`       |
| `NODE_ENV`                         | `development` | Environment mode                   | `production` |

## Connection String Examples

### Local Development

```bash
# Basic local connection
MONGODB_URI=mongodb://localhost:27017/arvaform

# With authentication
MONGODB_URI=mongodb://admin:password123@localhost:27017/arvaform?authSource=admin

# Docker Compose setup
MONGODB_URI=mongodb://admin:password123@mongodb:27017/arvaform?authSource=admin
```

### Production Examples

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/arvaform?retryWrites=true&w=majority

# Replica Set
MONGODB_URI=mongodb://user:pass@host1:27017,host2:27017,host3:27017/arvaform?replicaSet=rs0

# With SSL
MONGODB_URI=mongodb://user:pass@host:27017/arvaform?ssl=true&sslValidate=true
```

## Configuration File Structure

The database configuration is loaded from `src/config/database.config.ts`:

```typescript
export interface DatabaseConfig {
  uri: string;
  options: {
    maxPoolSize: number;
    minPoolSize: number;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
    connectTimeoutMS: number;
    maxIdleTimeMS: number;
    retryWrites: boolean;
    retryReads: boolean;
  };
  healthCheck: {
    interval: number;
    enabled: boolean;
  };
  debug: boolean;
}
```

## Performance Tuning

### Connection Pool Settings

```bash
# For high-traffic applications
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=5

# For low-traffic applications
MONGODB_MAX_POOL_SIZE=5
MONGODB_MIN_POOL_SIZE=1
```

### Timeout Configuration

```bash
# For slow networks or high latency
MONGODB_SERVER_SELECTION_TIMEOUT=60000
MONGODB_SOCKET_TIMEOUT=90000
MONGODB_CONNECT_TIMEOUT=60000

# For fast, local networks
MONGODB_SERVER_SELECTION_TIMEOUT=10000
MONGODB_SOCKET_TIMEOUT=15000
MONGODB_CONNECT_TIMEOUT=10000
```

### Health Check Settings

```bash
# Frequent health checks (development)
MONGODB_HEALTH_CHECK_INTERVAL=15000

# Less frequent (production)
MONGODB_HEALTH_CHECK_INTERVAL=60000

# Disable health checks
MONGODB_HEALTH_CHECK_INTERVAL=0
```

## Environment-Specific Configurations

### Development Environment (.env.local)

```bash
NODE_ENV=development
MONGODB_URI=mongodb://admin:password123@localhost:27017/arvaform?authSource=admin
MONGODB_MAX_POOL_SIZE=5
MONGODB_MIN_POOL_SIZE=1
MONGODB_DEBUG=true
MONGODB_HEALTH_CHECK_INTERVAL=30000
```

### Staging Environment

```bash
NODE_ENV=staging
MONGODB_URI=mongodb+srv://staging_user:password@staging-cluster.mongodb.net/arvaform_staging
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2
MONGODB_DEBUG=false
MONGODB_HEALTH_CHECK_INTERVAL=60000
```

### Production Environment

```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://prod_user:secure_password@production-cluster.mongodb.net/arvaform
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=5
MONGODB_DEBUG=false
MONGODB_HEALTH_CHECK_INTERVAL=120000
MONGODB_SERVER_SELECTION_TIMEOUT=45000
MONGODB_SOCKET_TIMEOUT=60000
```

## Security Configuration

### Authentication

```bash
# Database user with limited permissions
MONGODB_URI=mongodb://app_user:secure_password@host:27017/arvaform

# With authentication database
MONGODB_URI=mongodb://app_user:secure_password@host:27017/arvaform?authSource=admin
```

### SSL/TLS Configuration

```bash
# Enable SSL
MONGODB_URI=mongodb://user:pass@host:27017/arvaform?ssl=true

# SSL with certificate validation
MONGODB_URI=mongodb://user:pass@host:27017/arvaform?ssl=true&sslValidate=true

# MongoDB Atlas (SSL enabled by default)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/arvaform
```

### Connection Security Options

```bash
# Specify allowed authentication mechanisms
MONGODB_URI=mongodb://user:pass@host:27017/arvaform?authMechanism=SCRAM-SHA-256

# Read preference for security
MONGODB_URI=mongodb://user:pass@host:27017/arvaform?readPreference=secondary
```

## Configuration Validation

The database configuration is validated at startup. Invalid configurations will
prevent the application from starting.

### Common Validation Errors

1. **Invalid URI Format**

   ```
   Error: Invalid MongoDB URI format
   ```

   Solution: Ensure the URI follows the correct MongoDB connection string
   format.

2. **Connection Timeout**

   ```
   Error: Server selection timed out
   ```

   Solution: Check network connectivity and increase timeout values.

3. **Authentication Failed**
   ```
   Error: Authentication failed
   ```
   Solution: Verify username, password, and authentication database.

## Monitoring Configuration

### Health Check Configuration

```typescript
// Enable detailed health monitoring
export const healthCheckConfig = {
  interval: parseInt(process.env.MONGODB_HEALTH_CHECK_INTERVAL) || 30000,
  enabled: process.env.MONGODB_HEALTH_CHECK_INTERVAL !== '0',
  timeout: 5000,
  retries: 3,
};
```

### Logging Configuration

```bash
# Enable MongoDB driver debug logging
MONGODB_DEBUG=true

# Log levels
DEBUG=mongoose:*
```

## Docker Configuration

### Docker Compose Variables

```yaml
# docker-compose.dev.yml
services:
  mongodb:
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: arvaform
```

### Application Container

```bash
# Environment variables for Docker container
MONGODB_URI=mongodb://admin:password123@mongodb:27017/arvaform?authSource=admin
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2
```

## Troubleshooting Configuration Issues

### Common Configuration Problems

1. **Connection Pool Exhaustion**

   - Increase `MONGODB_MAX_POOL_SIZE`
   - Check for connection leaks in application code

2. **Slow Query Performance**

   - Reduce `MONGODB_SOCKET_TIMEOUT`
   - Add appropriate database indexes

3. **Frequent Disconnections**

   - Increase `MONGODB_SERVER_SELECTION_TIMEOUT`
   - Check network stability

4. **Memory Issues**
   - Reduce `MONGODB_MAX_POOL_SIZE`
   - Implement connection cleanup

### Debug Configuration

```bash
# Enable all MongoDB debugging
DEBUG=mongodb:*,mongoose:*
MONGODB_DEBUG=true

# Verbose connection logging
MONGODB_URI=mongodb://user:pass@host:27017/arvaform?w=majority&journal=true&logLevel=debug
```

## Configuration Best Practices

### 1. Environment Separation

- Use different databases for dev/staging/production
- Never use production credentials in development
- Use environment-specific connection strings

### 2. Security

- Use strong passwords and rotate them regularly
- Limit database user permissions to minimum required
- Enable SSL/TLS for production connections

### 3. Performance

- Tune connection pool based on application load
- Monitor connection usage and adjust accordingly
- Use appropriate timeout values for your network

### 4. Monitoring

- Enable health checks in production
- Set up alerts for connection failures
- Monitor connection pool utilization

## Configuration Examples by Use Case

### High-Availability Setup

```bash
MONGODB_URI=mongodb://user:pass@host1:27017,host2:27017,host3:27017/arvaform?replicaSet=rs0&readPreference=secondaryPreferred
MONGODB_MAX_POOL_SIZE=25
MONGODB_MIN_POOL_SIZE=5
MONGODB_SERVER_SELECTION_TIMEOUT=30000
```

### Development/Testing

```bash
MONGODB_URI=mongodb://localhost:27017/arvaform_test
MONGODB_MAX_POOL_SIZE=3
MONGODB_MIN_POOL_SIZE=1
MONGODB_DEBUG=true
```

### Microservices Architecture

```bash
MONGODB_URI=mongodb+srv://service_user:pass@cluster.mongodb.net/arvaform
MONGODB_MAX_POOL_SIZE=15
MONGODB_MIN_POOL_SIZE=3
MONGODB_HEALTH_CHECK_INTERVAL=45000
```

For more configuration help, see the
[troubleshooting guide](./TROUBLESHOOTING.md).
