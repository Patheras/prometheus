/**
 * Performance Analyzer
 * 
 * Analyzes performance metrics to identify bottlenecks, anomalies,
 * and optimization opportunities.
 * 
 * Task 28.1: Create bottleneck identification
 * Task 28.2: Create anomaly detection
 * Task 28.3: Generate optimization recommendations
 */

import { PerformanceBottleneck, PerformanceAnomaly, IssueSeverity } from './types';
import { randomUUID } from 'crypto';

/**
 * Performance metric data point
 */
export type MetricDataPoint = {
  timestamp: number;
  value: number;
  operation?: string;
  endpoint?: string;
  metadata?: Record<string, any>;
};

/**
 * Percentile statistics
 */
export type PercentileStats = {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  count: number;
};

/**
 * Performance analysis options
 */
export type PerformanceAnalysisOptions = {
  /** Minimum percentile to flag as bottleneck (default: p95) */
  bottleneckPercentile?: number;
  /** Threshold multiplier for bottleneck detection (default: 2x baseline) */
  bottleneckThreshold?: number;
  /** Z-score threshold for anomaly detection (default: 3) */
  anomalyZScore?: number;
  /** Minimum affected users to flag as critical */
  minAffectedUsers?: number;
};

/**
 * Performance Analyzer
 * 
 * Identifies bottlenecks and anomalies in performance metrics.
 */
export class PerformanceAnalyzer {
  private options: Required<PerformanceAnalysisOptions>;

  constructor(options?: PerformanceAnalysisOptions) {
    this.options = {
      bottleneckPercentile: options?.bottleneckPercentile ?? 95,
      bottleneckThreshold: options?.bottleneckThreshold ?? 2,
      anomalyZScore: options?.anomalyZScore ?? 3,
      minAffectedUsers: options?.minAffectedUsers ?? 100,
    };
  }

  /**
   * Identify performance bottlenecks
   * 
   * Groups metrics by operation/endpoint, calculates percentiles,
   * and flags operations that exceed thresholds.
   * 
   * @param metrics - Array of metric data points
   * @param baseline - Optional baseline metrics for comparison
   * @returns Array of identified bottlenecks
   */
  identifyBottlenecks(
    metrics: MetricDataPoint[],
    baseline?: Map<string, number>
  ): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Group metrics by operation
    const grouped = this.groupByOperation(metrics);

    for (const [operation, operationMetrics] of grouped.entries()) {
      // Calculate percentile statistics
      const stats = this.calculatePercentiles(operationMetrics.map((m) => m.value));

      // Get baseline value (if available)
      const baselineValue = baseline?.get(operation) ?? stats.p50;

      // Check if p95 exceeds threshold
      const threshold = baselineValue * this.options.bottleneckThreshold;
      const currentValue = stats.p95;

      if (currentValue > threshold) {
        // Determine severity based on how much it exceeds threshold
        const ratio = currentValue / threshold;
        let severity: IssueSeverity;
        if (ratio > 3) {
          severity = IssueSeverity.CRITICAL;
        } else if (ratio > 2) {
          severity = IssueSeverity.HIGH;
        } else if (ratio > 1.5) {
          severity = IssueSeverity.MEDIUM;
        } else {
          severity = IssueSeverity.LOW;
        }

        // Estimate affected users (simplified)
        const affectedUsers = this.estimateAffectedUsers(operationMetrics);

        bottlenecks.push({
          id: randomUUID(),
          operation,
          metricType: 'latency',
          currentValue,
          baselineValue,
          severity,
          affectedUsers,
          detectedAt: Date.now(),
        });
      }
    }

    // Sort by severity and impact
    return bottlenecks.sort((a, b) => {
      const severityOrder = {
        [IssueSeverity.CRITICAL]: 4,
        [IssueSeverity.HIGH]: 3,
        [IssueSeverity.MEDIUM]: 2,
        [IssueSeverity.LOW]: 1,
      };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Detect performance anomalies
   * 
   * Uses statistical analysis to detect outliers that deviate
   * significantly from the mean.
   * 
   * @param metrics - Array of metric data points
   * @returns Array of detected anomalies
   */
  detectAnomalies(metrics: MetricDataPoint[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];

    // Group by operation
    const grouped = this.groupByOperation(metrics);

    for (const [operation, operationMetrics] of grouped.entries()) {
      const values = operationMetrics.map((m) => m.value);

      // Calculate mean and standard deviation
      const mean = this.calculateMean(values);
      const stdDev = this.calculateStdDev(values, mean);

      // Skip if no variation (stdDev = 0)
      if (stdDev === 0) {
        continue;
      }

      // Find outliers
      for (const metric of operationMetrics) {
        const zScore = Math.abs((metric.value - mean) / stdDev);

        if (zScore >= this.options.anomalyZScore && isFinite(zScore)) {
          // Determine severity based on z-score
          let severity: IssueSeverity;
          if (zScore > 5) {
            severity = IssueSeverity.CRITICAL;
          } else if (zScore > 4) {
            severity = IssueSeverity.HIGH;
          } else if (zScore > 3) {
            severity = IssueSeverity.MEDIUM;
          } else {
            severity = IssueSeverity.LOW;
          }

          anomalies.push({
            id: randomUUID(),
            metricName: operation,
            value: metric.value,
            mean,
            stdDev,
            zScore,
            severity,
            timestamp: metric.timestamp,
          });
        }
      }
    }

    // Sort by z-score (most anomalous first)
    return anomalies.sort((a, b) => b.zScore - a.zScore);
  }

  /**
   * Calculate percentile statistics
   * 
   * @param values - Array of numeric values
   * @returns Percentile statistics
   */
  calculatePercentiles(values: number[]): PercentileStats {
    if (values.length === 0) {
      return {
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        mean: 0,
        count: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, Math.min(index, count - 1))];
    };

    return {
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      min: sorted[0],
      max: sorted[count - 1],
      mean: this.calculateMean(values),
      count,
    };
  }

  /**
   * Group metrics by operation/endpoint
   */
  private groupByOperation(metrics: MetricDataPoint[]): Map<string, MetricDataPoint[]> {
    const grouped = new Map<string, MetricDataPoint[]>();

    for (const metric of metrics) {
      const key = metric.operation || metric.endpoint || 'unknown';

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key)!.push(metric);
    }

    return grouped;
  }

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;

    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Estimate affected users (simplified heuristic)
   */
  private estimateAffectedUsers(metrics: MetricDataPoint[]): number {
    // In real implementation, would use actual user data
    // For now, estimate based on metric count
    return Math.min(metrics.length * 10, 10000);
  }

  /**
   * Generate optimization suggestion for a bottleneck
   * 
   * @param bottleneck - Performance bottleneck
   * @returns Optimization suggestion
   */
  generateOptimizationSuggestion(bottleneck: PerformanceBottleneck): string {
    const suggestions: string[] = [];

    suggestions.push(`Performance Bottleneck: ${bottleneck.operation}`);
    suggestions.push(
      `Current ${bottleneck.metricType}: ${bottleneck.currentValue.toFixed(2)}ms`
    );
    suggestions.push(`Baseline: ${bottleneck.baselineValue.toFixed(2)}ms`);
    suggestions.push(
      `Impact: ${((bottleneck.currentValue / bottleneck.baselineValue) * 100 - 100).toFixed(0)}% slower`
    );

    if (bottleneck.affectedUsers) {
      suggestions.push(`Affected users: ~${bottleneck.affectedUsers.toLocaleString()}`);
    }

    suggestions.push('\nOptimization Strategies:');

    // Generic optimization suggestions
    if (bottleneck.metricType === 'latency') {
      suggestions.push('1. Add caching for frequently accessed data');
      suggestions.push('2. Optimize database queries (add indexes, reduce joins)');
      suggestions.push('3. Implement pagination for large result sets');
      suggestions.push('4. Consider async processing for heavy operations');
      suggestions.push('5. Profile code to identify specific slow sections');
    }

    suggestions.push('\nNext Steps:');
    suggestions.push('1. Profile the operation to identify root cause');
    suggestions.push('2. Correlate with recent code changes');
    suggestions.push('3. Test optimization in staging environment');
    suggestions.push('4. Monitor impact after deployment');

    return suggestions.join('\n');
  }

  /**
   * Correlate performance changes with time periods
   * 
   * Useful for identifying when performance degraded.
   * 
   * @param metrics - Array of metric data points
   * @param windowMs - Time window in milliseconds
   * @returns Performance trend data
   */
  analyzePerformanceTrend(
    metrics: MetricDataPoint[],
    windowMs: number = 3600000 // 1 hour default
  ): Array<{
    startTime: number;
    endTime: number;
    mean: number;
    p95: number;
    count: number;
  }> {
    if (metrics.length === 0) return [];

    // Sort by timestamp
    const sorted = [...metrics].sort((a, b) => a.timestamp - b.timestamp);

    const windows: Array<{
      startTime: number;
      endTime: number;
      mean: number;
      p95: number;
      count: number;
    }> = [];

    let currentWindow: MetricDataPoint[] = [];
    let windowStart = sorted[0].timestamp;

    for (const metric of sorted) {
      if (metric.timestamp - windowStart >= windowMs) {
        // Process current window
        if (currentWindow.length > 0) {
          const stats = this.calculatePercentiles(currentWindow.map((m) => m.value));
          windows.push({
            startTime: windowStart,
            endTime: windowStart + windowMs,
            mean: stats.mean,
            p95: stats.p95,
            count: currentWindow.length,
          });
        }

        // Start new window
        windowStart = metric.timestamp;
        currentWindow = [];
      }

      currentWindow.push(metric);
    }

    // Process final window
    if (currentWindow.length > 0) {
      const stats = this.calculatePercentiles(currentWindow.map((m) => m.value));
      windows.push({
        startTime: windowStart,
        endTime: windowStart + windowMs,
        mean: stats.mean,
        p95: stats.p95,
        count: currentWindow.length,
      });
    }

    return windows;
  }
}

/**
 * Create a performance analyzer instance
 * 
 * @param options - Optional analysis options
 * @returns Performance analyzer instance
 */
export function createPerformanceAnalyzer(
  options?: PerformanceAnalysisOptions
): PerformanceAnalyzer {
  return new PerformanceAnalyzer(options);
}
