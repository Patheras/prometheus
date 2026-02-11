/**
 * Tests for Decision Storage (Task 9.1)
 * 
 * These tests verify:
 * - Storing decisions with all required fields (Requirement 2.1)
 * - Linking decisions to affected components (Requirement 2.5)
 * - Updating decisions with outcomes (Requirement 2.2)
 * - Field validation
 * 
 * Requirements: 2.1, 2.2, 2.5
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { initializeDatabase, createMemoryEngine, MemoryEngine } from '../index';
import { PrometheusDatabase } from '../database';
import { Decision } from '../types';

describe('Decision Storage (Task 9.1)', () => {
  let db: PrometheusDatabase;
  let engine: MemoryEngine;
  const testDbPath = join(__dirname, 'test-decision-storage.db');

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

  describe('Requirement 2.1: Store decisions with all required fields', () => {
    it('should store a decision with context, reasoning, alternatives, and chosen option', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Need to choose a database for the new feature',
        reasoning: 'PostgreSQL offers better JSON support and is already used in the project',
        alternatives: JSON.stringify([
          {
            option: 'PostgreSQL',
            pros: ['JSON support', 'Already in use', 'Strong ACID guarantees'],
            cons: ['More complex setup'],
            estimated_effort: '2 days',
          },
          {
            option: 'MongoDB',
            pros: ['Flexible schema', 'Easy to start'],
            cons: ['Not currently used', 'Learning curve'],
            estimated_effort: '3 days',
          },
        ]),
        chosen_option: 'PostgreSQL',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      const id = await engine.storeDecision(decision);

      // Verify ID format
      expect(id).toBeDefined();
      expect(id).toMatch(/^decision_\d+_[a-z0-9]+$/);

      // Verify the decision was stored with all fields
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(stored).toBeDefined();
      expect(stored.id).toBe(id);
      expect(stored.timestamp).toBe(decision.timestamp);
      expect(stored.context).toBe(decision.context);
      expect(stored.reasoning).toBe(decision.reasoning);
      expect(stored.alternatives).toBe(decision.alternatives);
      expect(stored.chosen_option).toBe(decision.chosen_option);
      expect(stored.outcome).toBeNull();
      expect(stored.lessons_learned).toBeNull();
      expect(stored.affected_components).toBeNull();
    });

    it('should validate that context is required', async () => {
      const decision = {
        timestamp: Date.now(),
        context: '', // Empty context
        reasoning: 'Test reasoning',
        alternatives: '[]',
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      await expect(engine.storeDecision(decision)).rejects.toThrow(
        'Decision context is required'
      );
    });

    it('should validate that reasoning is required', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Test context',
        reasoning: '', // Empty reasoning
        alternatives: '[]',
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      await expect(engine.storeDecision(decision)).rejects.toThrow(
        'Decision reasoning is required'
      );
    });

    it('should validate that alternatives is required', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Test context',
        reasoning: 'Test reasoning',
        alternatives: '', // Empty alternatives
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      await expect(engine.storeDecision(decision)).rejects.toThrow(
        'Decision alternatives are required'
      );
    });

    it('should validate that chosen_option is required', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Test context',
        reasoning: 'Test reasoning',
        alternatives: '[]',
        chosen_option: '', // Empty chosen option
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      await expect(engine.storeDecision(decision)).rejects.toThrow(
        'Decision chosen_option is required'
      );
    });

    it('should validate that alternatives is valid JSON', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Test context',
        reasoning: 'Test reasoning',
        alternatives: 'not valid json', // Invalid JSON
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      await expect(engine.storeDecision(decision)).rejects.toThrow(
        'Decision alternatives must be valid JSON array'
      );
    });

    it('should store multiple alternatives with detailed information', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Choosing authentication strategy',
        reasoning: 'Need secure and scalable authentication',
        alternatives: JSON.stringify([
          {
            option: 'JWT',
            pros: ['Stateless', 'Scalable', 'Industry standard'],
            cons: ['Token size', 'Revocation complexity'],
            estimated_effort: '1 week',
          },
          {
            option: 'Session-based',
            pros: ['Simple', 'Easy revocation'],
            cons: ['Stateful', 'Scaling challenges'],
            estimated_effort: '3 days',
          },
          {
            option: 'OAuth2',
            pros: ['Delegated auth', 'Third-party integration'],
            cons: ['Complex setup', 'Dependency on provider'],
            estimated_effort: '2 weeks',
          },
        ]),
        chosen_option: 'JWT',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      const id = await engine.storeDecision(decision);

      // Verify alternatives are stored correctly
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      const alternatives = JSON.parse(stored.alternatives);
      expect(alternatives).toHaveLength(3);
      expect(alternatives[0].option).toBe('JWT');
      expect(alternatives[1].option).toBe('Session-based');
      expect(alternatives[2].option).toBe('OAuth2');
    });
  });

  describe('Requirement 2.5: Link decisions to affected components', () => {
    it('should store decisions with affected components', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Refactoring authentication module',
        reasoning: 'Improve security and maintainability',
        alternatives: JSON.stringify([
          { option: 'Refactor', pros: ['Better code'], cons: ['Time'] },
          { option: 'Keep as-is', pros: ['No effort'], cons: ['Technical debt'] },
        ]),
        chosen_option: 'Refactor',
        outcome: null,
        lessons_learned: null,
        affected_components: JSON.stringify([
          'src/auth/login.ts',
          'src/auth/register.ts',
          'src/middleware/auth.ts',
          'src/models/user.ts',
        ]),
      };

      const id = await engine.storeDecision(decision);

      // Verify affected components are stored
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(stored.affected_components).toBeDefined();
      const components = JSON.parse(stored.affected_components!);
      expect(components).toHaveLength(4);
      expect(components).toContain('src/auth/login.ts');
      expect(components).toContain('src/middleware/auth.ts');
    });

    it('should validate that affected_components is valid JSON if provided', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Test context',
        reasoning: 'Test reasoning',
        alternatives: '[]',
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: 'not valid json', // Invalid JSON
      };

      await expect(engine.storeDecision(decision)).rejects.toThrow(
        'Decision affected_components must be valid JSON array'
      );
    });

    it('should allow decisions without affected components', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'High-level architectural decision',
        reasoning: 'Strategic direction',
        alternatives: JSON.stringify([
          { option: 'Microservices', pros: ['Scalable'], cons: ['Complex'] },
          { option: 'Monolith', pros: ['Simple'], cons: ['Scaling limits'] },
        ]),
        chosen_option: 'Microservices',
        outcome: null,
        lessons_learned: null,
        affected_components: null, // No specific components yet
      };

      const id = await engine.storeDecision(decision);

      // Verify decision is stored without affected components
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(stored.affected_components).toBeNull();
    });

    it('should link decisions to multiple types of components', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Implementing new payment gateway',
        reasoning: 'Support multiple payment methods',
        alternatives: JSON.stringify([
          { option: 'Stripe', pros: ['Easy integration'], cons: ['Fees'] },
          { option: 'PayPal', pros: ['Widely used'], cons: ['Complex API'] },
        ]),
        chosen_option: 'Stripe',
        outcome: null,
        lessons_learned: null,
        affected_components: JSON.stringify([
          'src/payment/gateway.ts',
          'src/payment/stripe-adapter.ts',
          'src/api/checkout.ts',
          'database/migrations/add_payment_tables.sql',
          'tests/payment/stripe.test.ts',
        ]),
      };

      const id = await engine.storeDecision(decision);

      // Verify all component types are stored
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      const components = JSON.parse(stored.affected_components!);
      expect(components).toHaveLength(5);
      expect(components).toContain('database/migrations/add_payment_tables.sql');
      expect(components).toContain('tests/payment/stripe.test.ts');
    });
  });

  describe('Requirement 2.2: Update decisions with outcomes', () => {
    it('should update a decision with outcome and lessons learned', async () => {
      // First, store a decision
      const decision = {
        timestamp: Date.now(),
        context: 'Choosing caching strategy',
        reasoning: 'Improve performance',
        alternatives: JSON.stringify([
          { option: 'Redis', pros: ['Fast'], cons: ['Cost'] },
          { option: 'In-memory', pros: ['Simple'], cons: ['Limited'] },
        ]),
        chosen_option: 'Redis',
        outcome: null,
        lessons_learned: null,
        affected_components: JSON.stringify(['src/cache/redis.ts']),
      };

      const id = await engine.storeDecision(decision);

      // Update with outcome
      await engine.updateDecisionOutcome(
        id,
        'Successfully implemented Redis caching. Response times improved by 60%.',
        'Redis setup was straightforward. Consider connection pooling for better performance.'
      );

      // Verify the outcome was updated
      const dbInstance = db.getDb();
      const updated = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(updated.outcome).toBe(
        'Successfully implemented Redis caching. Response times improved by 60%.'
      );
      expect(updated.lessons_learned).toBe(
        'Redis setup was straightforward. Consider connection pooling for better performance.'
      );
    });

    it('should throw error when updating non-existent decision', async () => {
      await expect(
        engine.updateDecisionOutcome(
          'non_existent_id',
          'Some outcome',
          'Some lessons'
        )
      ).rejects.toThrow('Decision not found: non_existent_id');
    });

    it('should allow updating outcome multiple times', async () => {
      // Store a decision
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

      // First update
      await engine.updateDecisionOutcome(
        id,
        'Initial outcome',
        'Initial lessons'
      );

      // Second update (e.g., after more time has passed)
      await engine.updateDecisionOutcome(
        id,
        'Updated outcome with more information',
        'Additional lessons learned over time'
      );

      // Verify the latest update
      const dbInstance = db.getDb();
      const updated = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(updated.outcome).toBe('Updated outcome with more information');
      expect(updated.lessons_learned).toBe(
        'Additional lessons learned over time'
      );
    });

    it('should store negative outcomes and lessons', async () => {
      // Store a decision
      const decision = {
        timestamp: Date.now(),
        context: 'Trying new deployment strategy',
        reasoning: 'Reduce downtime',
        alternatives: JSON.stringify([
          { option: 'Blue-green', pros: ['Zero downtime'], cons: ['Cost'] },
          { option: 'Rolling', pros: ['Simple'], cons: ['Some downtime'] },
        ]),
        chosen_option: 'Blue-green',
        outcome: null,
        lessons_learned: null,
        affected_components: JSON.stringify(['infrastructure/deploy.yml']),
      };

      const id = await engine.storeDecision(decision);

      // Update with negative outcome
      await engine.updateDecisionOutcome(
        id,
        'Failed: Blue-green deployment caused database connection issues. Rolled back to previous strategy.',
        'Blue-green requires careful database migration planning. Need to test more thoroughly in staging. Consider rolling deployment for database-heavy changes.'
      );

      // Verify negative outcome is stored
      const dbInstance = db.getDb();
      const updated = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(updated.outcome).toContain('Failed');
      expect(updated.lessons_learned).toContain('test more thoroughly');
    });
  });

  describe('Integration: Complete decision lifecycle', () => {
    it('should support complete decision lifecycle from creation to outcome', async () => {
      // 1. Store initial decision
      const decision = {
        timestamp: Date.now(),
        context: 'Implementing real-time notifications',
        reasoning: 'Users need instant updates for critical events',
        alternatives: JSON.stringify([
          {
            option: 'WebSockets',
            pros: ['Real-time', 'Bidirectional'],
            cons: ['Connection management', 'Scaling complexity'],
            estimated_effort: '2 weeks',
          },
          {
            option: 'Server-Sent Events',
            pros: ['Simple', 'HTTP-based'],
            cons: ['One-way only', 'Browser support'],
            estimated_effort: '1 week',
          },
          {
            option: 'Polling',
            pros: ['Simple', 'No special infrastructure'],
            cons: ['Inefficient', 'Not real-time'],
            estimated_effort: '3 days',
          },
        ]),
        chosen_option: 'WebSockets',
        outcome: null,
        lessons_learned: null,
        affected_components: JSON.stringify([
          'src/websocket/server.ts',
          'src/websocket/client.ts',
          'src/notifications/handler.ts',
          'src/api/notifications.ts',
        ]),
      };

      const id = await engine.storeDecision(decision);
      expect(id).toBeDefined();

      // 2. Verify initial storage
      const dbInstance = db.getDb();
      let stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(stored.context).toBe(decision.context);
      expect(stored.outcome).toBeNull();

      // 3. Update with outcome after implementation
      await engine.updateDecisionOutcome(
        id,
        'Successfully implemented WebSocket notifications. Users receive updates within 100ms. Connection stability is good with 99.9% uptime.',
        'WebSocket implementation was more complex than expected. Key learnings: 1) Need robust reconnection logic, 2) Heartbeat mechanism is essential, 3) Load balancer configuration is critical for sticky sessions.'
      );

      // 4. Verify final state
      stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(stored.outcome).toContain('Successfully implemented');
      expect(stored.lessons_learned).toContain('reconnection logic');

      // 5. Verify all data is intact
      const alternatives = JSON.parse(stored.alternatives);
      expect(alternatives).toHaveLength(3);

      const components = JSON.parse(stored.affected_components!);
      expect(components).toHaveLength(4);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle decisions with empty alternatives array', async () => {
      const decision = {
        timestamp: Date.now(),
        context: 'Emergency fix required',
        reasoning: 'Critical bug in production',
        alternatives: JSON.stringify([]), // Empty array - no time to consider alternatives
        chosen_option: 'Immediate hotfix',
        outcome: null,
        lessons_learned: null,
        affected_components: JSON.stringify(['src/critical/module.ts']),
      };

      const id = await engine.storeDecision(decision);
      expect(id).toBeDefined();

      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      const alternatives = JSON.parse(stored.alternatives);
      expect(alternatives).toHaveLength(0);
    });

    it('should handle very long context and reasoning', async () => {
      const longText = 'A'.repeat(10000); // 10KB of text

      const decision = {
        timestamp: Date.now(),
        context: longText,
        reasoning: longText,
        alternatives: JSON.stringify([{ option: 'A', pros: [], cons: [] }]),
        chosen_option: 'A',
        outcome: null,
        lessons_learned: null,
        affected_components: null,
      };

      const id = await engine.storeDecision(decision);
      expect(id).toBeDefined();

      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(stored.context).toHaveLength(10000);
      expect(stored.reasoning).toHaveLength(10000);
    });

    it('should handle special characters in decision fields', async () => {
      const decision = {
        timestamp: Date.now(),
        context: "Context with 'quotes' and \"double quotes\" and \n newlines",
        reasoning: 'Reasoning with special chars: <>&"\'',
        alternatives: JSON.stringify([
          { option: "Option with 'quotes'", pros: [], cons: [] },
        ]),
        chosen_option: "Option with 'quotes'",
        outcome: null,
        lessons_learned: null,
        affected_components: JSON.stringify(['src/file-with-special-chars.ts']),
      };

      const id = await engine.storeDecision(decision);
      expect(id).toBeDefined();

      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT * FROM decisions WHERE id = ?')
        .get(id) as Decision;

      expect(stored.context).toBe(decision.context);
      expect(stored.reasoning).toBe(decision.reasoning);
    });
  });
});
