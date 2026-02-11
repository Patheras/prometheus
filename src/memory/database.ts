/**
 * Database initialization and connection management for Prometheus Memory Engine
 * 
 * This module provides:
 * - SQLite database initialization with schema creation
 * - Connection management with transaction support
 * - Schema migration system
 * 
 * Requirements: 1.7, 2.1, 3.1, 4.1
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { DatabaseConfig } from './types';

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: number;
}

/**
 * Database connection wrapper with transaction support
 */
export class PrometheusDatabase {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    
    // Ensure directory exists
    const dbDir = dirname(config.path);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Open database connection
    this.db = new Database(config.path, {
      readonly: config.readonly || false,
      verbose: config.verbose ? console.log : undefined,
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Set WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Get the underlying database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Execute a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Check if database is open
   */
  isOpen(): boolean {
    return this.db.open;
  }
}

/**
 * Initialize database with schema
 */
export async function initializeDatabase(config: DatabaseConfig): Promise<PrometheusDatabase> {
  const db = new PrometheusDatabase(config);
  
  // Create schema
  await createSchema(db);
  
  // Run migrations
  await runMigrations(db);
  
  return db;
}

/**
 * Create initial database schema
 */
async function createSchema(db: PrometheusDatabase): Promise<void> {
  const dbInstance = db.getDb();

  // Create migrations table first
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  // Codebase Memory Tables
  dbInstance.exec(`
    -- Code files metadata
    CREATE TABLE IF NOT EXISTS code_files (
      path TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      hash TEXT NOT NULL,
      language TEXT,
      size INTEGER NOT NULL,
      last_modified INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_code_files_repo ON code_files(repo);
    CREATE INDEX IF NOT EXISTS idx_code_files_hash ON code_files(hash);
  `);

  dbInstance.exec(`
    -- Code chunks for semantic search
    CREATE TABLE IF NOT EXISTS code_chunks (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      text TEXT NOT NULL,
      hash TEXT NOT NULL,
      symbols TEXT,
      imports TEXT,
      FOREIGN KEY (file_path) REFERENCES code_files(path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_code_chunks_file ON code_chunks(file_path);
    CREATE INDEX IF NOT EXISTS idx_code_chunks_hash ON code_chunks(hash);
  `);

  // Note: Virtual tables for FTS5 and vec0 will be created separately
  // as they require special handling
  
  // FTS5 full-text search for code chunks
  dbInstance.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS code_chunks_fts USING fts5(
      id UNINDEXED,
      file_path,
      text,
      symbols,
      imports,
      content='code_chunks',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS index in sync
    CREATE TRIGGER IF NOT EXISTS code_chunks_fts_insert AFTER INSERT ON code_chunks BEGIN
      INSERT INTO code_chunks_fts(rowid, id, file_path, text, symbols, imports)
      VALUES (new.rowid, new.id, new.file_path, new.text, new.symbols, new.imports);
    END;

    CREATE TRIGGER IF NOT EXISTS code_chunks_fts_delete AFTER DELETE ON code_chunks BEGIN
      INSERT INTO code_chunks_fts(code_chunks_fts, rowid, id, file_path, text, symbols, imports)
      VALUES ('delete', old.rowid, old.id, old.file_path, old.text, old.symbols, old.imports);
    END;

    CREATE TRIGGER IF NOT EXISTS code_chunks_fts_update AFTER UPDATE ON code_chunks BEGIN
      INSERT INTO code_chunks_fts(code_chunks_fts, rowid, id, file_path, text, symbols, imports)
      VALUES ('delete', old.rowid, old.id, old.file_path, old.text, old.symbols, old.imports);
      INSERT INTO code_chunks_fts(rowid, id, file_path, text, symbols, imports)
      VALUES (new.rowid, new.id, new.file_path, new.text, new.symbols, new.imports);
    END;
  `);

  // Placeholder for vector table (sqlite-vec extension required)
  // This will be created when sqlite-vec is available
  dbInstance.exec(`
    -- Vector embeddings table (requires sqlite-vec extension)
    -- CREATE VIRTUAL TABLE IF NOT EXISTS code_chunks_vec USING vec0(
    --   id TEXT PRIMARY KEY,
    --   embedding FLOAT[1536]
    -- );
    
    -- For now, create a regular table to store embeddings as JSON
    CREATE TABLE IF NOT EXISTS code_chunks_vec (
      id TEXT PRIMARY KEY,
      embedding TEXT NOT NULL,
      FOREIGN KEY (id) REFERENCES code_chunks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_code_chunks_vec_id ON code_chunks_vec(id);
  `);

  // Decision Memory Tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      context TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      alternatives TEXT NOT NULL,
      chosen_option TEXT NOT NULL,
      outcome TEXT,
      lessons_learned TEXT,
      affected_components TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp);
  `);

  // Metric Memory Tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      metric_type TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      value REAL NOT NULL,
      context TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
    CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
    CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
  `);

  // Pattern Memory Tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      example_code TEXT,
      applicability TEXT,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category);
    CREATE INDEX IF NOT EXISTS idx_patterns_name ON patterns(name);
  `);

  // Embedding Cache Table (shared across all sources)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS embedding_cache (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      hash TEXT NOT NULL,
      embedding TEXT NOT NULL,
      dims INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (provider, model, hash)
    );

    CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash ON embedding_cache(hash);
    CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated ON embedding_cache(updated_at);
  `);

  // Conversation Memory Tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
  `);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON conversation_messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON conversation_messages(role);
  `);
  
  // Conversation chunks for search (similar to code_chunks)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS conversation_chunks (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      message_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      hash TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_chunks_conversation ON conversation_chunks(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_chunks_hash ON conversation_chunks(hash);
  `);
  
  // FTS5 full-text search for conversation chunks
  dbInstance.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS conversation_chunks_fts USING fts5(
      id UNINDEXED,
      conversation_id UNINDEXED,
      text,
      content='conversation_chunks',
      content_rowid='rowid'
    );
  `);
}

/**
 * Run database migrations
 */
async function runMigrations(db: PrometheusDatabase): Promise<void> {
  const dbInstance = db.getDb();
  
  // Get list of applied migrations
  const appliedMigrations = dbInstance
    .prepare('SELECT name FROM migrations ORDER BY id')
    .all() as MigrationRecord[];
  
  const appliedNames = new Set(appliedMigrations.map(m => m.name));
  
  // Define migrations
  const migrations: Array<{ name: string; up: (db: Database.Database) => void }> = [
    // Add future migrations here
    // Example:
    // {
    //   name: '001_add_user_behavior_tables',
    //   up: (db) => {
    //     db.exec(`
    //       CREATE TABLE user_events (
    //         id TEXT PRIMARY KEY,
    //         timestamp INTEGER NOT NULL,
    //         event_type TEXT NOT NULL,
    //         user_id TEXT,
    //         data TEXT
    //       );
    //     `);
    //   }
    // }
  ];
  
  // Apply pending migrations
  for (const migration of migrations) {
    if (!appliedNames.has(migration.name)) {
      console.log(`Applying migration: ${migration.name}`);
      
      db.transaction(() => {
        migration.up(dbInstance);
        
        dbInstance
          .prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
          .run(migration.name, Date.now());
      });
      
      console.log(`Migration applied: ${migration.name}`);
    }
  }
}

/**
 * Get database schema version
 */
export function getSchemaVersion(db: PrometheusDatabase): number {
  const dbInstance = db.getDb();
  
  try {
    const result = dbInstance
      .prepare('SELECT COUNT(*) as count FROM migrations')
      .get() as { count: number };
    
    return result.count;
  } catch (error) {
    return 0;
  }
}

/**
 * Check if all required tables exist
 */
export function validateSchema(db: PrometheusDatabase): boolean {
  const dbInstance = db.getDb();
  
  const requiredTables = [
    'migrations',
    'code_files',
    'code_chunks',
    'code_chunks_fts',
    'code_chunks_vec',
    'decisions',
    'metrics',
    'patterns',
    'embedding_cache',
    'conversations',
    'conversation_messages',
  ];
  
  for (const table of requiredTables) {
    const result = dbInstance
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      )
      .get(table);
    
    if (!result) {
      console.error(`Missing required table: ${table}`);
      return false;
    }
  }
  
  return true;
}
