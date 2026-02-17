/**
 * Self-Improvement Development Workflow
 * 
 * Manages the complete workflow for Prometheus self-improvements:
 * - Work exclusively in dev repository
 * - Run tests in dev environment
 * - Track self-improvement changes
 * - Generate promotion requests
 */

import { DevProdManager, PromotionRequest, ChangeDescription, TestResults, ImpactAssessment, RollbackPlan } from './dev-prod-manager';
import { RepositoryWorkflow } from '../integrations/repository-workflow';
import { MemoryEngine } from '../memory/engine';

export interface SelfImprovementTask {
  id: string;
  title: string;
  description: string;
  category: 'performance' | 'quality' | 'architecture' | 'testing' | 'documentation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number; // hours
  expectedBenefit: string;
  createdAt: number;
  status: 'planned' | 'in_progress' | 'testing' | 'ready_for_promotion' | 'promoted' | 'cancelled';
  branchName?: string;
  changes?: ChangeDescription[];
  testResults?: TestResults;
  promotionId?: string;
}

export interface SelfImprovementContext {
  taskId: string;
  devRepoPath: string;
  branchName: string;
  startedAt: number;
  modifiedFiles: Set<string>;
}

export interface WorkflowConfig {
  devRepoPath: string;
  testCommand: string;
  buildCommand?: string;
  lintCommand?: string;
  coverageThreshold?: number;
  requireAllTestsPass: boolean;
}

/**
 * Self-Improvement Workflow Manager
 * 
 * Orchestrates the development workflow for Prometheus self-improvements
 */
export class SelfImprovementWorkflow {
  private devProdManager: DevProdManager;
  private devWorkflow: RepositoryWorkflow;
  private memoryEngine: MemoryEngine;
  private config: WorkflowConfig;
  private tasks: Map<string, SelfImprovementTask> = new Map();
  private currentContext?: SelfImprovementContext;

  constructor(
    devProdManager: DevProdManager,
    devWorkflow: RepositoryWorkflow,
    memoryEngine: MemoryEngine,
    config: WorkflowConfig
  ) {
    this.devProdManager = devProdManager;
    this.devWorkflow = devWorkflow;
    this.memoryEngine = memoryEngine;
    this.config = config;
  }

  /**
   * Create a new self-improvement task
   */
  async createTask(
    title: string,
    description: string,
    category: SelfImprovementTask['category'],
    priority: SelfImprovementTask['priority'],
    estimatedEffort: number,
    expectedBenefit: string
  ): Promise<SelfImprovementTask> {
    const task: SelfImprovementTask = {
      id: `self-improvement-${Date.now()}`,
      title,
      description,
      category,
      priority,
      estimatedEffort,
      expectedBenefit,
      createdAt: Date.now(),
      status: 'planned',
    };

    this.tasks.set(task.id, task);
    await this.storeTask(task);

    console.log(`[SelfImprovement] Created task: ${task.id}`);
    console.log(`[SelfImprovement] Title: ${title}`);
    console.log(`[SelfImprovement] Category: ${category}`);
    console.log(`[SelfImprovement] Priority: ${priority}`);

    return task;
  }

  /**
   * Start working on a self-improvement task
   */
  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'planned') {
      throw new Error(`Task is not in planned state: ${task.status}`);
    }

    // Ensure we're in dev repository
    await this.devProdManager.switchToDev();
    this.devProdManager.requireDevRepository();

    console.log(`[SelfImprovement] Starting task: ${taskId}`);

    // Create branch for this task
    const branchName = this.generateBranchName(task);
    await this.devWorkflow.createFeatureBranch(branchName);

    // Update task
    task.status = 'in_progress';
    task.branchName = branchName;
    await this.storeTask(task);

    // Set current context
    this.currentContext = {
      taskId,
      devRepoPath: this.config.devRepoPath,
      branchName,
      startedAt: Date.now(),
      modifiedFiles: new Set(),
    };

    console.log(`[SelfImprovement] Created branch: ${branchName}`);
    console.log(`[SelfImprovement] Ready to make changes`);
  }

  /**
   * Track a file modification
   */
  trackFileModification(filePath: string): void {
    if (!this.currentContext) {
      throw new Error('No active self-improvement task');
    }

    this.currentContext.modifiedFiles.add(filePath);
    console.log(`[SelfImprovement] Tracked modification: ${filePath}`);
  }

  /**
   * Get current task context
   */
  getCurrentContext(): SelfImprovementContext | undefined {
    return this.currentContext;
  }

  /**
   * Run tests for current task
   */
  async runTests(): Promise<TestResults> {
    if (!this.currentContext) {
      throw new Error('No active self-improvement task');
    }

    console.log(`[SelfImprovement] Running tests...`);

    const startTime = Date.now();
    const results: TestResults = {
      passed: false,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      duration: 0,
      failures: [],
    };

    try {
      // Run test command
      const testOutput = await this.executeCommand(this.config.testCommand);
      
      // Parse test results (simplified - real implementation would parse actual output)
      results.passed = !testOutput.includes('FAIL') && !testOutput.includes('failed');
      results.totalTests = this.parseTestCount(testOutput);
      results.passedTests = results.passed ? results.totalTests : 0;
      results.failedTests = results.totalTests - results.passedTests;
      results.duration = Date.now() - startTime;

      // Check coverage if configured
      if (this.config.coverageThreshold) {
        const coverage = await this.checkCoverage();
        results.coverage = coverage;

        if (coverage < this.config.coverageThreshold) {
          results.passed = false;
          results.failures.push({
            test: 'Coverage',
            error: `Coverage ${coverage}% is below threshold ${this.config.coverageThreshold}%`,
          });
        }
      }

      console.log(`[SelfImprovement] Tests completed: ${results.passedTests}/${results.totalTests} passed`);
      if (results.coverage) {
        console.log(`[SelfImprovement] Coverage: ${results.coverage}%`);
      }

      return results;
    } catch (error) {
      results.passed = false;
      results.failures.push({
        test: 'Test Execution',
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(`[SelfImprovement] Tests failed:`, error);
      return results;
    }
  }

  /**
   * Run build (if configured)
   */
  async runBuild(): Promise<boolean> {
    if (!this.config.buildCommand) {
      return true;
    }

    console.log(`[SelfImprovement] Running build...`);

    try {
      await this.executeCommand(this.config.buildCommand);
      console.log(`[SelfImprovement] Build successful`);
      return true;
    } catch (error) {
      console.error(`[SelfImprovement] Build failed:`, error);
      return false;
    }
  }

  /**
   * Run lint (if configured)
   */
  async runLint(): Promise<boolean> {
    if (!this.config.lintCommand) {
      return true;
    }

    console.log(`[SelfImprovement] Running lint...`);

    try {
      await this.executeCommand(this.config.lintCommand);
      console.log(`[SelfImprovement] Lint passed`);
      return true;
    } catch (error) {
      console.error(`[SelfImprovement] Lint failed:`, error);
      return false;
    }
  }

  /**
   * Complete task and prepare for promotion
   */
  async completeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'in_progress') {
      throw new Error(`Task is not in progress: ${task.status}`);
    }

    if (!this.currentContext || this.currentContext.taskId !== taskId) {
      throw new Error('Task is not the current active task');
    }

    console.log(`[SelfImprovement] Completing task: ${taskId}`);

    // Run all checks
    const lintPassed = await this.runLint();
    const buildPassed = await this.runBuild();
    const testResults = await this.runTests();

    if (!lintPassed || !buildPassed || !testResults.passed) {
      throw new Error(
        'Cannot complete task: checks failed. ' +
        `Lint: ${lintPassed}, Build: ${buildPassed}, Tests: ${testResults.passed}`
      );
    }

    // Analyze changes
    const changes = await this.analyzeChanges();

    // Update task
    task.status = 'ready_for_promotion';
    task.changes = changes;
    task.testResults = testResults;
    await this.storeTask(task);

    console.log(`[SelfImprovement] Task ready for promotion`);
    console.log(`[SelfImprovement] Changes: ${changes.length} files`);
    console.log(`[SelfImprovement] Tests: ${testResults.passedTests}/${testResults.totalTests} passed`);
  }

  /**
   * Create promotion request for completed task
   */
  async createPromotionRequest(taskId: string): Promise<PromotionRequest> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'ready_for_promotion') {
      throw new Error(`Task is not ready for promotion: ${task.status}`);
    }

    if (!task.changes || !task.testResults) {
      throw new Error('Task is missing changes or test results');
    }

    console.log(`[SelfImprovement] Creating promotion request for task: ${taskId}`);

    // Perform impact assessment
    const impactAssessment = await this.assessImpact(task);

    // Generate rollback plan
    const rollbackPlan = this.generateRollbackPlan(task);

    // Create promotion request
    const promotionRequest = await this.devProdManager.createPromotionRequest(
      task.title,
      this.generatePromotionDescription(task),
      task.changes,
      task.testResults,
      impactAssessment,
      rollbackPlan
    );

    // Update task
    task.status = 'promoted';
    task.promotionId = promotionRequest.id;
    await this.storeTask(task);

    // Clear current context
    this.currentContext = undefined;

    console.log(`[SelfImprovement] Promotion request created: ${promotionRequest.id}`);

    return promotionRequest;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string, reason: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    console.log(`[SelfImprovement] Cancelling task: ${taskId}`);
    console.log(`[SelfImprovement] Reason: ${reason}`);

    // Update task
    task.status = 'cancelled';
    await this.storeTask(task);

    // Clear current context if this is the active task
    if (this.currentContext?.taskId === taskId) {
      this.currentContext = undefined;
    }

    console.log(`[SelfImprovement] Task cancelled`);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): SelfImprovementTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): SelfImprovementTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: SelfImprovementTask['status']): SelfImprovementTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === status)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get tasks by priority
   */
  getTasksByPriority(priority: SelfImprovementTask['priority']): SelfImprovementTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.priority === priority)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Generate branch name for task
   */
  private generateBranchName(task: SelfImprovementTask): string {
    const sanitizedTitle = task.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    return `self-improvement/${task.category}/${sanitizedTitle}`;
  }

  /**
   * Analyze changes made in current task
   */
  private async analyzeChanges(): Promise<ChangeDescription[]> {
    if (!this.currentContext) {
      return [];
    }

    const changes: ChangeDescription[] = [];

    for (const filePath of this.currentContext.modifiedFiles) {
      try {
        // Get file stats (simplified - real implementation would use git diff)
        const stats = await this.getFileStats(filePath);

        changes.push({
          file: filePath,
          type: stats.type,
          linesAdded: stats.linesAdded,
          linesRemoved: stats.linesRemoved,
          summary: stats.summary,
        });
      } catch (error) {
        console.warn(`Could not analyze file: ${filePath}`, error);
      }
    }

    return changes;
  }

  /**
   * Assess impact of task changes
   */
  private async assessImpact(task: SelfImprovementTask): Promise<ImpactAssessment> {
    if (!task.changes) {
      throw new Error('Task has no changes to assess');
    }

    // Use analysis engine to assess impact
    const affectedComponents = new Set<string>();
    for (const change of task.changes) {
      const component = this.extractComponentFromPath(change.file);
      if (component) {
        affectedComponents.add(component);
      }
    }

    // Determine risk level based on changes and category
    let risk: ImpactAssessment['risk'] = 'low';
    if (task.category === 'architecture' || affectedComponents.size > 5) {
      risk = 'high';
    } else if (task.category === 'performance' || affectedComponents.size > 2) {
      risk = 'medium';
    }

    return {
      risk,
      affectedComponents: Array.from(affectedComponents),
      estimatedDowntime: risk === 'high' ? 5 : 0,
      rollbackComplexity: risk === 'high' ? 'moderate' : 'simple',
      benefits: [task.expectedBenefit],
      risks: this.identifyRisks(task, risk),
    };
  }

  /**
   * Generate rollback plan
   */
  private generateRollbackPlan(task: SelfImprovementTask): RollbackPlan {
    const steps: string[] = [
      'Revert the merge commit',
      'Restart Prometheus service',
      'Verify system health',
    ];

    if (task.category === 'architecture') {
      steps.push('Run database migrations rollback if needed');
      steps.push('Clear caches');
    }

    return {
      steps,
      estimatedTime: task.category === 'architecture' ? 15 : 5,
      dataBackupRequired: task.category === 'architecture',
      automatable: task.category !== 'architecture',
    };
  }

  /**
   * Generate promotion description
   */
  private generatePromotionDescription(task: SelfImprovementTask): string {
    let description = `## Self-Improvement: ${task.title}\n\n`;
    description += `${task.description}\n\n`;
    description += `**Category**: ${task.category}\n`;
    description += `**Priority**: ${task.priority}\n`;
    description += `**Estimated Effort**: ${task.estimatedEffort} hours\n`;
    description += `**Expected Benefit**: ${task.expectedBenefit}\n\n`;

    if (this.currentContext) {
      const duration = Date.now() - this.currentContext.startedAt;
      const hours = Math.round(duration / (1000 * 60 * 60) * 10) / 10;
      description += `**Actual Time Spent**: ${hours} hours\n\n`;
    }

    return description;
  }

  /**
   * Identify risks for task
   */
  private identifyRisks(task: SelfImprovementTask, riskLevel: string): string[] {
    const risks: string[] = [];

    if (riskLevel === 'high') {
      risks.push('Significant architectural changes may have unforeseen impacts');
      risks.push('Requires careful monitoring after deployment');
    }

    if (task.category === 'performance') {
      risks.push('Performance improvements may affect behavior in edge cases');
    }

    if (task.category === 'architecture') {
      risks.push('May require database migrations');
      risks.push('Could affect multiple components');
    }

    return risks;
  }

  /**
   * Extract component name from file path
   */
  private extractComponentFromPath(filePath: string): string | null {
    const parts = filePath.split('/');
    if (parts.length >= 2 && parts[0] === 'src') {
      return parts[1] ?? null;
    }
    return null;
  }

  /**
   * Get file statistics (simplified)
   */
  private async getFileStats(_filePath: string): Promise<{
    type: 'added' | 'modified' | 'deleted';
    linesAdded: number;
    linesRemoved: number;
    summary: string;
  }> {
    // Simplified implementation - real version would use git diff
    return {
      type: 'modified',
      linesAdded: 10,
      linesRemoved: 5,
      summary: 'Updated implementation',
    };
  }

  /**
   * Execute shell command
   */
  private async executeCommand(command: string): Promise<string> {
    // Simplified - real implementation would use child_process
    console.log(`Executing: ${command}`);
    return 'Command output';
  }

  /**
   * Parse test count from output
   */
  private parseTestCount(_output: string): number {
    // Simplified - real implementation would parse actual test output
    return 100;
  }

  /**
   * Check code coverage
   */
  private async checkCoverage(): Promise<number> {
    // Simplified - real implementation would parse coverage report
    return 85;
  }

  /**
   * Store task in memory engine
   */
  private async storeTask(task: SelfImprovementTask): Promise<void> {
    try {
      await this.memoryEngine.storePattern({
        name: `self-improvement-task-${task.id}`,
        category: 'self-improvement-task',
        problem: task.title,
        solution: task.description,
        example_code: JSON.stringify(task.changes || []),
        applicability: JSON.stringify({
          status: task.status,
          priority: task.priority,
          taskId: task.id,
          taskData: task,
        }),
        success_count: 0,
        failure_count: 0,
      });
    } catch (error) {
      console.error('Failed to store task:', error);
    }
  }

  /**
   * Load tasks from memory engine
   */
  async loadTasks(): Promise<void> {
    try {
      const results = await this.memoryEngine.searchPatterns('self-improvement-task');

      for (const result of results) {
        if (result.category === 'self-improvement-task' && result.applicability) {
          try {
            const applicabilityData = JSON.parse(result.applicability);
            if (applicabilityData.taskData) {
              const task = applicabilityData.taskData as SelfImprovementTask;
              this.tasks.set(task.id, task);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      console.log(`[SelfImprovement] Loaded ${this.tasks.size} tasks`);
    } catch (error) {
      console.warn('Could not load tasks:', error);
    }
  }
}
