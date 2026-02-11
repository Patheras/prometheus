/**
 * Tests for ANOTS Repository Connector
 */

import { AnotsConnector, AnotsConnectorConfig, ChangeEvent } from '../anots-connector';
import { MemoryEngine } from '../../memory/engine';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

describe('AnotsConnector', () => {
  let connector: AnotsConnector;
  let memoryEngine: MemoryEngine;
  let testRepoPath: string;
  let prometheusRepoPath: string;
  let config: AnotsConnectorConfig;

  beforeEach(async () => {
    // Create temporary directories for testing
    const tempDir = tmpdir();
    testRepoPath = join(tempDir, `anots-test-${Date.now()}`);
    prometheusRepoPath = join(tempDir, `prometheus-test-${Date.now()}`);

    await mkdir(testRepoPath, { recursive: true });
    await mkdir(prometheusRepoPath, { recursive: true });

    // Initialize test git repo
    await execAsync('git init', { cwd: testRepoPath });
    await execAsync('git config user.email "test@test.com"', { cwd: testRepoPath });
    await execAsync('git config user.name "Test User"', { cwd: testRepoPath });
    await execAsync('git checkout -b main', { cwd: testRepoPath });

    // Create initial commit
    await writeFile(join(testRepoPath, 'README.md'), '# Test Repo');
    await execAsync('git add .', { cwd: testRepoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: testRepoPath });

    // Create mock memory engine
    memoryEngine = {
      indexCodebase: jest.fn().mockResolvedValue(undefined),
      syncCodebase: jest.fn().mockResolvedValue({ changes: { added: [], modified: [], deleted: [] }, timestamp: Date.now() }),
    } as unknown as MemoryEngine;

    config = {
      repoUrl: testRepoPath,
      localPath: testRepoPath,
      prometheusRepoPath,
      branch: 'main',
      pollInterval: 100, // Short interval for testing
    };

    connector = new AnotsConnector(config, memoryEngine);
  });

  afterEach(async () => {
    await connector.stop();
    
    // Clean up test directories
    try {
      await rm(testRepoPath, { recursive: true, force: true });
      await rm(prometheusRepoPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Repository Cloning', () => {
    it('should detect if repository is already cloned', async () => {
      const status = await connector.getStatus();
      expect(status.isCloned).toBe(true);
    });

    it('should get current commit hash', async () => {
      const status = await connector.getStatus();
      expect(status.commitHash).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should get current branch name', async () => {
      const status = await connector.getStatus();
      expect(status.currentBranch).toBe('main');
    });
  });

  describe('Codebase Indexing', () => {
    it('should index codebase on initialization', async () => {
      await connector.indexCodebase();
      
      expect(memoryEngine.indexCodebase).toHaveBeenCalledWith(
        testRepoPath,
        'anots'
      );
    });

    it('should count files in repository', async () => {
      // Add more files
      await writeFile(join(testRepoPath, 'file1.ts'), 'content');
      await writeFile(join(testRepoPath, 'file2.ts'), 'content');
      
      const status = await connector.getStatus();
      expect(status.fileCount).toBeGreaterThanOrEqual(3); // README + 2 files
    });

    it('should re-index after pulling changes', async () => {
      // Set up a remote
      const remotePath = join(tmpdir(), `remote-${Date.now()}`);
      await mkdir(remotePath, { recursive: true });
      await execAsync('git init --bare', { cwd: remotePath });
      await execAsync(`git remote add origin ${remotePath}`, { cwd: testRepoPath });
      await execAsync('git push -u origin main', { cwd: testRepoPath });

      // Create a new commit
      await writeFile(join(testRepoPath, 'newfile.ts'), 'new content');
      await execAsync('git add .', { cwd: testRepoPath });
      await execAsync('git commit -m "Add new file"', { cwd: testRepoPath });
      await execAsync('git push origin main', { cwd: testRepoPath });

      // Reset to previous commit
      await execAsync('git reset --hard HEAD~1', { cwd: testRepoPath });

      await connector.pullChanges();

      expect(memoryEngine.indexCodebase).toHaveBeenCalled();

      // Clean up remote
      await rm(remotePath, { recursive: true, force: true });
    });
  });

  describe('Change Monitoring', () => {
    it('should detect file changes', (done) => {
      connector.onChangeDetected((event: ChangeEvent) => {
        expect(event.type).toBe('modified');
        expect(event.path).toContain('test.ts');
        expect(event.timestamp).toBeGreaterThan(0);
        done();
      });

      // Start monitoring
      void connector.startMonitoring().then(async () => {
        // Create a file change
        await writeFile(join(testRepoPath, 'test.ts'), 'test content');
      });
    });

    it('should ignore .git directory changes', (done) => {
      let changeDetected = false;

      connector.onChangeDetected(() => {
        changeDetected = true;
      });

      void connector.startMonitoring().then(async () => {
        // Modify .git directory
        await writeFile(join(testRepoPath, '.git', 'test'), 'content');

        // Wait a bit
        setTimeout(() => {
          expect(changeDetected).toBe(false);
          done();
        }, 200);
      });
    });

    it('should ignore node_modules changes', (done) => {
      let changeDetected = false;

      connector.onChangeDetected(() => {
        changeDetected = true;
      });

      void connector.startMonitoring().then(async () => {
        // Create node_modules directory
        await mkdir(join(testRepoPath, 'node_modules'), { recursive: true });
        await writeFile(join(testRepoPath, 'node_modules', 'test.js'), 'content');

        // Wait a bit
        setTimeout(() => {
          expect(changeDetected).toBe(false);
          done();
        }, 200);
      });
    });

    it('should trigger incremental sync on file change', async () => {
      await connector.startMonitoring();

      // Create a file change
      await writeFile(join(testRepoPath, 'changed.ts'), 'changed content');

      // Wait for sync to be triggered
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(memoryEngine.syncCodebase).toHaveBeenCalled();
    });
  });

  describe('Repository Separation', () => {
    it('should verify file is in ANOTS repo', () => {
      const testPath = join(testRepoPath, 'src', 'test.ts');
      const isValid = connector.verifyRepositorySeparation(testPath);
      expect(isValid).toBe(true);
    });

    it('should reject file in Prometheus repo', () => {
      const testPath = join(prometheusRepoPath, 'src', 'test.ts');
      const isValid = connector.verifyRepositorySeparation(testPath);
      expect(isValid).toBe(false);
    });

    it('should reject file outside both repos', () => {
      const testPath = '/some/other/path/test.ts';
      const isValid = connector.verifyRepositorySeparation(testPath);
      expect(isValid).toBe(false);
    });

    it('should handle path normalization', () => {
      // Test with different path separators
      const testPath1 = testRepoPath.replace(/\//g, '\\') + '\\src\\test.ts';
      const testPath2 = testRepoPath + '/src/test.ts';

      expect(connector.verifyRepositorySeparation(testPath1)).toBe(true);
      expect(connector.verifyRepositorySeparation(testPath2)).toBe(true);
    });
  });

  describe('Status Reporting', () => {
    it('should return complete status', async () => {
      const status = await connector.getStatus();

      expect(status.isCloned).toBe(true);
      expect(status.isIndexed).toBe(true);
      expect(status.currentBranch).toBe('main');
      expect(status.commitHash).toBeTruthy();
      expect(status.fileCount).toBeGreaterThan(0);
      expect(status.lastSync).toBeGreaterThan(0);
    });

    it('should return empty status for non-cloned repo', async () => {
      const nonExistentPath = join(tmpdir(), 'non-existent-repo');
      const nonExistentConfig = {
        ...config,
        localPath: nonExistentPath,
      };

      const nonExistentConnector = new AnotsConnector(nonExistentConfig, memoryEngine);
      const status = await nonExistentConnector.getStatus();

      expect(status.isCloned).toBe(false);
      expect(status.isIndexed).toBe(false);
      expect(status.currentBranch).toBe('');
      expect(status.commitHash).toBe('');
      expect(status.fileCount).toBe(0);
    });
  });

  describe('Lifecycle Management', () => {
    it('should start and stop monitoring', async () => {
      await connector.startMonitoring();
      await connector.stop();

      // Verify monitoring stopped by checking no events are emitted
      let eventReceived = false;
      connector.onChangeDetected(() => {
        eventReceived = true;
      });

      await writeFile(join(testRepoPath, 'after-stop.ts'), 'content');
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(eventReceived).toBe(false);
    });

    it('should get repository path', () => {
      const path = connector.getRepoPath();
      expect(path).toBe(testRepoPath);
    });
  });

  describe('Error Handling', () => {
    it('should handle indexing errors gracefully', async () => {
      const errorEngine = {
        indexCodebase: jest.fn().mockRejectedValue(new Error('Index failed')),
      } as unknown as MemoryEngine;

      const errorConnector = new AnotsConnector(config, errorEngine);

      await expect(errorConnector.indexCodebase()).rejects.toThrow('Failed to index ANOTS codebase');
    });

    it('should handle git command errors', async () => {
      const invalidConfig = {
        ...config,
        repoUrl: 'invalid-url',
        localPath: join(tmpdir(), 'invalid-clone-path'),
      };

      const invalidConnector = new AnotsConnector(invalidConfig, memoryEngine);

      await expect(invalidConnector.cloneRepo()).rejects.toThrow('Failed to clone ANOTS repository');
    });

    it('should handle change listener errors', async () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      connector.onChangeDetected(errorListener);

      await connector.startMonitoring();

      // Should not throw when listener errors
      await writeFile(join(testRepoPath, 'error-test.ts'), 'content');
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('Multiple Listeners', () => {
    it('should notify all registered listeners', (done) => {
      let listener1Called = false;
      let listener2Called = false;

      connector.onChangeDetected(() => {
        listener1Called = true;
      });

      connector.onChangeDetected(() => {
        listener2Called = true;
        
        if (listener1Called && listener2Called) {
          done();
        }
      });

      void connector.startMonitoring().then(async () => {
        await writeFile(join(testRepoPath, 'multi-listener.ts'), 'content');
      });
    });
  });
});
