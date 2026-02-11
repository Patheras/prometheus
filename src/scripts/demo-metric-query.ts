/**
 * Demonstration script for Metric Query System (Task 10.2)
 * 
 * This script demonstrates:
 * - Time range filtering
 * - Metric type and name filtering
 * - Aggregation calculations
 * - Combined filtering
 * 
 * Requirements: 3.2
 */

import { initializeDatabase } from '../memory/database';
import { createMemoryEngine } from '../memory/engine';
import { Metric } from '../memory/types';

async function main() {
  console.log('='.repeat(80));
  console.log('Metric Query System Demonstration (Task 10.2)');
  console.log('='.repeat(80));
  console.log();

  // Initialize database
  const db = await initializeDatabase({ path: './data/demo-metric-query.db' });
  const engine = createMemoryEngine(db);

  try {
    // Create sample metrics
    console.log('Creating sample metrics...');
    const now = Date.now();
    const metrics: Metric[] = [];

    // Performance metrics over 10 time periods
    for (let i = 0; i < 10; i++) {
      metrics.push({
        id: `metric_perf_${i}`,
        timestamp: now + i * 1000,
        metric_type: 'performance',
        metric_name: 'response_time',
        value: 100 + Math.random() * 200, // 100-300ms
        context: JSON.stringify({
          endpoint: '/api/users',
          method: 'GET',
        }),
      });

      metrics.push({
        id: `metric_cpu_${i}`,
        timestamp: now + i * 1000,
        metric_type: 'performance',
        metric_name: 'cpu_usage',
        value: 20 + Math.random() * 60, // 20-80%
        context: JSON.stringify({
          server: 'web-1',
        }),
      });
    }

    // User behavior metrics
    for (let i = 0; i < 5; i++) {
      metrics.push({
        id: `metric_views_${i}`,
        timestamp: now + i * 2000,
        metric_type: 'user_behavior',
        metric_name: 'page_views',
        value: Math.floor(Math.random() * 100),
        context: JSON.stringify({
          page: '/dashboard',
        }),
      });
    }

    await engine.storeMetrics(metrics);
    console.log(`Stored ${metrics.length} metrics`);
    console.log();

    // Demonstration 1: Query all metrics
    console.log('1. Query all metrics (no filters)');
    console.log('-'.repeat(80));
    const allMetrics = await engine.queryMetrics({});
    console.log(`Found ${allMetrics.metrics.length} metrics`);
    console.log('Aggregations:', JSON.stringify(allMetrics.aggregations, null, 2));
    console.log();

    // Demonstration 2: Filter by metric type
    console.log('2. Filter by metric type (performance)');
    console.log('-'.repeat(80));
    const perfMetrics = await engine.queryMetrics({
      metric_type: 'performance',
    });
    console.log(`Found ${perfMetrics.metrics.length} performance metrics`);
    console.log('Aggregations:', JSON.stringify(perfMetrics.aggregations, null, 2));
    console.log();

    // Demonstration 3: Filter by metric type and name
    console.log('3. Filter by metric type and name (performance/response_time)');
    console.log('-'.repeat(80));
    const responseTimeMetrics = await engine.queryMetrics({
      metric_type: 'performance',
      metric_name: 'response_time',
    });
    console.log(`Found ${responseTimeMetrics.metrics.length} response_time metrics`);
    console.log('Aggregations:', JSON.stringify(responseTimeMetrics.aggregations, null, 2));
    console.log('Sample metrics:');
    responseTimeMetrics.metrics.slice(0, 3).forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.metric_name}: ${m.value.toFixed(2)}ms at ${new Date(m.timestamp).toISOString()}`);
    });
    console.log();

    // Demonstration 4: Time range filtering
    console.log('4. Filter by time range (first 5 seconds)');
    console.log('-'.repeat(80));
    const timeRangeMetrics = await engine.queryMetrics({
      metric_type: 'performance',
      metric_name: 'response_time',
      start_time: now,
      end_time: now + 5000,
    });
    console.log(`Found ${timeRangeMetrics.metrics.length} metrics in time range`);
    console.log('Aggregations:', JSON.stringify(timeRangeMetrics.aggregations, null, 2));
    console.log();

    // Demonstration 5: Limit results
    console.log('5. Limit results (top 5)');
    console.log('-'.repeat(80));
    const limitedMetrics = await engine.queryMetrics({
      metric_type: 'performance',
      limit: 5,
    });
    console.log(`Found ${limitedMetrics.metrics.length} metrics (limited to 5)`);
    console.log('Metrics:');
    limitedMetrics.metrics.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.metric_name}: ${m.value.toFixed(2)} at ${new Date(m.timestamp).toISOString()}`);
    });
    console.log();

    // Demonstration 6: Percentile analysis
    console.log('6. Percentile analysis for response times');
    console.log('-'.repeat(80));
    const percentileMetrics = await engine.queryMetrics({
      metric_type: 'performance',
      metric_name: 'response_time',
    });
    if (percentileMetrics.aggregations) {
      const agg = percentileMetrics.aggregations;
      console.log('Response Time Analysis:');
      console.log(`  Count: ${agg.count}`);
      console.log(`  Average: ${agg.avg?.toFixed(2) ?? 'N/A'}ms`);
      console.log(`  Min: ${agg.min?.toFixed(2) ?? 'N/A'}ms`);
      console.log(`  Max: ${agg.max?.toFixed(2) ?? 'N/A'}ms`);
      console.log(`  P50 (Median): ${agg.p50?.toFixed(2) ?? 'N/A'}ms`);
      console.log(`  P95: ${agg.p95?.toFixed(2) ?? 'N/A'}ms`);
      console.log(`  P99: ${agg.p99?.toFixed(2) ?? 'N/A'}ms`);
    }
    console.log();

    // Demonstration 7: Compare different metric types
    console.log('7. Compare different metric types');
    console.log('-'.repeat(80));
    const cpuMetrics = await engine.queryMetrics({
      metric_type: 'performance',
      metric_name: 'cpu_usage',
    });
    const userMetrics = await engine.queryMetrics({
      metric_type: 'user_behavior',
    });
    if (cpuMetrics.aggregations) {
      const cpuAgg = cpuMetrics.aggregations;
      console.log('CPU Usage:');
      console.log(`  Average: ${cpuAgg.avg?.toFixed(2) ?? 'N/A'}%`);
      console.log(`  P95: ${cpuAgg.p95?.toFixed(2) ?? 'N/A'}%`);
      console.log();
    }
    if (userMetrics.aggregations) {
      const userAgg = userMetrics.aggregations;
      console.log('User Behavior:');
      console.log(`  Total page views: ${userAgg.sum?.toFixed(0) ?? 'N/A'}`);
      console.log(`  Average per period: ${userAgg.avg?.toFixed(2) ?? 'N/A'}`);
      console.log();
    }

    console.log('='.repeat(80));
    console.log('Demonstration complete!');
    console.log('='.repeat(80));
  } finally {
    // Clean up
    engine.close();
  }
}

// Run the demonstration
main().catch(console.error);
