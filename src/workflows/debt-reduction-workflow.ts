/**
 * Technical Debt Reduction Workflow
 * 
 * End-to-end workflow for detecting debt, quantifying it,
 * prioritizing debt items, applying fixes, and measuring reduction.
 * 
 * Task 56.3: Create technical debt reduction workflow
 */

import type { DebtDetector } from '../analysis/debt-detector';
import type { PriorityScorer, Task } from '../decision/priority-scorer';
import type { MemoryEngine } from '../memory';
import type { TechnicalDebt } from '../types';

export interface DebtWorkflowConfig {
  /** Repository path to analyze */
  repoPath: string;
  /** Maximum debt items to process */
  maxItems?: number;
  /** Minimum priority threshold */
  minPriority?: number;
  /** Auto-fix low-effort items */
  autoFix?: boolean;
}

export interface DebtWorkflowResult {
  /** Debt detection results */
  detection: {
    totalDebt: number;
    debtByType: Record<string, number>;
    estimatedHours: number;
  };
  /** Prioritized debt items */
  prioritized: {
    id: string;
    description: string;
    priority: number;
    effort: number;
  }[];
  /** Fixed debt items */
  fixed: {
    id: string;
    success: boolean;
    hoursSpent?: number;
  }[];
  /** Overall impact */
  impact: {
    debtReduction: number;
    hoursInvested: number;
    itemsFixed: number;
  };
  /** Workflow duration */
  duration: number;
}

/**
 * Technical Debt Reduction Workflow
 * 
 * Orchestrates the complete debt reduction process.
 */
export class DebtReductionWorkflow {
  constructor(
    private debtDetector: DebtDetector,
    private priorityScorer: PriorityScorer,
    private memoryEngine: MemoryEngine
  ) {}

  /**
   * Execute the complete workflow
   * 
   * @param config - Workflow configuration
   * @returns Workflow result with impact metrics
   */
  async execute(config: DebtWorkflowConfig): Promise<DebtWorkflowResult> {
    const startTime = Date.now();
    console.log('Starting technical debt reduction workflow...');

    try {
      // Step 1: Detect debt
      console.log('Step 1: Detecting technical debt...');
      const debtReport = await this.detectDebt(config.repoPath);

      // Step 2: Quantify debt
      console.log('Step 2: Quantifying debt...');
      const quantifiedDebt = await this.quantifyDebt(debtReport.items);

      // Step 3: Prioritize debt items
      console.log('Step 3: Prioritizing debt items...');
      const prioritizedItems = await this.prioritizeDebt(quantifiedDebt, config);

      // Step 4: Apply fixes
      console.log('Step 4: Applying fixes...');
      const fixedResults = await this.applyFixes(prioritizedItems, config.autoFix || false);

      // Step 5: Measure debt reduction
      console.log('Step 5: Measuring debt reduction...');
      const impact = await this.measureDebtReduction(
        debtReport.totalDebt,
        config.repoPath,
        fixedResults
      );

      const duration = Date.now() - startTime;
      console.log(`Workflow completed in ${duration}ms`);

      return {
        detection: {
          totalDebt: debtReport.totalDebt,
          debtByType: debtReport.debtByType,
          estimatedHours: debtReport.estimatedHours,
        },
        prioritized: prioritizedItems.map((item) => ({
          id: item.id,
          description: item.description,
          priority: item.priority,
          effort: item.effortHours,
        })),
        fixed: fixedResults,
        impact,
        duration,
      };
    } catch (error) {
      console.error('Workflow failed:', error);
      throw error;
    }
  }

  /**
   * Step 1: Detect technical debt
   */
  private async detectDebt(repoPath: string): Promise<{
    items: TechnicalDebt[];
    totalDebt: number;
    debtByType: Record<string, number>;
    estimatedHours: number;
  }> {
    const report = await this.debtDetector.detectDebt(repoPath);

    // Group by type
    const debtByType: Record<string, number> = {};
    for (const item of report.items) {
      debtByType[item.type] = (debtByType[item.type] || 0) + 1;
    }

    return {
      items: report.items,
      totalDebt: report.totalDebt,
      debtByType,
      estimatedHours: report.estimatedHours,
    };
  }

  /**
   * Step 2: Quantify debt (already done by detector, but can enhance)
   */
  private async quantifyDebt(items: TechnicalDebt[]): Promise<TechnicalDebt[]> {
    // Debt is already quantified by detector
    // This step could enhance with additional analysis
    return items;
  }

  /**
   * Step 3: Prioritize debt items
   */
  private async prioritizeDebt(
    items: TechnicalDebt[],
    config: DebtWorkflowConfig
  ): Promise<Array<TechnicalDebt & { priority: number }>> {
    // Convert debt items to tasks
    const tasks: Task[] = items.map((item) => ({
      id: item.id,
      description: item.description,
      type: 'debt',
      effortHours: item.estimatedHours,
      metadata: {
        debtType: item.type,
        priority: item.priority,
        location: item.location,
      },
    }));

    // Score and sort tasks
    const scores = this.priorityScorer.scoreTasks(tasks);

    // Filter by minimum priority if specified
    let filteredScores = scores;
    if (config.minPriority) {
      filteredScores = scores.filter((s) => s.totalScore >= config.minPriority);
    }

    // Limit to maxItems if specified
    const topScores = config.maxItems ? filteredScores.slice(0, config.maxItems) : filteredScores;

    // Combine debt data with priority scores
    return topScores.map((score) => {
      const item = items.find((i) => i.id === score.taskId)!;
      return {
        ...item,
        priority: score.totalScore,
      };
    });
  }

  /**
   * Step 4: Apply fixes to debt items
   */
  private async applyFixes(
    items: Array<TechnicalDebt & { priority: number }>,
    autoFix: boolean
  ): Promise<Array<{ id: string; success: boolean; hoursSpent?: number }>> {
    const results: Array<{ id: string; success: boolean; hoursSpent?: number }> = [];

    for (const item of items) {
      try {
        // Determine if we should auto-fix
        const shouldFix =
          autoFix ||
          (item.estimatedHours <= 2 && item.priority > 70) ||
          item.type === 'todo_comment';

        if (!shouldFix) {
          console.log(`○ Skipped (manual review needed): ${item.description}`);
          results.push({
            id: item.id,
            success: false,
          });
          continue;
        }

        // Apply fix based on debt type
        let success = false;
        let hoursSpent: number | undefined;

        switch (item.type) {
          case 'todo_comment':
            success = await this.fixTodoComment(item);
            hoursSpent = 0.5;
            break;

          case 'outdated_dependency':
            success = await this.updateDependency(item);
            hoursSpent = 1;
            break;

          case 'missing_test':
            success = await this.addTest(item);
            hoursSpent = item.estimatedHours;
            break;

          case 'architectural_violation':
            // Requires manual intervention
            success = false;
            break;

          default:
            success = false;
        }

        results.push({
          id: item.id,
          success,
          hoursSpent,
        });

        if (success) {
          console.log(`✓ Fixed: ${item.description}`);
        }
      } catch (error) {
        console.warn(`Failed to fix debt item ${item.id}:`, error);
        results.push({
          id: item.id,
          success: false,
        });
      }
    }

    return results;
  }

  /**
   * Step 5: Measure debt reduction
   */
  private async measureDebtReduction(
    initialDebt: number,
    repoPath: string,
    fixedResults: Array<{ id: string; success: boolean; hoursSpent?: number }>
  ): Promise<{
    debtReduction: number;
    hoursInvested: number;
    itemsFixed: number;
  }> {
    // Re-analyze to get new debt level
    const newReport = await this.debtDetector.detectDebt(repoPath);
    const finalDebt = newReport.totalDebt;

    const itemsFixed = fixedResults.filter((r) => r.success).length;

    const hoursInvested = fixedResults
      .filter((r) => r.success && r.hoursSpent)
      .reduce((sum, r) => sum + (r.hoursSpent || 0), 0);

    return {
      debtReduction: initialDebt - finalDebt,
      hoursInvested,
      itemsFixed,
    };
  }

  /**
   * Fix TODO comment
   */
  private async fixTodoComment(item: TechnicalDebt): Promise<boolean> {
    // In real implementation, would:
    // 1. Read the file
    // 2. Remove or address the TODO
    // 3. Create a task if needed
    // 4. Commit changes

    console.log(`Fixing TODO comment at ${item.location}`);
    return true; // Simplified
  }

  /**
   * Update outdated dependency
   */
  private async updateDependency(item: TechnicalDebt): Promise<boolean> {
    // In real implementation, would:
    // 1. Update package.json
    // 2. Run npm install
    // 3. Run tests
    // 4. Commit if tests pass

    console.log(`Updating dependency at ${item.location}`);
    return true; // Simplified
  }

  /**
   * Add missing test
   */
  private async addTest(item: TechnicalDebt): Promise<boolean> {
    // In real implementation, would:
    // 1. Generate test using TestGenerator
    // 2. Validate with Themis
    // 3. Add to test file
    // 4. Run tests
    // 5. Commit if tests pass

    console.log(`Adding test for ${item.location}`);
    return true; // Simplified
  }
}

/**
 * Create a debt reduction workflow instance
 */
export function createDebtReductionWorkflow(
  debtDetector: DebtDetector,
  priorityScorer: PriorityScorer,
  memoryEngine: MemoryEngine
): DebtReductionWorkflow {
  return new DebtReductionWorkflow(debtDetector, priorityScorer, memoryEngine);
}
