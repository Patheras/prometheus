# Prometheus Database Schema

This document describes the database schema for the Prometheus Meta-Agent System.

## Overview

Prometheus uses SQLite as its primary data store with the following features:
- **SQLite with better-sqlite3**: Fast, synchronous SQLite bindings for Node.js
- **FTS5 Full-Text Search**: For keyword-based search across code and text
- **Vector Embeddings**: Stored as JSON (future: sqlite-vec extension for native vector search)
- **WAL Mode**: Write-Ahead Logging for better concurrency
- **Foreign Keys**: Enabled for referential integrity

## Database Location

Default: `prometheus/data/prometheus.db`

## Schema Version

Current version: 0 (initial schema)

## Tables

### Migrations Table

Tracks applied database migrations for schema versioning.

```sql
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);
```

### Codebase Memory Tables

#### code_files

Stores metadata about indexed source code files.

```sql
CREATE TABLE code_files (
  path TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  hash TEXT NOT NULL,
  language TEXT,
  size INTEGER NOT NULL,
  last_modified INTEGER NOT NULL
);
```

**Indexes:**
- `idx_code_files_repo` on `repo`
- `idx_code_files_hash` on `hash`

#### code_chunks

Stores code chunks for semantic search with line number tracking.

```sql
CREATE TABLE code_chunks (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  text TEXT NOT NULL,
  hash TEXT NOT NULL,
  symbols TEXT,  -- JSON array of symbols
  imports TEXT,  -- JSON array of imports
  FOREIGN KEY (file_path) REFERENCES code_files(path) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_code_chunks_file` on `file_path`
- `idx_code_chunks_hash` on `hash`

#### code_chunks_fts

FTS5 virtual table for full-text search on code chunks.

```sql
CREATE VIRTUAL TABLE code_chunks_fts USING fts5(
  id UNINDEXED,
  file_path,
  text,
  symbols,
  imports,
  content='code_chunks',
  content_rowid='rowid'
);
```

**Triggers:** Automatically syncs with `code_chunks` table on INSERT, UPDATE, DELETE.

#### code_chunks_vec

Stores vector embeddings for semantic search.

```sql
CREATE TABLE code_chunks_vec (
  id TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,  -- JSON array of floats
  FOREIGN KEY (id) REFERENCES code_chunks(id) ON DELETE CASCADE
);
```

**Note:** Currently stores embeddings as JSON. Future versions will use sqlite-vec extension for native vector operations.

### Decision Memory Tables

#### decisions

Stores decision history with context, reasoning, and outcomes.

```sql
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  context TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  alternatives TEXT NOT NULL,      -- JSON array
  chosen_option TEXT NOT NULL,
  outcome TEXT,
  lessons_learned TEXT,
  affected_components TEXT         -- JSON array
);
```

**Indexes:**
- `idx_decisions_timestamp` on `timestamp`

### Metric Memory Tables

#### metrics

Stores performance and system metrics.

```sql
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  context TEXT                     -- JSON object
);
```

**Indexes:**
- `idx_metrics_timestamp` on `timestamp`
- `idx_metrics_type` on `metric_type`
- `idx_metrics_name` on `metric_name`

### Pattern Memory Tables

#### patterns

Stores learned architectural patterns and best practices.

```sql
CREATE TABLE patterns (
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
```

**Indexes:**
- `idx_patterns_category` on `category`
- `idx_patterns_name` on `name`

### Embedding Cache Table

#### embedding_cache

Content-hash-based cache for vector embeddings to avoid redundant API calls.

```sql
CREATE TABLE embedding_cache (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  hash TEXT NOT NULL,
  embedding TEXT NOT NULL,         -- JSON array
  dims INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, hash)
);
```

**Indexes:**
- `idx_embedding_cache_hash` on `hash`
- `idx_embedding_cache_updated` on `updated_at`

## Scripts

### Initialize Database

Creates the database with all required tables and indexes:

```bash
npm run init-db [database-path]
```

### Verify Schema

Verifies that all required tables exist and displays schema information:

```bash
npm run verify-schema [database-path]
```

## Migrations

The migration system tracks schema changes over time. Migrations are defined in `src/memory/migrations.ts` and applied automatically during initialization.

### Creating a Migration

```typescript
import { createMigration } from './migrations';

export const myMigration = createMigration(
  '001_my_migration_name',
  (db) => {
    // Apply changes
    db.exec(`
      CREATE TABLE new_table (
        id TEXT PRIMARY KEY,
        data TEXT
      );
    `);
  },
  (db) => {
    // Rollback changes (optional)
    db.exec('DROP TABLE IF EXISTS new_table;');
  }
);
```

### Applying Migrations

Migrations are automatically applied when calling `initializeDatabase()`. To manually manage migrations:

```typescript
import { MigrationManager, getAllMigrations } from './memory';

const manager = new MigrationManager(db);
manager.registerAll(getAllMigrations());
manager.applyPending();
```

## Requirements Mapping

This database schema implements the following requirements:

- **Requirement 1.7**: SQLite database with sqlite-vec extension for codebase memory
- **Requirement 2.1**: Decision storage with context, reasoning, and outcomes
- **Requirement 3.1**: Metric storage with timestamps and context
- **Requirement 4.1**: Pattern storage with success/failure tracking

## Future Enhancements

1. **sqlite-vec Integration**: Replace JSON embedding storage with native vector operations
2. **User Behavior Tables**: Add tables for tracking user events and behavior patterns
3. **Performance Indexes**: Add additional indexes based on query patterns
4. **Partitioning**: Implement time-based partitioning for metrics table
5. **Compression**: Add compression for large text fields

## References

- Design Document: `.kiro/specs/prometheus/design.md`
- Requirements Document: `.kiro/specs/prometheus/requirements.md`
- OpenClaw Memory System: `openclaw-learning/analysis/memory-system.md`
