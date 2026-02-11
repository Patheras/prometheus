/**
 * Database migration system for Prometheus
 * 
 * This module provides utilities for managing database schema changes over time.
 * Migrations are applied in order and tracked in the migrations table.
 * 
 * Requirements: 1.7, 2.1, 3.1, 4.1
 */

import Database from 'better-sqlite3';
import { PrometheusDatabase } from './database';
import { Migration, MigrationRecord } from './types';

/**
 * Migration manager for applying and tracking schema changes
 */
export class MigrationManager {
  private db: PrometheusDatabase;
  private migrations: Migration[];

  constructor(db: PrometheusDatabase) {
    this.db = db;
    this.migrations = [];
  }

  /**
   * Register a migration
   */
  register(migration: Migration): void {
    this.migrations.push(migration);
  }

  /**
   * Register multiple migrations
   */
  registerAll(migrations: Migration[]): void {
    this.migrations.push(...migrations);
  }

  /**
   * Get list of applied migrations
   */
  getAppliedMigrations(): MigrationRecord[] {
    const dbInstance = this.db.getDb();
    
    try {
      return dbInstance
        .prepare('SELECT * FROM migrations ORDER BY id')
        .all() as MigrationRecord[];
    } catch (error) {
      // Migrations table doesn't exist yet
      return [];
    }
  }

  /**
   * Get list of pending migrations
   */
  getPendingMigrations(): Migration[] {
    const applied = this.getAppliedMigrations();
    const appliedNames = new Set(applied.map(m => m.name));
    
    return this.migrations.filter(m => !appliedNames.has(m.name));
  }

  /**
   * Apply all pending migrations
   */
  applyPending(): void {
    const pending = this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Applying ${pending.length} pending migration(s)...`);
    
    for (const migration of pending) {
      this.applyMigration(migration);
    }
    
    console.log('All migrations applied successfully');
  }

  /**
   * Apply a single migration
   */
  private applyMigration(migration: Migration): void {
    const dbInstance = this.db.getDb();
    
    console.log(`Applying migration: ${migration.name}`);
    
    this.db.transaction(() => {
      // Run the migration
      migration.up(dbInstance);
      
      // Record the migration
      dbInstance
        .prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
        .run(migration.name, Date.now());
    });
    
    console.log(`Migration applied: ${migration.name}`);
  }

  /**
   * Rollback the last migration (if down function is provided)
   */
  rollbackLast(): void {
    const applied = this.getAppliedMigrations();
    
    if (applied.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = applied[applied.length - 1];
    if (!lastMigration) {
      throw new Error('No last migration found');
    }
    
    const migration = this.migrations.find(m => m.name === lastMigration.name);
    
    if (!migration) {
      throw new Error(`Migration not found: ${lastMigration.name}`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${migration.name} does not have a down function`);
    }

    console.log(`Rolling back migration: ${migration.name}`);
    
    const dbInstance = this.db.getDb();
    
    this.db.transaction(() => {
      // Run the rollback
      migration.down!(dbInstance);
      
      // Remove the migration record
      dbInstance
        .prepare('DELETE FROM migrations WHERE name = ?')
        .run(migration.name);
    });
    
    console.log(`Migration rolled back: ${migration.name}`);
  }

  /**
   * Get current schema version (number of applied migrations)
   */
  getVersion(): number {
    return this.getAppliedMigrations().length;
  }

  /**
   * Check if database is up to date
   */
  isUpToDate(): boolean {
    return this.getPendingMigrations().length === 0;
  }
}

/**
 * Create a new migration
 */
export function createMigration(
  name: string,
  up: (db: Database.Database) => void,
  down?: (db: Database.Database) => void
): Migration {
  return { name, up, down };
}

/**
 * Example migrations for reference
 * 
 * These are commented out but show the pattern for future migrations
 */

// Example: Add user behavior tracking tables
// export const addUserBehaviorTables = createMigration(
//   '001_add_user_behavior_tables',
//   (db) => {
//     db.exec(`
//       CREATE TABLE user_events (
//         id TEXT PRIMARY KEY,
//         timestamp INTEGER NOT NULL,
//         event_type TEXT NOT NULL,
//         user_id TEXT,
//         session_id TEXT,
//         data TEXT
//       );
//
//       CREATE INDEX idx_user_events_timestamp ON user_events(timestamp);
//       CREATE INDEX idx_user_events_type ON user_events(event_type);
//       CREATE INDEX idx_user_events_user ON user_events(user_id);
//     `);
//   },
//   (db) => {
//     db.exec('DROP TABLE IF EXISTS user_events;');
//   }
// );

// Example: Add indexes for performance
// export const addPerformanceIndexes = createMigration(
//   '002_add_performance_indexes',
//   (db) => {
//     db.exec(`
//       CREATE INDEX idx_code_chunks_symbols ON code_chunks(symbols);
//       CREATE INDEX idx_decisions_outcome ON decisions(outcome);
//     `);
//   },
//   (db) => {
//     db.exec(`
//       DROP INDEX IF EXISTS idx_code_chunks_symbols;
//       DROP INDEX IF EXISTS idx_decisions_outcome;
//     `);
//   }
// );

/**
 * Get all registered migrations
 * 
 * This function returns all migrations that should be applied.
 * Add new migrations to this array as they are created.
 */
export function getAllMigrations(): Migration[] {
  return [
    // Add migrations here as they are created
    // addUserBehaviorTables,
    // addPerformanceIndexes,
  ];
}
