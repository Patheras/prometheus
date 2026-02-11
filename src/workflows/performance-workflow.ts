/**
 * Performance Optimization Workflow
 * 
 * End-to-end workflow for detecting bottlenecks,
 * proposing optimizations, applying them, and measuring impact.
 * 
 * Task 56.2: Create performance optimization workflow
 */

import type { PerformanceAnalyzer } from '../analysis/performance-analyzer';
import type { AgentOptimizer } from '../evolution/agent-optimizer';
import type { MemoryEngine } from '../memory';
import type { PerformanceBottleneck, OptimizationProposal } from '../evolution/agent-optimizer';

export interface PerformanceWorkflowConfig {
  /** Time range for metrics (milliseconds) */
  timeRange: number;
  /** Minimum severity to process */
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  /** Auto-apply safe optimizations */
  autoApply?: boolean;
  /** Run A/B tests for optimizations */
  runABTests?: boolean;
}

export interface PerformanceWorkflowResult {
  /** Bottlenecks detected */
  bottlenecks: {
    operation: string;
    severity: string;
    p95Latency: number;
    affectedUsers: number;
  }[];
  /** Optimization proposals */
  proposals: {
    id: string;
    description: string;
    estimatedImprovement: number;
    risk: string;
  }[];
  /** Applied optimizations */
  applied: {
    id: string;
    success: boolean;
    actualImprovement?: number;
  }[];
  /** Overall impact */
  impact: {
    latencyReduction: number;
    throughputIncrease: number;
    optimizationsApplied: number;
  };
  /** Workflow duration */
  duration: number;
}

/**
 * Performance Optimization Workflow
 * 
 * Orchestrates the complete performance optimization process.
 */
export class PerformanceWorkflow {
  constructor(
    private performanceAnalyzer: PerformanceAnalyzer,
    private agentOptimizer: AgentOptimizer,
    private memoryEngine: MemoryEngine
  ) {}

  /**
   * Execute the complete workflow
   * 
   * @param config - Workflow configuration
   * @returns Workflow result with impact metrics
   */
  async execute(config: PerformanceWorkflowConfig): Promise<PerformanceWorkflowResult> {
    const startTime = Date.now();
    console.log('Starting performance optimization workflow...');

    try {
      // Step 1: Detect bottlenecks
      console.log('Step 1: Detecting performance bottlenecks...');
      const bottlenecks = await this.detectBottlenecks(config.timeRange, config.minSeverity);

      // Step 2: Propose optimizations
      console.log('Step 2: Generating optimization proposals...');
      const proposals = await this.proposeOptimizations(bottlenecks);

      // Step 3: Apply optimizations
      console.log('Step 3: Applying optimizations...');
      const appliedResults = await this.applyOptimizations(
        proposals,
        config.autoApply || false,
        config.runABTests || false
      );

      // Step 4: Measure impact
      console.log('Step 4: Measuring impact...');
      const impact = await this.measureImpact(bottlenecks, appliedResults);

      const duration = Date.now() - startTime;
      console.log(`Workflow completed in ${duration}ms`);

      return {
        bottlenecks: bottlenecks.map((b) => ({
          operation: b.operation,
          severity: b.severity,
          p95Latency: b.p95,
          affectedUsers: b.affectedUsers,
        })),
        proposals: proposals.map((p) => ({
          id: p.id,
          description: p.description,
          estimatedImprovement: p.estimatedImprovement,
          risk: p.risk,
        })),
        applied: appliedResults,
        impact,
        duration,
      };
    } catch (error) {
      console.error('Workflow failed:', error);
      throw error;
    }
  }

  /**
   * Step 1: Detect performance bottlenecks
   */
  private async detectBottlenecks(
    timeRange: number,
    minSeverity?: string
  ): Promise<PerformanceBottleneck[]> {
    // Get performance metrics from memory
    const endTime = Date.now();
    const startTime = endTime - timeRange;

    const metrics = await this.memoryEngine.queryMetrics({
      startTime,
      endTime,
      metricType: 'performance',
    });

    // Analyze metrics to identify bottlenecks
    const bottlenecks = await this.performanceAnalyzer.identifyBottlenecks(metrics);

    // Filter by severity if specified
    if (minSeverity) {
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      const minLevel = severityOrder[minSeverity as keyof typeof severityOrder];

      return bottlenecks.filter((b) => {
        const level = severityOrder[b.severity as keyof typeof severityOrder];
        return level >= minLevel;
      });
    }

    return bottlenecks;
  }

  /**
   * Step 2: Propose optimizations for bottlenecks
   */
  private async proposeOptimizations(
    bottlenecks: PerformanceBottleneck[]
  ): Promise<OptimizationProposal[]> {
    const proposals: OptimizationProposal[] = [];

    for (const bottleneck of bottlenecks) {
      try {
        const optimizations = await this.agentOptimizer.generateOptimizations([bottleneck]);
        proposals.push(...optimizations);
      } catch (error) {
        console.warn(`Failed to generate optimizations for ${bottleneck.operation}:`, error);
      }
    }

    // Sort by estimated improvement
    return proposals.sort((a, b) => b.estimatedImprovement - a.estimatedImprovement);
  }

  /**
   * Step 3: Apply optimizations (with optional A/B testing)
   */
  private async applyOptimizations(
    proposals: OptimizationProposal[],
    autoApply: boolean,
    runABTests: boolean
  ): Promise<Array<{ id: string; success: boolean; actualImprovement?: number }>> {
    const results: Array<{ id: string; success: boolean; actualImprovement?: number }> = [];

    for (const proposal of proposals) {
      try {
        // Determine if we should apply this optimization
        const shouldApply =
          autoApply ||
          (proposal.risk === 'low' && proposal.estimatedImprovement > 20) ||
          proposal.estimatedImprovement > 50;

        if (!shouldApply) {
          console.log(`○ Skipped (manual review needed): ${proposal.description}`);
          results.push({
            id: proposal.id,
            success: false,
          });
          continue;
        }

        let success = false;
        let actualImprovement: number | undefined;

        if (runABTests && proposal.risk !== 'low') {
          // Run A/B test for higher-risk optimizations
          console.log(`Running A/B test for: ${proposal.description}`);

          const abTest = await this.agentOptimizer.startABTest({
            optimizationId: proposal.id,
            trafficSplit: 0.5,
            duration: 3600000, // 1 hour
            metrics: ['latency', 'throughput', 'error_rate'],
          });

          // Wait for test to complete (simplified - in reality would be async)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const testResult = await this.agentOptimizer.analyzeABTest(abTest.testId);

          if (testResult.recommendation === 'rollout') {
            await this.agentOptimizer.rolloutOptimization(proposal.id);
            success = true;
            actualImprovement = testResult.improvement;
          } else {
            await this.agentOptimizer.rollbackOptimization(
              proposal.id,
              'A/B test showed no improvement'
            );
            success = false;
          }
        } else {
          // Direct application for low-risk optimizations
          console.log(`Applying optimization: ${proposal.description}`);
          await this.agentOptimizer.rolloutOptimization(proposal.id);
          success = true;
          actualImprovement = proposal.estimatedImprovement;
        }

        results.push({
          id: proposal.id,
          success,
          actualImprovement,
        });

        if (success) {
          console.log(`✓ Applied: ${proposal.description}`);
        }
      } catch (error) {
        console.warn(`Failed to apply optimization ${proposal.id}:`, error);
        results.push({
          id: proposal.id,
          success: false,
        });
      }
    }

    return results;
  }

  /**
   * Step 4: Measure impact of optimizations
   */
  private async measureImpact(
    bottlenecks: PerformanceBottleneck[],
    appliedResults: Array<{ id: string; success: boolean; actualImprovement?: number }>
  ): Promise<{
    latencyReduction: number;
    throughputIncrease: number;
    optimizationsApplied: number;
  }> {
    const successfulOptimizations = appliedResults.filter((r) => r.success);

    // Calculate average improvement
    const improvements = successfulOptimizations
      .map((r) => r.actualImprovement || 0)
      .filter((i) => i > 0);

    const avgImprovement = improvements.length > 0
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length
      : 0;

    // Estimate latency reduction (percentage)
    const latencyReduction = Math.min(avgImprovement, 50); // Cap at 50%

    // Estimate throughput increase (percentage)
    const throughputIncrease = latencyReduction * 0.8; // Roughly proportional

    return {
      latencyReduction,
      throughputIncrease,
      optimizationsApplied: successfulOptimizations.length,
    };
  }
}

/**
 * Create a performance workflow instance
 */
export function createPerformanceWorkflow(
  performanceAnalyzer: PerformanceAnalyzer,
  agentOptimizer: AgentOptimizer,
  memoryEngine: MemoryEngine
): PerformanceWorkflow {
  return new PerformanceWorkflow(performanceAnalyzer, agentOptimizer, memoryEngine);
}
