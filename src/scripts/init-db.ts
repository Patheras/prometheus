#!/usr/bin/env node
/**
 * Database initialization script
 * 
 * This script initializes the Prometheus database with the required schema
 * and applies any pending migrations.
 * 
 * Usage:
 *   npm run init-db
 *   or
 *   tsx src/scripts/init-db.ts [database-path]
 */

import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { initializeDatabase, validateSchema, getSchemaVersion } from '../memory/index';

/**
 * Create parent directories for the database file if they don't exist
 */
function createDatabaseDirectories(dbPath: string): void {
  const dir = dirname(dbPath);
  
  if (!existsSync(dir)) {
    console.log(`Creating database directory: ${dir}`);
    try {
      mkdirSync(dir, { recursive: true });
      console.log('✅ Directory created successfully');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      throw new Error(
        `Failed to create database directory: ${dir}\n` +
        `Error: ${err.message}\n` +
        `\nPossible solutions:\n` +
        `  1. Check file permissions for the parent directory\n` +
        `  2. Ensure you have write access to: ${dirname(dir)}\n` +
        `  3. Try running with elevated permissions if necessary`
      );
    }
  }
}

async function main() {
  // Get database path from command line or use default
  const dbPath = process.argv[2] || join(process.cwd(), 'data', 'prometheus.db');
  
  console.log('Initializing Prometheus database...');
  console.log(`Database path: ${dbPath}`);
  
  try {
    // Step 1: Create directories
    createDatabaseDirectories(dbPath);
    
    // Step 2: Initialize database
    console.log('Initializing database schema...');
    const db = await initializeDatabase({ path: dbPath });
    console.log('✅ Database schema initialized');
    
    // Step 3: Validate schema
    console.log('Validating database schema...');
    const isValid = validateSchema(db);
    
    if (!isValid) {
      throw new Error(
        'Schema validation failed - database structure is incomplete\n' +
        '\nPossible solutions:\n' +
        `  1. Delete the database file and try again: ${dbPath}\n` +
        `  2. Check for disk space issues\n` +
        `  3. Verify SQLite is properly installed`
      );
    }
    console.log('✅ Schema validation passed');
    
    // Step 4: Get schema version
    const version = getSchemaVersion(db);
    
    console.log('\n✅ Database initialized successfully');
    console.log(`Schema version: ${version} migrations applied`);
    console.log(`Tables created: code_files, code_chunks, code_chunks_fts, code_chunks_vec, decisions, metrics, patterns, embedding_cache, conversations, conversation_messages`);
    
    // Close database
    db.close();
    
  } catch (error) {
    const err = error as Error;
    console.error('\n❌ Database initialization failed');
    console.error(`\nError details: ${err.message}`);
    
    // Provide context-specific recovery steps
    if (!err.message.includes('Possible solutions:')) {
      console.error('\nPossible solutions:');
      console.error('  1. Check that SQLite is properly installed');
      console.error('  2. Verify the database path is valid and writable');
      console.error('  3. Ensure no other process is using the database file');
      console.error(`  4. Try deleting the database file if it exists: ${dbPath}`);
    }
    
    process.exit(1);
  }
}

main();
