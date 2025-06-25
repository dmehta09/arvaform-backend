/**
 * Database migrations index file
 * Manages database schema changes and data migrations for ArvaForm
 *
 * This system provides a structured approach to evolving the database schema
 * over time while maintaining data integrity and backwards compatibility.
 */

import { Logger } from '@nestjs/common';
import { Connection } from 'mongoose';

/**
 * Migration interface definition
 * All migrations must implement this interface
 */
export interface Migration {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly createdAt: Date;

  /**
   * Execute the migration (up direction)
   */
  up(connection: Connection): Promise<void>;

  /**
   * Rollback the migration (down direction)
   */
  down(connection: Connection): Promise<void>;
}

/**
 * Migration status enumeration
 */
export enum MigrationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/**
 * Migration record interface for tracking applied migrations
 */
export interface MigrationRecord {
  name: string;
  version: string;
  status: MigrationStatus;
  appliedAt?: Date;
  rolledBackAt?: Date;
  executionTime?: number;
  error?: string;
}

/**
 * Migration runner class
 * Handles the execution of database migrations
 */
export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);
  private readonly migrations: Migration[] = [];

  constructor(private readonly connection: Connection) {}

  /**
   * Register a migration
   */
  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
    this.logger.log(`📝 Registered migration: ${migration.name} (v${migration.version})`);
  }

  /**
   * Get all registered migrations sorted by version
   */
  getMigrations(): Migration[] {
    return this.migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Get pending migrations that haven't been applied
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    return this.getMigrations().filter(migration => !appliedNames.has(migration.name));
  }

  /**
   * Get applied migrations from the database
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const collection = this.connection.collection('migrations');
      const documents = await collection.find({ status: MigrationStatus.COMPLETED }).toArray();

      // Type assertion with validation
      return documents.map(doc => ({
        name: String(doc.name || ''),
        version: String(doc.version || ''),
        status: doc.status as MigrationStatus,
        appliedAt:
          doc.appliedAt &&
          (typeof doc.appliedAt === 'string' ||
            typeof doc.appliedAt === 'number' ||
            doc.appliedAt instanceof Date)
            ? new Date(doc.appliedAt)
            : undefined,
        rolledBackAt:
          doc.rolledBackAt &&
          (typeof doc.rolledBackAt === 'string' ||
            typeof doc.rolledBackAt === 'number' ||
            doc.rolledBackAt instanceof Date)
            ? new Date(doc.rolledBackAt)
            : undefined,
        executionTime: typeof doc.executionTime === 'number' ? doc.executionTime : undefined,
        error: doc.error ? String(doc.error) : undefined,
      }));
    } catch (error) {
      this.logger.warn('Could not fetch applied migrations:', error);
      return [];
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations(): Promise<void> {
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      this.logger.log('✅ No pending migrations to run');
      return;
    }

    this.logger.log(`🔄 Running ${pendingMigrations.length} pending migrations...`);

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    this.logger.log('✅ All pending migrations completed successfully');
  }

  /**
   * Run a specific migration
   */
  async runMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`⏳ Running migration: ${migration.name} (v${migration.version})`);

      // Record migration start
      await this.recordMigrationStatus(migration, MigrationStatus.RUNNING);

      // Execute migration
      await migration.up(this.connection);

      // Record successful completion
      const executionTime = Date.now() - startTime;
      await this.recordMigrationStatus(migration, MigrationStatus.COMPLETED, {
        appliedAt: new Date(),
        executionTime,
      });

      this.logger.log(`✅ Migration completed: ${migration.name} (${executionTime}ms)`);
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failure
      await this.recordMigrationStatus(migration, MigrationStatus.FAILED, {
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.logger.error(`❌ Migration failed: ${migration.name}`, error);
      throw error;
    }
  }

  /**
   * Rollback a specific migration
   */
  async rollbackMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`⏳ Rolling back migration: ${migration.name} (v${migration.version})`);

      // Execute rollback
      await migration.down(this.connection);

      // Record rollback
      const executionTime = Date.now() - startTime;
      await this.recordMigrationStatus(migration, MigrationStatus.ROLLED_BACK, {
        rolledBackAt: new Date(),
        executionTime,
      });

      this.logger.log(`✅ Migration rolled back: ${migration.name} (${executionTime}ms)`);
    } catch (error) {
      this.logger.error(`❌ Migration rollback failed: ${migration.name}`, error);
      throw error;
    }
  }

  /**
   * Record migration status in the database
   */
  private async recordMigrationStatus(
    migration: Migration,
    status: MigrationStatus,
    additionalData: Partial<MigrationRecord> = {},
  ): Promise<void> {
    try {
      const collection = this.connection.collection('migrations');

      await collection.updateOne(
        { name: migration.name },
        {
          $set: {
            name: migration.name,
            version: migration.version,
            status,
            ...additionalData,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error('Failed to record migration status:', error);
    }
  }
}

/**
 * Example migration template for reference
 * This shows the structure that all migrations should follow
 */
export const exampleMigration: Migration = {
  name: '001_initial_setup',
  version: '1.0.0',
  description: 'Initial database setup with basic collections and indexes',
  createdAt: new Date('2025-06-15'),

  async up(_connection: Connection): Promise<void> {
    // Create collections and indexes
    // Example: await connection.collection('users').createIndex({ email: 1 }, { unique: true });
  },

  async down(_connection: Connection): Promise<void> {
    // Rollback changes
    // Example: await connection.collection('users').dropIndex({ email: 1 });
  },
};

/**
 * Available migrations registry
 * Add new migrations here to register them with the system
 */
export const availableMigrations: Migration[] = [
  // Add migrations here as they are created
  // exampleMigration,
];
