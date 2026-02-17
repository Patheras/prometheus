/**
 * Repository Manager
 * 
 * Manages multiple repository connectors simultaneously:
 * - Supports multiple repositories (ANOTS, other projects)
 * - Maintains repository context and isolation
 * - Prevents cross-repository contamination
 * - Provides unified interface for repository operations
 */

import { RepositoryConnector, RepositoryConfig, RepoStatus, ChangeEvent, RepositoryProfile } from './repository-connector';
import { RepositoryContextManager, RepositoryContext } from './repository-context';
import { RepositoryProfileManager } from './repository-profiles';
import { RepositoryPatternTracker } from './repository-pattern-tracker';
import { MemoryEngine } from '../memory/engine';

export interface RepositoryManagerConfig {
  prometheusRepoPath: string; // Path to Prometheus own repository (for separation)
}

export class RepositoryManager {
  private connectors: Map<string, RepositoryConnector> = new Map();
  private memoryEngine: MemoryEngine;
  private prometheusRepoPath: string;
  private contextManager: RepositoryContextManager;
  private profileManager: RepositoryProfileManager;
  private patternTrackers: Map<string, RepositoryPatternTracker> = new Map();
  private repositoryIndices: Map<string, string> = new Map(); // repoId -> index namespace

  constructor(memoryEngine: MemoryEngine, config: RepositoryManagerConfig) {
    this.memoryEngine = memoryEngine;
    this.prometheusRepoPath = config.prometheusRepoPath;
    this.contextManager = new RepositoryContextManager(memoryEngine, config.prometheusRepoPath);
    this.profileManager = new RepositoryProfileManager(memoryEngine);
  }

  /**
   * Initialize all repository connectors
   */
  async initializeAll(): Promise<void> {
    if (this.connectors.size === 0) {
      console.log('No repositories to initialize');
      return;
    }

    console.log(`Initializing ${this.connectors.size} repository connectors...`);

    const promises: Promise<void>[] = [];

    for (const [id, connector] of this.connectors) {
      promises.push(
        connector.initialize().catch((error) => {
          console.error(`Failed to initialize repository ${id}:`, error);
          throw error;
        })
      );
    }

    await Promise.all(promises);

    console.log('All repository connectors initialized successfully');
  }

  /**
   * Add a new repository
   */
  async addRepository(config: RepositoryConfig): Promise<void> {
    if (this.connectors.has(config.id)) {
      throw new Error(`Repository with ID ${config.id} already exists`);
    }

    console.log(`Adding new repository: ${config.name} (${config.id})`);

    // Create connector
    const connector = new RepositoryConnector(config, this.memoryEngine);
    this.connectors.set(config.id, connector);

    // Create isolated index namespace
    this.repositoryIndices.set(config.id, `repo:${config.id}`);

    // Create pattern tracker
    const patternTracker = new RepositoryPatternTracker(config.id, this.memoryEngine);
    this.patternTrackers.set(config.id, patternTracker);

    // Initialize the new connector
    await connector.initialize();

    console.log(`Repository ${config.name} added successfully with isolated index`);
  }

  /**
   * Remove a repository
   */
  async removeRepository(repoId: string): Promise<void> {
    const connector = this.connectors.get(repoId);
    
    if (!connector) {
      throw new Error(`Repository ${repoId} not found`);
    }

    console.log(`Removing repository: ${repoId}`);

    // Stop monitoring
    await connector.stop();

    // Remove from connectors
    this.connectors.delete(repoId);

    // Remove index namespace
    this.repositoryIndices.delete(repoId);

    // Remove pattern tracker
    this.patternTrackers.delete(repoId);

    // Clear context if this was the current repository
    if (this.contextManager.getCurrentRepoId() === repoId) {
      this.contextManager.clearContext();
    }

    console.log(`Repository ${repoId} removed successfully`);
  }

  /**
   * Get a repository connector by ID
   */
  getRepository(repoId: string): RepositoryConnector {
    const connector = this.connectors.get(repoId);
    
    if (!connector) {
      throw new Error(`Repository ${repoId} not found`);
    }

    return connector;
  }

  /**
   * Get all repository IDs
   */
  getRepositoryIds(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Get all repository statuses
   */
  async getAllStatuses(): Promise<RepoStatus[]> {
    const statuses: RepoStatus[] = [];

    for (const connector of this.connectors.values()) {
      const status = await connector.getStatus();
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Set current repository context
   * This ensures operations are performed on the correct repository
   */
  setCurrentRepository(repoId: string): void {
    const connector = this.getRepository(repoId);
    
    const context: RepositoryContext = {
      repoId,
      repoPath: connector.getRepoPath(),
      provider: connector.getConfig().provider as 'github' | 'gitlab' | 'bitbucket',
      url: connector.getConfig().repoUrl,
      enteredAt: Date.now(),
    };

    this.contextManager.setContext(context);
    console.log(`Repository context set to: ${repoId}`);
  }

  /**
   * Get current repository context
   */
  getCurrentRepository(): string | null {
    return this.contextManager.getCurrentRepoId();
  }

  /**
   * Clear repository context
   */
  clearCurrentRepository(): void {
    this.contextManager.clearContext();
    console.log('Repository context cleared');
  }

  /**
   * Get context manager
   */
  getContextManager(): RepositoryContextManager {
    return this.contextManager;
  }

  /**
   * Get profile manager
   */
  getProfileManager(): RepositoryProfileManager {
    return this.profileManager;
  }

  /**
   * Get pattern tracker for repository
   */
  getPatternTracker(repoId: string): RepositoryPatternTracker {
    const tracker = this.patternTrackers.get(repoId);
    if (!tracker) {
      throw new Error(`Pattern tracker not found for repository: ${repoId}`);
    }
    return tracker;
  }

  /**
   * Verify repository separation
   * Ensures we're not accidentally modifying Prometheus own repository
   * or crossing repository boundaries
   */
  verifyRepositorySeparation(targetPath: string, expectedRepoId?: string): boolean {
    // Normalize paths for comparison
    const normalizedTarget = targetPath.toLowerCase().replace(/\\/g, '/');
    const normalizedPrometheus = this.prometheusRepoPath.toLowerCase().replace(/\\/g, '/');

    // Check if target is in Prometheus repo (should never modify this)
    if (normalizedTarget.startsWith(normalizedPrometheus)) {
      console.error('SECURITY: Attempted to modify Prometheus repository!');
      return false;
    }

    // If expected repo is specified, verify target is in that repo
    if (expectedRepoId) {
      const connector = this.connectors.get(expectedRepoId);
      if (!connector) {
        console.error(`Repository ${expectedRepoId} not found`);
        return false;
      }

      const repoPath = connector.getRepoPath().toLowerCase().replace(/\\/g, '/');
      if (!normalizedTarget.startsWith(repoPath)) {
        console.error(`Target path is not in repository ${expectedRepoId}`);
        return false;
      }
    }

    // Verify target is in at least one managed repository
    let isInManagedRepo = false;
    for (const connector of this.connectors.values()) {
      const repoPath = connector.getRepoPath().toLowerCase().replace(/\\/g, '/');
      if (normalizedTarget.startsWith(repoPath)) {
        isInManagedRepo = true;
        break;
      }
    }

    if (!isInManagedRepo) {
      console.error('Target path is not in any managed repository');
      return false;
    }

    return true;
  }

  /**
   * Get repository ID from file path
   */
  getRepositoryIdFromPath(filePath: string): string | undefined {
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

    for (const [id, connector] of this.connectors) {
      const repoPath = connector.getRepoPath().toLowerCase().replace(/\\/g, '/');
      if (normalizedPath.startsWith(repoPath)) {
        return id;
      }
    }

    return undefined;
  }

  /**
   * Register a global change listener for all repositories
   */
  onAnyRepositoryChange(listener: (event: ChangeEvent) => void): void {
    for (const connector of this.connectors.values()) {
      connector.onChangeDetected(listener);
    }
  }

  /**
   * Update repository profile
   */
  updateRepositoryProfile(repoId: string, profile: Partial<RepositoryProfile>): void {
    const connector = this.getRepository(repoId);
    connector.updateProfile(profile);
    console.log(`Updated profile for repository: ${repoId}`);
  }

  /**
   * Stop all repository connectors
   */
  async stopAll(): Promise<void> {
    console.log('Stopping all repository connectors...');

    const promises: Promise<void>[] = [];

    for (const connector of this.connectors.values()) {
      promises.push(connector.stop());
    }

    await Promise.all(promises);

    console.log('All repository connectors stopped');
  }

  /**
   * Get repository count
   */
  getRepositoryCount(): number {
    return this.connectors.size;
  }

  /**
   * Check if repository exists
   */
  hasRepository(repoId: string): boolean {
    return this.connectors.has(repoId);
  }

  /**
   * Get repository index namespace
   */
  getRepositoryIndexNamespace(repoId: string): string {
    const namespace = this.repositoryIndices.get(repoId);
    if (!namespace) {
      throw new Error(`Index namespace not found for repository: ${repoId}`);
    }
    return namespace;
  }

  /**
   * Execute operation with repository isolation
   */
  async withRepositoryIsolation<T>(
    repoId: string,
    operation: (connector: RepositoryConnector) => Promise<T>
  ): Promise<T> {
    const connector = this.getRepository(repoId);
    
    // Set context
    const context: RepositoryContext = {
      repoId,
      repoPath: connector.getRepoPath(),
      provider: connector.getConfig().provider as 'github' | 'gitlab' | 'bitbucket',
      url: connector.getConfig().repoUrl,
      enteredAt: Date.now(),
    };

    // Execute with context isolation
    return this.contextManager.withContext(context, async () => {
      return await operation(connector);
    });
  }

  /**
   * Get repository statistics
   */
  getStatistics(): {
    totalRepositories: number;
    activeRepositories: number;
    currentRepository: string | null;
    repositories: Array<{
      id: string;
      name: string;
      status: string;
      hasProfile: boolean;
      hasPatterns: boolean;
    }>;
  } {
    const repositories = [];

    for (const [id, connector] of this.connectors) {
      repositories.push({
        id,
        name: connector.getConfig().name,
        status: 'active', // Would need to check actual status
        hasProfile: this.profileManager.getProfile(id) !== null,
        hasPatterns: this.patternTrackers.has(id),
      });
    }

    return {
      totalRepositories: this.connectors.size,
      activeRepositories: this.connectors.size,
      currentRepository: this.contextManager.getCurrentRepoId(),
      repositories,
    };
  }

  /**
   * Validate repository isolation
   * Ensures no cross-repository contamination
   */
  async validateIsolation(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check that each repository has its own index namespace
    for (const [repoId, _connector] of this.connectors) {
      const namespace = this.repositoryIndices.get(repoId);
      if (!namespace) {
        issues.push(`Repository ${repoId} missing index namespace`);
      }

      // Check for pattern tracker
      if (!this.patternTrackers.has(repoId)) {
        issues.push(`Repository ${repoId} missing pattern tracker`);
      }
    }

    // Check for namespace collisions
    const namespaces = Array.from(this.repositoryIndices.values());
    const uniqueNamespaces = new Set(namespaces);
    if (namespaces.length !== uniqueNamespaces.size) {
      issues.push('Duplicate index namespaces detected');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Switch between repositories
   */
  async switchRepository(fromRepoId: string, toRepoId: string): Promise<void> {
    // Validate both repositories exist
    this.getRepository(fromRepoId);
    this.getRepository(toRepoId);

    console.log(`Switching repository context from ${fromRepoId} to ${toRepoId}`);

    // Clear current context
    this.contextManager.clearContext();

    // Set new context
    this.setCurrentRepository(toRepoId);

    console.log(`Successfully switched to repository: ${toRepoId}`);
  }

  /**
   * Get all repositories with their contexts
   */
  getAllRepositories(): Array<{
    id: string;
    name: string;
    path: string;
    provider: string;
    url: string;
    isActive: boolean;
  }> {
    const repositories = [];

    for (const [id, connector] of this.connectors) {
      const config = connector.getConfig();
      repositories.push({
        id,
        name: config.name,
        path: connector.getRepoPath(),
        provider: config.provider,
        url: config.repoUrl,
        isActive: this.contextManager.isActive(id),
      });
    }

    return repositories;
  }
}
