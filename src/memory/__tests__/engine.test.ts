/**
 * Tests for Memory Engine interface and base class
 * 
 * These tests verify:
 * - Database connection management
 * - Transaction support
 * - Basic CRUD operations for decisions, metrics, and patterns
 * - ID generation
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 4.1
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { initializeDatabase, createMemoryEngine, MemoryEngine } from '../index';
import { PrometheusDatabase } from '../database';

describe('MemoryEngine', () => {
  let db: PrometheusDatabase;
  let engine: MemoryEngine;
  const testDbPath = join(__dirname, 'test-engine.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testDbPath + '-shm')) {
      unlinkSync(testDbPath + '-shm');
    }
    if (existsSync(testDbPath + '-wal')) {
      unlinkSync(testDbPath + '-wal');
    }

    // Initialize database
    db = await initializeDatabase({ path: testDbPath });
    engine = createMemoryEngine(db);
  });

  afterEach(() => {
    // Close database connection
    if (engine) {
      engine.close();
    }

    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testDbPath + '-shm')) {
      unlinkSync(testDbPath + '-shm');
    }
    if (existsSync(testDbPath + '-wal')) {
      unlinkSync(testDbPath + '-wal');
    }
  });

  describe('Database Connection Management', () => {
    it('should create a memory engine instance', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(MemoryEngine);
    });

    it('should provide access to the underlying database', () => {
      const database = engine.getDatabase();
      expect(database).toBeDefined();
      expect(database).toBeInstanceOf(PrometheusDatabase);
    });

    it('should close the database connection', () => {
      engine.close();
      expect(db.isOpen()).toBe(false);
    });
  });

  describe('Transaction Support', () => {
    it('should execute operations within a transaction', () => {
      const result = engine.transaction(() => {
        return 'test result';
      });

      expect(result).toBe('test result');
    });

    it('should rollback transaction on error', () => {
      expect(() => {
        engine.transaction(() => {
          // Store a decision
          const dbInstance = db.getDb();
          dbInstance
            .prepare(`
              INSERT INTO decisions (
                id, timestamp, context, reasoning, alternatives, chosen_option
              ) VALUES (?, ?, ?, ?, ?, ?)
            `)
            .run('test_id', Date.now(), 'context', 'reasoning', '[]', 'option1');

          // Throw an error to trigger rollback
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      // Verify the decision was not stored
      const dbInstance = db.getDb();
      const result = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get('test_id');

      expect(result).toBeUndefined();
    });
  });

  describe('Decision Memory Operations', () => {
    it('should store a decision', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Test context',
        reasoning: 'Test reasoning',
        alternatives: JSON.stringify([
          { option: 'A', pros: ['pro1'], cons: ['con1'] },
          { option: 'B', pros: ['pro2'], cons: ['con2'] },
        ]),
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      const id = await engine.storeDecision(decision);

      expect(id).toBeDefined();
      expect(id).toMatch(/^decision_\d+_[a-z0-9]+$/);

      // Verify the decision was stored
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id);

      expect(stored).toBeDefined();
      expect((stored as any).context).toBe(decision.context);
      expect((stored as any).reasoning).toBe(decision.reasoning);
    });

    it('should update decision outcome', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Test context',
        reasoning: 'Test reasoning',
        alternatives: '[]',
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      const id = await engine.storeDecision(decision);

      await engine.updateDecisionOutcome(
        id,
        'Success',
        'Learned that option A was the right choice'
      );

      // Verify the outcome was updated
      const dbInstance = db.getDb();
      const updated = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id);

      expect((updated as any).outcome).toBe('Success');
      expect((updated as any).lessons_learned).toBe(
        'Learned that option A was the right choice'
      );
    });
  });

  describe('Metric Memory Operations', () => {
    it('should store a single metric', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: JSON.stringify({ endpoint: '/api/users' }),
        },
      ];

      await engine.storeMetrics(metrics);

      // Verify the metric was stored
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM metrics WHERE id = ?')
        .get('metric_1');

      expect(stored).toBeDefined();
      expect((stored as any).metric_type).toBe('performance');
      expect((stored as any).value).toBe(150.5);
    });

    it('should store multiple metrics in a batch', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 200.3,
          context: null,
        },
        {
          id: 'metric_3',
          timestamp: Date.now(),
          metric_type: 'usage',
          metric_name: 'active_users',
          value: 42,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Verify all metrics were stored
      const dbInstance = db.getDb();
      const count = dbInstance
        .prepare('SELECT COUNT(*) as count FROM metrics')
        .get() as { count: number };

      expect(count.count).toBe(3);
    });

    it('should store metrics with context', async () => {
      const metrics = [
        {
          id: 'metric_with_context',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: JSON.stringify({ 
            endpoint: '/api/users',
            method: 'GET',
            status: 200
          }),
        },
      ];

      await engine.storeMetrics(metrics);

      // Verify the metric was stored with context
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM metrics WHERE id = ?')
        .get('metric_with_context');

      expect(stored).toBeDefined();
      expect((stored as any).context).toBeDefined();
      
      const context = JSON.parse((stored as any).context);
      expect(context.endpoint).toBe('/api/users');
      expect(context.method).toBe('GET');
      expect(context.status).toBe(200);
    });

    it('should handle empty array gracefully', async () => {
      await engine.storeMetrics([]);
      
      // Should not throw and should not store anything
      const dbInstance = db.getDb();
      const count = dbInstance
        .prepare('SELECT COUNT(*) as count FROM metrics')
        .get() as { count: number };

      expect(count.count).toBe(0);
    });

    it('should validate required field: id', async () => {
      const metrics = [
        {
          id: '',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
      ];

      await expect(engine.storeMetrics(metrics)).rejects.toThrow(
        'Metric at index 0: id is required and must be a non-empty string'
      );
    });

    it('should validate required field: timestamp', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: 'invalid' as any,
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
      ];

      await expect(engine.storeMetrics(metrics)).rejects.toThrow(
        'Metric at index 0: timestamp is required and must be a number'
      );
    });

    it('should validate required field: metric_type', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: '',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
      ];

      await expect(engine.storeMetrics(metrics)).rejects.toThrow(
        'Metric at index 0: metric_type is required and must be a non-empty string'
      );
    });

    it('should validate required field: metric_name', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: '',
          value: 150.5,
          context: null,
        },
      ];

      await expect(engine.storeMetrics(metrics)).rejects.toThrow(
        'Metric at index 0: metric_name is required and must be a non-empty string'
      );
    });

    it('should validate required field: value', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 'invalid' as any,
          context: null,
        },
      ];

      await expect(engine.storeMetrics(metrics)).rejects.toThrow(
        'Metric at index 0: value is required and must be a number'
      );
    });

    it('should validate context is valid JSON', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: 'invalid json',
        },
      ];

      await expect(engine.storeMetrics(metrics)).rejects.toThrow(
        'Metric at index 0: context must be valid JSON'
      );
    });

    it('should validate input is an array', async () => {
      await expect(engine.storeMetrics('not an array' as any)).rejects.toThrow(
        'Metrics must be an array'
      );
    });

    it('should validate all metrics in batch', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 200.3,
          context: null,
        },
        {
          id: '', // Invalid
          timestamp: Date.now(),
          metric_type: 'usage',
          metric_name: 'active_users',
          value: 42,
          context: null,
        },
      ];

      await expect(engine.storeMetrics(metrics)).rejects.toThrow(
        'Metric at index 2: id is required and must be a non-empty string'
      );

      // Verify no metrics were stored (transaction rollback)
      const dbInstance = db.getDb();
      const count = dbInstance
        .prepare('SELECT COUNT(*) as count FROM metrics')
        .get() as { count: number };

      expect(count.count).toBe(0);
    });

    it('should use transaction for batch insertion', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 200.3,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Verify both metrics were stored atomically
      const dbInstance = db.getDb();
      const count = dbInstance
        .prepare('SELECT COUNT(*) as count FROM metrics')
        .get() as { count: number };

      expect(count.count).toBe(2);
    });

    it('should index metrics by type', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'usage',
          metric_name: 'active_users',
          value: 42,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Query by metric_type using index
      const dbInstance = db.getDb();
      const performanceMetrics = dbInstance
        .prepare('SELECT * FROM metrics WHERE metric_type = ?')
        .all('performance');

      expect(performanceMetrics).toHaveLength(1);
      expect((performanceMetrics[0] as any).metric_name).toBe('response_time');
    });

    it('should index metrics by name', async () => {
      const metrics = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'cpu_usage',
          value: 75.2,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Query by metric_name using index
      const dbInstance = db.getDb();
      const responseTimeMetrics = dbInstance
        .prepare('SELECT * FROM metrics WHERE metric_name = ?')
        .all('response_time');

      expect(responseTimeMetrics).toHaveLength(1);
      expect((responseTimeMetrics[0] as any).value).toBe(150.5);
    });

    it('should index metrics by timestamp', async () => {
      const now = Date.now();
      const metrics = [
        {
          id: 'metric_1',
          timestamp: now - 1000,
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 150.5,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: now,
          metric_type: 'performance',
          metric_name: 'response_time',
          value: 200.3,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Query by timestamp range using index
      const dbInstance = db.getDb();
      const recentMetrics = dbInstance
        .prepare('SELECT * FROM metrics WHERE timestamp >= ? ORDER BY timestamp')
        .all(now - 500);

      expect(recentMetrics).toHaveLength(1);
      expect((recentMetrics[0] as any).id).toBe('metric_2');
    });
  });

  describe('Pattern Memory Operations', () => {
    it('should store a pattern', async () => {
      const pattern = {
        name: 'Singleton Pattern',
        category: 'Creational',
        problem: 'Need to ensure only one instance of a class exists',
        solution: 'Use a static instance and private constructor',
        example_code: 'class Singleton { private static instance: Singleton; }',
        applicability: 'When you need global access to a single instance',
        success_count: 0,
        failure_count: 0,
      };

      const id = await engine.storePattern(pattern);

      expect(id).toBeDefined();
      expect(id).toMatch(/^pattern_\d+_[a-z0-9]+$/);

      // Verify the pattern was stored
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM patterns WHERE id = ?')
        .get(id);

      expect(stored).toBeDefined();
      expect((stored as any).name).toBe(pattern.name);
      expect((stored as any).category).toBe(pattern.category);
    });

    it('should update pattern outcome on success', async () => {
      const pattern = {
        name: 'Test Pattern',
        category: 'Test',
        problem: 'Test problem',
        solution: 'Test solution',
        example_code: null,
        applicability: null,
        success_count: 0,
        failure_count: 0,
      };

      const id = await engine.storePattern(pattern);

      await engine.updatePatternOutcome(id, {
        success: true,
        context: 'Applied successfully',
        notes: 'Worked well',
      });

      // Verify the success count was incremented
      const dbInstance = db.getDb();
      const updated = dbInstance
        .prepare('SELECT * FROM patterns WHERE id = ?')
        .get(id);

      expect((updated as any).success_count).toBe(1);
      expect((updated as any).failure_count).toBe(0);
    });

    it('should update pattern outcome on failure', async () => {
      const pattern = {
        name: 'Test Pattern',
        category: 'Test',
        problem: 'Test problem',
        solution: 'Test solution',
        example_code: null,
        applicability: null,
        success_count: 0,
        failure_count: 0,
      };

      const id = await engine.storePattern(pattern);

      await engine.updatePatternOutcome(id, {
        success: false,
        context: 'Failed to apply',
        notes: 'Did not work',
      });

      // Verify the failure count was incremented
      const dbInstance = db.getDb();
      const updated = dbInstance
        .prepare('SELECT * FROM patterns WHERE id = ?')
        .get(id);

      expect((updated as any).success_count).toBe(0);
      expect((updated as any).failure_count).toBe(1);
    });
  });

  describe('File Metadata Operations', () => {
    it('should return null for non-existent file', async () => {
      const metadata = await engine.getFileMetadata('/non/existent/file.ts');
      expect(metadata).toBeNull();
    });

    it('should retrieve file metadata', async () => {
      // Insert a test file
      const dbInstance = db.getDb();
      dbInstance
        .prepare(`
          INSERT INTO code_files (path, repo, hash, language, size, last_modified)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          '/test/file.ts',
          'test-repo',
          'abc123',
          'typescript',
          1024,
          Date.now()
        );

      const metadata = await engine.getFileMetadata('/test/file.ts');

      expect(metadata).toBeDefined();
      expect(metadata?.path).toBe('/test/file.ts');
      expect(metadata?.repo).toBe('test-repo');
      expect(metadata?.language).toBe('typescript');
    });
  });

  describe('Not Implemented Methods', () => {
    // indexCodebase is now implemented in task 5.1
    // searchCode is now implemented in task 8.1
    // searchDecisions is now implemented in task 9.2
    // storeMetrics is now implemented in task 10.1
    // queryMetrics will be implemented in task 10.2
    // detectAnomalies will be implemented in task 10.3
    
    it('should return empty results for searchCode with no indexed data', async () => {
      // searchCode is now implemented, but returns empty results when no data is indexed
      const results = await engine.searchCode('test query');
      expect(results).toEqual([]);
    });

    it('should return empty results for searchDecisions with no data', async () => {
      // searchDecisions is now implemented, but returns empty results when no data exists
      const results = await engine.searchDecisions('test query');
      expect(results).toEqual([]);
    });

    it('should throw for searchPatterns', async () => {
      await expect(engine.searchPatterns('test problem')).rejects.toThrow(
        'Not implemented: searchPatterns'
      );
    });

    it('should throw for unified search', async () => {
      await expect(engine.search('test query')).rejects.toThrow(
        'Not implemented: search'
      );
    });
  });
});
