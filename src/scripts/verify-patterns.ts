#!/usr/bin/env tsx
/**
 * Pattern Verification Script
 * 
 * Verifies that patterns have been seeded correctly in the database.
 * 
 * Usage:
 *   npm run verify-patterns
 *   or
 *   tsx src/scripts/verify-patterns.ts
 */

import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from '../memory/database';
import { createMemoryEngine } from '../memory/engine';
import { Pattern } from '../memory/types';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function verifyPatterns(): Promise<void> {
  console.log('🔍 Verifying pattern seeding...\n');

  // Resolve database path
  const projectRoot = resolve(__dirname, '../../..');
  const dbPath = join(projectRoot, 'prometheus/data/prometheus.db');

  console.log(`📁 Database path: ${dbPath}`);

  // Initialize database
  console.log('🔌 Connecting to database...\n');
  const db = await initializeDatabase({ path: dbPath });
  const memoryEngine = createMemoryEngine(db);

  // Query patterns
  const dbInstance = memoryEngine.getDatabase().getDb();

  // Total count
  const totalResult = dbInstance
    .prepare('SELECT COUNT(*) as count FROM patterns')
    .get() as { count: number };

  console.log(`📊 Total patterns: ${totalResult.count}\n`);

  // Count by category
  const byCategory = dbInstance
    .prepare(`
      SELECT category, COUNT(*) as count
      FROM patterns
      GROUP BY category
      ORDER BY category
    `)
    .all() as Array<{ category: string; count: number }>;

  console.log('📋 Patterns by Category:');
  for (const row of byCategory) {
    console.log(`  • ${row.category}: ${row.count} patterns`);
  }

  // List all patterns
  console.log('\n📚 All Patterns:');
  const allPatterns = dbInstance
    .prepare('SELECT id, name, category FROM patterns ORDER BY category, name')
    .all() as Array<{ id: string; name: string; category: string }>;

  let currentCategory = '';
  for (const pattern of allPatterns) {
    if (pattern.category !== currentCategory) {
      currentCategory = pattern.category;
      console.log(`\n  [${currentCategory}]`);
    }
    console.log(`    • ${pattern.name}`);
  }

  // Sample pattern details
  console.log('\n🔬 Sample Pattern Details:');
  const samplePattern = dbInstance
    .prepare('SELECT * FROM patterns LIMIT 1')
    .get() as Pattern;

  if (samplePattern) {
    console.log(`\n  Name: ${samplePattern.name}`);
    console.log(`  Category: ${samplePattern.category}`);
    console.log(`  Problem: ${samplePattern.problem.substring(0, 80)}...`);
    console.log(`  Solution: ${samplePattern.solution.substring(0, 80)}...`);
    console.log(`  Success Count: ${samplePattern.success_count}`);
    console.log(`  Failure Count: ${samplePattern.failure_count}`);
    console.log(`  Has Example Code: ${samplePattern.example_code ? 'Yes' : 'No'}`);
    console.log(`  Has Applicability: ${samplePattern.applicability ? 'Yes' : 'No'}`);
  }

  // Close database
  memoryEngine.close();

  console.log('\n✅ Pattern verification complete!\n');
}

// Run verification
verifyPatterns()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error during pattern verification:', error);
    process.exit(1);
  });

export { verifyPatterns };
