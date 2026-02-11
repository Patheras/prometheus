/**
 * Tests for Decision Search functionality
 * 
 * Requirements tested:
 * - 2.3: Return relevant past decisions with their outcomes
 * - 2.4: Support querying by decision type, outcome, and time period
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrometheusDatabase, initializeDatabase } from '../database';
import { MemoryEngine } from '../engine';
import { Decision } from '../types';
import { unlinkSync, existsSync } from 'fs';

describe('Decision Search', () => {
  let db: PrometheusDatabase;
  let engine: MemoryEngine;
  const testDbPath = './data/test-decision-search.db';

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Initialize database and engine
    db = await initializeDatabase({ path: testDbPath });
    engine = new MemoryEngine(db);
  });

  afterEach(() => {
    // Clean up
    if (db) {
      db.close();
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Text Search', () => {
    it('should search decisions by context', async () => {
      // Store test decisions
      const decision1 = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Choosing database for user authentication',
        reasoning: 'Need fast lookups and ACID compliance',
        alternatives: JSON.stringify([
          { option: 'PostgreSQL', pros: ['ACID', 'Reliable'], cons: ['Complex'] },
          { option: 'MongoDB', pros: ['Fast'], cons: ['No ACID'] }
        ]),
        chosen_option: 'PostgreSQL',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const decision2 = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Selecting caching strategy for API responses',
        reasoning: 'Need to reduce database load',
        alternatives: JSON.stringify([
          { option: 'Redis', pros: ['Fast'], cons: ['Memory'] },
          { option: 'Memcached', pros: ['Simple'], cons: ['Limited'] }
        ]),
        chosen_option: 'Redis',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Search by context keyword
      const results = await engine.searchDecisions('database');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(d => d.id === decision1)).toBe(true);
      expect(results.some(d => d.id === decision2)).toBe(true);
    });

    it('should search decisions by reasoning', async () => {
      await engine.storeDecision({
        timestamp: Date.now(),
        context: 'API design decision',
        reasoning: 'Need to support real-time updates with WebSocket',
        alternatives: JSON.stringify([
          { option: 'REST', pros: ['Simple'], cons: ['No real-time'] },
          { option: 'WebSocket', pros: ['Real-time'], cons: ['Complex'] }
        ]),
        chosen_option: 'WebSocket',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const results = await engine.searchDecisions('real-time');

      expect(results.length).toBe(1);
      expect(results[0].reasoning).toContain('real-time');
    });

    it('should search decisions by alternatives', async () => {
      await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Frontend framework selection',
        reasoning: 'Need component-based architecture',
        alternatives: JSON.stringify([
          { option: 'React', pros: ['Popular', 'Flexible'], cons: ['Complex'] },
          { option: 'Vue', pros: ['Simple'], cons: ['Less popular'] }
        ]),
        chosen_option: 'React',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const results = await engine.searchDecisions('React');

      expect(results.length).toBe(1);
      expect(results[0].alternatives).toContain('React');
    });

    it('should search decisions by chosen_option', async () => {
      await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Testing framework selection',
        reasoning: 'Need fast test execution',
        alternatives: JSON.stringify([
          { option: 'Jest', pros: ['Fast', 'Popular'], cons: [] },
          { option: 'Mocha', pros: ['Flexible'], cons: ['Slower'] }
        ]),
        chosen_option: 'Jest for unit tests',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const results = await engine.searchDecisions('Jest');

      expect(results.length).toBe(1);
      expect(results[0].chosen_option).toContain('Jest');
    });

    it('should return empty array when no matches found', async () => {
      await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Some decision',
        reasoning: 'Some reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option A',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const results = await engine.searchDecisions('nonexistent keyword');

      expect(results.length).toBe(0);
    });

    it('should handle empty query string', async () => {
      await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Decision 1',
        reasoning: 'Reasoning 1',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option 1',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Decision 2',
        reasoning: 'Reasoning 2',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option 2',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Empty query should return all decisions (up to limit)
      const results = await engine.searchDecisions('');

      expect(results.length).toBe(2);
    });
  });

  describe('Outcome Filtering', () => {
    it('should filter decisions by success outcome', async () => {
      // Decision with success outcome
      const successId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Successful decision',
        reasoning: 'Good reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option A',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        successId,
        JSON.stringify({ success: true, actual_effort: '2 days' }),
        'Worked well'
      );

      // Decision with failure outcome
      const failureId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Failed decision',
        reasoning: 'Bad reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option B',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        failureId,
        JSON.stringify({ success: false, actual_effort: '5 days' }),
        'Did not work'
      );

      // Decision without outcome
      await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Pending decision',
        reasoning: 'Waiting',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option C',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Filter by success
      const successResults = await engine.searchDecisions('', { outcome: 'success' });
      expect(successResults.length).toBe(1);
      expect(successResults[0].id).toBe(successId);
      expect(successResults[0].outcome).toContain('"success":true');
    });

    it('should filter decisions by failure outcome', async () => {
      // Decision with failure outcome
      const failureId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Failed decision',
        reasoning: 'Bad reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option B',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        failureId,
        JSON.stringify({ success: false, actual_effort: '5 days' }),
        'Did not work'
      );

      // Decision with success outcome
      const successId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Successful decision',
        reasoning: 'Good reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option A',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        successId,
        JSON.stringify({ success: true, actual_effort: '2 days' }),
        'Worked well'
      );

      // Filter by failure
      const failureResults = await engine.searchDecisions('', { outcome: 'failure' });
      expect(failureResults.length).toBe(1);
      expect(failureResults[0].id).toBe(failureId);
      expect(failureResults[0].outcome).toContain('"success":false');
    });

    it('should filter decisions with null outcome', async () => {
      // Decision without outcome
      const nullId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Pending decision',
        reasoning: 'Waiting',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option C',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Decision with outcome
      const withOutcomeId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Completed decision',
        reasoning: 'Done',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option D',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        withOutcomeId,
        JSON.stringify({ success: true }),
        'Completed'
      );

      // Filter by null outcome
      const nullResults = await engine.searchDecisions('', { outcome: 'null' });
      expect(nullResults.length).toBe(1);
      expect(nullResults[0].id).toBe(nullId);
      expect(nullResults[0].outcome).toBeNull();
    });
  });

  describe('Time Period Filtering', () => {
    it('should filter decisions by start time', async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const twoHoursAgo = now - 7200000;

      // Old decision
      await engine.storeDecision({
        timestamp: twoHoursAgo,
        context: 'Old decision',
        reasoning: 'Old reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Old option',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Recent decision
      const recentId = await engine.storeDecision({
        timestamp: now,
        context: 'Recent decision',
        reasoning: 'Recent reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Recent option',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Filter by start time (last hour)
      const results = await engine.searchDecisions('', { startTime: oneHourAgo });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(recentId);
    });

    it('should filter decisions by end time', async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const twoHoursAgo = now - 7200000;

      // Old decision
      const oldId = await engine.storeDecision({
        timestamp: twoHoursAgo,
        context: 'Old decision',
        reasoning: 'Old reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Old option',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Recent decision
      await engine.storeDecision({
        timestamp: now,
        context: 'Recent decision',
        reasoning: 'Recent reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Recent option',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Filter by end time (before one hour ago)
      const results = await engine.searchDecisions('', { endTime: oneHourAgo });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(oldId);
    });

    it('should filter decisions by time range', async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const twoHoursAgo = now - 7200000;
      const threeHoursAgo = now - 10800000;

      // Very old decision
      await engine.storeDecision({
        timestamp: threeHoursAgo,
        context: 'Very old decision',
        reasoning: 'Very old reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Very old option',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Middle decision
      const middleId = await engine.storeDecision({
        timestamp: twoHoursAgo,
        context: 'Middle decision',
        reasoning: 'Middle reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Middle option',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Recent decision
      await engine.storeDecision({
        timestamp: now,
        context: 'Recent decision',
        reasoning: 'Recent reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Recent option',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Filter by time range (between 3 hours ago and 1 hour ago)
      const results = await engine.searchDecisions('', {
        startTime: threeHoursAgo,
        endTime: oneHourAgo
      });

      // Both very old and middle decisions should match (inclusive boundaries)
      expect(results.length).toBe(2);
      expect(results.some(d => d.id === middleId)).toBe(true);
    });
  });

  describe('Combined Filtering', () => {
    it('should combine text search with outcome filter', async () => {
      // Successful database decision
      const dbSuccessId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Database selection for authentication',
        reasoning: 'Need reliability',
        alternatives: JSON.stringify([]),
        chosen_option: 'PostgreSQL',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        dbSuccessId,
        JSON.stringify({ success: true }),
        'Worked well'
      );

      // Failed database decision
      const dbFailureId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Database caching strategy',
        reasoning: 'Need speed',
        alternatives: JSON.stringify([]),
        chosen_option: 'Memcached',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        dbFailureId,
        JSON.stringify({ success: false }),
        'Too slow'
      );

      // Successful non-database decision
      const otherSuccessId = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'API framework selection',
        reasoning: 'Need performance',
        alternatives: JSON.stringify([]),
        chosen_option: 'Express',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        otherSuccessId,
        JSON.stringify({ success: true }),
        'Great choice'
      );

      // Search for successful database decisions
      const results = await engine.searchDecisions('database', { outcome: 'success' });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(dbSuccessId);
    });

    it('should combine text search with time filter', async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Old database decision
      await engine.storeDecision({
        timestamp: oneHourAgo - 1000,
        context: 'Old database decision',
        reasoning: 'Old reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'MySQL',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Recent database decision
      const recentDbId = await engine.storeDecision({
        timestamp: now,
        context: 'Recent database decision',
        reasoning: 'Recent reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'PostgreSQL',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      // Search for recent database decisions
      const results = await engine.searchDecisions('database', { startTime: oneHourAgo });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(recentDbId);
    });

    it('should combine all filters', async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Recent successful database decision
      const targetId = await engine.storeDecision({
        timestamp: now,
        context: 'Database selection for user service',
        reasoning: 'Need ACID compliance',
        alternatives: JSON.stringify([]),
        chosen_option: 'PostgreSQL',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        targetId,
        JSON.stringify({ success: true }),
        'Perfect choice'
      );

      // Old successful database decision
      const oldDbId = await engine.storeDecision({
        timestamp: oneHourAgo - 1000,
        context: 'Database for analytics',
        reasoning: 'Need speed',
        alternatives: JSON.stringify([]),
        chosen_option: 'ClickHouse',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        oldDbId,
        JSON.stringify({ success: true }),
        'Good'
      );

      // Recent failed database decision
      const failedDbId = await engine.storeDecision({
        timestamp: now,
        context: 'Database for caching',
        reasoning: 'Need memory efficiency',
        alternatives: JSON.stringify([]),
        chosen_option: 'Redis',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        failedDbId,
        JSON.stringify({ success: false }),
        'Too expensive'
      );

      // Recent successful non-database decision
      const otherId = await engine.storeDecision({
        timestamp: now,
        context: 'API framework',
        reasoning: 'Need performance',
        alternatives: JSON.stringify([]),
        chosen_option: 'Fastify',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        otherId,
        JSON.stringify({ success: true }),
        'Excellent'
      );

      // Search for recent successful database decisions
      const results = await engine.searchDecisions('database', {
        outcome: 'success',
        startTime: oneHourAgo
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(targetId);
    });
  });

  describe('Sorting and Limiting', () => {
    it('should sort results by timestamp (most recent first)', async () => {
      const now = Date.now();

      const id1 = await engine.storeDecision({
        timestamp: now - 3000,
        context: 'First decision',
        reasoning: 'First',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option 1',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const id2 = await engine.storeDecision({
        timestamp: now - 2000,
        context: 'Second decision',
        reasoning: 'Second',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option 2',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const id3 = await engine.storeDecision({
        timestamp: now - 1000,
        context: 'Third decision',
        reasoning: 'Third',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option 3',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      const results = await engine.searchDecisions('');

      expect(results.length).toBe(3);
      expect(results[0].id).toBe(id3); // Most recent
      expect(results[1].id).toBe(id2);
      expect(results[2].id).toBe(id1); // Oldest
    });

    it('should respect limit option', async () => {
      // Create 5 decisions
      for (let i = 0; i < 5; i++) {
        await engine.storeDecision({
          timestamp: Date.now() + i,
          context: `Decision ${i}`,
          reasoning: `Reasoning ${i}`,
          alternatives: JSON.stringify([]),
          chosen_option: `Option ${i}`,
          outcome: null,
          lessons_learned: null,
          affected_components: null
        });
      }

      // Limit to 3 results
      const results = await engine.searchDecisions('', { limit: 3 });

      expect(results.length).toBe(3);
    });

    it('should use default limit of 50', async () => {
      // Create 60 decisions
      for (let i = 0; i < 60; i++) {
        await engine.storeDecision({
          timestamp: Date.now() + i,
          context: `Decision ${i}`,
          reasoning: `Reasoning ${i}`,
          alternatives: JSON.stringify([]),
          chosen_option: `Option ${i}`,
          outcome: null,
          lessons_learned: null,
          affected_components: null
        });
      }

      // No limit specified, should default to 50
      const results = await engine.searchDecisions('');

      expect(results.length).toBe(50);
    });
  });

  describe('Return Values', () => {
    it('should return all decision fields', async () => {
      const timestamp = Date.now();
      const context = 'Test context';
      const reasoning = 'Test reasoning';
      const alternatives = JSON.stringify([{ option: 'A', pros: [], cons: [] }]);
      const chosenOption = 'Option A';
      const affectedComponents = JSON.stringify(['component1', 'component2']);

      const id = await engine.storeDecision({
        timestamp,
        context,
        reasoning,
        alternatives,
        chosen_option: chosenOption,
        outcome: null,
        lessons_learned: null,
        affected_components: affectedComponents
      });

      const outcome = JSON.stringify({ success: true });
      const lessonsLearned = 'Learned something';

      await engine.updateDecisionOutcome(id, outcome, lessonsLearned);

      const results = await engine.searchDecisions('Test');

      expect(results.length).toBe(1);
      const decision = results[0];

      expect(decision.id).toBe(id);
      expect(decision.timestamp).toBe(timestamp);
      expect(decision.context).toBe(context);
      expect(decision.reasoning).toBe(reasoning);
      expect(decision.alternatives).toBe(alternatives);
      expect(decision.chosen_option).toBe(chosenOption);
      expect(decision.outcome).toBe(outcome);
      expect(decision.lessons_learned).toBe(lessonsLearned);
      expect(decision.affected_components).toBe(affectedComponents);
    });

    it('should include decisions with outcomes (Requirement 2.3)', async () => {
      const id = await engine.storeDecision({
        timestamp: Date.now(),
        context: 'Decision with outcome',
        reasoning: 'Test reasoning',
        alternatives: JSON.stringify([]),
        chosen_option: 'Option A',
        outcome: null,
        lessons_learned: null,
        affected_components: null
      });

      await engine.updateDecisionOutcome(
        id,
        JSON.stringify({ success: true, actual_effort: '3 days' }),
        'Worked as expected'
      );

      const results = await engine.searchDecisions('outcome');

      expect(results.length).toBe(1);
      expect(results[0].outcome).not.toBeNull();
      expect(results[0].lessons_learned).not.toBeNull();
    });
  });
});
