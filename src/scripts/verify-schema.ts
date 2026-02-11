#!/usr/bin/env node
/**
 * Schema verification script
 * 
 * This script verifies that all required tables and indexes exist in the database.
 */

import { join } from 'path';
import Database from 'better-sqlite3';

async function main() {
  const dbPath = process.argv[2] || join(process.cwd(), 'data', 'prometheus.db');
  
  console.log('Verifying database schema...');
  console.log(`Database path: ${dbPath}\n`);
  
  const db = new Database(dbPath, { readonly: true });
  
  try {
    // Get all tables
    const tables = db
      .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY type, name")
      .all() as Array<{ name: string; type: string }>;
    
    console.log('📋 Database Objects:\n');
    
    const tableNames = tables.filter(t => t.type === 'table').map(t => t.name);
    const indexNames = tables.filter(t => t.type === 'index').map(t => t.name);
    
    console.log('Tables:');
    tableNames.forEach(name => {
      console.log(`  ✓ ${name}`);
    });
    
    console.log('\nIndexes:');
    indexNames.forEach(name => {
      console.log(`  ✓ ${name}`);
    });
    
    // Check required tables
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
    ];
    
    console.log('\n📊 Required Tables Check:\n');
    
    let allPresent = true;
    for (const table of requiredTables) {
      const exists = tableNames.includes(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
      if (!exists) allPresent = false;
    }
    
    // Get table schemas
    console.log('\n📐 Table Schemas:\n');
    
    for (const table of requiredTables.filter(t => tableNames.includes(t))) {
      const schema = db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
        .get(table) as { sql: string } | undefined;
      
      if (schema) {
        console.log(`${table}:`);
        console.log(schema.sql);
        console.log('');
      }
    }
    
    if (allPresent) {
      console.log('✅ All required tables are present');
    } else {
      console.log('❌ Some required tables are missing');
      process.exit(1);
    }
    
  } finally {
    db.close();
  }
}

main();
