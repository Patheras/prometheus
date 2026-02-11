/**
 * Integration test demonstrating decision search functionality
 * 
 * This test shows how decision search works in a realistic scenario
 * with multiple decisions and various search criteria.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrometheusDatabase, initializeDatabase } from '../database';
import { MemoryEngine } from '../engine';
import { unlinkSync, existsSync } from 'fs';

describe('Decision Search Integration', () => {
  let db: PrometheusDatabase;
  let engine: MemoryEngine;
  const testDbPath = './data/test-decision-search-integration.db';

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    db = await initializeDatabase({ path: testDbPath });
    engine = new MemoryEngine(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should demonstrate complete decision lifecycle with search', async () => {
    // Scenario: A team is making architectural decisions for a new project
    
    // Decision 1: Database selection (successful)
    const dbDecisionId = await engine.storeDecision({
      timestamp: Date.now() - 7200000, // 2 hours ago
      context: 'Selecting primary database for user authentication and profile storage',
      reasoning: 'Need ACID compliance, strong consistency, and good TypeScript support. Expected to handle 10k users initially.',
      alternatives: JSON.stringify([
        {
          option: 'PostgreSQL',
          pros: ['ACID compliant', 'Mature ecosystem', 'Great TypeScript ORMs'],
          cons: ['Requires more setup', 'Higher resource usage']
        },
        {
          option: 'MongoDB',
          pros: ['Flexible schema', 'Easy to start'],
          cons: ['No ACID by default', 'Consistency issues']
        },
        {
          option: 'MySQL',
          pros: ['Popular', 'Good performance'],
          cons: ['Less feature-rich than PostgreSQL']
        }
      ]),
      chosen_option: 'PostgreSQL with Prisma ORM',
      outcome: null,
      lessons_learned: null,
      affected_components: JSON.stringify(['auth-service', 'user-service', 'profile-api'])
    });

    // Update with successful outcome
    await engine.updateDecisionOutcome(
      dbDecisionId,
      JSON.stringify({
        success: true,
        actual_effort: '3 days for setup and migration',
        unexpected_issues: [],
        lessons: ['Prisma migrations work great', 'Connection pooling was easy to configure']
      }),
      'PostgreSQL was the right choice. Performance is excellent and the type safety from Prisma is invaluable.'
    );

    // Decision 2: Caching strategy (failed)
    const cacheDecisionId = await engine.storeDecision({
      timestamp: Date.now() - 3600000, // 1 hour ago
      context: 'Implementing caching layer for API responses to reduce database load',
      reasoning: 'Database queries are becoming slow under load. Need to cache frequently accessed data.',
      alternatives: JSON.stringify([
        {
          option: 'Redis',
          pros: ['Very fast', 'Rich data structures', 'Pub/sub support'],
          cons: ['Additional infrastructure', 'Memory cost']
        },
        {
          option: 'In-memory cache',
          pros: ['No external dependency', 'Simple'],
          cons: ['Lost on restart', 'Not shared across instances']
        }
      ]),
      chosen_option: 'In-memory cache with node-cache',
      outcome: null,
      lessons_learned: null,
      affected_components: JSON.stringify(['api-gateway', 'user-service'])
    });

    await engine.updateDecisionOutcome(
      cacheDecisionId,
      JSON.stringify({
        success: false,
        actual_effort: '2 days wasted',
        unexpected_issues: ['Cache invalidation was complex', 'Not shared across instances caused stale data'],
        lessons: ['Should have used Redis from the start', 'In-memory cache only works for single-instance deployments']
      }),
      'In-memory cache was a mistake. We had to revert and implement Redis properly. The time saved on setup was lost dealing with cache inconsistencies.'
    );

    // Decision 3: API framework (pending)
    await engine.storeDecision({
      timestamp: Date.now() - 1800000, // 30 minutes ago
      context: 'Choosing API framework for microservices',
      reasoning: 'Need high performance, good TypeScript support, and easy testing',
      alternatives: JSON.stringify([
        {
          option: 'Express',
          pros: ['Popular', 'Lots of middleware', 'Well documented'],
          cons: ['Slower than alternatives', 'Callback-based']
        },
        {
          option: 'Fastify',
          pros: ['Very fast', 'Modern async/await', 'Schema validation'],
          cons: ['Smaller ecosystem', 'Less familiar to team']
        }
      ]),
      chosen_option: 'Fastify with TypeScript',
      outcome: null,
      lessons_learned: null,
      affected_components: JSON.stringify(['api-gateway', 'auth-service', 'user-service'])
    });

    // Decision 4: Testing framework (successful)
    const testDecisionId = await engine.storeDecision({
      timestamp: Date.now() - 5400000, // 1.5 hours ago
      context: 'Selecting testing framework for unit and integration tests',
      reasoning: 'Need fast test execution, good TypeScript support, and property-based testing',
      alternatives: JSON.stringify([
        {
          option: 'Jest',
          pros: ['Fast', 'Great TypeScript support', 'Snapshot testing'],
          cons: ['Can be slow for large projects']
        },
        {
          option: 'Vitest',
          pros: ['Very fast', 'Vite integration', 'Jest compatible'],
          cons: ['Newer, less mature']
        }
      ]),
      chosen_option: 'Jest with fast-check for property testing',
      outcome: null,
      lessons_learned: null,
      affected_components: JSON.stringify(['all-services'])
    });

    await engine.updateDecisionOutcome(
      testDecisionId,
      JSON.stringify({
        success: true,
        actual_effort: '1 day for setup',
        unexpected_issues: [],
        lessons: ['Property-based testing caught edge cases we missed', 'Jest watch mode is great for TDD']
      }),
      'Jest + fast-check is working perfectly. The property tests have already caught several bugs.'
    );

    // Now demonstrate various search scenarios

    // 1. Search for database-related decisions
    console.log('\n=== Searching for database decisions ===');
    const dbDecisions = await engine.searchDecisions('database');
    expect(dbDecisions.length).toBeGreaterThanOrEqual(2); // Database and caching decisions
    console.log(`Found ${dbDecisions.length} database-related decisions`);

    // 2. Find only successful decisions
    console.log('\n=== Finding successful decisions ===');
    const successfulDecisions = await engine.searchDecisions('', { outcome: 'success' });
    expect(successfulDecisions.length).toBe(2); // PostgreSQL and Jest decisions
    console.log(`Found ${successfulDecisions.length} successful decisions:`);
    successfulDecisions.forEach(d => {
      console.log(`  - ${d.context.substring(0, 50)}...`);
    });

    // 3. Find failed decisions to learn from
    console.log('\n=== Finding failed decisions ===');
    const failedDecisions = await engine.searchDecisions('', { outcome: 'failure' });
    expect(failedDecisions.length).toBe(1); // Caching decision
    console.log(`Found ${failedDecisions.length} failed decision:`);
    failedDecisions.forEach(d => {
      console.log(`  - ${d.context.substring(0, 50)}...`);
      console.log(`    Lesson: ${d.lessons_learned?.substring(0, 80)}...`);
    });

    // 4. Find pending decisions (no outcome yet)
    console.log('\n=== Finding pending decisions ===');
    const pendingDecisions = await engine.searchDecisions('', { outcome: 'null' });
    expect(pendingDecisions.length).toBe(1); // API framework decision
    console.log(`Found ${pendingDecisions.length} pending decision:`);
    pendingDecisions.forEach(d => {
      console.log(`  - ${d.context.substring(0, 50)}...`);
    });

    // 5. Find recent decisions (last hour)
    console.log('\n=== Finding recent decisions (last hour) ===');
    const oneHourAgo = Date.now() - 3600000;
    const recentDecisions = await engine.searchDecisions('', { startTime: oneHourAgo });
    expect(recentDecisions.length).toBeGreaterThanOrEqual(1); // At least API framework decision
    console.log(`Found ${recentDecisions.length} recent decisions`);

    // 6. Find successful caching-related decisions
    console.log('\n=== Finding successful caching decisions ===');
    const successfulCaching = await engine.searchDecisions('caching', { outcome: 'success' });
    expect(successfulCaching.length).toBe(0); // Caching decision failed
    console.log(`Found ${successfulCaching.length} successful caching decisions (expected 0)`);

    // 7. Complex query: Recent failed decisions
    console.log('\n=== Finding recent failed decisions ===');
    const twoHoursAgo = Date.now() - 7200000;
    const recentFailures = await engine.searchDecisions('', {
      outcome: 'failure',
      startTime: twoHoursAgo
    });
    expect(recentFailures.length).toBe(1); // Caching decision
    console.log(`Found ${recentFailures.length} recent failure:`);
    recentFailures.forEach(d => {
      const outcome = JSON.parse(d.outcome || '{}');
      console.log(`  - ${d.context.substring(0, 50)}...`);
      console.log(`    Issues: ${outcome.unexpected_issues?.join(', ')}`);
    });

    // 8. Search with limit
    console.log('\n=== Limiting search results ===');
    const limitedResults = await engine.searchDecisions('', { limit: 2 });
    expect(limitedResults.length).toBe(2);
    console.log(`Limited to ${limitedResults.length} results (most recent)`);

    console.log('\n=== Integration test complete ===');
  });
});
