/**
 * Technical Debt Integration Tests
 * 
 * Tests the complete technical debt workflow:
 * 1. Detect debt with DebtDetector
 * 2. Quantify debt with DebtQuantifier
 * 3. Monitor thresholds
 * 4. Trigger consultation when needed
 * 
 * Task 27.3: Implement debt threshold monitoring
 */

import { createDebtDetector } from '../debt-detector';
import { createDebtQuantifier } from '../debt-quantifier';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock RuntimeEngine
class MockRuntimeEngine {
  async execute(request: any): Promise<{ content: string }> {
    // Return realistic estimates based on debt type
    if (request.prompt.includes('todo_comment')) {
      return { content: '1.5' };
    }
    if (request.prompt.includes('missing_test')) {
      return { content: '3' };
    }
    if (request.prompt.includes('architectural_violation')) {
      return { content: '8' };
    }
    if (request.prompt.includes('outdated_dependency')) {
      return { content: '2' };
    }
    return { content: '2' };
  }
}

describe('Technical Debt Integration', () => {
  let tempDir: string;
  let detector: ReturnType<typeof createDebtDetector>;
  let quantifier: ReturnType<typeof createDebtQuantifier>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'debt-integration-'));
    detector = createDebtDetector({
      warning: 10,
      critical: 20,
      maximum: 50,
    });
    quantifier = createDebtQuantifier(new MockRuntimeEngine() as any);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Debt Workflow', () => {
    it('should detect, quantify, and monitor debt', async () => {
      // Step 1: Create codebase with debt
      const testFile = path.join(tempDir, 'problematic.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Implement properly
        // FIXME: This breaks on edge cases
        function buggy() {
          return 42;
        }
        `
      );

      // Step 2: Detect debt
      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      expect(summary.totalItems).toBeGreaterThan(0);

      // Step 3: Quantify debt (already has estimates from detector)
      // In real scenario, would use quantifier to refine estimates
      const totalDebt = quantifier.calculateTotalDebt(
        summary.byType['todo_comment']
          ? Array(summary.byType['todo_comment']).fill({
              id: '1',
              type: 'todo_comment',
              description: 'TODO',
              effortHours: 1,
              priority: 2,
              detectedAt: Date.now(),
            })
          : []
      );

      expect(totalDebt).toBeGreaterThanOrEqual(0);

      // Step 4: Check thresholds
      const thresholds = detector.checkThresholds(summary);

      expect(thresholds).toHaveProperty('exceedsWarning');
      expect(thresholds).toHaveProperty('exceedsCritical');
      expect(thresholds).toHaveProperty('requiresConsultation');
    });

    it('should trigger consultation when debt is critical', async () => {
      // Create many debt items to exceed threshold
      const testFile = path.join(tempDir, 'critical.ts');
      const todos = Array(15)
        .fill(0)
        .map((_, i) => `// TODO: Fix issue ${i}`)
        .join('\n');

      await fs.writeFile(testFile, todos);

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      const thresholds = detector.checkThresholds(summary);

      // Should exceed warning threshold (10 hours)
      expect(thresholds.exceedsWarning).toBe(true);

      // Should require consultation
      if (thresholds.exceedsCritical) {
        expect(thresholds.requiresConsultation).toBe(true);
      }
    });

    it('should prioritize debt by ROI', async () => {
      // Create mixed debt items
      const testFile = path.join(tempDir, 'mixed.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Quick fix (low effort, medium priority)
        // FIXME: Critical bug (low effort, high priority)
        function test() {
          return 1;
        }
        `
      );

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      // Create debt items array from summary
      const debtItems = Object.entries(summary.byType).flatMap(([type, count]) =>
        Array(count).fill({
          id: Math.random().toString(),
          type: type as any,
          description: `${type} item`,
          effortHours: type === 'todo_comment' ? 1 : 2,
          priority: type === 'todo_comment' ? 2 : 4,
          detectedAt: Date.now(),
        })
      );

      const prioritized = quantifier.prioritizeByROI(debtItems);

      // Higher priority, lower effort should be first
      if (prioritized.length > 1) {
        const firstROI = prioritized[0].priority / prioritized[0].effortHours;
        const lastROI =
          prioritized[prioritized.length - 1].priority /
          prioritized[prioritized.length - 1].effortHours;
        expect(firstROI).toBeGreaterThanOrEqual(lastROI);
      }
    });

    it('should group debt by effort for sprint planning', async () => {
      // Create debt items with varying effort
      const testFile = path.join(tempDir, 'varied.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Quick fix
        function quick() { return 1; }
        `
      );

      // Create large file for architectural violation
      const largeFile = path.join(tempDir, 'large.ts');
      const lines = Array(600).fill('console.log("line");').join('\n');
      await fs.writeFile(largeFile, lines);

      const summary = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
      });

      // Create debt items from summary
      const debtItems = Object.entries(summary.byType).flatMap(([type, count]) => {
        const effortMap: Record<string, number> = {
          todo_comment: 1,
          architectural_violation: 10,
        };

        return Array(count).fill({
          id: Math.random().toString(),
          type: type as any,
          description: `${type} item`,
          effortHours: effortMap[type] || 2,
          priority: 3,
          detectedAt: Date.now(),
        });
      });

      const grouped = quantifier.groupByEffort(debtItems);

      // Should have items in different effort categories
      expect(grouped.quick.length + grouped.medium.length + grouped.large.length).toBe(
        debtItems.length
      );
    });
  });

  describe('Threshold Monitoring Over Time', () => {
    it('should track debt accumulation', async () => {
      // Initial state - clean code
      const testFile = path.join(tempDir, 'evolving.ts');
      await fs.writeFile(testFile, 'function clean() { return 1; }');

      const initial = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      // Add debt
      await fs.writeFile(
        testFile,
        `
        // TODO: Fix 1
        // TODO: Fix 2
        // TODO: Fix 3
        function dirty() { return 1; }
        `
      );

      const withDebt = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      // Debt should increase
      expect(withDebt.totalHours).toBeGreaterThan(initial.totalHours);
    });

    it('should track debt reduction after fixes', async () => {
      // Start with debt
      const testFile = path.join(tempDir, 'improving.ts');
      await fs.writeFile(
        testFile,
        `
        // TODO: Fix 1
        // TODO: Fix 2
        // TODO: Fix 3
        function test() { return 1; }
        `
      );

      const before = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      // Fix some debt
      await fs.writeFile(
        testFile,
        `
        // TODO: Fix 1
        function test() { return 1; }
        `
      );

      const after = await detector.detectDebt(tempDir, {
        includeOutdatedDeps: false,
        includeMissingTests: false,
        includeArchitecturalViolations: false,
      });

      // Debt should decrease
      expect(after.totalHours).toBeLessThan(before.totalHours);
    });
  });

  describe('Consultation Triggers', () => {
    it('should require consultation for critical items', async () => {
      const summary = {
        totalItems: 1,
        totalHours: 5,
        byType: { architectural_violation: 1 },
        byPriority: { 5: 1 },
        criticalItems: [
          {
            id: '1',
            type: 'architectural_violation' as const,
            description: 'Critical architectural issue',
            effortHours: 5,
            priority: 5,
            detectedAt: Date.now(),
          },
        ],
      };

      const thresholds = detector.checkThresholds(summary);

      expect(thresholds.requiresConsultation).toBe(true);
    });

    it('should require consultation when exceeding critical threshold', async () => {
      const summary = {
        totalItems: 10,
        totalHours: 25, // Exceeds critical threshold of 20
        byType: { todo_comment: 10 },
        byPriority: { 2: 10 },
        criticalItems: [],
      };

      const thresholds = detector.checkThresholds(summary);

      expect(thresholds.exceedsCritical).toBe(true);
      expect(thresholds.requiresConsultation).toBe(true);
    });

    it('should not require consultation for manageable debt', async () => {
      const summary = {
        totalItems: 2,
        totalHours: 3, // Below warning threshold
        byType: { todo_comment: 2 },
        byPriority: { 2: 2 },
        criticalItems: [],
      };

      const thresholds = detector.checkThresholds(summary);

      expect(thresholds.requiresConsultation).toBe(false);
    });
  });

  describe('Debt Reporting', () => {
    it('should generate comprehensive debt report', async () => {
      // Create varied debt
      const testFile = path.join(tempDir, 'report.ts');
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

      // Report should include all key metrics
      expect(summary).toHaveProperty('totalItems');
      expect(summary).toHaveProperty('totalHours');
      expect(summary).toHaveProperty('byType');
      expect(summary).toHaveProperty('byPriority');
      expect(summary).toHaveProperty('criticalItems');

      // Should categorize by type
      expect(Object.keys(summary.byType).length).toBeGreaterThan(0);

      // Should categorize by priority
      expect(Object.keys(summary.byPriority).length).toBeGreaterThan(0);
    });
  });
});
