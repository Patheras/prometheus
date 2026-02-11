/**
 * Tests for Pattern Applicator
 */

import { PatternApplicator } from '../pattern-applicator';
import type { MemoryEngine } from '../../memory';
import type { RuntimeExecutor } from '../../runtime/runtime-executor';
import type { Pattern } from '../../types';

describe('PatternApplicator', () => {
  let applicator: PatternApplicator;
  let mockMemory: jest.Mocked<MemoryEngine>;
  let mockRuntime: jest.Mocked<RuntimeExecutor>;

  const mockPattern: Pattern = {
    id: 'pattern-1',
    name: 'Lane-Based Queue System',
    category: 'Concurrency',
    problem: 'Multiple concurrent operations on shared resources cause race conditions.',
    solution: 'Assign operations to lanes based on resource identity.',
    example_code: 'async function enqueue() { }',
    applicability: 'Use when multiple operations target the same resource.',
    success_count: 5,
    failure_count: 1,
  };

  beforeEach(() => {
    mockMemory = {
      updatePatternOutcome: jest.fn(),
      searchPatterns: jest.fn(),
    } as any;

    mockRuntime = {
      execute: jest.fn(),
    } as any;

    applicator = new PatternApplicator(mockMemory, mockRuntime);
  });

  describe('Pattern Applicability Verification', () => {
    it('should check pattern applicability with preconditions', async () => {
      const codeContext = `
        async function processData() {
          await Promise.all([
            operation1(),
            operation2()
          ]);
        }
      `;

      const result = await applicator.checkApplicability(
        mockPattern,
        { file: 'test.ts', line: 1 },
        codeContext
      );

      expect(result.applicable).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.preconditions).toBeInstanceOf(Array);
      expect(result.estimatedEffort).toBeGreaterThan(0);
      expect(result.reasoning).toBeTruthy();
    });

    it('should use LLM for deeper analysis when available', async () => {
      // Mock the precondition check to return satisfied
      jest.spyOn(applicator as any, 'checkPrecondition').mockResolvedValue({
        condition: 'test',
        satisfied: true,
        details: 'mocked',
      });

      mockRuntime.execute.mockResolvedValue({
        content: JSON.stringify({
          confidence: 85,
          reasoning: 'Pattern fits well',
          estimatedEffort: 3,
        }),
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 100,
        latency: 500,
      });

      // Use code that satisfies preconditions (async code for concurrency pattern)
      const codeContext = `
        async function processData() {
          await Promise.all([
            operation1(),
            operation2()
          ]);
        }
      `;

      const result = await applicator.checkApplicability(
        mockPattern,
        { file: 'test.ts', line: 1 },
        codeContext
      );

      expect(mockRuntime.execute).toHaveBeenCalled();
      expect(result.confidence).toBe(85);
      expect(result.reasoning).toBe('Pattern fits well');
    });

    it('should fall back to heuristics if LLM fails', async () => {
      mockRuntime.execute.mockRejectedValue(new Error('LLM error'));

      const result = await applicator.checkApplicability(
        mockPattern,
        { file: 'test.ts', line: 1 },
        'async function test() { }'
      );

      expect(result.applicable).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect when preconditions are not satisfied', async () => {
      const codeContext = 'function syncOperation() { return 42; }';

      const result = await applicator.checkApplicability(
        mockPattern,
        { file: 'test.ts', line: 1 },
        codeContext
      );

      // Should have lower confidence for sync code when pattern is for concurrency
      expect(result.confidence).toBeLessThan(100);
    });
  });

  describe('Pattern Adaptation', () => {
    it('should adapt pattern to local conventions', async () => {
      mockRuntime.execute.mockResolvedValue({
        content: JSON.stringify({
          adaptedCode: 'async function enqueueTask() { }',
          adaptationNotes: ['Renamed to match local naming'],
        }),
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 150,
        latency: 600,
      });

      const codeContext = `
        async function processTask() {
          // Local code style
        }
      `;

      const result = await applicator.adaptPattern(
        mockPattern,
        { file: 'test.ts', line: 1 },
        codeContext
      );

      expect(result.originalPattern).toBe(mockPattern);
      expect(result.adaptedCode).toBeTruthy();
      expect(result.adaptationNotes).toBeInstanceOf(Array);
      expect(result.localConventions).toBeInstanceOf(Array);
    });

    it('should detect local conventions', async () => {
      const codeContext = `
        async function camelCaseFunction(): Promise<void> {
          try {
            await operation();
          } catch (error) {
            console.error(error);
          }
        }
      `;

      const result = await applicator.adaptPattern(
        mockPattern,
        { file: 'test.ts', line: 1 },
        codeContext
      );

      expect(result.localConventions).toContain('camelCase for variables');
      expect(result.localConventions).toContain('async/await for asynchronous operations');
      expect(result.localConventions).toContain('try/catch for error handling');
    });

    it('should fall back to original pattern if adaptation fails', async () => {
      mockRuntime.execute.mockRejectedValue(new Error('Adaptation failed'));

      const result = await applicator.adaptPattern(
        mockPattern,
        { file: 'test.ts', line: 1 },
        'code'
      );

      expect(result.adaptedCode).toBe(mockPattern.example_code);
      expect(result.adaptationNotes).toContain('Adaptation failed, using original pattern');
    });

    it('should work without LLM (minimal adaptation)', async () => {
      const applicatorNoLLM = new PatternApplicator(mockMemory);

      const result = await applicatorNoLLM.adaptPattern(
        mockPattern,
        { file: 'test.ts', line: 1 },
        'code'
      );

      expect(result.adaptedCode).toBe(mockPattern.example_code);
      expect(result.adaptationNotes).toContain('No LLM available, using pattern as-is');
    });
  });

  describe('Pattern Application and Outcome Tracking', () => {
    it('should apply pattern and track success', async () => {
      const result = await applicator.applyPattern(
        mockPattern,
        { file: 'test.ts', line: 10 },
        'adapted code'
      );

      expect(result.success).toBe(true);
      expect(result.pattern).toBe(mockPattern);
      expect(result.location).toEqual({ file: 'test.ts', line: 10 });
      expect(mockMemory.updatePatternOutcome).toHaveBeenCalledWith(
        mockPattern.id,
        expect.objectContaining({
          success: true,
          context: expect.stringContaining('test.ts:10'),
        })
      );
    });

    it('should track pattern failure', async () => {
      // Simulate failure by throwing error
      mockMemory.updatePatternOutcome.mockRejectedValueOnce(new Error('Update failed'));

      const result = await applicator.applyPattern(
        mockPattern,
        { file: 'test.ts', line: 10 },
        'adapted code'
      );

      // Should still complete but track the failure
      expect(mockMemory.updatePatternOutcome).toHaveBeenCalled();
    });
  });

  describe('Pattern Opportunity Finding', () => {
    it('should find pattern opportunities in codebase', async () => {
      mockMemory.searchPatterns.mockResolvedValue([mockPattern]);

      const opportunities = await applicator.findOpportunities('./test-repo');

      expect(Array.isArray(opportunities)).toBe(true);
      // Opportunities depend on actual files, so just check structure
      opportunities.forEach(opp => {
        expect(opp.pattern).toBeDefined();
        expect(opp.location).toBeDefined();
        expect(opp.estimatedBenefit).toBeGreaterThanOrEqual(0);
        expect(opp.estimatedEffort).toBeGreaterThan(0);
      });
    });

    it('should sort opportunities by benefit/effort ratio', async () => {
      mockMemory.searchPatterns.mockResolvedValue([mockPattern]);

      const opportunities = await applicator.findOpportunities('./test-repo');

      // Check if sorted (higher benefit/effort first)
      for (let i = 0; i < opportunities.length - 1; i++) {
        const ratioA = opportunities[i].estimatedBenefit / opportunities[i].estimatedEffort;
        const ratioB = opportunities[i + 1].estimatedBenefit / opportunities[i + 1].estimatedEffort;
        expect(ratioA).toBeGreaterThanOrEqual(ratioB);
      }
    });
  });

  describe('Pattern Prioritization', () => {
    it('should prioritize patterns by multiple factors', () => {
      const opportunities = [
        {
          pattern: { ...mockPattern, category: 'Performance', success_count: 2, failure_count: 0 },
          location: { file: 'a.ts', line: 1 },
          estimatedBenefit: 50,
          estimatedEffort: 2,
        },
        {
          pattern: { ...mockPattern, category: 'Reliability', success_count: 10, failure_count: 0 },
          location: { file: 'b.ts', line: 1 },
          estimatedBenefit: 80,
          estimatedEffort: 3,
        },
        {
          pattern: { ...mockPattern, category: 'Data', success_count: 1, failure_count: 1 },
          location: { file: 'c.ts', line: 1 },
          estimatedBenefit: 30,
          estimatedEffort: 1,
        },
      ];

      const prioritized = applicator.prioritizeOpportunities(opportunities);

      expect(prioritized.length).toBe(3);
      // Reliability with high success rate should be prioritized
      expect(prioritized[0].pattern.category).toBe('Reliability');
    });

    it('should consider pattern success rate in prioritization', () => {
      const highSuccessPattern = {
        ...mockPattern,
        success_count: 20,
        failure_count: 1,
      };

      const lowSuccessPattern = {
        ...mockPattern,
        success_count: 1,
        failure_count: 10,
      };

      const opportunities = [
        {
          pattern: lowSuccessPattern,
          location: { file: 'a.ts', line: 1 },
          estimatedBenefit: 50,
          estimatedEffort: 2,
        },
        {
          pattern: highSuccessPattern,
          location: { file: 'b.ts', line: 1 },
          estimatedBenefit: 50,
          estimatedEffort: 2,
        },
      ];

      const prioritized = applicator.prioritizeOpportunities(opportunities);

      // High success rate should be first
      expect(prioritized[0].pattern.success_count).toBe(20);
    });

    it('should consider category weight in prioritization', () => {
      const opportunities = [
        {
          pattern: { ...mockPattern, category: 'Data' },
          location: { file: 'a.ts', line: 1 },
          estimatedBenefit: 50,
          estimatedEffort: 2,
        },
        {
          pattern: { ...mockPattern, category: 'Reliability' },
          location: { file: 'b.ts', line: 1 },
          estimatedBenefit: 50,
          estimatedEffort: 2,
        },
      ];

      const prioritized = applicator.prioritizeOpportunities(opportunities);

      // Reliability should be prioritized over Data
      expect(prioritized[0].pattern.category).toBe('Reliability');
    });
  });

  describe('Integration', () => {
    it('should complete full pattern application workflow', async () => {
      mockMemory.searchPatterns.mockResolvedValue([mockPattern]);
      mockRuntime.execute.mockResolvedValue({
        content: JSON.stringify({
          confidence: 80,
          reasoning: 'Good fit',
          estimatedEffort: 2,
          adaptedCode: 'adapted',
          adaptationNotes: ['adapted'],
        }),
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 100,
        latency: 500,
      });

      // 1. Find opportunities
      const opportunities = await applicator.findOpportunities('./test-repo');
      expect(Array.isArray(opportunities)).toBe(true);

      // 2. Prioritize
      const prioritized = applicator.prioritizeOpportunities(opportunities);
      expect(Array.isArray(prioritized)).toBe(true);

      // 3. Check applicability (if opportunities found)
      if (prioritized.length > 0) {
        const check = await applicator.checkApplicability(
          prioritized[0].pattern,
          prioritized[0].location,
          'code'
        );
        expect(check).toBeDefined();

        // 4. Adapt pattern
        if (check.applicable) {
          const adapted = await applicator.adaptPattern(
            prioritized[0].pattern,
            prioritized[0].location,
            'code'
          );
          expect(adapted).toBeDefined();

          // 5. Apply pattern
          const result = await applicator.applyPattern(
            prioritized[0].pattern,
            prioritized[0].location,
            adapted.adaptedCode
          );
          expect(result).toBeDefined();
        }
      }
    });
  });
});
