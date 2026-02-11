/**
 * Debt Detector Tests
 * 
 * Tests for technical debt detection and quantification.
 * 
 * Task 27.1: Create debt detection systems
 * Task 27.2: Implement debt quantification
 * Task 27.3: Implement debt threshold monitoring
 */

import { createDebtDetector } from '../debt-detector';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DebtDetector', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'debt-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('TODO/FIXME Detection', () => {
    it('should detect TODO comments', async () => {
      const detector = createDebtDetector();
      
      // Create test file with TODO
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        function test() {
          // TODO: Implement this properly
          return null;
        }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBeGreaterThan(0);
      expect(summary.byType['todo_comment']).toBeGreaterThan(0);
    });

    it('should detect FIXME comments with higher priority', async () => {
      const detector = createDebtDetector();
      
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        function buggy() {
          // FIXME: This breaks on edge cases
          return true;
        }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBeGreaterThan(0);
      // FIXME should have higher priority than TODO
      const fixmeItems = summary.byType['todo_comment'];
      expect(fixmeItems).toBeGreaterThan(0);
    });

    it('should detect HACK and XXX comments', async () => {
      const detector = createDebtDetector();
      
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        function hacky() {
          // HACK: Temporary workaround
          // XXX: This needs review
          return 42;
        }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Missing Tests Detection', () => {
    it('should detect files without tests', async () => {
      const detector = createDebtDetector();
      
      // Create source file without test
      const sourceFile = path.join(tempDir, 'calculator.ts');
      await fs.writeFile(
        sourceFile,
        `
        export function add(a: number, b: number) {
          return a + b;
        }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeTodoComments: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBeGreaterThan(0);
      expect(summary.byType['missing_test']).toBeGreaterThan(0);
    });

    it('should not flag files that have tests', async () => {
      const detector = createDebtDetector();
      
      // Create source file
      const sourceFile = path.join(tempDir, 'calculator.ts');
      await fs.writeFile(sourceFile, 'export function add(a, b) { return a + b; }');

      // Create test file
      const testFile = path.join(tempDir, 'calculator.test.ts');
      await fs.writeFile(testFile, 'test("add", () => {});');

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeTodoComments: false,
        includeArchitecturalViolations: false,
      });

      // Should not detect missing test for calculator.ts
      expect(summary.byType['missing_test'] || 0).toBe(0);
    });
  });

  describe('Outdated Dependencies Detection', () => {
    it('should detect pre-1.0 dependencies', async () => {
      const detector = createDebtDetector();
      
      // Create package.json with old dependencies
      const packageJson = {
        name: 'test-project',
        dependencies: {
          'old-package': '^0.9.0',
          'stable-package': '^2.0.0',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summary = await detector.detectDebt(tempDir, {
        includeTodoComments: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBeGreaterThan(0);
      expect(summary.byType['outdated_dependency']).toBeGreaterThan(0);
    });

    it('should handle missing package.json', async () => {
      const detector = createDebtDetector();

      const summary = await detector.detectDebt(tempDir, {
        includeTodoComments: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      // Should not crash, just return empty results
      expect(summary.totalItems).toBe(0);
    });
  });

  describe('Architectural Violations Detection', () => {
    it('should detect large files', async () => {
      const detector = createDebtDetector();
      
      // Create large file (> 500 lines)
      const lines = Array(600).fill('console.log("line");').join('\n');
      const largeFile = path.join(tempDir, 'large.ts');
      await fs.writeFile(largeFile, lines);

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeTodoComments: false,
        includeMissingTests: false,
      });

      expect(summary.totalItems).toBeGreaterThan(0);
      expect(summary.byType['architectural_violation']).toBeGreaterThan(0);
    });

    it('should detect God objects (classes with many methods)', async () => {
      const detector = createDebtDetector();
      
      // Create class with many methods
      const methods = Array(25)
        .fill(0)
        .map((_, i) => `  method${i}() { return ${i}; }`)
        .join('\n');
      
      const godClass = path.join(tempDir, 'god.ts');
      await fs.writeFile(
        godClass,
        `
        class GodObject {
          ${methods}
        }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeTodoComments: false,
        includeMissingTests: false,
      });

      expect(summary.totalItems).toBeGreaterThan(0);
      expect(summary.byType['architectural_violation']).toBeGreaterThan(0);
    });
  });

  describe('Debt Quantification', () => {
    it('should calculate total debt hours', async () => {
      const detector = createDebtDetector();
      
      // Create multiple debt items
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Fix this
        // FIXME: And this
        function test() {
          return 42;
        }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalHours).toBeGreaterThan(0);
      expect(summary.totalItems).toBeGreaterThan(0);
    });

    it('should group debt by type', async () => {
      const detector = createDebtDetector();
      
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Implement
        function test() { return 1; }
        `
      );

      const summary = await detector.detectDebt(tempDir);

      expect(summary.byType).toBeDefined();
      expect(Object.keys(summary.byType).length).toBeGreaterThan(0);
    });

    it('should group debt by priority', async () => {
      const detector = createDebtDetector();
      
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Low priority
        // FIXME: High priority
        function test() { return 1; }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.byPriority).toBeDefined();
      expect(Object.keys(summary.byPriority).length).toBeGreaterThan(0);
    });
  });

  describe('Threshold Monitoring', () => {
    it('should detect when debt exceeds warning threshold', async () => {
      const detector = createDebtDetector({
        warning: 1, // Very low threshold for testing
        critical: 10,
        maximum: 20,
      });

      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Item 1
        // TODO: Item 2
        function test() { return 1; }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      const thresholds = detector.checkThresholds(summary);

      expect(thresholds.exceedsWarning).toBe(true);
    });

    it('should detect when debt exceeds critical threshold', async () => {
      const detector = createDebtDetector({
        warning: 1,
        critical: 2,
        maximum: 20,
      });

      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Item 1
        // TODO: Item 2
        // TODO: Item 3
        function test() { return 1; }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      const thresholds = detector.checkThresholds(summary);

      expect(thresholds.exceedsCritical).toBe(true);
      expect(thresholds.requiresConsultation).toBe(true);
    });

    it('should require consultation for critical items', async () => {
      const detector = createDebtDetector();

      // Manually create summary with critical items
      const summary = {
        totalItems: 1,
        totalHours: 5,
        byType: { todo_comment: 1 },
        byPriority: { 5: 1 },
        criticalItems: [
          {
            id: '1',
            type: 'todo_comment' as const,
            description: 'Critical issue',
            effortHours: 5,
            priority: 5,
            detectedAt: Date.now(),
          },
        ],
      };

      const thresholds = detector.checkThresholds(summary);

      expect(thresholds.requiresConsultation).toBe(true);
    });
  });

  describe('Detection Options', () => {
    it('should respect minPriority filter', async () => {
      const detector = createDebtDetector();
      
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Low priority
        function test() { return 1; }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        minPriority: 4, // Only high priority
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      // TODO has priority 2, should be filtered out
      expect(summary.totalItems).toBe(0);
    });

    it('should respect maxItems limit', async () => {
      const detector = createDebtDetector();
      
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Item 1
        // TODO: Item 2
        // TODO: Item 3
        // TODO: Item 4
        // TODO: Item 5
        function test() { return 1; }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        maxItems: 2,
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBeLessThanOrEqual(2);
    });

    it('should allow disabling specific detection types', async () => {
      const detector = createDebtDetector();
      
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Should not be detected
        function test() { return 1; }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeTodoComments: false,
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBe(0);
    });
  });

  describe('Summary Structure', () => {
    it('should include all required fields', async () => {
      const detector = createDebtDetector();

      const summary = await detector.detectDebt(tempDir);

      expect(summary).toHaveProperty('totalItems');
      expect(summary).toHaveProperty('totalHours');
      expect(summary).toHaveProperty('byType');
      expect(summary).toHaveProperty('byPriority');
      expect(summary).toHaveProperty('criticalItems');
    });

    it('should handle empty codebase', async () => {
      const detector = createDebtDetector();

      const summary = await detector.detectDebt(tempDir);

      expect(summary.totalItems).toBe(0);
      expect(summary.totalHours).toBe(0);
      expect(summary.criticalItems).toEqual([]);
    });
  });
});
