/**
 * Generic Repository Connector
 * 
 * Manages integration with any Git repository (GitHub, GitLab, Bitbucket):
 * - Clones and indexes any codebase
 * - Monitors for changes with delta sync
 * - Supports multiple repositories simultaneously
 * - Maintains repository context and separation
 */

import { MemoryEngine } from '../memory/engine';
import { exec } from 'child_process';
import { promisify } from 'util';
import { watch, FSWatcher } from 'fs';
import { join } from 'path';
import { stat, readdir } from 'fs/promises';

const execAsync = promisify(exec);

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'generic';

export interface RepositoryConfig {
  id: string; // Unique identifier for this repository
  name: string; // Human-readable name
  provider: GitProvider;
  repoUrl: string;
  localPath: string;
  branch?: string;
  pollInterval?: number; // ms
  credentials?: {
    username?: string;
    token?: string;
    sshKey?: string;
  };
  // Repository-specific settings
  profile?: RepositoryProfile;
}

export interface RepositoryProfile {
  branchingStrategy: 'git-flow' | 'github-flow' | 'trunk-based' | 'custom';
  mainBranch: string;
  developBranch?: string;
  featureBranchPrefix?: string;
  testCommand?: string;
  buildCommand?: string;
  lintCommand?: string;
  reviewRequired: boolean;
  autoMerge: boolean;
}

export interface RepoStatus {
  id: string;
  name: string;
  provider: GitProvider;
  isCloned: boolean;
  isIndexed: boolean;
  lastSync: number;
  currentBranch: string;
  commitHash: string;
  fileCount: number;
  remoteUrl: string;
}

export interface ChangeEvent {
  repoId: string;
  type: 'added' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
}

export class RepositoryConnector {
  private config: RepositoryConfig;
  private memoryEngine: MemoryEngine;
  private watcher?: FSWatcher;
  private pollTimer?: NodeJS.Timeout;
  private lastCommitHash?: string;
  private changeListeners: Array<(event: ChangeEvent) => void> = [];
  private isMonitoring: boolean = false;

  constructor(config: RepositoryConfig, memoryEngine: MemoryEngine) {
    this.config = {
      branch: config.profile?.mainBranch || 'main',
      pollInterval: 60000, // 1 minute default
      ...config,
    };
    this.memoryEngine = memoryEngine;
  }

  /**
   * Initialize the connector: clone if needed, index, and start monitoring
   */
  async initialize(): Promise<void> {
    console.log(`[${this.config.id}] Initializing repository connector for ${this.config.name}...`);

    // Ensure repo is cloned
    const isCloned = await this.isRepoCloned();
    if (!isCloned) {
      await this.cloneRepo();
    }

    // Index the codebase
    await this.indexCodebase();

    // Start monitoring for changes
    await this.startMonitoring();

    console.log(`[${this.config.id}] Repository connector initialized successfully`);
  }

  /**
   * Check if the repository is already cloned
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
   * Clone the repository
   */
  async cloneRepo(): Promise<void> {
    console.log(`[${this.config.id}] Cloning repository from ${this.config.repoUrl}...`);
    
    try {
      // Build clone command with credentials if provided
      const cloneUrl = this.buildAuthenticatedUrl();
      
      const { stderr } = await execAsync(
        `git clone --branch ${this.config.branch} ${cloneUrl} ${this.config.localPath}`
      );
      
      if (stderr && !stderr.includes('Cloning into')) {
        console.warn(`[${this.config.id}] Git clone warnings:`, stderr);
      }
      
      console.log(`[${this.config.id}] Repository cloned successfully`);
    } catch (error) {
      throw new Error(`[${this.config.id}] Failed to clone repository: ${error}`);
    }
  }

  /**
   * Build authenticated URL for git operations
   */
  private buildAuthenticatedUrl(): string {
    if (!this.config.credentials?.token) {
      return this.config.repoUrl;
    }

    // Parse URL and inject credentials
    const url = new URL(this.config.repoUrl);
    
    switch (this.config.provider) {
      case 'github':
        // GitHub: https://token@github.com/user/repo.git
        url.username = this.config.credentials.token;
        break;
      
      case 'gitlab':
        // GitLab: https://oauth2:token@gitlab.com/user/repo.git
        url.username = 'oauth2';
        url.password = this.config.credentials.token;
        break;
      
      case 'bitbucket':
        // Bitbucket: https://x-token-auth:token@bitbucket.org/user/repo.git
        url.username = 'x-token-auth';
        url.password = this.config.credentials.token;
        break;
      
      default:
        // Generic: use username and token if provided
        if (this.config.credentials.username) {
          url.username = this.config.credentials.username;
        }
        if (this.config.credentials.token) {
          url.password = this.config.credentials.token;
        }
    }

    return url.toString();
  }

  /**
   * Index the codebase using Memory Engine
   */
  async indexCodebase(): Promise<void> {
    console.log(`[${this.config.id}] Indexing codebase...`);
    
    try {
      await this.memoryEngine.indexCodebase(this.config.localPath);
      
      // Store current commit hash
      this.lastCommitHash = await this.getCurrentCommitHash();
      
      console.log(`[${this.config.id}] Codebase indexed successfully`);
    } catch (error) {
      throw new Error(`[${this.config.id}] Failed to index codebase: ${error}`);
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
      throw new Error(`[${this.config.id}] Failed to get commit hash: ${error}`);
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
      throw new Error(`[${this.config.id}] Failed to get current branch: ${error}`);
    }
  }

  /**
   * Start monitoring the repository for changes
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.warn(`[${this.config.id}] Already monitoring`);
      return;
    }

    // Start file system watcher for local changes
    this.startFileWatcher();

    // Start polling for remote changes
    this.startRemotePolling();

    this.isMonitoring = true;
    console.log(`[${this.config.id}] Started monitoring repository`);
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

        // Ignore common build/cache directories
        if (filename.includes('dist') || filename.includes('.next') || filename.includes('build')) {
          return;
        }

        const fullPath = join(this.config.localPath, filename);
        
        // Emit change event
        const event: ChangeEvent = {
          repoId: this.config.id,
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
        console.error(`[${this.config.id}] Error checking for remote changes:`, error);
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
        console.log(`[${this.config.id}] Remote changes detected, pulling...`);
        await this.pullChanges();
      }
    } catch (error) {
      console.error(`[${this.config.id}] Error checking remote changes:`, error);
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
        console.warn(`[${this.config.id}] Git pull warnings:`, stderr);
      }

      // Re-index after pulling
      await this.indexCodebase();

      console.log(`[${this.config.id}] Pulled and re-indexed repository`);
    } catch (error) {
      throw new Error(`[${this.config.id}] Failed to pull changes: ${error}`);
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
      console.error(`[${this.config.id}] Error handling file change for ${filePath}:`, error);
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<RepoStatus> {
    const isCloned = await this.isRepoCloned();
    
    if (!isCloned) {
      return {
        id: this.config.id,
        name: this.config.name,
        provider: this.config.provider,
        isCloned: false,
        isIndexed: false,
        lastSync: 0,
        currentBranch: '',
        commitHash: '',
        fileCount: 0,
        remoteUrl: this.config.repoUrl,
      };
    }

    const currentBranch = await this.getCurrentBranch();
    const commitHash = await this.getCurrentCommitHash();
    const fileCount = await this.countFiles();

    return {
      id: this.config.id,
      name: this.config.name,
      provider: this.config.provider,
      isCloned: true,
      isIndexed: true,
      lastSync: Date.now(),
      currentBranch,
      commitHash,
      fileCount,
      remoteUrl: this.config.repoUrl,
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
   * Create a new branch
   */
  async createBranch(branchName: string, baseBranch?: string): Promise<void> {
    try {
      const base = baseBranch || this.config.branch;
      
      // Ensure we're on the base branch
      await execAsync(`git checkout ${base}`, {
        cwd: this.config.localPath,
      });

      // Pull latest changes
      await execAsync(`git pull origin ${base}`, {
        cwd: this.config.localPath,
      });

      // Create and checkout new branch
      await execAsync(`git checkout -b ${branchName}`, {
        cwd: this.config.localPath,
      });

      console.log(`[${this.config.id}] Created branch: ${branchName}`);
    } catch (error) {
      throw new Error(`[${this.config.id}] Failed to create branch: ${error}`);
    }
  }

  /**
   * Commit changes
   */
  async commit(message: string, files?: string[]): Promise<void> {
    try {
      // Stage files
      if (files && files.length > 0) {
        for (const file of files) {
          await execAsync(`git add ${file}`, {
            cwd: this.config.localPath,
          });
        }
      } else {
        // Stage all changes
        await execAsync('git add .', {
          cwd: this.config.localPath,
        });
      }

      // Commit
      await execAsync(`git commit -m "${message}"`, {
        cwd: this.config.localPath,
      });

      console.log(`[${this.config.id}] Committed changes: ${message}`);
    } catch (error) {
      throw new Error(`[${this.config.id}] Failed to commit: ${error}`);
    }
  }

  /**
   * Push changes to remote
   */
  async push(branch?: string): Promise<void> {
    try {
      const targetBranch = branch || await this.getCurrentBranch();
      
      await execAsync(`git push origin ${targetBranch}`, {
        cwd: this.config.localPath,
      });

      console.log(`[${this.config.id}] Pushed changes to ${targetBranch}`);
    } catch (error) {
      throw new Error(`[${this.config.id}] Failed to push: ${error}`);
    }
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
        console.error(`[${this.config.id}] Error in change listener:`, error);
      }
    }
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

    this.isMonitoring = false;
    console.log(`[${this.config.id}] Stopped monitoring repository`);
  }

  /**
   * Get repository path
   */
  getRepoPath(): string {
    return this.config.localPath;
  }

  /**
   * Get repository ID
   */
  getRepoId(): string {
    return this.config.id;
  }

  /**
   * Get repository configuration
   */
  getConfig(): RepositoryConfig {
    return { ...this.config };
  }

  /**
   * Update repository profile
   */
  updateProfile(profile: Partial<RepositoryProfile>): void {
    this.config.profile = {
      ...this.config.profile,
      ...profile,
    } as RepositoryProfile;
  }
}
