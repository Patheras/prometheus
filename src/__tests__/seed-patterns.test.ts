/**
 * Tests for Pattern Seeding
 * 
 * Verifies that OpenClaw patterns are correctly loaded and stored in the database.
 * 
 * Requirements: 4.4
 */

import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { initializeDatabase } from '../memory/database';
import { createMemoryEngine } from '../memory/engine';
import { OPENCLAW_PATTERNS } from '../data/openclaw-patterns';
import { Pattern } from '../memory/types';

describe('Pattern Seeding', () => {
  const testDbPath = join(__dirname, '../../data/test-seed-patterns.db');
  let memoryEngine: ReturnType<typeof createMemoryEngine>;

  beforeEach(async () => {
    // Clean up test database if it exists
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Initialize fresh database
    const db = await initializeDatabase({ path: testDbPath });
    memoryEngine = createMemoryEngine(db);
  });

  afterEach(() => {
    // Clean up
    memoryEngine.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Pattern Definitions', () => {
    test('should have all required pattern categories', () => {
      const categories = new Set(OPENCLAW_PATTERNS.map(p => p.category));
      
      expect(categories).toContain('Concurrency');
      expect(categories).toContain('Architecture');
      expect(categories).toContain('Reliability');
      expect(categories).toContain('Performance');
      expect(categories).toContain('Data');
    });

    test('should have at least 10 patterns', () => {
      expect(OPENCLAW_PATTERNS.length).toBeGreaterThanOrEqual(10);
    });

    test('all patterns should have required fields', () => {
      for (const pattern of OPENCLAW_PATTERNS) {
        expect(pattern.name).toBeTruthy();
        expect(pattern.category).toBeTruthy();
        expect(pattern.problem).toBeTruthy();
        expect(pattern.solution).toBeTruthy();
        expect(pattern.applicability).toBeTruthy();
        expect(typeof pattern.success_count).toBe('number');
        expect(typeof pattern.failure_count).toBe('number');
      }
    });

    test('all patterns should have example code', () => {
      for (const pattern of OPENCLAW_PATTERNS) {
        expect(pattern.example_code).toBeTruthy();
        expect(pattern.example_code!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Pattern Storage', () => {
    test('should store patterns successfully', async () => {
      const pattern = OPENCLAW_PATTERNS[0]!;
      const id = await memoryEngine.storePattern(pattern);

      expect(id).toBeTruthy();
      expect(id).toMatch(/^pattern_\d+_[a-z0-9]+$/);
    });

    test('should store all OpenClaw patterns', async () => {
      const ids: string[] = [];

      for (const pattern of OPENCLAW_PATTERNS) {
        const id = await memoryEngine.storePattern(pattern);
        ids.push(id);
      }

      expect(ids.length).toBe(OPENCLAW_PATTERNS.length);
      expect(new Set(ids).size).toBe(ids.length); // All IDs should be unique
    });

    test('should store pattern with correct metadata', async () => {
      const pattern = OPENCLAW_PATTERNS[0]!;
      const id = await memoryEngine.storePattern(pattern);

      // Retrieve pattern from database
      const db = memoryEngine.getDatabase().getDb();
      const stored = db
        .prepare('SELECT * FROM patterns WHERE id = ?')
        .get(id) as Pattern;

      expect(stored).toBeTruthy();
      expect(stored.name).toBe(pattern.name);
      expect(stored.category).toBe(pattern.category);
      expect(stored.problem).toBe(pattern.problem);
      expect(stored.solution).toBe(pattern.solution);
      expect(stored.example_code).toBe(pattern.example_code);
      expect(stored.applicability).toBe(pattern.applicability);
      expect(stored.success_count).toBe(0);
      expect(stored.failure_count).toBe(0);
    });

    test('should initialize success and failure counts to 0', async () => {
      const pattern = OPENCLAW_PATTERNS[0]!;
      const id = await memoryEngine.storePattern(pattern);

      const db = memoryEngine.getDatabase().getDb();
      const stored = db
        .prepare('SELECT success_count, failure_count FROM patterns WHERE id = ?')
        .get(id) as { success_count: number; failure_count: number };

      expect(stored.success_count).toBe(0);
      expect(stored.failure_count).toBe(0);
    });
  });

  describe('Pattern Categories', () => {
    test('should store Concurrency patterns', async () => {
      const concurrencyPatterns = OPENCLAW_PATTERNS.filter(
        p => p.category === 'Concurrency'
      );

      expect(concurrencyPatterns.length).toBeGreaterThan(0);

      for (const pattern of concurrencyPatterns) {
        const id = await memoryEngine.storePattern(pattern);
        expect(id).toBeTruthy();
      }
    });

    test('should store Architecture patterns', async () => {
      const architecturePatterns = OPENCLAW_PATTERNS.filter(
        p => p.category === 'Architecture'
      );

      expect(architecturePatterns.length).toBeGreaterThan(0);

      for (const pattern of architecturePatterns) {
        const id = await memoryEngine.storePattern(pattern);
        expect(id).toBeTruthy();
      }
    });

    test('should store Reliability patterns', async () => {
      const reliabilityPatterns = OPENCLAW_PATTERNS.filter(
        p => p.category === 'Reliability'
      );

      expect(reliabilityPatterns.length).toBeGreaterThan(0);

      for (const pattern of reliabilityPatterns) {
        const id = await memoryEngine.storePattern(pattern);
        expect(id).toBeTruthy();
      }
    });

    test('should store Performance patterns', async () => {
      const performancePatterns = OPENCLAW_PATTERNS.filter(
        p => p.category === 'Performance'
      );

      expect(performancePatterns.length).toBeGreaterThan(0);

      for (const pattern of performancePatterns) {
        const id = await memoryEngine.storePattern(pattern);
        expect(id).toBeTruthy();
      }
    });

    test('should store Data patterns', async () => {
      const dataPatterns = OPENCLAW_PATTERNS.filter(
        p => p.category === 'Data'
      );

      expect(dataPatterns.length).toBeGreaterThan(0);

      for (const pattern of dataPatterns) {
        const id = await memoryEngine.storePattern(pattern);
        expect(id).toBeTruthy();
      }
    });
  });

  describe('Specific Pattern Verification', () => {
    test('should include Lane-Based Queue System pattern', async () => {
      const pattern = OPENCLAW_PATTERNS.find(
        p => p.name === 'Lane-Based Queue System'
      );

      expect(pattern).toBeTruthy();
      expect(pattern!.category).toBe('Concurrency');
      expect(pattern!.problem).toContain('race conditions');
      expect(pattern!.solution).toContain('lanes');
    });

    test('should include Hybrid Search pattern', async () => {
      const pattern = OPENCLAW_PATTERNS.find(
        p => p.name === 'Hybrid Search (Vector + Keyword)'
      );

      expect(pattern).toBeTruthy();
      expect(pattern!.category).toBe('Architecture');
      expect(pattern!.problem).toContain('Vector search');
      expect(pattern!.solution).toContain('merge results');
    });

    test('should include Cascading Fallback pattern', async () => {
      const pattern = OPENCLAW_PATTERNS.find(
        p => p.name === 'Cascading Fallback with Auth Rotation'
      );

      expect(pattern).toBeTruthy();
      expect(pattern!.category).toBe('Reliability');
      expect(pattern!.problem).toContain('API key');
      expect(pattern!.solution).toContain('multiple models');
    });

    test('should include Embedding Cache pattern', async () => {
      const pattern = OPENCLAW_PATTERNS.find(
        p => p.name === 'Embedding Cache with Content Hashing'
      );

      expect(pattern).toBeTruthy();
      expect(pattern!.category).toBe('Performance');
      expect(pattern!.problem).toContain('expensive');
      expect(pattern!.solution).toContain('content hash');
    });

    test('should include Multi-Source Memory pattern', async () => {
      const pattern = OPENCLAW_PATTERNS.find(
        p => p.name === 'Multi-Source Memory System'
      );

      expect(pattern).toBeTruthy();
      expect(pattern!.category).toBe('Data');
      expect(pattern!.problem).toContain('scattered');
      expect(pattern!.solution).toContain('unified');
    });
  });

  describe('Pattern Retrieval', () => {
    test('should retrieve patterns by category', async () => {
      // Store all patterns
      for (const pattern of OPENCLAW_PATTERNS) {
        await memoryEngine.storePattern(pattern);
      }

      // Query by category
      const db = memoryEngine.getDatabase().getDb();
      const concurrencyPatterns = db
        .prepare('SELECT * FROM patterns WHERE category = ?')
        .all('Concurrency') as Pattern[];

      expect(concurrencyPatterns.length).toBeGreaterThan(0);
      for (const pattern of concurrencyPatterns) {
        expect(pattern.category).toBe('Concurrency');
      }
    });

    test('should retrieve patterns by name', async () => {
      // Store all patterns
      for (const pattern of OPENCLAW_PATTERNS) {
        await memoryEngine.storePattern(pattern);
      }

      // Query by name
      const db = memoryEngine.getDatabase().getDb();
      const pattern = db
        .prepare('SELECT * FROM patterns WHERE name = ?')
        .get('Lane-Based Queue System') as Pattern;

      expect(pattern).toBeTruthy();
      expect(pattern.name).toBe('Lane-Based Queue System');
      expect(pattern.category).toBe('Concurrency');
    });

    test('should count patterns correctly', async () => {
      // Store all patterns
      for (const pattern of OPENCLAW_PATTERNS) {
        await memoryEngine.storePattern(pattern);
      }

      // Count patterns
      const db = memoryEngine.getDatabase().getDb();
      const result = db
        .prepare('SELECT COUNT(*) as count FROM patterns')
        .get() as { count: number };

      expect(result.count).toBe(OPENCLAW_PATTERNS.length);
    });
  });

  describe('Error Handling', () => {
    test('should handle duplicate pattern names gracefully', async () => {
      const pattern = OPENCLAW_PATTERNS[0]!;

      // Store pattern twice
      const id1 = await memoryEngine.storePattern(pattern);
      const id2 = await memoryEngine.storePattern(pattern);

      // Both should succeed with different IDs
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);

      // Both should be in database
      const db = memoryEngine.getDatabase().getDb();
      const patterns = db
        .prepare('SELECT * FROM patterns WHERE name = ?')
        .all(pattern.name) as Pattern[];

      expect(patterns.length).toBe(2);
    });

    test('should handle patterns with null example_code', async () => {
      const pattern: Omit<Pattern, 'id'> = {
        name: 'Test Pattern',
        category: 'Test',
        problem: 'Test problem',
        solution: 'Test solution',
        example_code: null,
        applicability: 'Test applicability',
        success_count: 0,
        failure_count: 0,
      };

      const id = await memoryEngine.storePattern(pattern);
      expect(id).toBeTruthy();

      const db = memoryEngine.getDatabase().getDb();
      const stored = db
        .prepare('SELECT * FROM patterns WHERE id = ?')
        .get(id) as Pattern;

      expect(stored.example_code).toBeNull();
    });
  });
});
