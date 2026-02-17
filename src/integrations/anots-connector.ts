/**
 * ANOTS Repository Connector
 * 
 * Manages integration with the ANOTS development repository:
 * - Clones and indexes ANOTS codebase
 * - Monitors for changes
 * - Maintains separation from Prometheus repository
 */

import { MemoryEngine } from '../memory/engine';
import { exec } from 'child_process';
import { promisify } from 'util';
import { watch, FSWatcher } from 'fs';
import { join } from 'path';
import { stat, readdir } from 'fs/promises';

const execAsync = promisify(exec);

export interface AnotsConnectorConfig {
  repoUrl: string;
  localPath: string;
  prometheusRepoPath: string;
  branch?: string;
  pollInterval?: number; // ms
}

export interface RepoStatus {
  isCloned: boolean;
  isIndexed: boolean;
  lastSync: number;
  currentBranch: string;
  commitHash: string;
  fileCount: number;
}

export interface ChangeEvent {
  type: 'added' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
}

export class AnotsConnector {
  private config: AnotsConnectorConfig;
  private memoryEngine: MemoryEngine;
  private watcher?: FSWatcher;
  private pollTimer?: NodeJS.Timeout;
  private lastCommitHash?: string;
  private changeListeners: Array<(event: ChangeEvent) => void> = [];

  constructor(config: AnotsConnectorConfig, memoryEngine: MemoryEngine) {
    this.config = {
      branch: 'main',
      pollInterval: 60000, // 1 minute default
      ...config,
    };
    this.memoryEngine = memoryEngine;
  }

  /**
   * Initialize the connector: clone if needed, index, and start monitoring
   */
  async initialize(): Promise<void> {
    // Ensure ANOTS repo is cloned
    const isCloned = await this.isRepoCloned();
    if (!isCloned) {
      await this.cloneRepo();
    }

    // Index the codebase
    await this.indexCodebase();

    // Start monitoring for changes
    await this.startMonitoring();
  }

  /**
   * Check if the ANOTS repository is already cloned
   */
  private async isRepoCloned(): Promise<boolean> {
    try {
      const gitDir = join(this.config.localPath, '.git');
      const stats = await stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Clone the ANOTS repository
   */
  async cloneRepo(): Promise<void> {
    console.log(`Cloning ANOTS repository from ${this.config.repoUrl}...`);
    
    try {
      const { stderr } = await execAsync(
        `git clone --branch ${this.config.branch} ${this.config.repoUrl} ${this.config.localPath}`
      );
      
      if (stderr && !stderr.includes('Cloning into')) {
        console.warn('Git clone warnings:', stderr);
      }
      
      console.log('ANOTS repository cloned successfully');
    } catch (error) {
      throw new Error(`Failed to clone ANOTS repository: ${error}`);
    }
  }

  /**
   * Index the ANOTS codebase using Memory Engine
   */
  async indexCodebase(): Promise<void> {
    console.log('Indexing ANOTS codebase...');
    
    try {
      await this.memoryEngine.indexCodebase(this.config.localPath);
      
      // Store current commit hash
      this.lastCommitHash = await this.getCurrentCommitHash();
      
      console.log('ANOTS codebase indexed successfully');
    } catch (error) {
      throw new Error(`Failed to index ANOTS codebase: ${error}`);
    }
  }

  /**
   * Get current commit hash
   */
  private async getCurrentCommitHash(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: this.config.localPath,
      });
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get commit hash: ${error}`);
    }
  }

  /**
   * Get current branch name
   */
  private async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: this.config.localPath,
      });
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`);
    }
  }

  /**
   * Start monitoring the repository for changes
   */
  async startMonitoring(): Promise<void> {
    // Start file system watcher for local changes
    this.startFileWatcher();

    // Start polling for remote changes
    this.startRemotePolling();

    console.log('Started monitoring ANOTS repository');
  }

  /**
   * Start file system watcher for local changes
   */
  private startFileWatcher(): void {
    this.watcher = watch(
      this.config.localPath,
      { recursive: true },
      (eventType, filename) => {
        if (!filename) return;

        // Ignore .git directory changes
        if (filename.includes('.git')) return;

        // Ignore node_modules
        if (filename.includes('node_modules')) return;

        const fullPath = join(this.config.localPath, filename);
        
        // Emit change event
        const event: ChangeEvent = {
          type: eventType === 'rename' ? 'modified' : 'modified',
          path: fullPath,
          timestamp: Date.now(),
        };

        this.notifyChangeListeners(event);

        // Trigger incremental index update
        void this.handleFileChange(fullPath);
      }
    );
  }

  /**
   * Start polling for remote repository changes
   */
  private startRemotePolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        await this.checkForRemoteChanges();
      } catch (error) {
        console.error('Error checking for remote changes:', error);
      }
    }, this.config.pollInterval);
  }

  /**
   * Check for remote repository changes
   */
  private async checkForRemoteChanges(): Promise<void> {
    try {
      // Fetch latest changes
      await execAsync('git fetch origin', {
        cwd: this.config.localPath,
      });

      // Get remote commit hash
      const { stdout } = await execAsync(
        `git rev-parse origin/${this.config.branch}`,
        { cwd: this.config.localPath }
      );
      const remoteHash = stdout.trim();

      // Check if there are new commits
      if (remoteHash !== this.lastCommitHash) {
        console.log('Remote changes detected, pulling...');
        await this.pullChanges();
      }
    } catch (error) {
      console.error('Error checking remote changes:', error);
    }
  }

  /**
   * Pull changes from remote repository
   */
  async pullChanges(): Promise<void> {
    try {
      const { stderr } = await execAsync(
        `git pull origin ${this.config.branch}`,
        { cwd: this.config.localPath }
      );

      if (stderr && !stderr.includes('Already up to date')) {
        console.warn('Git pull warnings:', stderr);
      }

      // Re-index after pulling
      await this.indexCodebase();

      console.log('Pulled and re-indexed ANOTS repository');
    } catch (error) {
      throw new Error(`Failed to pull changes: ${error}`);
    }
  }

  /**
   * Handle individual file change
   */
  private async handleFileChange(filePath: string): Promise<void> {
    try {
      // Use delta sync to update only this file
      await this.memoryEngine.indexCodebase(this.config.localPath);
    } catch (error) {
      console.error(`Error handling file change for ${filePath}:`, error);
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<RepoStatus> {
    const isCloned = await this.isRepoCloned();
    
    if (!isCloned) {
      return {
        isCloned: false,
        isIndexed: false,
        lastSync: 0,
        currentBranch: '',
        commitHash: '',
        fileCount: 0,
      };
    }

    const currentBranch = await this.getCurrentBranch();
    const commitHash = await this.getCurrentCommitHash();
    const fileCount = await this.countFiles();

    return {
      isCloned: true,
      isIndexed: true,
      lastSync: Date.now(),
      currentBranch,
      commitHash,
      fileCount,
    };
  }

  /**
   * Count files in repository
   */
  private async countFiles(): Promise<number> {
    let count = 0;

    async function countRecursive(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip .git and node_modules
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }

        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await countRecursive(fullPath);
        } else {
          count++;
        }
      }
    }

    await countRecursive(this.config.localPath);
    return count;
  }

  /**
   * Register a change listener
   */
  onChangeDetected(listener: (event: ChangeEvent) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(event: ChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in change listener:', error);
      }
    }
  }

  /**
   * Verify repository separation (ensure we're not modifying Prometheus repo)
   */
  verifyRepositorySeparation(targetPath: string): boolean {
    // Normalize paths for comparison
    const normalizedTarget = targetPath.toLowerCase().replace(/\\/g, '/');
    const normalizedAnots = this.config.localPath.toLowerCase().replace(/\\/g, '/');
    const normalizedPrometheus = this.config.prometheusRepoPath.toLowerCase().replace(/\\/g, '/');

    // Check if target is in ANOTS repo
    const isAnotsRepo = normalizedTarget.startsWith(normalizedAnots);

    // Check if target is in Prometheus repo
    const isPrometheusRepo = normalizedTarget.startsWith(normalizedPrometheus);

    // Should be in ANOTS repo and NOT in Prometheus repo
    return isAnotsRepo && !isPrometheusRepo;
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    console.log('Stopped monitoring ANOTS repository');
  }

  /**
   * Get repository path
   */
  getRepoPath(): string {
    return this.config.localPath;
  }
}
