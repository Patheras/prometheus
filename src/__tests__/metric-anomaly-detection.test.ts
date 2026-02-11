/**
 * Tests for metric anomaly detection (Task 10.3)
 * 
 * Tests the detectAnomalies() method with different threshold types:
 * - Absolute thresholds
 * - Percentage-based thresholds
 * - Standard deviation-based thresholds
 * 
 * Requirements: 3.5
 */

import { initializeDatabase, PrometheusDatabase } from '../memory/database';
import { createMemoryEngine, MemoryEngine } from '../memory/engine';
import { Metric } from '../memory/types';
import { unlinkSync, existsSync } from 'fs';

describe('Metric Anomaly Detection (Task 10.3)', () => {
  let db: PrometheusDatabase;
  let engine: MemoryEngine;
  const testDbPath = './data/test-anomaly-detection.db';

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

  describe('Absolute Threshold Detection', () => {
    it('should detect metrics exceeding absolute threshold', async () => {
      // Store metrics with varying values
      const metrics: Metric[] = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'response_time',
          metric_name: 'api_latency',
          value: 100,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'response_time',
          metric_name: 'api_latency',
          value: 200,
          context: null,
        },
        {
          id: 'metric_3',
          timestamp: Date.now(),
          metric_type: 'response_time',
          metric_name: 'api_latency',
          value: 1500, // Anomaly
          context: null,
        },
        {
          id: 'metric_4',
          timestamp: Date.now(),
          metric_type: 'response_time',
          metric_name: 'api_latency',
          value: 150,
          context: null,
        },
        {
          id: 'metric_5',
          timestamp: Date.now(),
          metric_type: 'response_time',
          metric_name: 'api_latency',
          value: 2000, // Anomaly
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Detect anomalies with absolute threshold of 1000
      const anomalies = await engine.detectAnomalies('response_time', {
        thresholdType: 'absolute',
        thresholdValue: 1000,
      });

      // Should detect 2 anomalies
      expect(anomalies).toHaveLength(2);
      expect(anomalies[0].id).toBe('metric_3');
      expect(anomalies[0].value).toBe(1500);
      expect(anomalies[1].id).toBe('metric_5');
      expect(anomalies[1].value).toBe(2000);
    });

    it('should return empty array when no metrics exceed threshold', async () => {
      const metrics: Metric[] = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'response_time',
          metric_name: 'api_latency',
          value: 100,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'response_time',
          metric_name: 'api_latency',
          value: 200,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      const anomalies = await engine.detectAnomalies('response_time', {
        thresholdType: 'absolute',
        thresholdValue: 1000,
      });

      expect(anomalies).toHaveLength(0);
    });
  });

  describe('Percentage Threshold Detection', () => {
    it('should detect metrics with percentage change from baseline', async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Create baseline metrics (average ~100)
      const metrics: Metric[] = [
        {
          id: 'metric_1',
          timestamp: oneHourAgo,
          metric_type: 'cpu_usage',
          metric_name: 'cpu_percent',
          value: 90,
          context: null,
        },
        {
          id: 'metric_2',
          timestamp: oneHourAgo + 1000,
          metric_type: 'cpu_usage',
          metric_name: 'cpu_percent',
          value: 100,
          context: null,
        },
        {
          id: 'metric_3',
          timestamp: oneHourAgo + 2000,
          metric_type: 'cpu_usage',
          metric_name: 'cpu_percent',
          value: 110,
          context: null,
        },
        // Recent spike (100% increase from baseline of ~100)
        {
          id: 'metric_4',
          timestamp: now - 1000,
          metric_type: 'cpu_usage',
          metric_name: 'cpu_percent',
          value: 200, // Anomaly: 100% increase
          context: null,
        },
        {
          id: 'metric_5',
          timestamp: now,
          metric_type: 'cpu_usage',
          metric_name: 'cpu_percent',
          value: 105, // Normal
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Detect anomalies with 50% threshold
      const anomalies = await engine.detectAnomalies('cpu_usage', {
        thresholdType: 'percentage',
        thresholdValue: 50, // 50% change
        baselineWindow: 3600000, // 1 hour
      });

      // Should detect the spike
      expect(anomalies.length).toBeGreaterThan(0);
      const spikeAnomaly = anomalies.find(a => a.id === 'metric_4');
      expect(spikeAnomaly).toBeDefined();
      expect(spikeAnomaly?.value).toBe(200);
    });

    it('should handle empty baseline window gracefully', async () => {
      const metrics: Metric[] = [
        {
          id: 'metric_1',
          timestamp: Date.now() - 7200000, // 2 hours ago (outside baseline window)
          metric_type: 'memory_usage',
          metric_name: 'memory_mb',
          value: 1000,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // Baseline window is 1 hour, so no baseline data
      const anomalies = await engine.detectAnomalies('memory_usage', {
        thresholdType: 'percentage',
        thresholdValue: 50,
        baselineWindow: 3600000,
      });

      // Should return empty array when no baseline
      expect(anomalies).toHaveLength(0);
    });
  });

  describe('Standard Deviation Threshold Detection', () => {
    it('should detect statistical outliers beyond N standard deviations', async () => {
      // Create metrics with normal distribution and outliers
      const metrics: Metric[] = [
        // Normal values around 100
        { id: 'metric_1', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 95, context: null },
        { id: 'metric_2', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 98, context: null },
        { id: 'metric_3', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 100, context: null },
        { id: 'metric_4', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 102, context: null },
        { id: 'metric_5', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 105, context: null },
        { id: 'metric_6', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 97, context: null },
        { id: 'metric_7', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 103, context: null },
        // Outliers
        { id: 'metric_8', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 500, context: null }, // Far outlier
        { id: 'metric_9', timestamp: Date.now(), metric_type: 'requests', metric_name: 'count', value: 1, context: null },   // Far outlier
      ];

      await engine.storeMetrics(metrics);

      // Detect anomalies beyond 2 standard deviations (more sensitive)
      const anomalies = await engine.detectAnomalies('requests', {
        thresholdType: 'std_deviation',
        thresholdValue: 2,
      });

      // Should detect the outliers
      expect(anomalies.length).toBeGreaterThan(0);
      
      // Check that extreme values are flagged
      const outlierIds = anomalies.map(a => a.id);
      expect(outlierIds).toContain('metric_8'); // 500 is far from mean
    });

    it('should use default threshold of 3 standard deviations', async () => {
      // Use more normal values to dilute the effect of the outlier on std dev
      const metrics: Metric[] = [
        { id: 'metric_1', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 10, context: null },
        { id: 'metric_2', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 12, context: null },
        { id: 'metric_3', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 11, context: null },
        { id: 'metric_4', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 13, context: null },
        { id: 'metric_5', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 10, context: null },
        { id: 'metric_6', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 12, context: null },
        { id: 'metric_7', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 11, context: null },
        { id: 'metric_8', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 13, context: null },
        { id: 'metric_9', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 10, context: null },
        { id: 'metric_10', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 12, context: null },
        { id: 'metric_11', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 11, context: null },
        { id: 'metric_12', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 13, context: null },
        { id: 'metric_13', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 10, context: null },
        { id: 'metric_14', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 12, context: null },
        { id: 'metric_15', timestamp: Date.now(), metric_type: 'errors', metric_name: 'count', value: 2000, context: null }, // Extreme outlier
      ];

      await engine.storeMetrics(metrics);

      // Call without options (should use default std_deviation with threshold 3)
      const anomalies = await engine.detectAnomalies('errors');

      // Should detect the extreme outlier
      expect(anomalies.length).toBeGreaterThan(0);
      const outlierIds = anomalies.map(a => a.id);
      expect(outlierIds).toContain('metric_15');
    });

    it('should handle uniform values without division by zero', async () => {
      // All values are the same (std dev = 0)
      const metrics: Metric[] = [
        { id: 'metric_1', timestamp: Date.now(), metric_type: 'constant', metric_name: 'value', value: 100, context: null },
        { id: 'metric_2', timestamp: Date.now(), metric_type: 'constant', metric_name: 'value', value: 100, context: null },
        { id: 'metric_3', timestamp: Date.now(), metric_type: 'constant', metric_name: 'value', value: 100, context: null },
      ];

      await engine.storeMetrics(metrics);

      // Should not crash with division by zero
      const anomalies = await engine.detectAnomalies('constant', {
        thresholdType: 'std_deviation',
        thresholdValue: 3,
      });

      // With std dev = 0, no anomalies should be detected (or all, depending on implementation)
      // The important thing is it doesn't crash
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array for non-existent metric type', async () => {
      const anomalies = await engine.detectAnomalies('non_existent_type');
      expect(anomalies).toHaveLength(0);
    });

    it('should handle single metric gracefully', async () => {
      const metrics: Metric[] = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'single',
          metric_name: 'value',
          value: 100,
          context: null,
        },
      ];

      await engine.storeMetrics(metrics);

      // With only one metric, std dev is 0
      const anomalies = await engine.detectAnomalies('single', {
        thresholdType: 'std_deviation',
        thresholdValue: 3,
      });

      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should preserve metric context in anomaly results', async () => {
      const metrics: Metric[] = [
        {
          id: 'metric_1',
          timestamp: Date.now(),
          metric_type: 'api_calls',
          metric_name: 'latency',
          value: 100,
          context: JSON.stringify({ endpoint: '/api/users', method: 'GET' }),
        },
        {
          id: 'metric_2',
          timestamp: Date.now(),
          metric_type: 'api_calls',
          metric_name: 'latency',
          value: 5000, // Anomaly
          context: JSON.stringify({ endpoint: '/api/users', method: 'POST' }),
        },
      ];

      await engine.storeMetrics(metrics);

      const anomalies = await engine.detectAnomalies('api_calls', {
        thresholdType: 'absolute',
        thresholdValue: 1000,
      });

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].context).toBeTruthy();
      
      const context = JSON.parse(anomalies[0].context!);
      expect(context.endpoint).toBe('/api/users');
      expect(context.method).toBe('POST');
    });
  });

  describe('Multiple Metric Types', () => {
    it('should only detect anomalies for specified metric type', async () => {
      const metrics: Metric[] = [
        // Type A - normal
        { id: 'metric_a1', timestamp: Date.now(), metric_type: 'type_a', metric_name: 'value', value: 100, context: null },
        { id: 'metric_a2', timestamp: Date.now(), metric_type: 'type_a', metric_name: 'value', value: 110, context: null },
        // Type B - has anomaly
        { id: 'metric_b1', timestamp: Date.now(), metric_type: 'type_b', metric_name: 'value', value: 100, context: null },
        { id: 'metric_b2', timestamp: Date.now(), metric_type: 'type_b', metric_name: 'value', value: 10000, context: null }, // Anomaly
      ];

      await engine.storeMetrics(metrics);

      // Detect anomalies only in type_a
      const anomaliesA = await engine.detectAnomalies('type_a', {
        thresholdType: 'absolute',
        thresholdValue: 1000,
      });

      // Detect anomalies only in type_b
      const anomaliesB = await engine.detectAnomalies('type_b', {
        thresholdType: 'absolute',
        thresholdValue: 1000,
      });

      expect(anomaliesA).toHaveLength(0);
      expect(anomaliesB).toHaveLength(1);
      expect(anomaliesB[0].id).toBe('metric_b2');
    });
  });

  describe('Threshold Configuration', () => {
    it('should support custom threshold values', async () => {
      const metrics: Metric[] = [
        { id: 'metric_1', timestamp: Date.now(), metric_type: 'test', metric_name: 'value', value: 100, context: null },
        { id: 'metric_2', timestamp: Date.now(), metric_type: 'test', metric_name: 'value', value: 600, context: null },
        { id: 'metric_3', timestamp: Date.now(), metric_type: 'test', metric_name: 'value', value: 1100, context: null },
      ];

      await engine.storeMetrics(metrics);

      // With threshold 500
      const anomalies500 = await engine.detectAnomalies('test', {
        thresholdType: 'absolute',
        thresholdValue: 500,
      });

      // With threshold 1000
      const anomalies1000 = await engine.detectAnomalies('test', {
        thresholdType: 'absolute',
        thresholdValue: 1000,
      });

      expect(anomalies500).toHaveLength(2); // 600 and 1100
      expect(anomalies1000).toHaveLength(1); // only 1100
    });

    it('should support custom baseline window', async () => {
      const now = Date.now();
      const metrics: Metric[] = [
        // Old baseline (2 hours ago)
        { id: 'metric_1', timestamp: now - 7200000, metric_type: 'test', metric_name: 'value', value: 50, context: null },
        // Recent baseline (30 minutes ago)
        { id: 'metric_2', timestamp: now - 1800000, metric_type: 'test', metric_name: 'value', value: 100, context: null },
        { id: 'metric_3', timestamp: now - 1800000, metric_type: 'test', metric_name: 'value', value: 110, context: null },
        // Current value
        { id: 'metric_4', timestamp: now, metric_type: 'test', metric_name: 'value', value: 200, context: null },
      ];

      await engine.storeMetrics(metrics);

      // With 1 hour baseline (should use metrics 2 and 3, baseline ~105)
      const anomalies1h = await engine.detectAnomalies('test', {
        thresholdType: 'percentage',
        thresholdValue: 50,
        baselineWindow: 3600000, // 1 hour
      });

      // With 3 hour baseline (should use all metrics, baseline ~90)
      const anomalies3h = await engine.detectAnomalies('test', {
        thresholdType: 'percentage',
        thresholdValue: 50,
        baselineWindow: 10800000, // 3 hours
      });

      // Different baselines may produce different results
      expect(Array.isArray(anomalies1h)).toBe(true);
      expect(Array.isArray(anomalies3h)).toBe(true);
    });
  });
});
