#!/usr/bin/env tsx
/**
 * Pattern Seeding Script
 * 
 * This script seeds OpenClaw patterns from the openclaw-learning/patterns directory
 * into the Prometheus pattern memory system.
 * 
 * Usage:
 *   npm run seed-patterns
 *   or
 *   tsx src/scripts/seed-patterns.ts
 * 
 * Requirements: 4.4
 */

import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from '../memory/database';
import { createMemoryEngine } from '../memory/engine';
import { OPENCLAW_PATTERNS } from '../data/openclaw-patterns';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Main Seeding Function
// ============================================================================

async function seedPatterns(): Promise<void> {
  console.log('🌱 Starting pattern seeding...\n');

  // Resolve database path
  const projectRoot = resolve(__dirname, '../../..');
  const dbPath = join(projectRoot, 'prometheus/data/prometheus.db');

  console.log(`📁 Database path: ${dbPath}`);

  // Initialize database
  console.log('🔌 Connecting to database...');
  const db = await initializeDatabase({ path: dbPath });

  // Create memory engine
  const memoryEngine = createMemoryEngine(db);

  // Seed patterns
  console.log(`\n📦 Seeding ${OPENCLAW_PATTERNS.length} patterns...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const pattern of OPENCLAW_PATTERNS) {
    try {
      const id = await memoryEngine.storePattern(pattern);
      console.log(`✅ [${pattern.category}] ${pattern.name} (${id})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to store pattern "${pattern.name}":`, error);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Seeding Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully seeded: ${successCount} patterns`);
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} patterns`);
  }
  console.log('='.repeat(60));

  // Pattern breakdown by category
  console.log('\n📋 Patterns by Category:');
  const byCategory = OPENCLAW_PATTERNS.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  • ${category}: ${count} patterns`);
  }

  // Close database
  memoryEngine.close();

  console.log('\n✨ Pattern seeding complete!\n');
}

// ============================================================================
// Script Execution
// ============================================================================

// Run if this is the main module
seedPatterns()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error during pattern seeding:', error);
    process.exit(1);
  });

export { seedPatterns };
