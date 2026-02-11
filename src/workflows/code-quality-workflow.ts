/**
 * Code Quality Improvement Workflow
 * 
 * End-to-end workflow for detecting quality issues,
 * prioritizing improvements, applying refactorings,
 * and measuring impact.
 * 
 * Task 56.1: Create code quality improvement workflow
 */

import type { CodeQualityAnalyzer } from '../analysis/code-quality-analyzer';
import type { PriorityScorer, Task } from '../decision/priority-scorer';
import type { PatternApplicator } from '../evolution/pattern-applicator';
import type { MemoryEngine } from '../memory';
import type { QualityIssue } from '../analysis/types';

export interface WorkflowConfig {
  /** Repository path to analyze */
  repoPath: string;
  /** Maximum issues to process */
  maxIssues?: number;
  /** Minimum quality score threshold */
  minQualityScore?: number;
  /** Auto-apply low-risk fixes */
  autoApply?: boolean;
}

export interface WorkflowResult {
  /** Analysis results */
  analysis: {
    filesAnalyzed: number;
    issuesFound: number;
    averageQualityScore: number;
  };
  /** Prioritized improvements */
  improvements: {
    taskId: string;
    description: string;
    priority: number;
    effort: number;
  }[];
  /** Applied refactorings */
  applied: {
    taskId: string;
    success: boolean;
    impact?: string;
  }[];
  /** Overall impact */
  impact: {
    qualityScoreImprovement: number;
    issuesFixed: number;
    timeSpent: number;
  };
  /** Workflow duration */
  duration: number;
}

/**
 * Code Quality Improvement Workflow
 * 
 * Orchestrates the complete quality improvement process.
 */
export class CodeQualityWorkflow {
  constructor(
    private qualityAnalyzer: CodeQualityAnalyzer,
    private priorityScorer: PriorityScorer,
    private patternApplicator: PatternApplicator,
    private memoryEngine: MemoryEngine
  ) {}

  /**
   * Execute the complete workflow
   * 
   * @param config - Workflow configuration
   * @returns Workflow result with impact metrics
   */
  async execute(config: WorkflowConfig): Promise<WorkflowResult> {
    const startTime = Date.now();
    console.log('Starting code quality improvement workflow...');

    try {
      // Step 1: Detect quality issues
      console.log('Step 1: Analyzing code quality...');
      const analysisResults = await this.detectQualityIssues(config.repoPath);

      // Step 2: Prioritize improvements
      console.log('Step 2: Prioritizing improvements...');
      const prioritizedTasks = await this.prioritizeImprovements(
        analysisResults.issues,
        config.maxIssues
      );

      // Step 3: Apply refactorings
      console.log('Step 3: Applying refactorings...');
      const appliedResults = await this.applyRefactorings(
        prioritizedTasks,
        config.autoApply || false
      );

      // Step 4: Measure impact
      console.log('Step 4: Measuring impact...');
      const impact = await this.measureImpact(
        analysisResults.initialScore,
        config.repoPath,
        appliedResults
      );

      const duration = Date.now() - startTime;
      console.log(`Workflow completed in ${duration}ms`);

      return {
        analysis: {
          filesAnalyzed: analysisResults.filesAnalyzed,
          issuesFound: analysisResults.issues.length,
          averageQualityScore: analysisResults.initialScore,
        },
        improvements: prioritizedTasks.map((task) => ({
          taskId: task.id,
          description: task.description,
          priority: task.priority,
          effort: task.effortHours,
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
   * Step 1: Detect quality issues across codebase
   */
  private async detectQualityIssues(repoPath: string): Promise<{
    issues: QualityIssue[];
    filesAnalyzed: number;
    initialScore: number;
  }> {
    const files = await this.getCodeFiles(repoPath);
    const allIssues: QualityIssue[] = [];
    let totalScore = 0;

    for (const file of files) {
      try {
        const content = await this.readFile(file);
        const result = await this.qualityAnalyzer.analyze(file, content);

        allIssues.push(...result.issues);
        totalScore += result.qualityScore;
      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error);
      }
    }

    const averageScore = files.length > 0 ? totalScore / files.length : 0;

    return {
      issues: allIssues,
      filesAnalyzed: files.length,
      initialScore: averageScore,
    };
  }

  /**
   * Step 2: Prioritize improvements using decision engine
   */
  private async prioritizeImprovements(
    issues: QualityIssue[],
    maxIssues?: number
  ): Promise<Array<Task & { priority: number }>> {
    // Convert issues to tasks
    const tasks: Task[] = issues.map((issue) => ({
      id: issue.id,
      description: issue.description,
      type: this.mapIssueTypeToTaskType(issue.type),
      effortHours: issue.effortHours || 1,
      metadata: {
        severity: issue.severity,
        impactScore: issue.impactScore,
        filePath: issue.filePath,
        line: issue.startLine,
      },
    }));

    // Score and sort tasks
    const scores = this.priorityScorer.scoreTasks(tasks);

    // Limit to maxIssues if specified
    const topScores = maxIssues ? scores.slice(0, maxIssues) : scores;

    // Combine task data with priority scores
    return topScores.map((score) => {
      const task = tasks.find((t) => t.id === score.taskId)!;
      return {
        ...task,
        priority: score.totalScore,
      };
    });
  }

  /**
   * Step 3: Apply refactorings (with pattern matching)
   */
  private async applyRefactorings(
    tasks: Array<Task & { priority: number }>,
    autoApply: boolean
  ): Promise<Array<{ taskId: string; success: boolean; impact?: string }>> {
    const results: Array<{ taskId: string; success: boolean; impact?: string }> = [];

    for (const task of tasks) {
      try {
        // Check if there's a pattern that can help
        const patterns = await this.memoryEngine.searchPatterns(task.description, {
          limit: 3,
        });

        let applied = false;
        let impact: string | undefined;

        if (patterns.length > 0 && task.metadata?.filePath) {
          // Try to apply best matching pattern
          const bestPattern = patterns[0];
          const content = await this.readFile(task.metadata.filePath);

          const applicability = await this.patternApplicator.checkApplicability(
            bestPattern,
            { file: task.metadata.filePath, line: task.metadata.line || 1 },
            content
          );

          if (applicability.applicable && (autoApply || applicability.confidence > 80)) {
            const adapted = await this.patternApplicator.adaptPattern(
              bestPattern,
              { file: task.metadata.filePath, line: task.metadata.line || 1 },
              content
            );

            const result = await this.patternApplicator.applyPattern(
              bestPattern,
              { file: task.metadata.filePath, line: task.metadata.line || 1 },
              adapted.adaptedCode
            );

            applied = result.success;
            impact = `Applied pattern: ${bestPattern.name}`;
          }
        }

        results.push({
          taskId: task.id,
          success: applied,
          impact,
        });

        if (applied) {
          console.log(`✓ Applied fix for: ${task.description}`);
        } else {
          console.log(`○ Skipped (manual review needed): ${task.description}`);
        }
      } catch (error) {
        console.warn(`Failed to apply fix for task ${task.id}:`, error);
        results.push({
          taskId: task.id,
          success: false,
        });
      }
    }

    return results;
  }

  /**
   * Step 4: Measure impact of improvements
   */
  private async measureImpact(
    initialScore: number,
    repoPath: string,
    appliedResults: Array<{ taskId: string; success: boolean }>
  ): Promise<{
    qualityScoreImprovement: number;
    issuesFixed: number;
    timeSpent: number;
  }> {
    // Re-analyze to get new quality score
    const newAnalysis = await this.detectQualityIssues(repoPath);
    const finalScore = newAnalysis.initialScore;

    const issuesFixed = appliedResults.filter((r) => r.success).length;

    // Estimate time spent (sum of effort for applied fixes)
    const timeSpent = issuesFixed * 2; // Simplified: 2 hours per fix

    return {
      qualityScoreImprovement: finalScore - initialScore,
      issuesFixed,
      timeSpent,
    };
  }

  /**
   * Map issue type to task type
   */
  private mapIssueTypeToTaskType(issueType: string): Task['type'] {
    const mapping: Record<string, Task['type']> = {
      complexity: 'refactor',
      long_method: 'refactor',
      large_class: 'refactor',
      code_smell: 'refactor',
      magic_number: 'refactor',
      duplication: 'refactor',
    };

    return mapping[issueType] || 'refactor';
  }

  /**
   * Get code files from repository
   */
  private async getCodeFiles(repoPath: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const files: string[] = [];

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await scanDir(fullPath);
            }
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to scan directory ${dir}:`, error);
      }
    }

    await scanDir(repoPath);
    return files;
  }

  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  }
}

/**
 * Create a code quality workflow instance
 */
export function createCodeQualityWorkflow(
  qualityAnalyzer: CodeQualityAnalyzer,
  priorityScorer: PriorityScorer,
  patternApplicator: PatternApplicator,
  memoryEngine: MemoryEngine
): CodeQualityWorkflow {
  return new CodeQualityWorkflow(
    qualityAnalyzer,
    priorityScorer,
    patternApplicator,
    memoryEngine
  );
}
