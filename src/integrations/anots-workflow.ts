/**
 * ANOTS Change Workflow
 * 
 * Manages the workflow for making changes to ANOTS repository:
 * - Creates feature branches
 * - Generates pull requests
 * - Runs tests before PR
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export interface WorkflowConfig {
  repoPath: string;
  baseBranch?: string;
  branchPrefix?: string;
  runTestsBeforePR?: boolean;
  testCommand?: string;
}

export interface BranchInfo {
  name: string;
  baseBranch: string;
  created: number;
  commitHash: string;
}

export interface PullRequestInfo {
  branch: string;
  title: string;
  description: string;
  baseBranch: string;
  filesChanged: string[];
  testsRun: boolean;
  testsPassed: boolean;
}

export interface ChangeSet {
  files: Array<{
    path: string;
    content: string;
  }>;
  commitMessage: string;
}

export class AnotsWorkflow {
  private config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = {
      baseBranch: 'main',
      branchPrefix: 'prometheus/',
      runTestsBeforePR: true,
      testCommand: 'npm test',
      ...config,
    };
  }

  /**
   * Create a feature branch for changes
   */
  async createFeatureBranch(featureName: string): Promise<BranchInfo> {
    const branchName = `${this.config.branchPrefix}${featureName}`;

    try {
      // Ensure we're on base branch
      await execAsync(`git checkout ${this.config.baseBranch}`, {
        cwd: this.config.repoPath,
      });

      // Try to pull from origin if it exists
      try {
        await execAsync(`git pull origin ${this.config.baseBranch}`, {
          cwd: this.config.repoPath,
        });
      } catch {
        // Ignore pull errors (origin might not exist in tests)
      }

      // Create and checkout new branch
      await execAsync(`git checkout -b ${branchName}`, {
        cwd: this.config.repoPath,
      });

      // Get commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: this.config.repoPath,
      });

      return {
        name: branchName,
        baseBranch: this.config.baseBranch!,
        created: Date.now(),
        commitHash: stdout.trim(),
      };
    } catch (error) {
      throw new Error(`Failed to create feature branch: ${error}`);
    }
  }

  /**
   * Apply a change set to the repository
   */
  async applyChanges(changeSet: ChangeSet): Promise<void> {
    try {
      // Write all files
      for (const file of changeSet.files) {
        const fullPath = join(this.config.repoPath, file.path);
        await writeFile(fullPath, file.content, 'utf-8');
      }

      // Stage all changes
      await execAsync('git add .', {
        cwd: this.config.repoPath,
      });

      // Commit changes
      await execAsync(`git commit -m "${changeSet.commitMessage}"`, {
        cwd: this.config.repoPath,
      });

      console.log(`Applied changes: ${changeSet.commitMessage}`);
    } catch (error) {
      throw new Error(`Failed to apply changes: ${error}`);
    }
  }

  /**
   * Run tests in the repository
   */
  async runTests(): Promise<{ passed: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(this.config.testCommand!, {
        cwd: this.config.repoPath,
        timeout: 300000, // 5 minute timeout
      });

      return {
        passed: true,
        output: stdout + stderr,
      };
    } catch (error: any) {
      return {
        passed: false,
        output: error.stdout + error.stderr || error.message,
      };
    }
  }

  /**
   * Push branch to remote
   */
  async pushBranch(branchName: string): Promise<void> {
    try {
      await execAsync(`git push -u origin ${branchName}`, {
        cwd: this.config.repoPath,
      });

      console.log(`Pushed branch: ${branchName}`);
    } catch (error) {
      throw new Error(`Failed to push branch: ${error}`);
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
      throw new Error(`Failed to get changed files: ${error}`);
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
      // Get changed files
      const filesChanged = await this.getChangedFiles(this.config.baseBranch!);

      // Run tests if configured
      let testsRun = false;
      let testsPassed = false;

      if (this.config.runTestsBeforePR) {
        testsRun = true;
        const testResult = await this.runTests();
        testsPassed = testResult.passed;

        if (!testsPassed) {
          console.warn('Tests failed, but continuing with PR generation');
          console.warn('Test output:', testResult.output);
        }
      }

      // Push branch
      await this.pushBranch(branchName);

      return {
        branch: branchName,
        title,
        description,
        baseBranch: this.config.baseBranch!,
        filesChanged,
        testsRun,
        testsPassed,
      };
    } catch (error) {
      throw new Error(`Failed to generate pull request: ${error}`);
    }
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
      // Create feature branch
      const branch = await this.createFeatureBranch(featureName);
      console.log(`Created branch: ${branch.name}`);

      // Apply changes
      await this.applyChanges(changeSet);

      // Generate PR
      const pr = await this.generatePullRequest(
        branch.name,
        prTitle,
        prDescription
      );

      console.log(`Workflow complete for ${featureName}`);
      return pr;
    } catch (error) {
      throw new Error(`Workflow execution failed: ${error}`);
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

      console.log(`Deleted branch: ${branchName}`);
    } catch (error) {
      throw new Error(`Failed to delete branch: ${error}`);
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
      throw new Error(`Failed to get current branch: ${error}`);
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

      console.log(`Switched to branch: ${branchName}`);
    } catch (error) {
      throw new Error(`Failed to switch branch: ${error}`);
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
      throw new Error(`Failed to get commit count: ${error}`);
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
}
