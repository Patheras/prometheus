/**
 * Priority Scorer
 * 
 * Scores and prioritizes tasks based on impact, urgency, effort, and alignment.
 * 
 * Task 33.1: Create priority scoring logic
 */

import { RuntimeEngine } from '../runtime';

/**
 * Task to be scored
 */
export type Task = {
  id: string;
  description: string;
  type: string;
  context?: Record<string, unknown>;
};

/**
 * Priority score breakdown
 */
export type PriorityScore = {
  total: number; // 0-100
  breakdown: {
    impact: number; // 0-100
    urgency: number; // 0-100
    effort: number; // 0-100 (inverted - lower effort = higher score)
    alignment: number; // 0-100
  };
  reasoning: string;
};

/**
 * Scoring weights configuration
 */
export type ScoringWeights = {
  impact: number;
  urgency: number;
  effort: number;
  alignment: number;
};

/**
 * Default scoring weights
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  impact: 0.4,
  urgency: 0.3,
  effort: 0.2,
  alignment: 0.1,
};

/**
 * Priority Scorer
 * 
 * Scores tasks based on multiple criteria with configurable weights.
 */
export class PriorityScorer {
  private weights: ScoringWeights;

  constructor(
    private runtimeEngine: RuntimeEngine,
    weights?: Partial<ScoringWeights>
  ) {
    this.weights = {
      ...DEFAULT_WEIGHTS,
      ...weights,
    };

    // Normalize weights to sum to 1.0
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (sum !== 1.0) {
      this.weights = {
        impact: this.weights.impact / sum,
        urgency: this.weights.urgency / sum,
        effort: this.weights.effort / sum,
        alignment: this.weights.alignment / sum,
      };
    }
  }

  /**
   * Score a single task
   * 
   * Uses LLM to evaluate impact, urgency, effort, and alignment.
   * 
   * @param task - Task to score
   * @param context - Optional additional context
   * @returns Priority score with breakdown
   */
  async scoreTask(task: Task, context?: string): Promise<PriorityScore> {
    // Build prompt for LLM
    const prompt = this.buildScoringPrompt(task, context);

    try {
      // Use RuntimeEngine to get LLM scoring
      const response = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        systemPrompt: 'You are a task prioritization expert. Score tasks objectively.',
        maxTokens: 300,
      });

      // Parse breakdown from response
      const breakdown = this.parseScoreBreakdown(response.content);

      // Calculate weighted total
      const total = this.calculateWeightedScore(breakdown);

      return {
        total,
        breakdown,
        reasoning: response.content,
      };
    } catch (error) {
      // Fallback to heuristic scoring if LLM fails
      return this.heuristicScore(task);
    }
  }

  /**
   * Score multiple tasks in batch
   * 
   * @param tasks - Array of tasks to score
   * @param context - Optional additional context
   * @returns Array of tasks with scores
   */
  async scoreTasks(
    tasks: Task[],
    context?: string
  ): Promise<Array<Task & { score: PriorityScore }>> {
    const scored: Array<Task & { score: PriorityScore }> = [];

    for (const task of tasks) {
      const score = await this.scoreTask(task, context);
      scored.push({ ...task, score });
    }

    return scored;
  }

  /**
   * Rank tasks by priority
   * 
   * @param tasks - Array of tasks to rank
   * @param context - Optional additional context
   * @returns Sorted array (highest priority first)
   */
  async rankTasks(tasks: Task[], context?: string): Promise<Task[]> {
    const scored = await this.scoreTasks(tasks, context);

    // Sort by total score (descending)
    scored.sort((a, b) => b.score.total - a.score.total);

    // Return tasks without scores
    return scored.map(({ score, ...task }) => task);
  }

  /**
   * Build scoring prompt for LLM
   */
  private buildScoringPrompt(task: Task, context?: string): string {
    let prompt = `Score this task on the following criteria (0-100 for each):\n\n`;
    prompt += `Task: ${task.description}\n`;
    prompt += `Type: ${task.type}\n`;

    if (task.context) {
      prompt += `\nTask Context:\n${JSON.stringify(task.context, null, 2)}\n`;
    }

    if (context) {
      prompt += `\nAdditional Context:\n${context}\n`;
    }

    prompt += `\n**Scoring Criteria:**\n`;
    prompt += `1. **Impact** (0-100): How much value does this task provide? Consider:\n`;
    prompt += `   - User benefit\n`;
    prompt += `   - System improvement\n`;
    prompt += `   - Risk reduction\n`;
    prompt += `   - Technical debt reduction\n\n`;

    prompt += `2. **Urgency** (0-100): How time-sensitive is this task? Consider:\n`;
    prompt += `   - Blocking other work\n`;
    prompt += `   - User pain points\n`;
    prompt += `   - Deadlines\n`;
    prompt += `   - Degrading conditions\n\n`;

    prompt += `3. **Effort** (0-100): How much work is required? Consider:\n`;
    prompt += `   - Development time\n`;
    prompt += `   - Testing requirements\n`;
    prompt += `   - Complexity\n`;
    prompt += `   - Dependencies\n\n`;

    prompt += `4. **Alignment** (0-100): How well does this align with project goals? Consider:\n`;
    prompt += `   - Strategic importance\n`;
    prompt += `   - Roadmap alignment\n`;
    prompt += `   - Stakeholder priorities\n\n`;

    prompt += `Respond in this exact format:\n`;
    prompt += `Impact: [score]\n`;
    prompt += `Urgency: [score]\n`;
    prompt += `Effort: [score]\n`;
    prompt += `Alignment: [score]\n`;
    prompt += `Reasoning: [brief explanation]`;

    return prompt;
  }

  /**
   * Parse score breakdown from LLM response
   */
  private parseScoreBreakdown(response: string): PriorityScore['breakdown'] {
    const breakdown = {
      impact: 50,
      urgency: 50,
      effort: 50,
      alignment: 50,
    };

    // Extract scores using regex
    const impactMatch = response.match(/Impact:\s*(\d+)/i);
    const urgencyMatch = response.match(/Urgency:\s*(\d+)/i);
    const effortMatch = response.match(/Effort:\s*(\d+)/i);
    const alignmentMatch = response.match(/Alignment:\s*(\d+)/i);

    if (impactMatch) breakdown.impact = Math.min(100, Math.max(0, parseInt(impactMatch[1])));
    if (urgencyMatch) breakdown.urgency = Math.min(100, Math.max(0, parseInt(urgencyMatch[1])));
    if (effortMatch) breakdown.effort = Math.min(100, Math.max(0, parseInt(effortMatch[1])));
    if (alignmentMatch)
      breakdown.alignment = Math.min(100, Math.max(0, parseInt(alignmentMatch[1])));

    return breakdown;
  }

  /**
   * Calculate weighted total score
   * 
   * Note: Effort is inverted (lower effort = higher score)
   */
  private calculateWeightedScore(breakdown: PriorityScore['breakdown']): number {
    const score =
      breakdown.impact * this.weights.impact +
      breakdown.urgency * this.weights.urgency +
      (100 - breakdown.effort) * this.weights.effort + // Invert effort
      breakdown.alignment * this.weights.alignment;

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Heuristic scoring (fallback when LLM unavailable)
   */
  private heuristicScore(task: Task): PriorityScore {
    // Simple heuristic based on task type
    const breakdown = {
      impact: 50,
      urgency: 50,
      effort: 50,
      alignment: 50,
    };

    // Adjust based on task type
    switch (task.type) {
      case 'bug_fix':
        breakdown.impact = 70;
        breakdown.urgency = 80;
        breakdown.effort = 40;
        breakdown.alignment = 60;
        break;
      case 'feature':
        breakdown.impact = 60;
        breakdown.urgency = 40;
        breakdown.effort = 70;
        breakdown.alignment = 70;
        break;
      case 'refactoring':
        breakdown.impact = 50;
        breakdown.urgency = 30;
        breakdown.effort = 60;
        breakdown.alignment = 50;
        break;
      case 'optimization':
        breakdown.impact = 60;
        breakdown.urgency = 40;
        breakdown.effort = 50;
        breakdown.alignment = 60;
        break;
      case 'technical_debt':
        breakdown.impact = 40;
        breakdown.urgency = 30;
        breakdown.effort = 50;
        breakdown.alignment = 50;
        break;
    }

    const total = this.calculateWeightedScore(breakdown);

    return {
      total,
      breakdown,
      reasoning: `Heuristic score based on task type: ${task.type}`,
    };
  }

  /**
   * Get current scoring weights
   */
  getWeights(): ScoringWeights {
    return { ...this.weights };
  }

  /**
   * Update scoring weights
   * 
   * Weights will be normalized to sum to 1.0
   */
  setWeights(weights: Partial<ScoringWeights>): void {
    this.weights = {
      ...this.weights,
      ...weights,
    };

    // Normalize
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (sum !== 1.0) {
      this.weights = {
        impact: this.weights.impact / sum,
        urgency: this.weights.urgency / sum,
        effort: this.weights.effort / sum,
        alignment: this.weights.alignment / sum,
      };
    }
  }
}

/**
 * Create a priority scorer instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @param weights - Optional custom scoring weights
 * @returns Priority scorer instance
 */
export function createPriorityScorer(
  runtimeEngine: RuntimeEngine,
  weights?: Partial<ScoringWeights>
): PriorityScorer {
  return new PriorityScorer(runtimeEngine, weights);
}
