# Database Migration System

## Overview

The ArvaForm database migration system provides a robust framework for managing
database schema changes, data transformations, and version control. It ensures
consistent database states across environments and enables safe rollbacks when
needed.

## Migration System Architecture

```
src/database/migrations/
├── index.ts                 # Migration framework core
├── 001_initial_indexes.ts   # Initial database indexes
├── 002_user_schema.ts       # User schema updates
├── 003_form_schema.ts       # Form schema updates
└── README.md               # Migration guidelines
```

## Migration Interface

```typescript
export interface Migration {
  name: string; // Unique migration name
  version: string; // Application version
  description: string; // Human-readable description
  createdAt: Date; // Migration creation date
  up(connection: Connection): Promise<void>; // Forward migration
  down(connection: Connection): Promise<void>; // Rollback migration
}
```

## Creating Migrations

### 1. Basic Migration Template

```typescript
// src/database/migrations/004_add_form_templates.ts
import { Migration } from './index';
import { Connection } from 'mongoose';

export const addFormTemplatesMigration: Migration = {
  name: '004_add_form_templates',
  version: '1.2.0',
  description: 'Add form templates collection with indexes',
  createdAt: new Date('2025-06-15'),

  async up(connection: Connection): Promise<void> {
    const db = connection.db;

    // Create collection if it doesn't exist
    const collections = await db
      .listCollections({ name: 'formtemplates' })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection('formtemplates', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'template', 'createdAt'],
            properties: {
              name: { bsonType: 'string' },
              template: { bsonType: 'object' },
              createdAt: { bsonType: 'date' },
            },
          },
        },
      });
    }

    // Add indexes
    await db
      .collection('formtemplates')
      .createIndex({ name: 1 }, { unique: true });
    await db.collection('formtemplates').createIndex({ createdAt: -1 });
    await db
      .collection('formtemplates')
      .createIndex({ 'template.category': 1 });
  },

  async down(connection: Connection): Promise<void> {
    const db = connection.db;

    // Drop indexes
    await db.collection('formtemplates').dropIndex({ name: 1 });
    await db.collection('formtemplates').dropIndex({ createdAt: -1 });
    await db.collection('formtemplates').dropIndex({ 'template.category': 1 });

    // Drop collection
    await db.dropCollection('formtemplates');
  },
};
```

### 2. Data Migration Example

```typescript
// src/database/migrations/005_migrate_user_roles.ts
import { Migration } from './index';
import { Connection } from 'mongoose';

export const migrateUserRolesMigration: Migration = {
  name: '005_migrate_user_roles',
  version: '1.3.0',
  description: 'Migrate user roles from string to object format',
  createdAt: new Date('2025-06-15'),

  async up(connection: Connection): Promise<void> {
    const db = connection.db;
    const users = db.collection('users');

    // Find users with old role format
    const usersToUpdate = await users
      .find({
        role: { $type: 'string' },
      })
      .toArray();

    // Update each user
    for (const user of usersToUpdate) {
      const newRole = {
        name: user.role,
        permissions: this.getDefaultPermissions(user.role),
        assignedAt: new Date(),
        assignedBy: 'system',
      };

      await users.updateOne({ _id: user._id }, { $set: { role: newRole } });
    }

    console.log(`Migrated ${usersToUpdate.length} user roles`);
  },

  async down(connection: Connection): Promise<void> {
    const db = connection.db;
    const users = db.collection('users');

    // Revert to string format
    const usersToRevert = await users
      .find({
        'role.name': { $exists: true },
      })
      .toArray();

    for (const user of usersToRevert) {
      await users.updateOne(
        { _id: user._id },
        { $set: { role: user.role.name } },
      );
    }

    console.log(`Reverted ${usersToRevert.length} user roles`);
  },

  getDefaultPermissions(roleName: string): string[] {
    const permissions = {
      admin: ['read', 'write', 'delete', 'manage'],
      user: ['read', 'write'],
      viewer: ['read'],
    };
    return permissions[roleName] || ['read'];
  },
};
```

### 3. Index Management Migration

```typescript
// src/database/migrations/006_optimize_query_indexes.ts
import { Migration } from './index';
import { Connection } from 'mongoose';

export const optimizeQueryIndexesMigration: Migration = {
  name: '006_optimize_query_indexes',
  version: '1.4.0',
  description: 'Add compound indexes for common query patterns',
  createdAt: new Date('2025-06-15'),

  async up(connection: Connection): Promise<void> {
    const db = connection.db;

    // Forms collection indexes
    await db
      .collection('forms')
      .createIndex(
        { userId: 1, createdAt: -1 },
        { name: 'user_forms_by_date' },
      );

    await db
      .collection('forms')
      .createIndex(
        { status: 1, updatedAt: -1 },
        { name: 'forms_by_status_updated' },
      );

    // Submissions collection indexes
    await db
      .collection('submissions')
      .createIndex(
        { formId: 1, submittedAt: -1 },
        { name: 'form_submissions_by_date' },
      );

    await db
      .collection('submissions')
      .createIndex({ userId: 1, formId: 1 }, { name: 'user_form_submissions' });

    // Users collection indexes
    await db
      .collection('users')
      .createIndex({ email: 1, status: 1 }, { name: 'active_users_by_email' });
  },

  async down(connection: Connection): Promise<void> {
    const db = connection.db;

    // Drop the indexes we created
    await db.collection('forms').dropIndex('user_forms_by_date');
    await db.collection('forms').dropIndex('forms_by_status_updated');
    await db.collection('submissions').dropIndex('form_submissions_by_date');
    await db.collection('submissions').dropIndex('user_form_submissions');
    await db.collection('users').dropIndex('active_users_by_email');
  },
};
```

## Running Migrations

### 1. Using the Migration Runner

```typescript
import { MigrationRunner } from './migrations';
import { DatabaseService } from './database.service';

// In your service or CLI command
const connection = this.databaseService.databaseConnection;
const migrationRunner = new MigrationRunner(connection);

// Register your migrations
migrationRunner.registerMigration(addFormTemplatesMigration);

// Run pending migrations
await migrationRunner.runPendingMigrations();
```

### 2. CLI Commands

Create a CLI command for migrations:

```typescript
// src/cli/migration.command.ts
import { Command, CommandRunner, Option } from 'nest-commander';
import { MigrationRunnerService } from '../database/migration-runner.service';

@Command({ name: 'migration', description: 'Database migration commands' })
export class MigrationCommand extends CommandRunner {
  constructor(private readonly migrationRunner: MigrationRunnerService) {
    super();
  }

  async run(inputs: string[], options: any): Promise<void> {
    const { action } = options;

    switch (action) {
      case 'run':
        await this.migrationRunner.runPendingMigrations();
        break;
      case 'rollback':
        await this.migrationRunner.rollbackLastMigration();
        break;
      case 'status':
        const status = await this.migrationRunner.getMigrationStatus();
        console.log('Migration Status:', status);
        break;
      default:
        console.log('Available actions: run, rollback, status');
    }
  }

  @Option({
    flags: '-a, --action <action>',
    description: 'Migration action to perform',
  })
  parseAction(val: string): string {
    return val;
  }
}
```

### 3. Running Migrations

```bash
# Run all pending migrations
npm run migration -- --action run

# Rollback the last migration
npm run migration -- --action rollback

# Check migration status
npm run migration -- --action status
```

### 2. Migration Status Tracking

The migration system tracks status in the `migrations` collection:

```typescript
interface MigrationRecord {
  name: string;
  version: string;
  description: string;
  executedAt: Date;
  executionTime: number;
  status: 'completed' | 'failed' | 'rolled_back';
  error?: string;
}
```

## Best Practices

### 1. Migration Naming Convention

```
[version]_[description].ts

Examples:
001_initial_schema.ts
002_add_user_indexes.ts
003_migrate_form_data.ts
```

### 2. Safety Rules

- Always include rollback logic in `down()` method
- Test migrations on copy of production data first
- Keep migrations atomic - complete success or failure
- Never modify existing migrations in production

For complete migration documentation, see the implementation in
`src/database/migrations/index.ts`.

## Troubleshooting Migrations

### Common Issues

1. **Migration Fails Midway**

   - Check the migration status in the database
   - Review error logs for specific failure reasons
   - Consider manual cleanup before retrying

2. **Rollback Not Working**

   - Ensure rollback logic is properly implemented
   - Check for data dependencies that prevent rollback
   - May require manual intervention for complex data changes

3. **Performance Issues**
   - Use batching for large data migrations
   - Create indexes after data migration, not before
   - Monitor database performance during migration

### Debugging Migrations

```typescript
// Add logging to your migrations
async up(connection: Connection): Promise<void> {
  const startTime = Date.now();
  console.log(`Starting migration: ${this.name}`);

  try {
    // Your migration logic here
    const endTime = Date.now();
    console.log(`Migration completed in ${endTime - startTime}ms`);
  } catch (error) {
    console.error(`Migration failed:`, error);
    throw error;
  }
}
```

## Advanced Migration Patterns

### 1. Conditional Migrations

```typescript
async up(connection: Connection): Promise<void> {
  const db = connection.db;

  // Only run if condition is met
  const shouldRun = await this.checkCondition(db);
  if (!shouldRun) {
    console.log('Migration skipped - condition not met');
    return;
  }

  // Continue with migration...
}

private async checkCondition(db: any): Promise<boolean> {
  const count = await db.collection('users').countDocuments({ role: { $type: 'string' } });
  return count > 0;
}
```

### 2. Multi-Collection Migrations

```typescript
async up(connection: Connection): Promise<void> {
  const db = connection.db;
  const session = connection.startSession();

  try {
    await session.withTransaction(async () => {
      // Update multiple collections atomically
      await db.collection('users').updateMany({}, { $set: { version: 2 } }, { session });
      await db.collection('forms').updateMany({}, { $set: { version: 2 } }, { session });
      await db.collection('submissions').updateMany({}, { $set: { version: 2 } }, { session });
    });
  } finally {
    await session.endSession();
  }
}
```

For more troubleshooting help, see the
[troubleshooting guide](./TROUBLESHOOTING.md).
