/**
 * Self-Improvement Prioritizer
 * 
 * Prioritizes self-improvement opportunities alongside other work.
 * Balances self-improvement with project work based on ROI and urgency.
 * 
 * Task 37.3: Implement self-improvement prioritization
 */

import type { Improvement } from '../types';
import type { Task as BaseTask, PriorityScore, PriorityScorer } from '../decision/priority-scorer';

// Extended Task type with effort hours
export type Task = BaseTask & {
  effortHours: number;
};

export interface SelfImprovementPrioritizationConfig {
  /** Maximum percentage of work that can be self-improvement (0-1) */
  maxSelfImprovementRatio: number;
  /** Minimum ROI threshold for self-improvements */
  minROI: number;
  /** Boost factor for high-impact self-improvements (1.0 = no boost) */
  highImpactBoost: number;
}

export interface PrioritizedWork {
  /** All tasks including self-improvements */
  allTasks: Task[];
  /** Prioritized scores (for backward compatibility) */
  scores: Array<{ taskId: string; totalScore: number; breakdown: PriorityScore['breakdown']; reasoning: string }>;
  /** Prioritized tasks with scores */
  scoredTasks: Array<Task & { score: PriorityScore }>;
  /** Self-improvement tasks */
  selfImprovements: Task[];
  /** Project work tasks */
  projectWork: Task[];
  /** Self-improvement ratio (0-1) */
  selfImprovementRatio: number;
  /** ROI metrics */
  roiMetrics: {
    totalROI: number;
    averageROI: number;
    highROICount: number;
  };
}

export interface SelfImprovementROI {
  improvementId: string;
  estimatedBenefit: number; // 0-100
  estimatedCost: number; // hours
  roi: number; // benefit / cost
  reasoning: string;
}

export class SelfImprovementPrioritizer {
  private config: SelfImprovementPrioritizationConfig;
  private priorityScorer: PriorityScorer;
  private roiHistory: Map<string, SelfImprovementROI> = new Map();

  constructor(
    priorityScorer: PriorityScorer,
    config?: Partial<SelfImprovementPrioritizationConfig>
  ) {
    this.config = {
      maxSelfImprovementRatio: config?.maxSelfImprovementRatio ?? 0.2, // 20% max
      minROI: config?.minROI ?? 2.0, // 2:1 benefit:cost ratio
      highImpactBoost: config?.highImpactBoost ?? 1.5,
    };

    this.priorityScorer = priorityScorer;
  }

  /**
   * Prioritize self-improvements alongside project work
   * 
   * @param improvements - Self-improvement opportunities
   * @param projectTasks - Project work tasks
   * @returns Prioritized work with balanced self-improvement
   */
  prioritize(improvements: Improvement[], projectTasks: Task[]): PrioritizedWork {
    // Convert improvements to tasks
    const allSelfImprovementTasks = this.convertImprovementsToTasks(improvements);

    // Calculate ROI for each self-improvement
    const roiMap = new Map<string, SelfImprovementROI>();
    for (const task of allSelfImprovementTasks) {
      const roi = this.calculateROI(task, improvements);
      roiMap.set(task.id, roi);
      this.roiHistory.set(task.id, roi);
    }

    // Filter self-improvements by minimum ROI
    const viableSelfImprovements = allSelfImprovementTasks.filter((task) => {
      const roi = roiMap.get(task.id);
      return roi && roi.roi >= this.config.minROI;
    });

    // Calculate initial ratio
    const totalProjectEffort = projectTasks.reduce((sum, task) => sum + task.effortHours, 0);
    const totalSelfImprovementEffort = viableSelfImprovements.reduce(
      (sum, task) => sum + task.effortHours,
      0
    );
    const totalEffort = totalProjectEffort + totalSelfImprovementEffort;
    const initialRatio = totalEffort > 0 ? totalSelfImprovementEffort / totalEffort : 0;

    // If ratio exceeds max, select only top self-improvements by ROI
    let selectedSelfImprovements = viableSelfImprovements;
    if (initialRatio > this.config.maxSelfImprovementRatio && totalProjectEffort > 0) {
      // Sort by ROI (highest first)
      const sortedByROI = [...viableSelfImprovements].sort((a, b) => {
        const roiA = roiMap.get(a.id)?.roi ?? 0;
        const roiB = roiMap.get(b.id)?.roi ?? 0;
        return roiB - roiA;
      });

      // Always include at least the top self-improvement if it has very high ROI (>= 10)
      const topImprovement = sortedByROI[0];
      const topROI = topImprovement ? (roiMap.get(topImprovement.id)?.roi ?? 0) : 0;
      if (topROI >= 10.0 && topImprovement) {
        // Include top improvement regardless of ratio
        selectedSelfImprovements = [topImprovement];
        
        // Try to add more if they fit within an expanded ratio
        const effectiveMaxRatio = Math.min(0.4, this.config.maxSelfImprovementRatio * 2);
        const maxSelfImprovementEffort =
          (totalProjectEffort * effectiveMaxRatio) / (1 - effectiveMaxRatio);
        
        let currentEffort = topImprovement.effortHours;
        for (let i = 1; i < sortedByROI.length; i++) {
          const task = sortedByROI[i];
          if (task && currentEffort + task.effortHours <= maxSelfImprovementEffort) {
            selectedSelfImprovements.push(task);
            currentEffort += task.effortHours;
          }
        }
      } else {
        // Normal ratio balancing
        const maxSelfImprovementEffort =
          (totalProjectEffort * this.config.maxSelfImprovementRatio) /
          (1 - this.config.maxSelfImprovementRatio);

        selectedSelfImprovements = [];
        let currentEffort = 0;
        for (const task of sortedByROI) {
          if (currentEffort + task.effortHours <= maxSelfImprovementEffort) {
            selectedSelfImprovements.push(task);
            currentEffort += task.effortHours;
          }
        }
      }
    }

    // Apply high-impact boost to selected self-improvements
    const boostedSelfImprovements = selectedSelfImprovements.map((task) => {
      const roi = roiMap.get(task.id)!;
      if (roi.estimatedBenefit >= 80) {
        // High impact - boost priority
        return {
          ...task,
          context: {
            ...(task.context || {}),
            boosted: true,
            originalImpact: roi.estimatedBenefit,
            boostedImpact: roi.estimatedBenefit * this.config.highImpactBoost,
          },
        };
      }
      return task;
    });

    // Combine all tasks
    const allTasks = [...boostedSelfImprovements, ...projectTasks];

    // Score all tasks using heuristic scoring (sync)
    const scoredTasks = allTasks.map((task) => {
      const score = this.heuristicScoreTask(task, roiMap);
      return { ...task, score };
    });

    // Boost scores for high-ROI self-improvements to make them competitive
    const boostedScoredTasks = scoredTasks.map((scoredTask) => {
      const task = scoredTask;
      if (task.type === 'self-improvement') {
        const roi = roiMap.get(task.id);
        if (roi && roi.roi >= 10.0) {
          // Very high ROI - strong boost
          return {
            ...scoredTask,
            score: {
              ...scoredTask.score,
              total: Math.round(scoredTask.score.total * 1.5),
            },
          };
        } else if (roi && roi.roi >= 5.0) {
          // High ROI - moderate boost
          return {
            ...scoredTask,
            score: {
              ...scoredTask.score,
              total: Math.round(scoredTask.score.total * 1.3),
            },
          };
        }
      }
      return scoredTask;
    });

    // Re-sort after boosting
    boostedScoredTasks.sort((a, b) => b.score.total - a.score.total);

    // Calculate final self-improvement ratio
    const finalTotalEffort = allTasks.reduce((sum, task) => sum + task.effortHours, 0);
    const finalSelfImprovementEffort = boostedSelfImprovements.reduce(
      (sum, task) => sum + task.effortHours,
      0
    );
    const selfImprovementRatio =
      finalTotalEffort > 0 ? finalSelfImprovementEffort / finalTotalEffort : 0;

    // Calculate ROI metrics
    const roiMetrics = this.calculateROIMetrics(roiMap);

    // Convert scoredTasks to scores array for backward compatibility
    const scores = boostedScoredTasks.map((st) => ({
      taskId: st.id,
      totalScore: st.score.total,
      breakdown: st.score.breakdown,
      reasoning: st.score.reasoning,
    }));

    return {
      allTasks,
      scores,
      scoredTasks: boostedScoredTasks,
      selfImprovements: boostedSelfImprovements,
      projectWork: projectTasks,
      selfImprovementRatio,
      roiMetrics,
    };
  }

  /**
   * Heuristic scoring for tasks (synchronous)
   * 
   * Used instead of LLM-based scoring for performance.
   */
  private heuristicScoreTask(
    task: Task,
    roiMap: Map<string, SelfImprovementROI>
  ): PriorityScore {
    const breakdown = {
      impact: 50,
      urgency: 50,
      effort: 50,
      alignment: 50,
    };

    // Adjust based on task type
    if (task.type === 'self-improvement') {
      const roi = roiMap.get(task.id);
      if (roi) {
        // Impact based on estimated benefit
        breakdown.impact = Math.min(100, roi.estimatedBenefit);
        
        // Urgency based on ROI (higher ROI = more urgent)
        breakdown.urgency = Math.min(100, roi.roi * 10);
        
        // Effort based on cost (inverted - lower cost = higher score)
        breakdown.effort = Math.max(0, 100 - roi.estimatedCost * 10);
        
        // Alignment - self-improvements always align with quality goals
        breakdown.alignment = 70;
      }
    } else {
      // Project work - use defaults or metadata
      breakdown.impact = 60;
      breakdown.urgency = 50;
      breakdown.effort = 50;
      breakdown.alignment = 70;
    }

    // Calculate weighted total
    const weights = this.priorityScorer.getWeights();
    const total =
      breakdown.impact * weights.impact +
      breakdown.urgency * weights.urgency +
      (100 - breakdown.effort) * weights.effort + // Invert effort
      breakdown.alignment * weights.alignment;

    return {
      total: Math.round(total * 100) / 100,
      breakdown,
      reasoning: `Heuristic score for ${task.type}`,
    };
  }

  /**
   * Convert improvements to tasks
   */
  private convertImprovementsToTasks(improvements: Improvement[]): Task[] {
    return improvements.map((improvement) => {
      // More realistic effort estimation based on improvement type and priority
      let effortHours: number;
      
      if (improvement.priority === 'high') {
        // High priority improvements are usually more complex
        effortHours = improvement.estimatedImpact >= 80 ? 8 : 5;
      } else if (improvement.priority === 'medium') {
        effortHours = improvement.estimatedImpact >= 60 ? 4 : 2;
      } else {
        // Low priority
        effortHours = 1;
      }

      return {
        id: `self-improvement-${improvement.type}-${improvement.location}`,
        description: improvement.description,
        type: 'self-improvement' as const,
        effortHours,
        metadata: {
          improvementType: improvement.type,
          priority: improvement.priority,
          suggestion: improvement.suggestion,
          location: improvement.location,
          estimatedImpact: improvement.estimatedImpact,
        },
      };
    });
  }

  /**
   * Calculate ROI for a self-improvement task
   */
  private calculateROI(task: Task, improvements: Improvement[]): SelfImprovementROI {
    const improvement = improvements.find(
      (i) =>
        `self-improvement-${i.type}-${i.location}` === task.id
    );

    if (!improvement) {
      return {
        improvementId: task.id,
        estimatedBenefit: 0,
        estimatedCost: task.effortHours,
        roi: 0,
        reasoning: 'Improvement not found',
      };
    }

    // Estimate benefit based on impact and type
    let estimatedBenefit = improvement.estimatedImpact;

    // Boost benefit for certain types
    if (improvement.type === 'quality') {
      estimatedBenefit *= 1.2; // Quality improvements have compounding benefits
    } else if (improvement.type === 'debt') {
      estimatedBenefit *= 1.1; // Debt reduction prevents future issues
    }

    // Calculate ROI - use actual effort hours from task
    const cost = task.effortHours > 0 ? task.effortHours : 1; // Avoid division by zero
    const roi = estimatedBenefit / cost;

    // Generate reasoning
    const reasoning = this.generateROIReasoning(improvement, estimatedBenefit, cost, roi);

    return {
      improvementId: task.id,
      estimatedBenefit,
      estimatedCost: cost,
      roi,
      reasoning,
    };
  }

  /**
   * Generate ROI reasoning
   */
  private generateROIReasoning(
    improvement: Improvement,
    benefit: number,
    cost: number,
    roi: number
  ): string {
    const reasons: string[] = [];

    if (roi >= 10) {
      reasons.push('Exceptional ROI');
    } else if (roi >= 5) {
      reasons.push('High ROI');
    } else if (roi >= 2) {
      reasons.push('Good ROI');
    } else {
      reasons.push('Low ROI');
    }

    if (benefit >= 80) {
      reasons.push('high impact on system quality');
    } else if (benefit >= 60) {
      reasons.push('moderate impact');
    }

    if (cost <= 2) {
      reasons.push('quick win');
    } else if (cost <= 8) {
      reasons.push('reasonable effort');
    } else {
      reasons.push('significant investment');
    }

    if (improvement.type === 'quality') {
      reasons.push('improves maintainability');
    } else if (improvement.type === 'debt') {
      reasons.push('reduces technical debt');
    }

    return reasons.join(', ');
  }

  /**
   * Calculate ROI metrics
   */
  private calculateROIMetrics(roiMap: Map<string, SelfImprovementROI>): {
    totalROI: number;
    averageROI: number;
    highROICount: number;
  } {
    const rois = Array.from(roiMap.values());

    if (rois.length === 0) {
      return {
        totalROI: 0,
        averageROI: 0,
        highROICount: 0,
      };
    }

    const totalROI = rois.reduce((sum, r) => sum + r.roi, 0);
    const averageROI = totalROI / rois.length;
    const highROICount = rois.filter((r) => r.roi >= 5).length;

    return {
      totalROI,
      averageROI,
      highROICount,
    };
  }

  /**
   * Get ROI for a specific improvement
   */
  getROI(improvementId: string): SelfImprovementROI | undefined {
    return this.roiHistory.get(improvementId);
  }

  /**
   * Get all ROI history
   */
  getROIHistory(): SelfImprovementROI[] {
    return Array.from(this.roiHistory.values());
  }

  /**
   * Track actual outcome of a self-improvement
   * 
   * This allows learning from actual vs. estimated ROI.
   */
  trackOutcome(
    improvementId: string,
    actualBenefit: number,
    actualCost: number
  ): void {
    const estimated = this.roiHistory.get(improvementId);
    if (!estimated) return;

    const actualROI = actualCost > 0 ? actualBenefit / actualCost : 0;

    // Store outcome for learning
    this.roiHistory.set(`${improvementId}-outcome`, {
      improvementId: `${improvementId}-outcome`,
      estimatedBenefit: actualBenefit,
      estimatedCost: actualCost,
      roi: actualROI,
      reasoning: `Actual outcome: ${actualROI.toFixed(2)} ROI (estimated: ${estimated.roi.toFixed(2)})`,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelfImprovementPrioritizationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Create a self-improvement prioritizer instance
 */
export function createSelfImprovementPrioritizer(
  config?: Partial<SelfImprovementPrioritizationConfig>,
  priorityScorer?: PriorityScorer
): SelfImprovementPrioritizer {
  return new SelfImprovementPrioritizer(priorityScorer!, config);
}
