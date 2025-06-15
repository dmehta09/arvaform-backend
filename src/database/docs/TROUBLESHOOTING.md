# Database Troubleshooting Guide

## Overview

This guide provides solutions to common database-related issues you might
encounter when working with the ArvaForm database module. Issues are organized
by category with step-by-step resolution instructions.

## Connection Issues

### 1. "Server selection timed out"

**Error Message:**

```
MongoTimeoutError: Server selection timed out after 30000 ms
```

**Possible Causes:**

- MongoDB server is not running
- Incorrect connection string
- Network connectivity issues
- Firewall blocking connection

**Solutions:**

1. **Check MongoDB Service Status:**

   ```bash
   # Check if MongoDB is running (macOS/Linux)
   brew services list | grep mongodb
   systemctl status mongod

   # Start MongoDB if not running
   brew services start mongodb-community
   sudo systemctl start mongod
   ```

2. **Verify Connection String:**

   ```bash
   # Test connection with MongoDB CLI
   mongosh "mongodb://admin:password123@localhost:27017/arvaform?authSource=admin"
   ```

3. **Check Docker Setup:**

   ```bash
   # Check if MongoDB container is running
   docker ps | grep mongodb

   # Start MongoDB container
   docker-compose -f docker-compose.dev.yml up -d mongodb

   # Check container logs
   docker logs arvaform-mongodb
   ```

4. **Network Troubleshooting:**

   ```bash
   # Test port connectivity
   telnet localhost 27017
   nc -zv localhost 27017

   # Check firewall settings
   sudo ufw status
   ```

### 2. "Authentication failed"

**Error Message:**

```
MongoServerError: Authentication failed
```

**Possible Causes:**

- Incorrect username/password
- Wrong authentication database
- User doesn't have required permissions

**Solutions:**

1. **Verify Credentials:**

   ```bash
   # Connect with correct credentials
   mongosh mongodb://admin:password123@localhost:27017/admin

   # List users in admin database
   use admin
   db.getUsers()
   ```

2. **Create Database User:**

   ```javascript
   // Connect to admin database
   use admin

   // Create application user
   db.createUser({
     user: "arvaform_user",
     pwd: "secure_password",
     roles: [
       { role: "readWrite", db: "arvaform" },
       { role: "dbAdmin", db: "arvaform" }
     ]
   })
   ```

3. **Update Connection String:**
   ```bash
   # Use correct authentication database
   MONGODB_URI=mongodb://arvaform_user:secure_password@localhost:27017/arvaform?authSource=admin
   ```

### 3. "Connection was forced closed"

**Error Message:**

```
MongoNetworkError: connection was forcibly closed
```

**Possible Causes:**

- Connection pool exhaustion
- Network instability
- MongoDB server restart

**Solutions:**

1. **Adjust Connection Pool Settings:**

   ```bash
   # Increase pool size
   MONGODB_MAX_POOL_SIZE=20
   MONGODB_MIN_POOL_SIZE=5

   # Increase timeouts
   MONGODB_SERVER_SELECTION_TIMEOUT=45000
   MONGODB_SOCKET_TIMEOUT=60000
   ```

2. **Check Application for Connection Leaks:**
   ```typescript
   // Ensure connections are properly closed
   async someFunction() {
     try {
       const result = await Model.find({});
       return result;
     } catch (error) {
       console.error('Database error:', error);
       throw error;
     }
     // Mongoose handles connection cleanup automatically
   }
   ```

## Performance Issues

### 1. Slow Queries

**Symptoms:**

- High response times
- Database timeouts
- High CPU usage

**Diagnosis:**

1. **Enable Query Profiling:**

   ```javascript
   // Connect to MongoDB
   use arvaform

   // Enable profiling for slow queries (>100ms)
   db.setProfilingLevel(2, { slowms: 100 })

   // View profiler results
   db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()
   ```

2. **Explain Query Performance:**
   ```javascript
   // Analyze query execution
   db.forms.find({ userId: ObjectId('...') }).explain('executionStats');
   ```

**Solutions:**

1. **Add Missing Indexes:**

   ```javascript
   // Check existing indexes
   db.forms.getIndexes();

   // Add compound index
   db.forms.createIndex({ userId: 1, createdAt: -1 });

   // Add text search index
   db.forms.createIndex({ title: 'text', description: 'text' });
   ```

2. **Optimize Queries:**

   ```typescript
   // Before: Inefficient query
   const forms = await Form.find({}).populate('userId');

   // After: Optimized query with projection
   const forms = await Form.find({}, 'title status createdAt')
     .populate('userId', 'name email')
     .sort({ createdAt: -1 })
     .limit(20);
   ```

### 2. Memory Usage Issues

**Symptoms:**

- High memory consumption
- Out of memory errors
- Connection pool exhaustion

**Solutions:**

1. **Optimize Connection Pool:**

   ```bash
   # Reduce pool size for low-traffic apps
   MONGODB_MAX_POOL_SIZE=5
   MONGODB_MAX_IDLE_TIME=30000
   ```

2. **Use Aggregation Pipelines for Large Datasets:**

   ```typescript
   // Instead of loading all documents
   const forms = await Form.find({});

   // Use aggregation with $limit
   const forms = await Form.aggregate([
     { $match: { status: 'published' } },
     { $sort: { createdAt: -1 } },
     { $limit: 100 },
     { $project: { title: 1, status: 1, createdAt: 1 } },
   ]);
   ```

## Schema and Validation Issues

### 1. Validation Errors

**Error Message:**

```
ValidationError: User validation failed: email: Path `email` is required
```

**Solutions:**

1. **Check Required Fields:**

   ```typescript
   // Ensure all required fields are provided
   const userData = {
     email: 'user@example.com',
     name: 'User Name',
     // Don't forget required fields
   };

   const user = new User(userData);
   await user.save();
   ```

2. **Handle Validation Errors:**
   ```typescript
   try {
     await user.save();
   } catch (error) {
     if (error.name === 'ValidationError') {
       const errors = Object.values(error.errors).map(err => err.message);
       console.log('Validation errors:', errors);
     }
     throw error;
   }
   ```

### 2. Index Creation Failures

**Error Message:**

```
MongoError: Index with name "email_1" already exists with different options
```

**Solutions:**

1. **Drop and Recreate Index:**

   ```javascript
   // Drop existing index
   db.users.dropIndex('email_1');

   // Create new index with correct options
   db.users.createIndex({ email: 1 }, { unique: true });
   ```

2. **Check for Index Conflicts:**

   ```javascript
   // List all indexes
   db.users.getIndexes();

   // Find problematic index
   db.users.dropIndex({ email: 1 });
   ```

## Migration Issues

### 1. Migration Failures

**Error Message:**

```
Migration failed: Cannot create index on collection with existing data
```

**Solutions:**

1. **Handle Existing Data:**

   ```typescript
   async up(connection: Connection): Promise<void> {
     const db = connection.db;

     // Check if data exists
     const count = await db.collection('users').countDocuments();
     if (count > 0) {
       // Clean up invalid data first
       await db.collection('users').deleteMany({ email: null });
     }

     // Then create index
     await db.collection('users').createIndex({ email: 1 }, { unique: true });
   }
   ```

2. **Use Batch Processing:**

   ```typescript
   async migrateDataInBatches(collection: any, batchSize = 1000): Promise<void> {
     let processed = 0;
     let batch = await collection.find({}).limit(batchSize).toArray();

     while (batch.length > 0) {
       const bulkOps = batch.map(doc => ({
         updateOne: {
           filter: { _id: doc._id },
           update: { $set: { version: 2 } }
         }
       }));

       await collection.bulkWrite(bulkOps);
       processed += batch.length;

       batch = await collection.find({}).skip(processed).limit(batchSize).toArray();
     }
   }
   ```

### 2. Rollback Issues

**Error Message:**

```
Rollback failed: Cannot revert schema changes
```

**Solutions:**

1. **Manual Rollback:**

   ```javascript
   // Manually revert changes
   use arvaform

   // Remove new fields
   db.users.updateMany({}, { $unset: { newField: "" } })

   // Drop new indexes
   db.users.dropIndex("newField_1")
   ```

2. **Create Rollback-Safe Migrations:**
   ```typescript
   async down(connection: Connection): Promise<void> {
     try {
       // Attempt automated rollback
       await this.automaticRollback(connection);
     } catch (error) {
       console.error('Automatic rollback failed, manual intervention required');
       console.error('Error:', error.message);
       // Log manual steps needed
       console.log('Manual rollback steps:');
       console.log('1. Connect to database');
       console.log('2. Run: db.users.dropIndex("email_1")');
     }
   }
   ```

## Development Environment Issues

### 1. Docker Compose Problems

**Symptoms:**

- MongoDB container won't start
- Connection refused errors
- Data not persisting

**Solutions:**

1. **Clean Docker Environment:**

   ```bash
   # Stop all containers
   docker-compose -f docker-compose.dev.yml down

   # Remove volumes (WARNING: This deletes data)
   docker-compose -f docker-compose.dev.yml down -v

   # Rebuild and start
   docker-compose -f docker-compose.dev.yml up --build -d
   ```

2. **Check Container Logs:**

   ```bash
   # View MongoDB logs
   docker logs arvaform-mongodb

   # Follow logs in real-time
   docker logs -f arvaform-mongodb
   ```

3. **Verify Port Binding:**

   ```bash
   # Check if port is available
   lsof -i :27017

   # Kill process using port
   kill -9 $(lsof -t -i:27017)
   ```

### 2. Environment Variable Issues

**Error Message:**

```
Configuration error: MONGODB_URI is required
```

**Solutions:**

1. **Check Environment File:**

   ```bash
   # Verify .env.local exists
   ls -la .env.local

   # Check file contents
   cat .env.local | grep MONGODB
   ```

2. **Load Environment Variables:**

   ```bash
   # Source environment file
   source .env.local

   # Verify variables are loaded
   echo $MONGODB_URI
   ```

3. **Debug Configuration Loading:**
   ```typescript
   // Add debug logging to configuration
   console.log('Environment:', process.env.NODE_ENV);
   console.log('MongoDB URI:', process.env.MONGODB_URI);
   console.log('All env vars:', process.env);
   ```

## Health Check Issues

### 1. Health Check Failures

**Error Message:**

```
Database health check failed: unhealthy
```

**Solutions:**

1. **Check Health Check Logic:**

   ```typescript
   // Test health check manually
   const health = await databaseService.checkHealth();
   console.log('Health status:', health);
   ```

2. **Increase Health Check Timeout:**

   ```bash
   # Increase timeout for slow connections
   MONGODB_HEALTH_CHECK_INTERVAL=60000
   ```

3. **Disable Health Checks Temporarily:**
   ```bash
   # Disable health checks for debugging
   MONGODB_HEALTH_CHECK_INTERVAL=0
   ```

## Debugging Tools

### 1. Enable Debug Logging

```bash
# Enable Mongoose debug mode
DEBUG=mongoose:*
MONGODB_DEBUG=true

# Enable all MongoDB debugging
DEBUG=mongodb:*,mongoose:*
```

### 2. MongoDB Compass

```bash
# Connect with MongoDB Compass GUI tool
mongodb://admin:password123@localhost:27017/?authSource=admin
```

### 3. Database Profiling

```javascript
// Enable profiling for all operations
db.setProfilingLevel(2);

// View recent operations
db.system.profile.find().limit(10).sort({ ts: -1 }).pretty();

// Disable profiling
db.setProfilingLevel(0);
```

## Common Error Messages Reference

| Error                            | Cause                    | Solution                       |
| -------------------------------- | ------------------------ | ------------------------------ |
| `Server selection timed out`     | MongoDB not running      | Start MongoDB service          |
| `Authentication failed`          | Wrong credentials        | Check username/password        |
| `Connection was forcibly closed` | Network issues           | Check connection pool settings |
| `Index already exists`           | Duplicate index creation | Drop existing index first      |
| `Validation failed`              | Missing required fields  | Provide all required data      |
| `Cannot connect to server`       | Wrong host/port          | Verify connection string       |
| `Database command failed`        | Permission issues        | Check user permissions         |

## Getting Help

If you're still experiencing issues after trying these solutions:

1. **Check Application Logs:**

   ```bash
   # View recent logs
   tail -f logs/application.log

   # Search for specific errors
   grep -i "mongodb\|mongoose" logs/application.log
   ```

2. **Enable Verbose Logging:**

   ```bash
   NODE_ENV=development
   DEBUG=*
   MONGODB_DEBUG=true
   ```

3. **Test Database Connection Independently:**

   ```bash
   # Test with MongoDB shell
   mongosh "your-connection-string"

   # Test with Node.js script
   node -e "require('mongoose').connect('your-uri').then(() => console.log('Connected')).catch(console.error)"
   ```

4. **Check System Resources:**

   ```bash
   # Check disk space
   df -h

   # Check memory usage
   free -m

   # Check MongoDB process
   ps aux | grep mongod
   ```

For additional support, refer to the [main documentation](./README.md) or check
the MongoDB and Mongoose official documentation.
