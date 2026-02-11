/**
 * Tests for RepositoryPatternTracker
 */

import { RepositoryPatternTracker, PatternCategory } from '../repository-pattern-tracker';
import { MemoryEngine } from '../../memory/engine';

describe('RepositoryPatternTracker', () => {
  let memoryEngine: MemoryEngine;
  let tracker: RepositoryPatternTracker;

  beforeEach(() => {
    memoryEngine = new MemoryEngine({
      dbPath: ':memory:',
      embeddingProvider: 'mock',
    });
    tracker = new RepositoryPatternTracker('test-repo', memoryEngine);
  });

  afterEach(async () => {
    await memoryEngine.close();
  });

  describe('Pattern Analysis', () => {
    it('should analyze repository and return results', async () => {
      // Index some sample code
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/utils/helper.ts',
          content: `
            function calculateTotal(items: Item[]): number {
              return items.reduce((sum, item) => sum + item.price, 0);
            }
            
            function formatCurrency(amount: number): string {
              return \`$\${amount.toFixed(2)}\`;
            }
          `,
          language: 'typescript',
        },
        {
          path: 'src/models/User.ts',
          content: `
            class User {
              constructor(public name: string, public email: string) {}
            }
            
            interface IUserRepository {
              findById(id: string): Promise<User | null>;
            }
          `,
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');

      expect(result.repoId).toBe('test-repo');
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.conventions.length).toBeGreaterThan(0);
      expect(Array.isArray(result.violations)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should detect naming conventions', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/service.ts',
          content: `
            function getUserById(id: string) {}
            function createUser(data: any) {}
            function updateUserEmail(id: string, email: string) {}
          `,
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');
      const namingPatterns = result.patterns.filter(p => p.category === 'naming');

      expect(namingPatterns.length).toBeGreaterThan(0);
      expect(namingPatterns.some(p => p.name.includes('camelCase'))).toBe(true);
    });

    it('should detect structure patterns', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/components/Button.tsx',
          content: 'export const Button = () => {};',
          language: 'typescript',
        },
        {
          path: 'src/utils/format.ts',
          content: 'export const format = () => {};',
          language: 'typescript',
        },
        {
          path: 'src/types/user.ts',
          content: 'export interface User {}',
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');
      const structurePatterns = result.patterns.filter(p => p.category === 'structure');

      expect(structurePatterns.length).toBeGreaterThan(0);
    });

    it('should detect testing patterns', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/utils/__tests__/helper.test.ts',
          content: `
            describe('helper', () => {
              it('should work', () => {
                expect(true).toBe(true);
              });
            });
          `,
          language: 'typescript',
        },
        {
          path: 'src/models/__tests__/User.test.ts',
          content: `
            describe('User', () => {
              it('should create user', () => {
                expect(true).toBe(true);
              });
            });
          `,
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');
      const testingPatterns = result.patterns.filter(p => p.category === 'testing');

      expect(testingPatterns.length).toBeGreaterThan(0);
      expect(testingPatterns.some(p => p.name.includes('.test.'))).toBe(true);
    });

    it('should detect code style patterns', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/index.ts',
          content: `
            const name = 'John';
            const greeting = 'Hello';
            const message = 'World';
          `,
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');
      const stylePatterns = result.patterns.filter(p => p.category === 'code-style');

      expect(stylePatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Retrieval', () => {
    beforeEach(async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/utils/helper.ts',
          content: 'function helper() {}',
          language: 'typescript',
        },
      ]);
      await tracker.analyzeRepository('/fake/path');
    });

    it('should get all patterns', () => {
      const patterns = tracker.getPatterns();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should get patterns by category', () => {
      const namingPatterns = tracker.getPatternsByCategory('naming');
      expect(Array.isArray(namingPatterns)).toBe(true);
      namingPatterns.forEach(p => {
        expect(p.category).toBe('naming');
      });
    });

    it('should get high confidence patterns', () => {
      const highConfidence = tracker.getHighConfidencePatterns(0.7);
      expect(Array.isArray(highConfidence)).toBe(true);
      highConfidence.forEach(p => {
        expect(p.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should filter by custom confidence threshold', () => {
      const patterns = tracker.getHighConfidencePatterns(0.9);
      patterns.forEach(p => {
        expect(p.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });
  });

  describe('Pattern Persistence', () => {
    it('should persist patterns to memory engine', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/index.ts',
          content: 'function test() {}',
          language: 'typescript',
        },
      ]);

      await tracker.analyzeRepository('/fake/path');

      // Create new tracker to test loading
      const newTracker = new RepositoryPatternTracker('test-repo', memoryEngine);
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/index2.ts',
          content: 'function test2() {}',
          language: 'typescript',
        },
      ]);
      await newTracker.analyzeRepository('/fake/path');

      const patterns = newTracker.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Convention Extraction', () => {
    it('should extract high-confidence conventions', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/utils.ts',
          content: `
            function helperOne() {}
            function helperTwo() {}
            function helperThree() {}
          `,
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');

      expect(result.conventions.length).toBeGreaterThan(0);
      result.conventions.forEach(conv => {
        expect(conv.confidence).toBeGreaterThan(0);
        expect(conv.type).toBeTruthy();
        expect(conv.pattern).toBeTruthy();
        expect(Array.isArray(conv.examples)).toBe(true);
      });
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for missing patterns', async () => {
      // Index code without tests
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/index.ts',
          content: 'function main() {}',
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');

      expect(Array.isArray(result.recommendations)).toBe(true);
      // Should recommend adding tests
      expect(result.recommendations.some(r => r.toLowerCase().includes('test'))).toBe(true);
    });

    it('should recommend establishing conventions for low confidence patterns', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/a.ts',
          content: 'function test() {}',
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Categories', () => {
    it('should support all pattern categories', () => {
      const categories: PatternCategory[] = [
        'naming',
        'structure',
        'architecture',
        'testing',
        'documentation',
        'commit',
        'code-style',
        'import',
        'error-handling',
        'api-design',
      ];

      categories.forEach(category => {
        const patterns = tracker.getPatternsByCategory(category);
        expect(Array.isArray(patterns)).toBe(true);
      });
    });
  });

  describe('Pattern Confidence', () => {
    it('should calculate confidence based on occurrences', async () => {
      await memoryEngine.indexRepository('test-repo', '/fake/path', [
        {
          path: 'src/a.ts',
          content: 'function testOne() {}',
          language: 'typescript',
        },
        {
          path: 'src/b.ts',
          content: 'function testTwo() {}',
          language: 'typescript',
        },
        {
          path: 'src/c.ts',
          content: 'function testThree() {}',
          language: 'typescript',
        },
      ]);

      const result = await tracker.analyzeRepository('/fake/path');
      const patterns = result.patterns;

      patterns.forEach(p => {
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Multiple Repositories', () => {
    it('should isolate patterns per repository', async () => {
      const tracker1 = new RepositoryPatternTracker('repo1', memoryEngine);
      const tracker2 = new RepositoryPatternTracker('repo2', memoryEngine);

      await memoryEngine.indexRepository('repo1', '/path1', [
        {
          path: 'src/index.ts',
          content: 'function test() {}',
          language: 'typescript',
        },
      ]);

      await memoryEngine.indexRepository('repo2', '/path2', [
        {
          path: 'src/index.ts',
          content: 'class Test {}',
          language: 'typescript',
        },
      ]);

      const result1 = await tracker1.analyzeRepository('/path1');
      const result2 = await tracker2.analyzeRepository('/path2');

      expect(result1.repoId).toBe('repo1');
      expect(result2.repoId).toBe('repo2');
    });
  });
});
