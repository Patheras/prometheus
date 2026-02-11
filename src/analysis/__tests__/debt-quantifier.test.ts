/**
 * Debt Quantifier Tests
 * 
 * Tests for LLM-based debt quantification.
 * 
 * Task 27.2: Implement debt quantification
 */

import { createDebtQuantifier } from '../debt-quantifier';
import { TechnicalDebtItem } from '../types';
import { RuntimeEngine } from '../../runtime';

// Mock RuntimeEngine
class MockRuntimeEngine {
  async execute(request: any): Promise<{ content: string }> {
    // Return mock estimate based on debt type
    const estimates: Record<string, string> = {
      todo_comment: '1',
      outdated_dependency: '2',
      missing_test: '3',
      architectural_violation: '8',
    };

    // Extract debt type from prompt
    const typeMatch = request.prompt.match(/Type: (\w+)/);
    const type = typeMatch ? typeMatch[1] : 'todo_comment';

    return {
      content: estimates[type] || '2',
    };
  }
}

describe('DebtQuantifier', () => {
  let mockRuntime: RuntimeEngine;
  let quantifier: ReturnType<typeof createDebtQuantifier>;

  beforeEach(() => {
    mockRuntime = new MockRuntimeEngine() as any;
    quantifier = createDebtQuantifier(mockRuntime);
  });

  describe('Single Debt Quantification', () => {
    it('should quantify a TODO comment', async () => {
      const debt: TechnicalDebtItem = {
        id: '1',
        type: 'todo_comment',
        description: 'TODO: Implement feature',
        effortHours: 0,
        priority: 2,
        detectedAt: Date.now(),
      };

      const estimate = await quantifier.quantifyDebt(debt);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThanOrEqual(100);
    });

    it('should quantify an outdated dependency', async () => {
      const debt: TechnicalDebtItem = {
        id: '2',
        type: 'outdated_dependency',
        description: 'Outdated package',
        effortHours: 0,
        priority: 3,
        detectedAt: Date.now(),
      };

      const estimate = await quantifier.quantifyDebt(debt);

      expect(estimate).toBeGreaterThan(0);
    });

    it('should quantify missing tests', async () => {
      const debt: TechnicalDebtItem = {
        id: '3',
        type: 'missing_test',
        description: 'No test for calculator.ts',
        filePath: 'src/calculator.ts',
        effortHours: 0,
        priority: 3,
        detectedAt: Date.now(),
      };

      const estimate = await quantifier.quantifyDebt(debt);

      expect(estimate).toBeGreaterThan(0);
    });

    it('should quantify architectural violations', async () => {
      const debt: TechnicalDebtItem = {
        id: '4',
        type: 'architectural_violation',
        description: 'Circular dependency detected',
        effortHours: 0,
        priority: 4,
        detectedAt: Date.now(),
      };

      const estimate = await quantifier.quantifyDebt(debt);

      expect(estimate).toBeGreaterThan(0);
    });

    it('should clamp estimates to reasonable range', async () => {
      // Mock extreme response
      const extremeRuntime = {
        async execute() {
          return { content: '1000' }; // Unrealistic estimate
        },
      } as any;

      const extremeQuantifier = createDebtQuantifier(extremeRuntime);
      const debt: TechnicalDebtItem = {
        id: '5',
        type: 'todo_comment',
        description: 'TODO: Simple fix',
        effortHours: 0,
        priority: 2,
        detectedAt: Date.now(),
      };

      const estimate = await extremeQuantifier.quantifyDebt(debt);

      // Should be clamped to max 100 hours
      expect(estimate).toBeLessThanOrEqual(100);
    });

    it('should handle LLM failures gracefully', async () => {
      // Mock failing runtime
      const failingRuntime = {
        async execute() {
          throw new Error('LLM unavailable');
        },
      } as any;

      const failingQuantifier = createDebtQuantifier(failingRuntime);
      const debt: TechnicalDebtItem = {
        id: '6',
        type: 'todo_comment',
        description: 'TODO: Fix',
        effortHours: 0,
        priority: 2,
        detectedAt: Date.now(),
      };

      const estimate = await failingQuantifier.quantifyDebt(debt);

      // Should fall back to heuristic
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBe(1); // Heuristic for TODO
    });
  });

  describe('Batch Quantification', () => {
    it('should quantify multiple debt items', async () => {
      const debts: TechnicalDebtItem[] = [
        {
          id: '1',
          type: 'todo_comment',
          description: 'TODO: Fix 1',
          effortHours: 0,
          priority: 2,
          detectedAt: Date.now(),
        },
        {
          id: '2',
          type: 'missing_test',
          description: 'No test for file.ts',
          effortHours: 0,
          priority: 3,
          detectedAt: Date.now(),
        },
      ];

      const quantified = await quantifier.quantifyDebts(debts);

      expect(quantified).toHaveLength(2);
      expect(quantified[0].effortHours).toBeGreaterThan(0);
      expect(quantified[1].effortHours).toBeGreaterThan(0);
    });

    it('should preserve debt item properties', async () => {
      const debts: TechnicalDebtItem[] = [
        {
          id: '1',
          type: 'todo_comment',
          description: 'TODO: Fix',
          filePath: 'test.ts',
          lineNumber: 42,
          effortHours: 0,
          priority: 2,
          detectedAt: Date.now(),
        },
      ];

      const quantified = await quantifier.quantifyDebts(debts);

      expect(quantified[0].id).toBe('1');
      expect(quantified[0].filePath).toBe('test.ts');
      expect(quantified[0].lineNumber).toBe(42);
      expect(quantified[0].priority).toBe(2);
    });
  });

  describe('Total Debt Calculation', () => {
    it('should calculate total debt hours', () => {
      const debts: TechnicalDebtItem[] = [
        {
          id: '1',
          type: 'todo_comment',
          description: 'TODO: Fix 1',
          effortHours: 2,
          priority: 2,
          detectedAt: Date.now(),
        },
        {
          id: '2',
          type: 'missing_test',
          description: 'No test',
          effortHours: 3,
          priority: 3,
          detectedAt: Date.now(),
        },
        {
          id: '3',
          type: 'architectural_violation',
          description: 'Violation',
          effortHours: 8,
          priority: 4,
          detectedAt: Date.now(),
        },
      ];

      const total = quantifier.calculateTotalDebt(debts);

      expect(total).toBe(13);
    });

    it('should handle empty debt list', () => {
      const total = quantifier.calculateTotalDebt([]);

      expect(total).toBe(0);
    });
  });

  describe('ROI Prioritization', () => {
    it('should prioritize by ROI (priority / effort)', () => {
      const debts: TechnicalDebtItem[] = [
        {
          id: '1',
          type: 'todo_comment',
          description: 'Low ROI',
          effortHours: 10,
          priority: 2, // ROI = 0.2
          detectedAt: Date.now(),
        },
        {
          id: '2',
          type: 'missing_test',
          description: 'High ROI',
          effortHours: 1,
          priority: 4, // ROI = 4.0
          detectedAt: Date.now(),
        },
        {
          id: '3',
          type: 'architectural_violation',
          description: 'Medium ROI',
          effortHours: 4,
          priority: 4, // ROI = 1.0
          detectedAt: Date.now(),
        },
      ];

      const prioritized = quantifier.prioritizeByROI(debts);

      // Highest ROI first
      expect(prioritized[0].id).toBe('2'); // ROI = 4.0
      expect(prioritized[1].id).toBe('3'); // ROI = 1.0
      expect(prioritized[2].id).toBe('1'); // ROI = 0.2
    });

    it('should not mutate original array', () => {
      const debts: TechnicalDebtItem[] = [
        {
          id: '1',
          type: 'todo_comment',
          description: 'Item 1',
          effortHours: 2,
          priority: 2,
          detectedAt: Date.now(),
        },
        {
          id: '2',
          type: 'missing_test',
          description: 'Item 2',
          effortHours: 1,
          priority: 4,
          detectedAt: Date.now(),
        },
      ];

      const original = [...debts];
      quantifier.prioritizeByROI(debts);

      expect(debts).toEqual(original);
    });
  });

  describe('Effort Grouping', () => {
    it('should group debt by effort range', () => {
      const debts: TechnicalDebtItem[] = [
        {
          id: '1',
          type: 'todo_comment',
          description: 'Quick fix',
          effortHours: 1,
          priority: 2,
          detectedAt: Date.now(),
        },
        {
          id: '2',
          type: 'missing_test',
          description: 'Medium fix',
          effortHours: 4,
          priority: 3,
          detectedAt: Date.now(),
        },
        {
          id: '3',
          type: 'architectural_violation',
          description: 'Large fix',
          effortHours: 10,
          priority: 4,
          detectedAt: Date.now(),
        },
      ];

      const grouped = quantifier.groupByEffort(debts);

      expect(grouped.quick).toHaveLength(1);
      expect(grouped.quick[0].id).toBe('1');

      expect(grouped.medium).toHaveLength(1);
      expect(grouped.medium[0].id).toBe('2');

      expect(grouped.large).toHaveLength(1);
      expect(grouped.large[0].id).toBe('3');
    });

    it('should handle edge cases in grouping', () => {
      const debts: TechnicalDebtItem[] = [
        {
          id: '1',
          type: 'todo_comment',
          description: 'Exactly 2 hours',
          effortHours: 2,
          priority: 2,
          detectedAt: Date.now(),
        },
        {
          id: '2',
          type: 'missing_test',
          description: 'Exactly 8 hours',
          effortHours: 8,
          priority: 3,
          detectedAt: Date.now(),
        },
      ];

      const grouped = quantifier.groupByEffort(debts);

      // 2 hours should be in medium
      expect(grouped.medium).toContainEqual(
        expect.objectContaining({ id: '1' })
      );

      // 8 hours should be in medium
      expect(grouped.medium).toContainEqual(
        expect.objectContaining({ id: '2' })
      );
    });

    it('should handle empty debt list', () => {
      const grouped = quantifier.groupByEffort([]);

      expect(grouped.quick).toEqual([]);
      expect(grouped.medium).toEqual([]);
      expect(grouped.large).toEqual([]);
    });
  });
});
