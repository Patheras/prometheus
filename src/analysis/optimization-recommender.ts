/**
 * Optimization Recommender
 * 
 * Uses LLM to generate specific optimization recommendations
 * based on performance bottlenecks and anomalies.
 * 
 * Task 28.3: Generate optimization recommendations
 */

import { PerformanceBottleneck, PerformanceAnomaly } from './types';
import { RuntimeEngine } from '../runtime';

/**
 * Optimization recommendation
 */
export type OptimizationRecommendation = {
  /** Unique identifier */
  id: string;
  /** Target (endpoint, operation, etc.) */
  target: string;
  /** Issue description */
  issue: string;
  /** Recommended action */
  recommendation: string;
  /** Expected impact */
  expectedImpact: string;
  /** Estimated effort (hours) */
  estimatedEffort: number;
  /** Priority (1-5) */
  priority: number;
  /** Related code changes (if any) */
  relatedChanges?: string[];
  /** Generated timestamp */
  generatedAt: number;
};

/**
 * Optimization context for LLM
 */
type OptimizationContext = {
  bottlenecks: PerformanceBottleneck[];
  anomalies: PerformanceAnomaly[];
  recentChanges?: string[];
  codeContext?: string;
};

/**
 * Optimization Recommender
 * 
 * Generates actionable optimization recommendations using LLM analysis.
 */
export class OptimizationRecommender {
  constructor(private runtimeEngine: RuntimeEngine) {}

  /**
   * Generate optimization recommendations
   * 
   * @param context - Performance analysis context
   * @returns Array of optimization recommendations
   */
  async generateRecommendations(
    context: OptimizationContext
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Generate recommendations for each bottleneck
    for (const bottleneck of context.bottlenecks) {
      const recommendation = await this.recommendForBottleneck(bottleneck, context);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Generate recommendations for anomalies
    for (const anomaly of context.anomalies) {
      const recommendation = await this.recommendForAnomaly(anomaly, context);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by priority
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate recommendation for a bottleneck
   */
  private async recommendForBottleneck(
    bottleneck: PerformanceBottleneck,
    context: OptimizationContext
  ): Promise<OptimizationRecommendation | null> {
    try {
      const prompt = this.buildBottleneckPrompt(bottleneck, context);

      const response = await this.runtimeEngine.execute({
        taskType: 'metric_analysis',
        prompt,
        systemPrompt: 'You are a performance optimization expert. Provide specific, actionable recommendations.',
        maxTokens: 300,
      });

      return this.parseRecommendation(response.content, bottleneck.operation, 'bottleneck');
    } catch (error) {
      // Fallback to heuristic recommendation
      return this.heuristicBottleneckRecommendation(bottleneck);
    }
  }

  /**
   * Generate recommendation for an anomaly
   */
  private async recommendForAnomaly(
    anomaly: PerformanceAnomaly,
    context: OptimizationContext
  ): Promise<OptimizationRecommendation | null> {
    try {
      const prompt = this.buildAnomalyPrompt(anomaly, context);

      const response = await this.runtimeEngine.execute({
        taskType: 'metric_analysis',
        prompt,
        systemPrompt: 'You are a performance optimization expert. Analyze anomalies and suggest fixes.',
        maxTokens: 300,
      });

      return this.parseRecommendation(response.content, anomaly.metricName, 'anomaly');
    } catch (error) {
      // Fallback to heuristic recommendation
      return this.heuristicAnomalyRecommendation(anomaly);
    }
  }

  /**
   * Build prompt for bottleneck analysis
   */
  private buildBottleneckPrompt(
    bottleneck: PerformanceBottleneck,
    context: OptimizationContext
  ): string {
    let prompt = `Analyze this performance bottleneck and provide optimization recommendations:\n\n`;
    prompt += `Endpoint: ${bottleneck.operation}\n`;
    prompt += `Metric: ${bottleneck.metricType}\n`;
    prompt += `Current Value: ${bottleneck.currentValue.toFixed(0)}ms\n`;
    prompt += `Baseline: ${bottleneck.baselineValue.toFixed(0)}ms\n`;
    prompt += `Severity: ${bottleneck.severity}\n`;
    prompt += `Affected Users: ${bottleneck.affectedUsers || 'unknown'}\n`;

    if (context.recentChanges && context.recentChanges.length > 0) {
      prompt += `\nRecent Changes:\n`;
      context.recentChanges.slice(0, 3).forEach((change) => {
        prompt += `- ${change}\n`;
      });
    }

    prompt += `\nProvide:\n`;
    prompt += `1. Root cause analysis\n`;
    prompt += `2. Specific optimization recommendation\n`;
    prompt += `3. Expected impact (e.g., "reduce latency by 50%")\n`;
    prompt += `4. Estimated effort in hours\n`;
    prompt += `5. Priority (1-5, where 5 is highest)\n`;

    return prompt;
  }

  /**
   * Build prompt for anomaly analysis
   */
  private buildAnomalyPrompt(
    anomaly: PerformanceAnomaly,
    context: OptimizationContext
  ): string {
    let prompt = `Analyze this performance anomaly and suggest investigation steps:\n\n`;
    prompt += `Metric: ${anomaly.metricName}\n`;
    prompt += `Anomalous Value: ${anomaly.value.toFixed(2)}\n`;
    prompt += `Expected (Mean): ${anomaly.mean.toFixed(2)}\n`;
    prompt += `Standard Deviation: ${anomaly.stdDev.toFixed(2)}\n`;
    prompt += `Z-Score: ${anomaly.zScore.toFixed(2)}\n`;
    prompt += `Severity: ${anomaly.severity}\n`;

    prompt += `\nProvide:\n`;
    prompt += `1. Possible causes for this anomaly\n`;
    prompt += `2. Investigation steps\n`;
    prompt += `3. Recommended actions\n`;
    prompt += `4. Priority (1-5)\n`;

    return prompt;
  }

  /**
   * Parse LLM response into recommendation
   */
  private parseRecommendation(
    response: string,
    target: string,
    type: 'bottleneck' | 'anomaly'
  ): OptimizationRecommendation {
    // Extract priority (look for "Priority: N" or just a number)
    const priorityMatch = response.match(/priority[:\s]+(\d)/i);
    const priority = priorityMatch ? parseInt(priorityMatch[1]) : 3;

    // Extract effort (look for "N hours" or "Effort: N")
    const effortMatch = response.match(/(\d+)\s*hours?|effort[:\s]+(\d+)/i);
    const estimatedEffort = effortMatch ? parseInt(effortMatch[1] || effortMatch[2]) : 4;

    // Extract expected impact
    const impactMatch = response.match(/impact[:\s]+(.+?)(?:\n|$)/i);
    const expectedImpact = impactMatch ? impactMatch[1].trim() : 'Improved performance';

    return {
      id: `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      target,
      issue: `${type === 'bottleneck' ? 'Performance bottleneck' : 'Performance anomaly'} detected`,
      recommendation: response,
      expectedImpact,
      estimatedEffort,
      priority: Math.max(1, Math.min(5, priority)),
      generatedAt: Date.now(),
    };
  }

  /**
   * Heuristic bottleneck recommendation (fallback)
   */
  private heuristicBottleneckRecommendation(
    bottleneck: PerformanceBottleneck
  ): OptimizationRecommendation {
    const recommendations = [
      'Profile the endpoint to identify slow database queries',
      'Check for N+1 query patterns',
      'Add database indexes for frequently queried fields',
      'Implement caching for frequently accessed data',
      'Consider pagination for large result sets',
      'Review recent code changes that may have introduced the issue',
    ];

    return {
      id: `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      target: bottleneck.operation,
      issue: `High latency detected (${bottleneck.currentValue.toFixed(0)}ms)`,
      recommendation: recommendations.join('\n'),
      expectedImpact: 'Reduce latency by 30-50%',
      estimatedEffort: 4,
      priority: bottleneck.severity === 'critical' ? 5 : 3,
      generatedAt: Date.now(),
    };
  }

  /**
   * Heuristic anomaly recommendation (fallback)
   */
  private heuristicAnomalyRecommendation(
    anomaly: PerformanceAnomaly
  ): OptimizationRecommendation {
    return {
      id: `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      target: anomaly.metricName,
      issue: `Anomalous value detected (z-score: ${anomaly.zScore.toFixed(2)})`,
      recommendation: [
        'Investigate the time period when the anomaly occurred',
        'Check for unusual traffic patterns or load spikes',
        'Review application logs for errors or warnings',
        'Correlate with deployment or configuration changes',
        'Monitor for recurring patterns',
      ].join('\n'),
      expectedImpact: 'Prevent future anomalies',
      estimatedEffort: 2,
      priority: anomaly.severity === 'critical' ? 5 : 3,
      generatedAt: Date.now(),
    };
  }

  /**
   * Correlate recommendations with recent code changes
   * 
   * @param recommendations - Array of recommendations
   * @param recentChanges - Array of recent code changes
   * @returns Recommendations with correlated changes
   */
  correlateWithChanges(
    recommendations: OptimizationRecommendation[],
    recentChanges: string[]
  ): OptimizationRecommendation[] {
    return recommendations.map((rec) => {
      // Simple correlation: check if target appears in change descriptions
      const relatedChanges = recentChanges.filter((change) =>
        change.toLowerCase().includes(rec.target.toLowerCase())
      );

      return {
        ...rec,
        relatedChanges: relatedChanges.length > 0 ? relatedChanges : undefined,
      };
    });
  }

  /**
   * Prioritize recommendations by ROI
   * 
   * ROI = Priority / Effort
   * 
   * @param recommendations - Array of recommendations
   * @returns Sorted recommendations (highest ROI first)
   */
  prioritizeByROI(
    recommendations: OptimizationRecommendation[]
  ): OptimizationRecommendation[] {
    return [...recommendations].sort((a, b) => {
      const roiA = a.priority / a.estimatedEffort;
      const roiB = b.priority / b.estimatedEffort;
      return roiB - roiA;
    });
  }

  /**
   * Group recommendations by target
   * 
   * @param recommendations - Array of recommendations
   * @returns Map of target to recommendations
   */
  groupByTarget(
    recommendations: OptimizationRecommendation[]
  ): Map<string, OptimizationRecommendation[]> {
    const grouped = new Map<string, OptimizationRecommendation[]>();

    for (const rec of recommendations) {
      if (!grouped.has(rec.target)) {
        grouped.set(rec.target, []);
      }
      grouped.get(rec.target)!.push(rec);
    }

    return grouped;
  }
}

/**
 * Create an optimization recommender instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @returns Optimization recommender instance
 */
export function createOptimizationRecommender(
  runtimeEngine: RuntimeEngine
): OptimizationRecommender {
  return new OptimizationRecommender(runtimeEngine);
}
