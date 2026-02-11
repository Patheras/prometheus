/**
 * Tests for Agent Optimizer
 */

import { AgentOptimizer } from '../agent-optimizer';
import type { MemoryEngine } from '../../memory';
import type { RuntimeExecutor } from '../../runtime/runtime-executor';
import type { Metric } from '../../types';

describe('AgentOptimizer', () => {
  let optimizer: AgentOptimizer;
  let mockMemory: jest.Mocked<MemoryEngine>;
  let mockRuntime: jest.Mocked<RuntimeExecutor>;

  beforeEach(() => {
    mockMemory = {
      queryMetrics: jest.fn(),
      storeMetrics: jest.fn(),
    } as any;

    mockRuntime = {
      execute: jest.fn(),
    } as any;

    optimizer = new AgentOptimizer(mockMemory, mockRuntime);
  });

  describe('Performance Analysis', () => {
    it('should analyze performance and identify bottlenecks', async () => {
      const mockMetrics: Metric[] = [
        {
          id: '1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'llm_call_latency',
          value: 1000,
          context: {},
        },
        {
          id: '2',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'llm_call_latency',
          value: 1200,
          context: {},
        },
        {
          id: '3',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'memory_search_latency',
          value: 500,
          context: {},
        },
      ];

      mockMemory.queryMetrics.mockResolvedValue(mockMetrics);

      const bottlenecks = await optimizer.analyzePerformance();

      expect(Array.isArray(bottlenecks)).toBe(true);
      expect(bottlenecks.length).toBeGreaterThan(0);
      
      bottlenecks.forEach(b => {
        expect(b.operation).toBeTruthy();
        expect(b.type).toMatch(/llm_call|memory_access|computation|io/);
        expect(b.averageLatency).toBeGreaterThanOrEqual(0);
        expect(b.p95Latency).toBeGreaterThanOrEqual(0);
        expect(b.frequency).toBeGreaterThan(0);
        expect(b.totalImpact).toBeGreaterThanOrEqual(0);
        expect(b.severity).toMatch(/low|medium|high/);
      });
    });

    it('should sort bottlenecks by total impact', async () => {
      const mockMetrics: Metric[] = [
        // High impact: high frequency, high latency
        ...Array(100).fill(null).map((_, i) => ({
          id: `high-${i}`,
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'high_impact_operation',
          value: 1000,
          context: {},
        })),
        // Low impact: low frequency, low latency
        {
          id: 'low-1',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'low_impact_operation',
          value: 10,
          context: {},
        },
      ];

      mockMemory.queryMetrics.mockResolvedValue(mockMetrics);

      const bottlenecks = await optimizer.analyzePerformance();

      // First bottleneck should have highest total impact
      if (bottlenecks.length > 1) {
        expect(bottlenecks[0].totalImpact).toBeGreaterThanOrEqual(bottlenecks[1].totalImpact);
      }
    });

    it('should handle empty metrics', async () => {
      mockMemory.queryMetrics.mockResolvedValue([]);

      const bottlenecks = await optimizer.analyzePerformance();

      expect(bottlenecks).toEqual([]);
    });
  });

  describe('Optimization Proposal Generation', () => {
    it('should generate optimization proposals for bottlenecks', async () => {
      mockRuntime.execute.mockResolvedValue({
        content: JSON.stringify({
          description: 'Cache LLM responses',
          approach: 'Implement response caching',
          codeChanges: 'Add cache layer',
          estimatedImprovement: 50,
          estimatedEffort: 3,
          risks: ['Cache invalidation complexity'],
        }),
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 100,
        latency: 500,
      });

      const bottlenecks = [
        {
          operation: 'llm_call',
          type: 'llm_call' as const,
          averageLatency: 1000,
          p95Latency: 1500,
          p99Latency: 2000,
          frequency: 100,
          totalImpact: 100000,
          severity: 'high' as const,
        },
      ];

      const proposals = await optimizer.generateOptimizations(bottlenecks);

      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0].description).toBeTruthy();
      expect(proposals[0].approach).toBeTruthy();
      expect(proposals[0].estimatedImprovement).toBeGreaterThan(0);
      expect(proposals[0].estimatedEffort).toBeGreaterThan(0);
    });

    it('should skip low severity bottlenecks', async () => {
      const bottlenecks = [
        {
          operation: 'low_impact',
          type: 'computation' as const,
          averageLatency: 10,
          p95Latency: 15,
          p99Latency: 20,
          frequency: 10,
          totalImpact: 100,
          severity: 'low' as const,
        },
      ];

      const proposals = await optimizer.generateOptimizations(bottlenecks);

      expect(proposals.length).toBe(0);
    });

    it('should use heuristics when LLM unavailable', async () => {
      const optimizerNoLLM = new AgentOptimizer(mockMemory);

      const bottlenecks = [
        {
          operation: 'llm_call',
          type: 'llm_call' as const,
          averageLatency: 1000,
          p95Latency: 1500,
          p99Latency: 2000,
          frequency: 100,
          totalImpact: 100000,
          severity: 'high' as const,
        },
      ];

      const proposals = await optimizerNoLLM.generateOptimizations(bottlenecks);

      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0].description).toContain('cach'); // Match both "cache" and "caching"
    });

    it('should fall back to heuristics if LLM fails', async () => {
      mockRuntime.execute.mockRejectedValue(new Error('LLM error'));

      const bottlenecks = [
        {
          operation: 'memory_access',
          type: 'memory_access' as const,
          averageLatency: 500,
          p95Latency: 700,
          p99Latency: 900,
          frequency: 200,
          totalImpact: 100000,
          severity: 'high' as const,
        },
      ];

      const proposals = await optimizer.generateOptimizations(bottlenecks);

      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0].description).toBeTruthy();
    });
  });

  describe('A/B Testing', () => {
    it('should start A/B test with valid configuration', async () => {
      const config = {
        optimizationId: 'opt-1',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency', 'throughput'],
        duration: 3600000,
        significanceLevel: 0.05,
      };

      await expect(optimizer.startABTest(config)).resolves.not.toThrow();
    });

    it('should reject invalid traffic split', async () => {
      const config = {
        optimizationId: 'opt-1',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 150, // Invalid
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      };

      await expect(optimizer.startABTest(config)).rejects.toThrow('Traffic split must be between 0 and 100');
    });

    it('should analyze A/B test results', async () => {
      const config = {
        optimizationId: 'opt-1',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      };

      await optimizer.startABTest(config);

      // Mock metrics for both versions
      mockMemory.queryMetrics.mockResolvedValueOnce([
        { id: '1', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 1000, context: {} },
      ]).mockResolvedValueOnce([
        { id: '2', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 800, context: {} },
      ]);

      const result = await optimizer.analyzeABTest('opt-1');

      expect(result.optimizationId).toBe('opt-1');
      expect(result.baselineMetrics).toBeDefined();
      expect(result.optimizedMetrics).toBeDefined();
      expect(result.improvements).toBeDefined();
      expect(result.statisticallySignificant).toBeDefined();
      expect(result.recommendation).toMatch(/rollout|rollback|continue_testing/);
      expect(result.reasoning).toBeTruthy();
    });

    it('should recommend rollout for significant improvements', async () => {
      const config = {
        optimizationId: 'opt-2',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      };

      await optimizer.startABTest(config);

      // Mock significant improvement
      mockMemory.queryMetrics.mockResolvedValueOnce([
        { id: '1', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 1000, context: {} },
      ]).mockResolvedValueOnce([
        { id: '2', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 700, context: {} }, // 30% improvement
      ]);

      const result = await optimizer.analyzeABTest('opt-2');

      expect(result.recommendation).toBe('rollout');
    });

    it('should recommend rollback for regressions', async () => {
      const config = {
        optimizationId: 'opt-3',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      };

      await optimizer.startABTest(config);

      // Mock regression
      mockMemory.queryMetrics.mockResolvedValueOnce([
        { id: '1', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 1000, context: {} },
      ]).mockResolvedValueOnce([
        { id: '2', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 1200, context: {} }, // 20% worse
      ]);

      const result = await optimizer.analyzeABTest('opt-3');

      expect(result.recommendation).toBe('rollback');
    });
  });

  describe('Optimization Rollout and Rollback', () => {
    it('should rollout optimization', async () => {
      await optimizer.startABTest({
        optimizationId: 'opt-1',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      });

      await expect(optimizer.rolloutOptimization('opt-1')).resolves.not.toThrow();
      expect(mockMemory.storeMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            metric_name: 'rollout',
            context: expect.objectContaining({ optimizationId: 'opt-1' }),
          }),
        ])
      );
    });

    it('should rollback optimization with reason', async () => {
      await optimizer.startABTest({
        optimizationId: 'opt-1',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      });

      await expect(
        optimizer.rollbackOptimization('opt-1', 'Performance regression detected')
      ).resolves.not.toThrow();

      expect(mockMemory.storeMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            metric_name: 'rollback',
            context: expect.objectContaining({
              optimizationId: 'opt-1',
              reason: 'Performance regression detected',
            }),
          }),
        ])
      );
    });

    it('should throw error for non-existent optimization', async () => {
      await expect(optimizer.rolloutOptimization('non-existent')).rejects.toThrow();
      await expect(optimizer.rollbackOptimization('non-existent', 'test')).rejects.toThrow();
    });
  });

  describe('Impact Tracking', () => {
    it('should track optimization impact over time', async () => {
      // Start and rollout optimization
      await optimizer.startABTest({
        optimizationId: 'opt-1',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      });

      await optimizer.rolloutOptimization('opt-1');

      // Mock metrics before and after
      mockMemory.queryMetrics
        .mockResolvedValueOnce([
          { id: '1', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 1000, context: {} },
        ])
        .mockResolvedValueOnce([
          { id: '2', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 800, context: {} },
        ]);

      const impact = await optimizer.trackOptimizationImpact('opt-1', {
        start: Date.now() - 3600000,
        end: Date.now(),
      });

      expect(impact.beforeMetrics).toBeDefined();
      expect(impact.afterMetrics).toBeDefined();
      expect(impact.improvements).toBeDefined();
      expect(typeof impact.sustained).toBe('boolean');
    });

    it('should detect sustained improvements', async () => {
      await optimizer.startABTest({
        optimizationId: 'opt-1',
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      });

      await optimizer.rolloutOptimization('opt-1');

      // Mock sustained improvement
      mockMemory.queryMetrics
        .mockResolvedValueOnce([
          { id: '1', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 1000, context: {} },
        ])
        .mockResolvedValueOnce([
          { id: '2', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 700, context: {} }, // 30% improvement
        ]);

      const impact = await optimizer.trackOptimizationImpact('opt-1', {
        start: Date.now() - 3600000,
        end: Date.now(),
      });

      expect(impact.sustained).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should complete full optimization workflow', async () => {
      // 1. Analyze performance
      mockMemory.queryMetrics.mockResolvedValue([
        ...Array(100).fill(null).map((_, i) => ({
          id: `${i}`,
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'llm_call_latency',
          value: 1000,
          context: {},
        })),
      ]);

      const bottlenecks = await optimizer.analyzePerformance();
      expect(bottlenecks.length).toBeGreaterThan(0);

      // 2. Generate optimizations
      mockRuntime.execute.mockResolvedValue({
        content: JSON.stringify({
          description: 'Test optimization',
          approach: 'Test approach',
          codeChanges: 'Test changes',
          estimatedImprovement: 30,
          estimatedEffort: 2,
          risks: [],
        }),
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 100,
        latency: 500,
      });

      const proposals = await optimizer.generateOptimizations(bottlenecks);
      expect(proposals.length).toBeGreaterThan(0);

      // 3. Start A/B test
      const config = {
        optimizationId: proposals[0].id,
        baselineVersion: 'v1.0',
        optimizedVersion: 'v1.1',
        trafficSplit: 50,
        metrics: ['latency'],
        duration: 3600000,
        significanceLevel: 0.05,
      };

      await optimizer.startABTest(config);

      // 4. Analyze results
      mockMemory.queryMetrics
        .mockResolvedValueOnce([
          { id: '1', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 1000, context: {} },
        ])
        .mockResolvedValueOnce([
          { id: '2', timestamp: Date.now(), metric_type: 'perf', metric_name: 'latency', value: 800, context: {} },
        ]);

      const result = await optimizer.analyzeABTest(proposals[0].id);
      expect(result).toBeDefined();

      // 5. Rollout if successful
      if (result.recommendation === 'rollout') {
        await optimizer.rolloutOptimization(proposals[0].id);
        expect(mockMemory.storeMetrics).toHaveBeenCalled();
      }
    });
  });
});
