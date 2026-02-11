/**
 * Tests for ANOTS Change Workflow
 */

import { AnotsWorkflow, WorkflowConfig, ChangeSet } from '../anots-workflow';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

describe('AnotsWorkflow', () => {
  let workflow: AnotsWorkflow;
  let testRepoPath: string;
  let config: WorkflowConfig;

  beforeEach(async () => {
    // Create temporary directory for testing
    const tempDir = tmpdir();
    testRepoPath = join(tempDir, `workflow-test-${Date.now()}`);

    await mkdir(testRepoPath, { recursive: true });

    // Initialize test git repo
    await execAsync('git init', { cwd: testRepoPath });
    await execAsync('git config user.email "test@test.com"', { cwd: testRepoPath });
    await execAsync('git config user.name "Test User"', { cwd: testRepoPath });
    await execAsync('git checkout -b main', { cwd: testRepoPath });

    // Create initial commit
    await writeFile(join(testRepoPath, 'README.md'), '# Test Repo');
    await execAsync('git add .', { cwd: testRepoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: testRepoPath });

    config = {
      repoPath: testRepoPath,
      baseBranch: 'main',
      branchPrefix: 'prometheus/',
      runTestsBeforePR: false, // Disable for most tests
      testCommand: 'echo "Tests passed"',
    };

    workflow = new AnotsWorkflow(config);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testRepoPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Branch Management', () => {
    it('should create a feature branch', async () => {
      const branch = await workflow.createFeatureBranch('test-feature');

      expect(branch.name).toBe('prometheus/test-feature');
      expect(branch.baseBranch).toBe('main');
      expect(branch.created).toBeGreaterThan(0);
      expect(branch.commitHash).toMatch(/^[0-9a-f]{40}$/);

      // Verify branch exists
      const exists = await workflow.branchExists('prometheus/test-feature');
      expect(exists).toBe(true);
    });

    it('should check if branch exists', async () => {
      await workflow.createFeatureBranch('existing-branch');

      const exists = await workflow.branchExists('prometheus/existing-branch');
      const notExists = await workflow.branchExists('prometheus/non-existent');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should get current branch', async () => {
      await workflow.createFeatureBranch('current-test');

      const currentBranch = await workflow.getCurrentBranch();
      expect(currentBranch).toBe('prometheus/current-test');
    });

    it('should switch branches', async () => {
      await workflow.createFeatureBranch('switch-test');
      await workflow.switchBranch('main');

      const currentBranch = await workflow.getCurrentBranch();
      expect(currentBranch).toBe('main');
    });

    it('should delete a branch', async () => {
      await workflow.createFeatureBranch('delete-test');
      await workflow.switchBranch('main');
      await workflow.deleteBranch('prometheus/delete-test');

      const exists = await workflow.branchExists('prometheus/delete-test');
      expect(exists).toBe(false);
    });

    it('should force delete a branch with uncommitted changes', async () => {
      await workflow.createFeatureBranch('force-delete-test');
      
      // Make uncommitted changes
      await writeFile(join(testRepoPath, 'uncommitted.txt'), 'content');
      
      await workflow.switchBranch('main');
      await workflow.deleteBranch('prometheus/force-delete-test', true);

      const exists = await workflow.branchExists('prometheus/force-delete-test');
      expect(exists).toBe(false);
    });
  });

  describe('Change Application', () => {
    it('should apply changes to repository', async () => {
      await workflow.createFeatureBranch('apply-changes');

      const changeSet: ChangeSet = {
        files: [
          { path: 'file1.ts', content: 'console.log("file1");' },
          { path: 'file2.ts', content: 'console.log("file2");' },
        ],
        commitMessage: 'Add new files',
      };

      await workflow.applyChanges(changeSet);

      // Verify files were created and committed
      const { stdout } = await execAsync('git log -1 --pretty=%B', {
        cwd: testRepoPath,
      });

      expect(stdout.trim()).toBe('Add new files');
    });

    it('should get changed files', async () => {
      await workflow.createFeatureBranch('changed-files');

      const changeSet: ChangeSet = {
        files: [
          { path: 'changed1.ts', content: 'content1' },
          { path: 'changed2.ts', content: 'content2' },
        ],
        commitMessage: 'Add changed files',
      };

      await workflow.applyChanges(changeSet);

      const changedFiles = await workflow.getChangedFiles('main');
      expect(changedFiles).toContain('changed1.ts');
      expect(changedFiles).toContain('changed2.ts');
      expect(changedFiles.length).toBe(2);
    });

    it('should check if working directory is clean', async () => {
      const isClean = await workflow.isWorkingDirectoryClean();
      expect(isClean).toBe(true);

      // Make uncommitted changes
      await writeFile(join(testRepoPath, 'dirty.txt'), 'content');

      const isCleanAfter = await workflow.isWorkingDirectoryClean();
      expect(isCleanAfter).toBe(false);
    });
  });

  describe('Testing', () => {
    it('should run tests successfully', async () => {
      const result = await workflow.runTests();

      expect(result.passed).toBe(true);
      expect(result.output).toContain('Tests passed');
    });

    it('should handle test failures', async () => {
      const failingWorkflow = new AnotsWorkflow({
        ...config,
        testCommand: 'exit 1',
      });

      const result = await failingWorkflow.runTests();

      expect(result.passed).toBe(false);
    });

    it('should timeout long-running tests', async () => {
      const slowWorkflow = new AnotsWorkflow({
        ...config,
        testCommand: 'sleep 10',
      });

      const result = await slowWorkflow.runTests();

      // Should fail due to timeout
      expect(result.passed).toBe(false);
    }, 10000);
  });

  describe('Pull Request Generation', () => {
    it('should generate pull request info without running tests', async () => {
      await workflow.createFeatureBranch('pr-test');

      const changeSet: ChangeSet = {
        files: [{ path: 'pr-file.ts', content: 'content' }],
        commitMessage: 'Add PR file',
      };

      await workflow.applyChanges(changeSet);

      // Set up remote
      const remotePath = join(tmpdir(), `remote-${Date.now()}`);
      await mkdir(remotePath, { recursive: true });
      await execAsync('git init --bare', { cwd: remotePath });
      await execAsync(`git remote add origin ${remotePath}`, { cwd: testRepoPath });

      const pr = await workflow.generatePullRequest(
        'prometheus/pr-test',
        'Test PR',
        'This is a test PR'
      );

      expect(pr.branch).toBe('prometheus/pr-test');
      expect(pr.title).toBe('Test PR');
      expect(pr.description).toBe('This is a test PR');
      expect(pr.baseBranch).toBe('main');
      expect(pr.filesChanged).toContain('pr-file.ts');
      expect(pr.testsRun).toBe(false);

      // Clean up remote
      await rm(remotePath, { recursive: true, force: true });
    });

    it('should run tests before PR when configured', async () => {
      const testingWorkflow = new AnotsWorkflow({
        ...config,
        runTestsBeforePR: true,
      });

      await testingWorkflow.createFeatureBranch('pr-with-tests');

      const changeSet: ChangeSet = {
        files: [{ path: 'test-file.ts', content: 'content' }],
        commitMessage: 'Add test file',
      };

      await testingWorkflow.applyChanges(changeSet);

      // Set up remote
      const remotePath = join(tmpdir(), `remote-${Date.now()}`);
      await mkdir(remotePath, { recursive: true });
      await execAsync('git init --bare', { cwd: remotePath });
      await execAsync(`git remote add origin ${remotePath}`, { cwd: testRepoPath });

      const pr = await testingWorkflow.generatePullRequest(
        'prometheus/pr-with-tests',
        'Test PR with tests',
        'PR with test execution'
      );

      expect(pr.testsRun).toBe(true);
      expect(pr.testsPassed).toBe(true);

      // Clean up remote
      await rm(remotePath, { recursive: true, force: true });
    });
  });

  describe('Complete Workflow', () => {
    it('should execute complete workflow', async () => {
      // Set up remote
      const remotePath = join(tmpdir(), `remote-${Date.now()}`);
      await mkdir(remotePath, { recursive: true });
      await execAsync('git init --bare', { cwd: remotePath });
      await execAsync(`git remote add origin ${remotePath}`, { cwd: testRepoPath });

      const changeSet: ChangeSet = {
        files: [
          { path: 'feature1.ts', content: 'export const feature1 = true;' },
          { path: 'feature2.ts', content: 'export const feature2 = true;' },
        ],
        commitMessage: 'Implement new feature',
      };

      const pr = await workflow.executeWorkflow(
        'complete-feature',
        changeSet,
        'Add new feature',
        'This PR adds a new feature to the system'
      );

      expect(pr.branch).toBe('prometheus/complete-feature');
      expect(pr.title).toBe('Add new feature');
      expect(pr.filesChanged.length).toBe(2);

      // Verify branch was created and pushed
      const branchExists = await workflow.branchExists('prometheus/complete-feature');
      expect(branchExists).toBe(true);

      // Clean up remote
      await rm(remotePath, { recursive: true, force: true });
    });
  });

  describe('Commit Management', () => {
    it('should get commit count between branches', async () => {
      await workflow.createFeatureBranch('commit-count-test');

      // Make multiple commits
      for (let i = 0; i < 3; i++) {
        const changeSet: ChangeSet = {
          files: [{ path: `file${i}.ts`, content: `content ${i}` }],
          commitMessage: `Commit ${i}`,
        };
        await workflow.applyChanges(changeSet);
      }

      const count = await workflow.getCommitCount('main', 'prometheus/commit-count-test');
      expect(count).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle branch creation errors', async () => {
      const invalidWorkflow = new AnotsWorkflow({
        ...config,
        repoPath: '/invalid/path',
      });

      await expect(invalidWorkflow.createFeatureBranch('test')).rejects.toThrow(
        'Failed to create feature branch'
      );
    });

    it('should handle change application errors', async () => {
      await workflow.createFeatureBranch('error-test');

      const invalidChangeSet: ChangeSet = {
        files: [{ path: '../../../etc/passwd', content: 'malicious' }],
        commitMessage: 'Invalid change',
      };

      // Should not throw, but may fail to write outside repo
      await expect(workflow.applyChanges(invalidChangeSet)).rejects.toThrow();
    });
  });
});
