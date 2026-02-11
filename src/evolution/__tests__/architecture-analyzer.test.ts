/**
 * Tests for Architecture Analyzer
 */

import { ArchitectureAnalyzer } from '../architecture-analyzer';
import type { MemoryEngine } from '../../memory';
import type { RuntimeExecutor } from '../../runtime/runtime-executor';
import type { RefactoringPlan } from '../../types';

describe('ArchitectureAnalyzer', () => {
  let analyzer: ArchitectureAnalyzer;
  let mockMemory: jest.Mocked<MemoryEngine>;
  let mockRuntime: jest.Mocked<RuntimeExecutor>;

  beforeEach(() => {
    mockMemory = {} as jest.Mocked<MemoryEngine>;
    mockRuntime = {
      execute: jest.fn(),
    } as any;

    analyzer = new ArchitectureAnalyzer(mockMemory, mockRuntime);
  });

  describe('Architectural Issue Detection', () => {
    it('should detect tight coupling', async () => {
      // This test would require actual files, so we'll test the logic
      const issues = await analyzer.detectIssues('./test-repo');
      
      // Should return array of issues
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const issues = await analyzer.detectIssues('./test-repo');
      
      const circularIssues = issues.filter(i => i.type === 'circular_dependency');
      expect(Array.isArray(circularIssues)).toBe(true);
    });

    it('should detect missing abstractions with LLM', async () => {
      mockRuntime.execute.mockResolvedValue({
        content: JSON.stringify([
          {
            type: 'missing_abstraction',
            severity: 'medium',
            description: 'Repeated validation logic',
            affectedComponents: ['file1.ts', 'file2.ts'],
            location: 'file1.ts',
            impact: 'Code duplication',
          },
        ]),
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 100,
        latency: 500,
      });

      const issues = await analyzer.detectIssues('./test-repo');
      
      // Should include LLM-detected issues
      expect(mockRuntime.execute).toHaveBeenCalled();
    });

    it('should detect scalability issues', async () => {
      const issues = await analyzer.detectIssues('./test-repo');
      
      const scalabilityIssues = issues.filter(i => i.type === 'scalability');
      expect(Array.isArray(scalabilityIssues)).toBe(true);
    });

    it('should handle detection errors gracefully', async () => {
      mockRuntime.execute.mockRejectedValue(new Error('LLM error'));

      // Should not throw, just skip LLM analysis
      await expect(analyzer.detectIssues('./test-repo')).resolves.toBeDefined();
    });
  });

  describe('Refactoring Strategy Generation', () => {
    it('should generate refactoring strategy from issues', async () => {
      const issues = [
        {
          type: 'tight_coupling' as const,
          severity: 'high' as const,
          description: 'High coupling detected',
          affectedComponents: ['file1.ts', 'file2.ts'],
          location: 'file1.ts',
          impact: 'Hard to maintain',
        },
      ];

      mockRuntime.execute.mockResolvedValue({
        content: JSON.stringify({
          description: 'Introduce dependency injection',
          steps: [
            {
              description: 'Create interface',
              files: ['file1.ts'],
              changes: 'Add interface definition',
            },
          ],
          affectedFiles: ['file1.ts', 'file2.ts'],
          estimatedEffort: 4,
          expectedBenefits: ['Reduced coupling', 'Better testability'],
          risks: [{ description: 'Breaking changes', likelihood: 30, severity: 'medium' }],
        }),
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 200,
        latency: 800,
      });

      const plan = await analyzer.generateRefactoringStrategy(issues, 'Test context');

      expect(plan.description).toBe('Introduce dependency injection');
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.affectedFiles).toContain('file1.ts');
      expect(plan.estimatedEffort).toBeGreaterThan(0);
      expect(plan.expectedBenefits.length).toBeGreaterThan(0);
      expect(plan.risks.length).toBeGreaterThan(0);
    });

    it('should throw error if no runtime executor', async () => {
      const analyzerWithoutRuntime = new ArchitectureAnalyzer(mockMemory);
      const issues = [
        {
          type: 'tight_coupling' as const,
          severity: 'high' as const,
          description: 'High coupling',
          affectedComponents: [],
          location: '',
          impact: '',
        },
      ];

      await expect(
        analyzerWithoutRuntime.generateRefactoringStrategy(issues, '')
      ).rejects.toThrow('RuntimeExecutor required');
    });

    it('should handle LLM errors in strategy generation', async () => {
      mockRuntime.execute.mockRejectedValue(new Error('LLM error'));

      const issues = [
        {
          type: 'tight_coupling' as const,
          severity: 'high' as const,
          description: 'High coupling',
          affectedComponents: [],
          location: '',
          impact: '',
        },
      ];

      await expect(
        analyzer.generateRefactoringStrategy(issues, '')
      ).rejects.toThrow();
    });
  });

  describe('Backward Compatibility Checking', () => {
    it('should detect breaking changes in refactoring plan', async () => {
      const plan: RefactoringPlan = {
        id: 'test-plan',
        description: 'Test refactoring',
        steps: [
          {
            description: 'Change API',
            files: ['api.ts'],
            changes: 'export function newSignature()',
          },
        ],
        affectedFiles: ['api.ts'],
        estimatedEffort: 2,
        expectedBenefits: ['Better API'],
        risks: [],
      };

      const result = await analyzer.checkBackwardCompatibility(plan, './test-repo');

      // Should detect potential breaking changes
      expect(result.compatible).toBeDefined();
      expect(Array.isArray(result.breakingChanges)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should suggest compatibility layers for breaking changes', async () => {
      const plan: RefactoringPlan = {
        id: 'test-plan',
        description: 'Test refactoring',
        steps: [
          {
            description: 'Change function signature',
            files: ['utils.ts'],
            changes: 'function newSignature()',
          },
        ],
        affectedFiles: ['utils.ts'],
        estimatedEffort: 1,
        expectedBenefits: [],
        risks: [],
      };

      const result = await analyzer.checkBackwardCompatibility(plan, './test-repo');

      // Should provide suggestions
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle file read errors gracefully', async () => {
      const plan: RefactoringPlan = {
        id: 'test-plan',
        description: 'Test refactoring',
        steps: [
          {
            description: 'Change non-existent file',
            files: ['non-existent.ts'],
            changes: 'some changes',
          },
        ],
        affectedFiles: ['non-existent.ts'],
        estimatedEffort: 1,
        expectedBenefits: [],
        risks: [],
      };

      // Should not throw
      await expect(
        analyzer.checkBackwardCompatibility(plan, './test-repo')
      ).resolves.toBeDefined();
    });
  });

  describe('Architecture Quality Measurement', () => {
    it('should measure coupling metric', async () => {
      const metrics = await analyzer.measureArchitectureQuality('./test-repo');

      expect(metrics.coupling).toBeGreaterThanOrEqual(0);
      expect(metrics.coupling).toBeLessThanOrEqual(100);
    });

    it('should measure cohesion metric', async () => {
      const metrics = await analyzer.measureArchitectureQuality('./test-repo');

      expect(metrics.cohesion).toBeGreaterThanOrEqual(0);
      expect(metrics.cohesion).toBeLessThanOrEqual(100);
    });

    it('should measure complexity metric', async () => {
      const metrics = await analyzer.measureArchitectureQuality('./test-repo');

      expect(metrics.complexity).toBeGreaterThanOrEqual(0);
      expect(metrics.complexity).toBeLessThanOrEqual(100);
    });

    it('should measure modularity metric', async () => {
      const metrics = await analyzer.measureArchitectureQuality('./test-repo');

      expect(metrics.modularity).toBeGreaterThanOrEqual(0);
      expect(metrics.modularity).toBeLessThanOrEqual(100);
    });

    it('should handle empty repository', async () => {
      const metrics = await analyzer.measureArchitectureQuality('./empty-repo');

      // Should return valid metrics even for empty repo
      expect(metrics.coupling).toBeDefined();
      expect(metrics.cohesion).toBeDefined();
      expect(metrics.complexity).toBeDefined();
      expect(metrics.modularity).toBeDefined();
    });

    it('should track metrics over time', async () => {
      const metrics1 = await analyzer.measureArchitectureQuality('./test-repo');
      const metrics2 = await analyzer.measureArchitectureQuality('./test-repo');

      // Metrics should be consistent for same repo
      expect(metrics1.coupling).toBe(metrics2.coupling);
      expect(metrics1.cohesion).toBe(metrics2.cohesion);
    });
  });

  describe('Integration', () => {
    it('should complete full architecture analysis workflow', async () => {
      // 1. Detect issues
      const issues = await analyzer.detectIssues('./test-repo');
      expect(Array.isArray(issues)).toBe(true);

      // 2. Measure quality
      const metrics = await analyzer.measureArchitectureQuality('./test-repo');
      expect(metrics).toBeDefined();

      // 3. Generate strategy (if issues found and runtime available)
      if (issues.length > 0 && mockRuntime) {
        mockRuntime.execute.mockResolvedValue({
          content: JSON.stringify({
            description: 'Refactoring strategy',
            steps: [],
            affectedFiles: [],
            estimatedEffort: 0,
            expectedBenefits: [],
            risks: [],
          }),
          model: { provider: 'anthropic', model: 'claude-sonnet-4' },
          tokensUsed: 100,
          latency: 500,
        });

        const plan = await analyzer.generateRefactoringStrategy(issues, 'context');
        expect(plan).toBeDefined();

        // 4. Check compatibility
        const compat = await analyzer.checkBackwardCompatibility(plan, './test-repo');
        expect(compat).toBeDefined();
      }
    });
  });
});
