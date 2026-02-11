/**
 * Generic Repository Change Workflow
 * 
 * Manages the workflow for making changes to any Git repository:
 * - Creates feature branches following repository conventions
 * - Generates pull requests with context
 * - Runs repository-specific tests before PR
 * - Supports different Git providers (GitHub, GitLab, Bitbucket)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { RepositoryProfile, GitProvider } from './repository-connector';

const execAsync = promisify(exec);

export interface WorkflowConfig {
  repoId: string;
  repoPath: string;
  provider: GitProvider;
  profile: RepositoryProfile;
}

export interface BranchInfo {
  name: string;
  baseBranch: string;
  created: number;
  commitHash: string;
  repoId: string;
}

export interface PullRequestInfo {
  repoId: string;
  provider: GitProvider;
  branch: string;
  title: string;
  description: string;
  baseBranch: string;
  filesChanged: string[];
  testsRun: boolean;
  testsPassed: boolean;
  testOutput?: string;
  prUrl?: string; // Will be set after PR creation via API
}

export interface ChangeSet {
  files: Array<{
    path: string;
    content: string;
  }>;
  commitMessage: string;
  author?: {
    name: string;
    email: string;
  };
}

export interface TestResult {
  passed: boolean;
  output: string;
  duration: number;
  command: string;
}

export class RepositoryWorkflow {
  private config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  /**
   * Create a feature branch following repository conventions
   */
  async createFeatureBranch(featureName: string): Promise<BranchInfo> {
    const branchName = this.buildBranchName(featureName);
    const baseBranch = this.config.profile.mainBranch;

    try {
      console.log(`[${this.config.repoId}] Creating feature branch: ${branchName}`);

      // Ensure we're on base branch
      await execAsync(`git checkout ${baseBranch}`, {
        cwd: this.config.repoPath,
      });

      // Pull latest changes
      try {
        await execAsync(`git pull origin ${baseBranch}`, {
          cwd: this.config.repoPath,
        });
      } catch (error) {
        console.warn(`[${this.config.repoId}] Could not pull from origin:`, error);
      }

      // Create and checkout new branch
      await execAsync(`git checkout -b ${branchName}`, {
        cwd: this.config.repoPath,
      });

      // Get commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: this.config.repoPath,
      });

      console.log(`[${this.config.repoId}] Created branch: ${branchName}`);

      return {
        name: branchName,
        baseBranch,
        created: Date.now(),
        commitHash: stdout.trim(),
        repoId: this.config.repoId,
      };
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to create feature branch: ${error}`);
    }
  }

  /**
   * Build branch name following repository conventions
   */
  private buildBranchName(featureName: string): string {
    const prefix = this.config.profile.featureBranchPrefix || 'feature/';
    
    // Sanitize feature name (remove special characters, replace spaces with dashes)
    const sanitized = featureName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${prefix}${sanitized}`;
  }

  /**
   * Apply a change set to the repository
   */
  async applyChanges(changeSet: ChangeSet): Promise<void> {
    try {
      console.log(`[${this.config.repoId}] Applying ${changeSet.files.length} file changes...`);

      // Write all files
      for (const file of changeSet.files) {
        const fullPath = join(this.config.repoPath, file.path);
        
        // Ensure directory exists
        await mkdir(dirname(fullPath), { recursive: true });
        
        // Write file
        await writeFile(fullPath, file.content, 'utf-8');
      }

      // Stage all changes
      await execAsync('git add .', {
        cwd: this.config.repoPath,
      });

      // Build commit command with author if provided
      let commitCmd = `git commit -m "${changeSet.commitMessage}"`;
      if (changeSet.author) {
        commitCmd = `git -c user.name="${changeSet.author.name}" -c user.email="${changeSet.author.email}" commit -m "${changeSet.commitMessage}"`;
      }

      // Commit changes
      await execAsync(commitCmd, {
        cwd: this.config.repoPath,
      });

      console.log(`[${this.config.repoId}] Applied changes: ${changeSet.commitMessage}`);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to apply changes: ${error}`);
    }
  }

  /**
   * Run tests in the repository
   */
  async runTests(): Promise<TestResult> {
    const testCommand = this.config.profile.testCommand;
    
    if (!testCommand) {
      console.warn(`[${this.config.repoId}] No test command configured, skipping tests`);
      return {
        passed: true,
        output: 'No test command configured',
        duration: 0,
        command: '',
      };
    }

    console.log(`[${this.config.repoId}] Running tests: ${testCommand}`);
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(testCommand, {
        cwd: this.config.repoPath,
        timeout: 600000, // 10 minute timeout
      });

      const duration = Date.now() - startTime;

      console.log(`[${this.config.repoId}] Tests passed in ${duration}ms`);

      return {
        passed: true,
        output: stdout + stderr,
        duration,
        command: testCommand,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`[${this.config.repoId}] Tests failed after ${duration}ms`);

      return {
        passed: false,
        output: error.stdout + error.stderr || error.message,
        duration,
        command: testCommand,
      };
    }
  }

  /**
   * Run build command
   */
  async runBuild(): Promise<TestResult> {
    const buildCommand = this.config.profile.buildCommand;
    
    if (!buildCommand) {
      return {
        passed: true,
        output: 'No build command configured',
        duration: 0,
        command: '',
      };
    }

    console.log(`[${this.config.repoId}] Running build: ${buildCommand}`);
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: this.config.repoPath,
        timeout: 600000, // 10 minute timeout
      });

      const duration = Date.now() - startTime;

      return {
        passed: true,
        output: stdout + stderr,
        duration,
        command: buildCommand,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        passed: false,
        output: error.stdout + error.stderr || error.message,
        duration,
        command: buildCommand,
      };
    }
  }

  /**
   * Run lint command
   */
  async runLint(): Promise<TestResult> {
    const lintCommand = this.config.profile.lintCommand;
    
    if (!lintCommand) {
      return {
        passed: true,
        output: 'No lint command configured',
        duration: 0,
        command: '',
      };
    }

    console.log(`[${this.config.repoId}] Running lint: ${lintCommand}`);
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(lintCommand, {
        cwd: this.config.repoPath,
        timeout: 300000, // 5 minute timeout
      });

      const duration = Date.now() - startTime;

      return {
        passed: true,
        output: stdout + stderr,
        duration,
        command: lintCommand,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        passed: false,
        output: error.stdout + error.stderr || error.message,
        duration,
        command: lintCommand,
      };
    }
  }

  /**
   * Push branch to remote
   */
  async pushBranch(branchName: string): Promise<void> {
    try {
      console.log(`[${this.config.repoId}] Pushing branch: ${branchName}`);

      await execAsync(`git push -u origin ${branchName}`, {
        cwd: this.config.repoPath,
      });

      console.log(`[${this.config.repoId}] Branch pushed successfully`);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to push branch: ${error}`);
    }
  }

  /**
   * Get list of changed files
   */
  async getChangedFiles(baseBranch: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git diff --name-only ${baseBranch}`, {
        cwd: this.config.repoPath,
      });

      return stdout
        .trim()
        .split('\n')
        .filter(line => line.length > 0);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to get changed files: ${error}`);
    }
  }

  /**
   * Get diff statistics
   */
  async getDiffStats(baseBranch: string): Promise<{ additions: number; deletions: number }> {
    try {
      const { stdout } = await execAsync(`git diff --shortstat ${baseBranch}`, {
        cwd: this.config.repoPath,
      });

      // Parse output like: "3 files changed, 45 insertions(+), 12 deletions(-)"
      const additionsMatch = stdout.match(/(\d+) insertion/);
      const deletionsMatch = stdout.match(/(\d+) deletion/);

      return {
        additions: additionsMatch ? parseInt(additionsMatch[1], 10) : 0,
        deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0,
      };
    } catch (error) {
      return { additions: 0, deletions: 0 };
    }
  }

  /**
   * Generate pull request information
   */
  async generatePullRequest(
    branchName: string,
    title: string,
    description: string
  ): Promise<PullRequestInfo> {
    try {
      console.log(`[${this.config.repoId}] Generating pull request for ${branchName}...`);

      // Get changed files
      const filesChanged = await this.getChangedFiles(this.config.profile.mainBranch);

      // Get diff stats
      const diffStats = await this.getDiffStats(this.config.profile.mainBranch);

      // Run tests if configured
      let testsRun = false;
      let testsPassed = false;
      let testOutput = '';

      // Run lint first
      const lintResult = await this.runLint();
      if (lintResult.command && !lintResult.passed) {
        console.warn(`[${this.config.repoId}] Lint failed, but continuing...`);
      }

      // Run build
      const buildResult = await this.runBuild();
      if (buildResult.command && !buildResult.passed) {
        throw new Error(`Build failed: ${buildResult.output}`);
      }

      // Run tests
      if (this.config.profile.testCommand) {
        testsRun = true;
        const testResult = await this.runTests();
        testsPassed = testResult.passed;
        testOutput = testResult.output;

        if (!testsPassed) {
          console.warn(`[${this.config.repoId}] Tests failed!`);
          console.warn('Test output:', testResult.output);
          
          // If review is required, we still create PR but mark tests as failed
          // If auto-merge is enabled, we throw error
          if (this.config.profile.autoMerge) {
            throw new Error(`Tests failed, cannot auto-merge: ${testResult.output}`);
          }
        }
      }

      // Push branch
      await this.pushBranch(branchName);

      // Enhance description with stats
      const enhancedDescription = this.enhancePRDescription(
        description,
        filesChanged.length,
        diffStats,
        testsRun,
        testsPassed
      );

      console.log(`[${this.config.repoId}] Pull request info generated successfully`);

      return {
        repoId: this.config.repoId,
        provider: this.config.provider,
        branch: branchName,
        title,
        description: enhancedDescription,
        baseBranch: this.config.profile.mainBranch,
        filesChanged,
        testsRun,
        testsPassed,
        testOutput: testsRun ? testOutput : undefined,
      };
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to generate pull request: ${error}`);
    }
  }

  /**
   * Enhance PR description with stats and test results
   */
  private enhancePRDescription(
    description: string,
    fileCount: number,
    diffStats: { additions: number; deletions: number },
    testsRun: boolean,
    testsPassed: boolean
  ): string {
    let enhanced = description + '\n\n---\n\n';
    
    enhanced += `**Changes Summary:**\n`;
    enhanced += `- Files changed: ${fileCount}\n`;
    enhanced += `- Lines added: +${diffStats.additions}\n`;
    enhanced += `- Lines removed: -${diffStats.deletions}\n\n`;

    if (testsRun) {
      enhanced += `**Tests:** ${testsPassed ? '✅ Passed' : '❌ Failed'}\n\n`;
    }

    enhanced += `*Generated by Prometheus Meta-Agent*`;

    return enhanced;
  }

  /**
   * Complete workflow: create branch, apply changes, run tests, create PR
   */
  async executeWorkflow(
    featureName: string,
    changeSet: ChangeSet,
    prTitle: string,
    prDescription: string
  ): Promise<PullRequestInfo> {
    try {
      console.log(`[${this.config.repoId}] Executing workflow for: ${featureName}`);

      // Ensure working directory is clean
      const isClean = await this.isWorkingDirectoryClean();
      if (!isClean) {
        throw new Error('Working directory is not clean. Please commit or stash changes first.');
      }

      // Create feature branch
      const branch = await this.createFeatureBranch(featureName);

      // Apply changes
      await this.applyChanges(changeSet);

      // Generate PR
      const pr = await this.generatePullRequest(
        branch.name,
        prTitle,
        prDescription
      );

      console.log(`[${this.config.repoId}] Workflow completed successfully`);
      return pr;
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Workflow execution failed: ${error}`);
    }
  }

  /**
   * Check if branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git branch --list', {
        cwd: this.config.repoPath,
      });

      return stdout.includes(branchName);
    } catch {
      return false;
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      const flag = force ? '-D' : '-d';
      await execAsync(`git branch ${flag} ${branchName}`, {
        cwd: this.config.repoPath,
      });

      console.log(`[${this.config.repoId}] Deleted branch: ${branchName}`);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to delete branch: ${error}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: this.config.repoPath,
      });

      return stdout.trim();
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to get current branch: ${error}`);
    }
  }

  /**
   * Switch to a branch
   */
  async switchBranch(branchName: string): Promise<void> {
    try {
      await execAsync(`git checkout ${branchName}`, {
        cwd: this.config.repoPath,
      });

      console.log(`[${this.config.repoId}] Switched to branch: ${branchName}`);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to switch branch: ${error}`);
    }
  }

  /**
   * Get commit count between branches
   */
  async getCommitCount(fromBranch: string, toBranch: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `git rev-list --count ${fromBranch}..${toBranch}`,
        { cwd: this.config.repoPath }
      );

      return parseInt(stdout.trim(), 10);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to get commit count: ${error}`);
    }
  }

  /**
   * Check if working directory is clean
   */
  async isWorkingDirectoryClean(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.config.repoPath,
      });

      return stdout.trim().length === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get commit history
   */
  async getCommitHistory(count: number = 10): Promise<Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
  }>> {
    try {
      const { stdout } = await execAsync(
        `git log -${count} --pretty=format:"%H|%an|%ad|%s"`,
        { cwd: this.config.repoPath }
      );

      return stdout
        .trim()
        .split('\n')
        .map(line => {
          const [hash, author, date, message] = line.split('|');
          return { hash, author, date, message };
        });
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to get commit history: ${error}`);
    }
  }

  /**
   * Stash changes
   */
  async stashChanges(message?: string): Promise<void> {
    try {
      const cmd = message ? `git stash push -m "${message}"` : 'git stash';
      await execAsync(cmd, {
        cwd: this.config.repoPath,
      });

      console.log(`[${this.config.repoId}] Changes stashed`);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to stash changes: ${error}`);
    }
  }

  /**
   * Pop stashed changes
   */
  async popStash(): Promise<void> {
    try {
      await execAsync('git stash pop', {
        cwd: this.config.repoPath,
      });

      console.log(`[${this.config.repoId}] Stash popped`);
    } catch (error) {
      throw new Error(`[${this.config.repoId}] Failed to pop stash: ${error}`);
    }
  }
}
