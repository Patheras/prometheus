/**
 * Basic Usage Example for Memory Engine
 * 
 * This example demonstrates how to:
 * 1. Initialize the database
 * 2. Create a Memory Engine instance
 * 3. Store and retrieve decisions
 * 4. Store and query metrics
 * 5. Store and manage patterns
 * 6. Use transactions
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 4.1
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initializeDatabase, createMemoryEngine } from '../index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('=== Prometheus Memory Engine - Basic Usage Example ===\n');

  // 1. Initialize the database
  console.log('1. Initializing database...');
  const dbPath = join(__dirname, '../../data/example.db');
  const db = await initializeDatabase({ path: dbPath });
  console.log('   Database initialized at:', dbPath);

  // 2. Create Memory Engine instance
  console.log('\n2. Creating Memory Engine instance...');
  const engine = createMemoryEngine(db);
  console.log('   Memory Engine created successfully');

  // 3. Store a decision
  console.log('\n3. Storing a decision...');
  const decisionId = await engine.storeDecision({
    timestamp: Date.now(),
    context: 'Choosing database for Prometheus Memory Engine',
    reasoning: 'SQLite provides excellent performance for local storage with zero configuration',
    alternatives: JSON.stringify([
      {
        option: 'SQLite',
        pros: ['Zero config', 'Fast', 'Embedded', 'ACID compliant'],
        cons: ['Single writer', 'Limited concurrency'],
      },
      {
        option: 'PostgreSQL',
        pros: ['High concurrency', 'Advanced features'],
        cons: ['Requires server', 'More complex setup'],
      },
    ]),
    chosen_option: 'SQLite',
    outcome: null,
    lessons_learned: null,
    affected_components: JSON.stringify(['memory-engine', 'database-layer']),
  });
  console.log('   Decision stored with ID:', decisionId);

  // 4. Update decision outcome
  console.log('\n4. Updating decision outcome...');
  await engine.updateDecisionOutcome(
    decisionId,
    'Success - SQLite performs excellently for our use case',
    'Learned that SQLite with WAL mode provides sufficient concurrency for our needs'
  );
  console.log('   Decision outcome updated');

  // 5. Store metrics
  console.log('\n5. Storing metrics...');
  await engine.storeMetrics([
    {
      id: `metric_${Date.now()}_1`,
      timestamp: Date.now(),
      metric_type: 'performance',
      metric_name: 'db_query_time',
      value: 15.5,
      context: JSON.stringify({ operation: 'storeDecision' }),
    },
    {
      id: `metric_${Date.now()}_2`,
      timestamp: Date.now(),
      metric_type: 'performance',
      metric_name: 'db_query_time',
      value: 12.3,
      context: JSON.stringify({ operation: 'updateDecisionOutcome' }),
    },
  ]);
  console.log('   Metrics stored successfully');

  // 6. Store a pattern
  console.log('\n6. Storing a pattern...');
  const patternId = await engine.storePattern({
    name: 'Content-Hash Caching',
    category: 'Performance',
    problem: 'Avoid redundant API calls for identical content',
    solution: 'Hash content and cache results by hash',
    example_code: `
const hash = createHash('sha256').update(content).digest('hex');
const cached = await cache.get(hash);
if (cached) return cached;
const result = await expensiveOperation(content);
await cache.set(hash, result);
return result;
    `,
    applicability: 'When processing identical content multiple times',
    success_count: 0,
    failure_count: 0,
  });
  console.log('   Pattern stored with ID:', patternId);

  // 7. Update pattern outcome
  console.log('\n7. Updating pattern outcome...');
  await engine.updatePatternOutcome(patternId, {
    success: true,
    context: 'Applied to embedding cache',
    notes: 'Reduced API calls by 80%',
  });
  console.log('   Pattern outcome updated (success count incremented)');

  // 8. Use transactions
  console.log('\n8. Using transactions...');
  const result = engine.transaction(() => {
    // Multiple operations in a single transaction
    console.log('   - Executing multiple operations atomically');
    return 'Transaction completed successfully';
  });
  console.log('   Transaction result:', result);

  // 9. Get file metadata (will be null since we haven't indexed any files yet)
  console.log('\n9. Querying file metadata...');
  const metadata = await engine.getFileMetadata('/example/file.ts');
  console.log('   File metadata:', metadata || 'Not found (expected - no files indexed yet)');

  // 10. Clean up
  console.log('\n10. Closing database connection...');
  engine.close();
  console.log('   Database connection closed');

  console.log('\n=== Example completed successfully! ===');
  console.log('\nNote: Some operations (like searchCode, queryMetrics) are not yet implemented.');
  console.log('They will be added in subsequent tasks.');
}

// Run the example
main().catch((error) => {
  console.error('Error running example:', error);
  process.exit(1);
});
