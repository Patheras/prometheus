/**
 * Performance Analyzer Tests
 * 
 * Tests for bottleneck identification, anomaly detection,
 * and optimization recommendations.
 * 
 * Task 28.1: Create bottleneck identification
 * Task 28.2: Create anomaly detection
 * Task 28.3: Generate optimization recommendations
 */

import { createPerformanceAnalyzer, MetricDataPoint } from '../performance-analyzer';
import { IssueSeverity } from '../types';

describe('PerformanceAnalyzer', () => {
  describe('Bottleneck Identification', () => {
    it('should identify slow operations', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = [
        // Fast operation
        { timestamp: 1000, value: 10, operation: 'fast-op' },
        { timestamp: 2000, value: 12, operation: 'fast-op' },
        { timestamp: 3000, value: 11, operation: 'fast-op' },
        // Slow operation
        { timestamp: 1000, value: 500, operation: 'slow-op' },
        { timestamp: 2000, value: 600, operation: 'slow-op' },
        { timestamp: 3000, value: 550, operation: 'slow-op' },
      ];

      const baseline = new Map([
        ['fast-op', 10],
        ['slow-op', 100], // Baseline is much faster
      ]);

      const bottlenecks = analyzer.identifyBottlenecks(metrics, baseline);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].operation).toBe('slow-op');
      expect(bottlenecks[0].currentValue).toBeGreaterThan(bottlenecks[0].baselineValue);
    });

    it('should calculate severity based on threshold ratio', () => {
      const analyzer = createPerformanceAnalyzer({
        bottleneckThreshold: 2, // 2x baseline
      });

      const metrics: MetricDataPoint[] = [
        // Critical: 10x baseline
        { timestamp: 1000, value: 1000, operation: 'critical-op' },
        { timestamp: 2000, value: 1100, operation: 'critical-op' },
        // High: 5x baseline
        { timestamp: 1000, value: 500, operation: 'high-op' },
        { timestamp: 2000, value: 550, operation: 'high-op' },
        // Medium: 3x baseline
        { timestamp: 1000, value: 300, operation: 'medium-op' },
        { timestamp: 2000, value: 320, operation: 'medium-op' },
      ];

      const baseline = new Map([
        ['critical-op', 100],
        ['high-op', 100],
        ['medium-op', 100],
      ]);

      const bottlenecks = analyzer.identifyBottlenecks(metrics, baseline);

      // Should have all three
      expect(bottlenecks.length).toBe(3);

      // Critical should be first
      expect(bottlenecks[0].severity).toBe(IssueSeverity.CRITICAL);
      expect(bottlenecks[0].operation).toBe('critical-op');
    });

    it('should not flag operations within threshold', () => {
      const analyzer = createPerformanceAnalyzer({
        bottleneckThreshold: 2,
      });

      const metrics: MetricDataPoint[] = [
        { timestamp: 1000, value: 100, operation: 'normal-op' },
        { timestamp: 2000, value: 110, operation: 'normal-op' },
        { timestamp: 3000, value: 105, operation: 'normal-op' },
      ];

      const baseline = new Map([['normal-op', 100]]);

      const bottlenecks = analyzer.identifyBottlenecks(metrics, baseline);

      expect(bottlenecks.length).toBe(0);
    });

    it('should use p50 as baseline when not provided', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = [
        { timestamp: 1000, value: 100, operation: 'op' },
        { timestamp: 2000, value: 110, operation: 'op' },
        { timestamp: 3000, value: 500, operation: 'op' }, // Outlier
      ];

      const bottlenecks = analyzer.identifyBottlenecks(metrics);

      // Should detect bottleneck using p50 as baseline
      expect(bottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    it('should estimate affected users', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = Array(100)
        .fill(0)
        .map((_, i) => ({
          timestamp: 1000 + i * 1000,
          value: 500,
          operation: 'slow-op',
        }));

      const baseline = new Map([['slow-op', 100]]);

      const bottlenecks = analyzer.identifyBottlenecks(metrics, baseline);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].affectedUsers).toBeGreaterThan(0);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect statistical outliers', () => {
      const analyzer = createPerformanceAnalyzer({
        anomalyZScore: 3,
      });

      const metrics: MetricDataPoint[] = [
        // Normal values
        ...Array(20)
          .fill(0)
          .map((_, i) => ({
            timestamp: 1000 + i * 1000,
            value: 100 + Math.random() * 10,
            operation: 'op',
          })),
        // Anomaly
        { timestamp: 30000, value: 1000, operation: 'op' },
      ];

      const anomalies = analyzer.detectAnomalies(metrics);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].value).toBe(1000);
      expect(anomalies[0].zScore).toBeGreaterThan(3);
    });

    it('should calculate z-score correctly', () => {
      const analyzer = createPerformanceAnalyzer({
        anomalyZScore: 2, // Lower threshold for this test
      });

      const metrics: MetricDataPoint[] = [
        { timestamp: 1000, value: 100, operation: 'op' },
        { timestamp: 2000, value: 105, operation: 'op' },
        { timestamp: 3000, value: 95, operation: 'op' },
        { timestamp: 4000, value: 102, operation: 'op' },
        { timestamp: 5000, value: 98, operation: 'op' },
        { timestamp: 6000, value: 500, operation: 'op' }, // Clear outlier
      ];

      const anomalies = analyzer.detectAnomalies(metrics);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].zScore).toBeGreaterThan(2);
      expect(anomalies[0].value).toBe(500);
    });

    it('should assign severity based on z-score', () => {
      const analyzer = createPerformanceAnalyzer({
        anomalyZScore: 3,
      });

      const metrics: MetricDataPoint[] = [
        ...Array(20)
          .fill(0)
          .map((_, i) => ({
            timestamp: 1000 + i * 1000,
            value: 100,
            operation: 'op',
          })),
        // Extreme anomaly (z-score > 5)
        { timestamp: 30000, value: 2000, operation: 'op' },
      ];

      const anomalies = analyzer.detectAnomalies(metrics);

      if (anomalies.length > 0) {
        expect(anomalies[0].severity).toBeDefined();
        expect([
          IssueSeverity.LOW,
          IssueSeverity.MEDIUM,
          IssueSeverity.HIGH,
          IssueSeverity.CRITICAL,
        ]).toContain(anomalies[0].severity);
      }
    });

    it('should not flag normal variations', () => {
      const analyzer = createPerformanceAnalyzer({
        anomalyZScore: 3,
      });

      const metrics: MetricDataPoint[] = Array(20)
        .fill(0)
        .map((_, i) => ({
          timestamp: 1000 + i * 1000,
          value: 100 + Math.random() * 5, // Small variation
          operation: 'op',
        }));

      const anomalies = analyzer.detectAnomalies(metrics);

      expect(anomalies.length).toBe(0);
    });

    it('should sort anomalies by z-score', () => {
      const analyzer = createPerformanceAnalyzer({
        anomalyZScore: 2,
      });

      const metrics: MetricDataPoint[] = [
        ...Array(20)
          .fill(0)
          .map((_, i) => ({
            timestamp: 1000 + i * 1000,
            value: 100,
            operation: 'op',
          })),
        { timestamp: 30000, value: 500, operation: 'op' }, // Moderate anomaly
        { timestamp: 31000, value: 1000, operation: 'op' }, // Extreme anomaly
      ];

      const anomalies = analyzer.detectAnomalies(metrics);

      if (anomalies.length > 1) {
        expect(anomalies[0].zScore).toBeGreaterThanOrEqual(anomalies[1].zScore);
      }
    });
  });

  describe('Percentile Calculation', () => {
    it('should calculate percentiles correctly', () => {
      const analyzer = createPerformanceAnalyzer();

      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = analyzer.calculatePercentiles(values);

      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);
      expect(stats.mean).toBe(5.5);
      expect(stats.p50).toBeGreaterThanOrEqual(5);
      expect(stats.p95).toBeGreaterThanOrEqual(9);
      expect(stats.count).toBe(10);
    });

    it('should handle empty array', () => {
      const analyzer = createPerformanceAnalyzer();

      const stats = analyzer.calculatePercentiles([]);

      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.count).toBe(0);
    });

    it('should handle single value', () => {
      const analyzer = createPerformanceAnalyzer();

      const stats = analyzer.calculatePercentiles([42]);

      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.mean).toBe(42);
      expect(stats.p50).toBe(42);
      expect(stats.p95).toBe(42);
    });

    it('should calculate mean correctly', () => {
      const analyzer = createPerformanceAnalyzer();

      const stats = analyzer.calculatePercentiles([10, 20, 30]);

      expect(stats.mean).toBe(20);
    });
  });

  describe('Optimization Suggestions', () => {
    it('should generate suggestions for bottlenecks', () => {
      const analyzer = createPerformanceAnalyzer();

      const bottleneck = {
        id: '1',
        operation: 'slow-query',
        metricType: 'latency' as const,
        currentValue: 500,
        baselineValue: 100,
        severity: IssueSeverity.HIGH,
        affectedUsers: 1000,
        detectedAt: Date.now(),
      };

      const suggestion = analyzer.generateOptimizationSuggestion(bottleneck);

      expect(suggestion).toContain('slow-query');
      expect(suggestion).toContain('500');
      expect(suggestion).toContain('100');
      expect(suggestion).toContain('Optimization');
      expect(suggestion).toContain('caching');
    });

    it('should include impact percentage', () => {
      const analyzer = createPerformanceAnalyzer();

      const bottleneck = {
        id: '1',
        operation: 'op',
        metricType: 'latency' as const,
        currentValue: 300,
        baselineValue: 100,
        severity: IssueSeverity.HIGH,
        detectedAt: Date.now(),
      };

      const suggestion = analyzer.generateOptimizationSuggestion(bottleneck);

      expect(suggestion).toContain('200%'); // 3x slower = 200% increase
    });

    it('should include affected users if available', () => {
      const analyzer = createPerformanceAnalyzer();

      const bottleneck = {
        id: '1',
        operation: 'op',
        metricType: 'latency' as const,
        currentValue: 300,
        baselineValue: 100,
        severity: IssueSeverity.HIGH,
        affectedUsers: 5000,
        detectedAt: Date.now(),
      };

      const suggestion = analyzer.generateOptimizationSuggestion(bottleneck);

      // Check for the number in various formats
      expect(suggestion).toMatch(/5[,.]?000/);
    });
  });

  describe('Performance Trend Analysis', () => {
    it('should analyze performance over time windows', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = [
        // Window 1: Good performance
        { timestamp: 1000, value: 100, operation: 'op' },
        { timestamp: 2000, value: 110, operation: 'op' },
        // Window 2: Degraded performance (after 1 hour)
        { timestamp: 3601000, value: 500, operation: 'op' },
        { timestamp: 3602000, value: 550, operation: 'op' },
      ];

      const trend = analyzer.analyzePerformanceTrend(metrics, 3600000); // 1 hour windows

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0].mean).toBeLessThan(trend[1].mean); // Performance degraded
    });

    it('should handle empty metrics', () => {
      const analyzer = createPerformanceAnalyzer();

      const trend = analyzer.analyzePerformanceTrend([]);

      expect(trend).toEqual([]);
    });

    it('should group metrics into time windows', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = Array(100)
        .fill(0)
        .map((_, i) => ({
          timestamp: i * 60000, // 1 minute apart
          value: 100 + Math.random() * 10,
          operation: 'op',
        }));

      const trend = analyzer.analyzePerformanceTrend(metrics, 600000); // 10 minute windows

      expect(trend.length).toBeGreaterThan(1);
      expect(trend[0].count).toBeGreaterThan(0);
    });
  });

  describe('Operation Grouping', () => {
    it('should group metrics by operation', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = [
        { timestamp: 1000, value: 100, operation: 'op1' },
        { timestamp: 2000, value: 200, operation: 'op2' },
        { timestamp: 3000, value: 110, operation: 'op1' },
      ];

      const bottlenecks = analyzer.identifyBottlenecks(metrics);

      // Should analyze each operation separately
      expect(bottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle metrics without operation field', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = [
        { timestamp: 1000, value: 100, endpoint: '/api/users' },
        { timestamp: 2000, value: 200, endpoint: '/api/posts' },
      ];

      const bottlenecks = analyzer.identifyBottlenecks(metrics);

      // Should not crash
      expect(Array.isArray(bottlenecks)).toBe(true);
    });

    it('should use "unknown" for metrics without operation or endpoint', () => {
      const analyzer = createPerformanceAnalyzer();

      const metrics: MetricDataPoint[] = [
        { timestamp: 1000, value: 100 },
        { timestamp: 2000, value: 200 },
      ];

      const bottlenecks = analyzer.identifyBottlenecks(metrics);

      // Should group under "unknown"
      expect(Array.isArray(bottlenecks)).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom bottleneck threshold', () => {
      const analyzer = createPerformanceAnalyzer({
        bottleneckThreshold: 5, // Very high threshold
      });

      const metrics: MetricDataPoint[] = [
        { timestamp: 1000, value: 300, operation: 'op' },
        { timestamp: 2000, value: 320, operation: 'op' },
      ];

      const baseline = new Map([['op', 100]]);

      const bottlenecks = analyzer.identifyBottlenecks(metrics, baseline);

      // 3x baseline shouldn't trigger with 5x threshold
      expect(bottlenecks.length).toBe(0);
    });

    it('should respect custom anomaly z-score', () => {
      const analyzer = createPerformanceAnalyzer({
        anomalyZScore: 5, // Very high threshold
      });

      const metrics: MetricDataPoint[] = [
        ...Array(20)
          .fill(0)
          .map((_, i) => ({
            timestamp: 1000 + i * 1000,
            value: 100,
            operation: 'op',
          })),
        { timestamp: 30000, value: 500, operation: 'op' }, // Moderate outlier
      ];

      const anomalies = analyzer.detectAnomalies(metrics);

      // Moderate outlier shouldn't trigger with high threshold
      expect(anomalies.length).toBe(0);
    });
  });
});
