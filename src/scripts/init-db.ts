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

import { join } from 'path';
import { initializeDatabase, validateSchema, getSchemaVersion } from '../memory/index';

async function main() {
  // Get database path from command line or use default
  const dbPath = process.argv[2] || join(process.cwd(), 'data', 'prometheus.db');
  
  console.log('Initializing Prometheus database...');
  console.log(`Database path: ${dbPath}`);
  
  try {
    // Initialize database
    const db = await initializeDatabase({ path: dbPath });
    
    // Validate schema
    const isValid = validateSchema(db);
    
    if (!isValid) {
      console.error('❌ Schema validation failed');
      process.exit(1);
    }
    
    // Get schema version
    const version = getSchemaVersion(db);
    
    console.log('✅ Database initialized successfully');
    console.log(`Schema version: ${version}`);
    console.log(`Tables created: code_files, code_chunks, code_chunks_fts, code_chunks_vec, decisions, metrics, patterns, embedding_cache`);
    
    // Close database
    db.close();
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

main();
