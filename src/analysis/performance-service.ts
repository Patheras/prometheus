/**
 * Performance Analysis Service
 * 
 * Integrates performance analysis with Memory and Runtime engines.
 * Uses Memory Engine to retrieve metrics and Runtime Engine for LLM recommendations.
 * Stores analysis results back in Memory Engine.
 * 
 * Task 31.2: Wire performance analysis
 */

import { MemoryEngine } from '../memory/engine';
import { RuntimeExecutor } from '../runtime/runtime-executor';
import { PerformanceAnalyzer } from './performance-analyzer';
import { OptimizationRecommender } from './optimization-recommender';
import { PerformanceBottleneck, PerformanceAnomaly } from './types';
import { TaskType } from '../runtime/types';

/**
 * Performance service configuration
 */
export type PerformanceServiceConfig = {
  /** Memory engine instance */
  memoryEngine: MemoryEngine;
  /** Runtime executor instance */
  runtimeExecutor: RuntimeExecutor;
  /** Enable LLM-based recommendations */
  enableLLMRecommendations?: boolean;
};

/**
 * Performance Analysis Service
 * 
 * Orchestrates performance analysis using Memory and Runtime engines.
 */
export class PerformanceService {
  private memoryEngine: MemoryEngine;
  private runtimeExecutor: RuntimeExecutor;
  private analyzer: PerformanceAnalyzer;
  private recommender: OptimizationRecommender;
  private enableLLMRecommendations: boolean;

  constructor(config: PerformanceServiceConfig) {
    this.memoryEngine = config.memoryEngine;
    this.runtimeExecutor = config.runtimeExecutor;
    this.analyzer = new PerformanceAnalyzer();
    this.recommender = new OptimizationRecommender(config.runtimeExecutor);
    this.enableLLMRecommendations = config.enableLLMRecommendations ?? true;
  }

  /**
   * Analyze performance metrics for a specific metric type
   * 
   * @param metricType - Type of metric to analyze (e.g., 'latency', 'throughput')
   * @param timeRange - Time range for analysis
   * @returns Analysis results with bottlenecks and anomalies
   */
  async analyzeMetrics(
    metricType: string,
    timeRange?: { startTime: number; endTime: number }
  ): Promise<{
    bottlenecks: PerformanceBottleneck[];
    anomalies: PerformanceAnomaly[];
    recommendations: string[];
  }> {
    // Retrieve metrics from Memory Engine
    const metrics = await this.memoryEngine.queryMetrics({
      metric_type: metricType,
      start_time: timeRange?.startTime,
      end_time: timeRange?.endTime,
    });

    // Identify bottlenecks
    const bottlenecks = this.analyzer.identifyBottlenecks(metrics.metrics);

    // Detect anomalies
    const anomalies = this.analyzer.detectAnomalies(metrics.metrics);

    // Generate recommendations
    let recommendations: string[] = [];
    if (this.enableLLMRecommendations && bottlenecks.length > 0) {
      recommendations = await this.recommender.generateRecommendations(
        bottlenecks,
        []
      );
    }

    // Store analysis results
    await this.storeAnalysisResults(metricType, {
      bottlenecks,
      anomalies,
      recommendations,
      analyzedAt: Date.now(),
    });

    return {
      bottlenecks,
      anomalies,
      recommendations,
    };
  }

  /**
   * Store analysis results in Memory Engine
   * 
   * @param metricType - Type of metric analyzed
   * @param results - Analysis results
   */
  private async storeAnalysisResults(
    metricType: string,
    results: {
      bottlenecks: PerformanceBottleneck[];
      anomalies: PerformanceAnomaly[];
      recommendations: string[];
      analyzedAt: number;
    }
  ): Promise<void> {
    const db = this.memoryEngine.getDatabase().getDb();

    // Create table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS performance_analysis_results (
        id TEXT PRIMARY KEY,
        metric_type TEXT NOT NULL,
        bottleneck_count INTEGER NOT NULL,
        anomaly_count INTEGER NOT NULL,
        recommendation_count INTEGER NOT NULL,
        analyzed_at INTEGER NOT NULL,
        result_json TEXT NOT NULL
      )
    `);

    // Store result
    const id = `${metricType}-${results.analyzedAt}`;
    db.prepare(`
      INSERT OR REPLACE INTO performance_analysis_results
      (id, metric_type, bottleneck_count, anomaly_count, recommendation_count, analyzed_at, result_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      metricType,
      results.bottlenecks.length,
      results.anomalies.length,
      results.recommendations.length,
      results.analyzedAt,
      JSON.stringify(results)
    );
  }

  /**
   * Get analysis history for a metric type
   * 
   * @param metricType - Type of metric
   * @param limit - Maximum number of results
   * @returns Array of analysis results
   */
  async getAnalysisHistory(
    metricType: string,
    limit: number = 10
  ): Promise<Array<{
    bottlenecks: PerformanceBottleneck[];
    anomalies: PerformanceAnomaly[];
    recommendations: string[];
    analyzedAt: number;
  }>> {
    const db = this.memoryEngine.getDatabase().getDb();

    const rows = db.prepare(`
      SELECT result_json
      FROM performance_analysis_results
      WHERE metric_type = ?
      ORDER BY analyzed_at DESC
      LIMIT ?
    `).all(metricType, limit) as Array<{ result_json: string }>;

    return rows.map((row) => JSON.parse(row.result_json));
  }
}

/**
 * Create a performance service instance
 * 
 * @param config - Service configuration
 * @returns Performance service instance
 */
export function createPerformanceService(config: PerformanceServiceConfig): PerformanceService {
  return new PerformanceService(config);
}
