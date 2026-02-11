/**
 * Optimization Recommender Tests
 * 
 * Tests for LLM-based optimization recommendations.
 * 
 * Task 28.3: Generate optimization recommendations
 */

import { createOptimizationRecommender } from '../optimization-recommender';
import { PerformanceBottleneck, PerformanceAnomaly, IssueSeverity } from '../types';
import { RuntimeEngine } from '../../runtime';

// Mock RuntimeEngine
class MockRuntimeEngine {
  async execute(request: any): Promise<{ content: string }> {
    // Return mock recommendation
    if (request.prompt.includes('bottleneck')) {
      return {
        content: `Root Cause: Database query optimization needed
Recommendation: Add index on user_id column
Expected Impact: Reduce latency by 60%
Estimated Effort: 2 hours
Priority: 4`,
      };
    }

    if (request.prompt.includes('anomaly')) {
      return {
        content: `Possible Causes: Traffic spike or memory leak
Investigation: Check logs and memory usage
Recommended Actions: Scale resources or fix leak
Priority: 3`,
      };
    }

    return { content: 'Generic recommendation\nPriority: 3\nEffort: 2 hours' };
  }
}

describe('OptimizationRecommender', () => {
  let mockRuntime: RuntimeEngine;
  let recommender: ReturnType<typeof createOptimizationRecommender>;

  beforeEach(() => {
    mockRuntime = new MockRuntimeEngine() as any;
    recommender = createOptimizationRecommender(mockRuntime);
  });

  describe('Bottleneck Recommendations', () => {
    it('should generate recommendation for bottleneck', async () => {
      const bottleneck: PerformanceBottleneck = {
        id: '1',
        operation: '/api/users',
        metricType: 'latency',
        currentValue: 1500,
        baselineValue: 200,
        severity: IssueSeverity.HIGH,
        detectedAt: Date.now(),
      };

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [bottleneck],
        anomalies: [],
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].target).toBe('/api/users');
      expect(recommendations[0]).toHaveProperty('recommendation');
      expect(recommendations[0]).toHaveProperty('expectedImpact');
      expect(recommendations[0]).toHaveProperty('estimatedEffort');
      expect(recommendations[0]).toHaveProperty('priority');
    });

    it('should parse LLM response correctly', async () => {
      const bottleneck: PerformanceBottleneck = {
        id: '1',
        operation: '/api/slow',
        metricType: 'latency',
        currentValue: 2000,
        baselineValue: 300,
        severity: IssueSeverity.HIGH,
        detectedAt: Date.now(),
      };

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [bottleneck],
        anomalies: [],
      });

      expect(recommendations[0].priority).toBeGreaterThan(0);
      expect(recommendations[0].priority).toBeLessThanOrEqual(5);
      expect(recommendations[0].estimatedEffort).toBeGreaterThan(0);
    });

    it('should handle LLM failures gracefully', async () => {
      const failingRuntime = {
        async execute() {
          throw new Error('LLM unavailable');
        },
      } as any;

      const failingRecommender = createOptimizationRecommender(failingRuntime);

      const bottleneck: PerformanceBottleneck = {
        id: '1',
        operation: '/api/test',
        metricType: 'latency',
        currentValue: 1000,
        baselineValue: 200,
        severity: IssueSeverity.MEDIUM,
        detectedAt: Date.now(),
      };

      const recommendations = await failingRecommender.generateRecommendations({
        bottlenecks: [bottleneck],
        anomalies: [],
      });

      // Should fall back to heuristic
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].recommendation).toBeTruthy();
    });
  });

  describe('Anomaly Recommendations', () => {
    it('should generate recommendation for anomaly', async () => {
      const anomaly: PerformanceAnomaly = {
        id: '1',
        metricName: 'cpu_usage',
        value: 95,
        mean: 50,
        stdDev: 10,
        zScore: 4.5,
        severity: IssueSeverity.HIGH,
        timestamp: Date.now(),
      };

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [],
        anomalies: [anomaly],
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].target).toBe('cpu_usage');
    });

    it('should handle multiple anomalies', async () => {
      const anomalies: PerformanceAnomaly[] = [
        {
          id: '1',
          metricName: 'cpu',
          value: 95,
          mean: 50,
          stdDev: 10,
          zScore: 4.5,
          severity: IssueSeverity.HIGH,
          timestamp: Date.now(),
        },
        {
          id: '2',
          metricName: 'memory',
          value: 90,
          mean: 60,
          stdDev: 5,
          zScore: 6,
          severity: IssueSeverity.CRITICAL,
          timestamp: Date.now(),
        },
      ];

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [],
        anomalies,
      });

      expect(recommendations.length).toBe(2);
    });
  });

  describe('Mixed Recommendations', () => {
    it('should generate recommendations for both bottlenecks and anomalies', async () => {
      const bottleneck: PerformanceBottleneck = {
        id: '1',
        operation: '/api/test',
        metricType: 'latency',
        currentValue: 1000,
        baselineValue: 200,
        severity: IssueSeverity.MEDIUM,
        detectedAt: Date.now(),
      };

      const anomaly: PerformanceAnomaly = {
        id: '1',
        metricName: 'cpu',
        value: 95,
        mean: 50,
        stdDev: 10,
        zScore: 4.5,
        severity: IssueSeverity.HIGH,
        timestamp: Date.now(),
      };

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [bottleneck],
        anomalies: [anomaly],
      });

      expect(recommendations.length).toBe(2);
    });

    it('should sort recommendations by priority', async () => {
      const lowPriorityBottleneck: PerformanceBottleneck = {
        id: '1',
        operation: '/api/low',
        metricType: 'latency',
        currentValue: 600,
        baselineValue: 200,
        severity: IssueSeverity.LOW,
        detectedAt: Date.now(),
      };

      const highPriorityBottleneck: PerformanceBottleneck = {
        id: '2',
        operation: '/api/high',
        metricType: 'latency',
        currentValue: 5000,
        baselineValue: 200,
        severity: IssueSeverity.CRITICAL,
        detectedAt: Date.now(),
      };

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [lowPriorityBottleneck, highPriorityBottleneck],
        anomalies: [],
      });

      // Higher priority should be first
      expect(recommendations[0].priority).toBeGreaterThanOrEqual(recommendations[1].priority);
    });
  });

  describe('Change Correlation', () => {
    it('should correlate recommendations with recent changes', () => {
      const recommendations = [
        {
          id: '1',
          target: '/api/users',
          issue: 'High latency',
          recommendation: 'Optimize query',
          expectedImpact: 'Reduce latency',
          estimatedEffort: 2,
          priority: 4,
          generatedAt: Date.now(),
        },
      ];

      const recentChanges = [
        'Updated /api/users endpoint to include more data',
        'Fixed bug in authentication',
      ];

      const correlated = recommender.correlateWithChanges(recommendations, recentChanges);

      expect(correlated[0].relatedChanges).toBeDefined();
      expect(correlated[0].relatedChanges!.length).toBeGreaterThan(0);
    });

    it('should handle no matching changes', () => {
      const recommendations = [
        {
          id: '1',
          target: '/api/users',
          issue: 'High latency',
          recommendation: 'Optimize query',
          expectedImpact: 'Reduce latency',
          estimatedEffort: 2,
          priority: 4,
          generatedAt: Date.now(),
        },
      ];

      const recentChanges = ['Updated /api/products endpoint'];

      const correlated = recommender.correlateWithChanges(recommendations, recentChanges);

      expect(correlated[0].relatedChanges).toBeUndefined();
    });
  });

  describe('ROI Prioritization', () => {
    it('should prioritize by ROI (priority / effort)', () => {
      const recommendations = [
        {
          id: '1',
          target: '/api/low-roi',
          issue: 'Issue',
          recommendation: 'Fix',
          expectedImpact: 'Impact',
          estimatedEffort: 10,
          priority: 2, // ROI = 0.2
          generatedAt: Date.now(),
        },
        {
          id: '2',
          target: '/api/high-roi',
          issue: 'Issue',
          recommendation: 'Fix',
          expectedImpact: 'Impact',
          estimatedEffort: 1,
          priority: 4, // ROI = 4.0
          generatedAt: Date.now(),
        },
      ];

      const prioritized = recommender.prioritizeByROI(recommendations);

      // Higher ROI first
      expect(prioritized[0].id).toBe('2');
      expect(prioritized[1].id).toBe('1');
    });

    it('should not mutate original array', () => {
      const recommendations = [
        {
          id: '1',
          target: '/api/test',
          issue: 'Issue',
          recommendation: 'Fix',
          expectedImpact: 'Impact',
          estimatedEffort: 2,
          priority: 3,
          generatedAt: Date.now(),
        },
      ];

      const original = [...recommendations];
      recommender.prioritizeByROI(recommendations);

      expect(recommendations).toEqual(original);
    });
  });

  describe('Grouping', () => {
    it('should group recommendations by target', () => {
      const recommendations = [
        {
          id: '1',
          target: '/api/users',
          issue: 'Issue 1',
          recommendation: 'Fix 1',
          expectedImpact: 'Impact',
          estimatedEffort: 2,
          priority: 3,
          generatedAt: Date.now(),
        },
        {
          id: '2',
          target: '/api/users',
          issue: 'Issue 2',
          recommendation: 'Fix 2',
          expectedImpact: 'Impact',
          estimatedEffort: 3,
          priority: 4,
          generatedAt: Date.now(),
        },
        {
          id: '3',
          target: '/api/products',
          issue: 'Issue 3',
          recommendation: 'Fix 3',
          expectedImpact: 'Impact',
          estimatedEffort: 1,
          priority: 2,
          generatedAt: Date.now(),
        },
      ];

      const grouped = recommender.groupByTarget(recommendations);

      expect(grouped.size).toBe(2);
      expect(grouped.get('/api/users')!.length).toBe(2);
      expect(grouped.get('/api/products')!.length).toBe(1);
    });
  });

  describe('Recommendation Structure', () => {
    it('should include all required fields', async () => {
      const bottleneck: PerformanceBottleneck = {
        id: '1',
        operation: '/api/test',
        metricType: 'latency',
        currentValue: 1000,
        baselineValue: 200,
        severity: IssueSeverity.MEDIUM,
        detectedAt: Date.now(),
      };

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [bottleneck],
        anomalies: [],
      });

      const rec = recommendations[0];
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('target');
      expect(rec).toHaveProperty('issue');
      expect(rec).toHaveProperty('recommendation');
      expect(rec).toHaveProperty('expectedImpact');
      expect(rec).toHaveProperty('estimatedEffort');
      expect(rec).toHaveProperty('priority');
      expect(rec).toHaveProperty('generatedAt');
    });

    it('should clamp priority to valid range', async () => {
      const bottleneck: PerformanceBottleneck = {
        id: '1',
        operation: '/api/test',
        metricType: 'latency',
        currentValue: 1000,
        baselineValue: 200,
        severity: IssueSeverity.MEDIUM,
        detectedAt: Date.now(),
      };

      const recommendations = await recommender.generateRecommendations({
        bottlenecks: [bottleneck],
        anomalies: [],
      });

      expect(recommendations[0].priority).toBeGreaterThanOrEqual(1);
      expect(recommendations[0].priority).toBeLessThanOrEqual(5);
    });
  });
});
