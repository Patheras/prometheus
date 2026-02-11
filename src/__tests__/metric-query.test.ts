/**
 * Tests for Metric Query System (Task 10.2)
 * 
 * Tests the queryMetrics() method implementation including:
 * - Time range filtering
 * - Metric type filtering
 * - Metric name filtering
 * - Aggregations (avg, sum, count, min, max, p50, p95, p99)
 * 
 * Requirements: 3.2
 */

import { initializeDatabase } from '../memory/database';
import { createMemoryEngine } from '../memory/engine';
import { Metric } from '../memory/types';
import { unlinkSync, existsSync } from 'fs';

describe('Metric Query System (Task 10.2)', () => {
  const testDbPath = './data/test-metric-query.db';
  let db: any;
  let engine: any;

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Initialize database and engine
    db = await initializeDatabase({ path: testDbPath });
    engine = createMemoryEngine(db);
  });

  afterEach(() => {
    // Clean up
    if (db) {
      db.close();
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  // Helper function to create test metrics
  function createMetric(
    type: string,
    name: string,
    value: number,
    timestamp: number,
    context?: any
  ): Metric {
    return {
      id: `metric_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp,
      metric_type: type,
      metric_name: name,
      value,
      context: context ? JSON.stringify(context) : null,
    };
  }

  describe('Time Range Filtering', () => {
    it('should filter metrics by start_time', async () => {
      // Create metrics at different times
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
        createMetric('performance', 'response_time', 300, 3000),
      ];

      await engine.storeMetrics(metrics);

      // Query with start_time filter
      const result = await engine.queryMetrics({
        start_time: 2000,
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0].timestamp).toBe(2000);
      expect(result.metrics[1].timestamp).toBe(3000);
    });

    it('should filter metrics by end_time', async () => {
      // Create metrics at different times
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
        createMetric('performance', 'response_time', 300, 3000),
      ];

      await engine.storeMetrics(metrics);

      // Query with end_time filter
      const result = await engine.queryMetrics({
        end_time: 2000,
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0].timestamp).toBe(1000);
      expect(result.metrics[1].timestamp).toBe(2000);
    });

    it('should filter metrics by time range (start_time and end_time)', async () => {
      // Create metrics at different times
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
        createMetric('performance', 'response_time', 300, 3000),
        createMetric('performance', 'response_time', 400, 4000),
      ];

      await engine.storeMetrics(metrics);

      // Query with time range
      const result = await engine.queryMetrics({
        start_time: 2000,
        end_time: 3000,
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0].timestamp).toBe(2000);
      expect(result.metrics[1].timestamp).toBe(3000);
    });
  });

  describe('Metric Type Filtering', () => {
    it('should filter metrics by metric_type', async () => {
      // Create metrics of different types
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'cpu_usage', 50, 1000),
        createMetric('user_behavior', 'page_views', 10, 1000),
        createMetric('user_behavior', 'clicks', 5, 1000),
      ];

      await engine.storeMetrics(metrics);

      // Query for performance metrics
      const result = await engine.queryMetrics({
        metric_type: 'performance',
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics.every(m => m.metric_type === 'performance')).toBe(true);
    });

    it('should filter metrics by metric_name', async () => {
      // Create metrics with different names
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
        createMetric('performance', 'cpu_usage', 50, 1000),
      ];

      await engine.storeMetrics(metrics);

      // Query for response_time metrics
      const result = await engine.queryMetrics({
        metric_name: 'response_time',
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics.every(m => m.metric_name === 'response_time')).toBe(true);
    });

    it('should filter by both metric_type and metric_name', async () => {
      // Create metrics
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'cpu_usage', 50, 1000),
        createMetric('user_behavior', 'response_time', 200, 1000),
      ];

      await engine.storeMetrics(metrics);

      // Query for specific type and name
      const result = await engine.queryMetrics({
        metric_type: 'performance',
        metric_name: 'response_time',
      });

      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0].metric_type).toBe('performance');
      expect(result.metrics[0].metric_name).toBe('response_time');
    });
  });

  describe('Combined Filtering', () => {
    it('should apply all filters together', async () => {
      // Create diverse metrics
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
        createMetric('performance', 'response_time', 300, 3000),
        createMetric('performance', 'cpu_usage', 50, 2000),
        createMetric('user_behavior', 'response_time', 400, 2000),
      ];

      await engine.storeMetrics(metrics);

      // Query with all filters
      const result = await engine.queryMetrics({
        metric_type: 'performance',
        metric_name: 'response_time',
        start_time: 2000,
        end_time: 3000,
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0].value).toBe(200);
      expect(result.metrics[1].value).toBe(300);
    });
  });

  describe('Limit Parameter', () => {
    it('should limit the number of results', async () => {
      // Create many metrics
      const metrics = Array.from({ length: 10 }, (_, i) =>
        createMetric('performance', 'response_time', i * 100, 1000 + i)
      );

      await engine.storeMetrics(metrics);

      // Query with limit
      const result = await engine.queryMetrics({
        limit: 5,
      });

      expect(result.metrics).toHaveLength(5);
    });
  });

  describe('Aggregations', () => {
    it('should calculate basic aggregations (avg, sum, count, min, max)', async () => {
      // Create metrics with known values
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
        createMetric('performance', 'response_time', 300, 3000),
        createMetric('performance', 'response_time', 400, 4000),
      ];

      await engine.storeMetrics(metrics);

      // Query all metrics
      const result = await engine.queryMetrics({
        metric_type: 'performance',
        metric_name: 'response_time',
      });

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations!.count).toBe(4);
      expect(result.aggregations!.sum).toBe(1000);
      expect(result.aggregations!.avg).toBe(250);
      expect(result.aggregations!.min).toBe(100);
      expect(result.aggregations!.max).toBe(400);
    });

    it('should calculate percentiles (p50, p95, p99)', async () => {
      // Create metrics with values 1-100
      const metrics = Array.from({ length: 100 }, (_, i) =>
        createMetric('performance', 'response_time', i + 1, 1000 + i)
      );

      await engine.storeMetrics(metrics);

      // Query all metrics
      const result = await engine.queryMetrics({
        metric_type: 'performance',
        metric_name: 'response_time',
      });

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations!.p50).toBeCloseTo(50.5, 1);
      expect(result.aggregations!.p95).toBeCloseTo(95.05, 1);
      expect(result.aggregations!.p99).toBeCloseTo(99.01, 1);
    });

    it('should handle single metric aggregations', async () => {
      // Create single metric
      const metrics = [createMetric('performance', 'response_time', 100, 1000)];

      await engine.storeMetrics(metrics);

      // Query
      const result = await engine.queryMetrics({
        metric_type: 'performance',
      });

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations!.count).toBe(1);
      expect(result.aggregations!.avg).toBe(100);
      expect(result.aggregations!.min).toBe(100);
      expect(result.aggregations!.max).toBe(100);
      expect(result.aggregations!.p50).toBe(100);
      expect(result.aggregations!.p95).toBe(100);
      expect(result.aggregations!.p99).toBe(100);
    });

    it('should return undefined aggregations for empty results', async () => {
      // Query with no matching metrics
      const result = await engine.queryMetrics({
        metric_type: 'nonexistent',
      });

      expect(result.metrics).toHaveLength(0);
      expect(result.aggregations).toBeUndefined();
    });
  });

  describe('Result Ordering', () => {
    it('should return metrics ordered by timestamp ascending', async () => {
      // Create metrics in random order
      const metrics = [
        createMetric('performance', 'response_time', 300, 3000),
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
      ];

      await engine.storeMetrics(metrics);

      // Query
      const result = await engine.queryMetrics({
        metric_type: 'performance',
      });

      expect(result.metrics).toHaveLength(3);
      expect(result.metrics[0].timestamp).toBe(1000);
      expect(result.metrics[1].timestamp).toBe(2000);
      expect(result.metrics[2].timestamp).toBe(3000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle query with no filters', async () => {
      // Create metrics
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('user_behavior', 'clicks', 5, 2000),
      ];

      await engine.storeMetrics(metrics);

      // Query without filters
      const result = await engine.queryMetrics({});

      expect(result.metrics.length).toBeGreaterThan(0);
      expect(result.aggregations).toBeDefined();
    });

    it('should handle metrics with context', async () => {
      // Create metrics with context
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000, {
          endpoint: '/api/users',
          method: 'GET',
        }),
        createMetric('performance', 'response_time', 200, 2000, {
          endpoint: '/api/posts',
          method: 'POST',
        }),
      ];

      await engine.storeMetrics(metrics);

      // Query
      const result = await engine.queryMetrics({
        metric_type: 'performance',
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0].context).toBeTruthy();
      expect(result.metrics[1].context).toBeTruthy();
    });

    it('should handle large datasets efficiently', async () => {
      // Create 1000 metrics
      const metrics = Array.from({ length: 1000 }, (_, i) =>
        createMetric('performance', 'response_time', Math.random() * 1000, 1000 + i)
      );

      await engine.storeMetrics(metrics);

      // Query with limit
      const startTime = Date.now();
      const result = await engine.queryMetrics({
        metric_type: 'performance',
        limit: 100,
      });
      const endTime = Date.now();

      expect(result.metrics).toHaveLength(100);
      expect(result.aggregations).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Percentile Calculation Edge Cases', () => {
    it('should handle two values', async () => {
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
      ];

      await engine.storeMetrics(metrics);

      const result = await engine.queryMetrics({
        metric_type: 'performance',
      });

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations!.p50).toBeCloseTo(150, 1);
    });

    it('should handle identical values', async () => {
      const metrics = Array.from({ length: 10 }, (_, i) =>
        createMetric('performance', 'response_time', 100, 1000 + i)
      );

      await engine.storeMetrics(metrics);

      const result = await engine.queryMetrics({
        metric_type: 'performance',
      });

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations!.p50).toBe(100);
      expect(result.aggregations!.p95).toBe(100);
      expect(result.aggregations!.p99).toBe(100);
    });
  });

  describe('Integration with storeMetrics', () => {
    it('should query metrics immediately after storing', async () => {
      // Store metrics
      const metrics = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
      ];

      await engine.storeMetrics(metrics);

      // Query immediately
      const result = await engine.queryMetrics({
        metric_type: 'performance',
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.aggregations!.avg).toBe(150);
    });

    it('should handle multiple batch stores and queries', async () => {
      // Store first batch
      const batch1 = [
        createMetric('performance', 'response_time', 100, 1000),
        createMetric('performance', 'response_time', 200, 2000),
      ];
      await engine.storeMetrics(batch1);

      // Query first batch
      let result = await engine.queryMetrics({
        metric_type: 'performance',
      });
      expect(result.metrics).toHaveLength(2);

      // Store second batch
      const batch2 = [
        createMetric('performance', 'response_time', 300, 3000),
        createMetric('performance', 'response_time', 400, 4000),
      ];
      await engine.storeMetrics(batch2);

      // Query all
      result = await engine.queryMetrics({
        metric_type: 'performance',
      });
      expect(result.metrics).toHaveLength(4);
      expect(result.aggregations!.avg).toBe(250);
    });
  });
});
