/**
 * Queued Memory Engine
 * 
 * Wraps Memory Engine operations with lane-based queueing for:
 * - Race condition prevention
 * - Concurrency control
 * - Resource isolation
 * 
 * Task 24.1: Wire Memory Engine operations through queue
 */

import { IMemoryEngine } from './engine';
import { enqueueInLane, Lane } from '../queue';
import {
  CodeFile,
  Decision,
  Metric,
  MetricQuery,
  MetricResult,
  Pattern,
  PatternOutcome,
  SearchOptions,
  SearchResult,
} from './types';

/**
 * Queued Memory Engine
 * 
 * Wraps a Memory Engine instance and routes all operations through
 * appropriate lanes for concurrency control and race condition prevention.
 * 
 * Lane Strategy:
 * - Indexing operations: repo-specific lanes (repo:repoName)
 * - Search operations: analysis lane (concurrent)
 * - Decision storage: decision lane (moderate concurrency)
 * - Metric storage: main lane (concurrent)
 * - Pattern storage: main lane (concurrent)
 */
export class QueuedMemoryEngine implements IMemoryEngine {
  constructor(private engine: IMemoryEngine) {}

  // ========== Codebase Memory Operations ==========

  /**
   * Index a codebase repository (queued in repo-specific lane)
   * 
   * Serializes indexing per repository to prevent race conditions
   * on file metadata and chunk updates.
   */
  async indexCodebase(repoPath: string): Promise<void> {
    const repoName = this.extractRepoName(repoPath);
    const lane = `${Lane.REPO_PREFIX}${repoName}`;
    
    return enqueueInLane(
      () => this.engine.indexCodebase(repoPath),
      lane,
      { warnAfterMs: 30000 } // Indexing can take time
    );
  }

  /**
   * Search code (queued in analysis lane)
   * 
   * Allows concurrent searches across different queries.
   */
  async searchCode(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return enqueueInLane(
      () => this.engine.searchCode(query, options),
      Lane.ANALYSIS,
      { warnAfterMs: 10000 }
    );
  }

  /**
   * Get file metadata (queued in analysis lane)
   * 
   * Read-only operation, safe to run concurrently.
   */
  async getFileMetadata(path: string): Promise<CodeFile | null> {
    return enqueueInLane(
      () => this.engine.getFileMetadata(path),
      Lane.ANALYSIS
    );
  }

  // ========== Decision Memory Operations ==========

  /**
   * Store a decision (queued in decision lane)
   * 
   * Moderate concurrency for decision storage.
   */
  async storeDecision(decision: Omit<Decision, 'id'>): Promise<string> {
    return enqueueInLane(
      () => this.engine.storeDecision(decision),
      Lane.DECISION
    );
  }

  /**
   * Update decision outcome (queued in decision lane)
   * 
   * Serializes updates to same decision.
   */
  async updateDecisionOutcome(
    id: string,
    outcome: string,
    lessonsLearned: string
  ): Promise<void> {
    return enqueueInLane(
      () => this.engine.updateDecisionOutcome(id, outcome, lessonsLearned),
      Lane.DECISION
    );
  }

  /**
   * Search decisions (queued in analysis lane)
   * 
   * Read-only search, safe to run concurrently.
   */
  async searchDecisions(
    query: string,
    options?: SearchOptions & {
      outcome?: 'success' | 'failure' | 'null';
      startTime?: number;
      endTime?: number;
    }
  ): Promise<SearchResult[]> {
    return enqueueInLane(
      () => this.engine.searchDecisions(query, options),
      Lane.ANALYSIS
    );
  }

  // ========== Metric Memory Operations ==========

  /**
   * Store metrics (queued in main lane)
   * 
   * Batch metric insertion with moderate concurrency.
   */
  async storeMetrics(metrics: Metric[]): Promise<void> {
    return enqueueInLane(
      () => this.engine.storeMetrics(metrics),
      Lane.MAIN
    );
  }

  /**
   * Query metrics (queued in analysis lane)
   * 
   * Read-only query, safe to run concurrently.
   */
  async queryMetrics(query: MetricQuery): Promise<MetricResult[]> {
    return enqueueInLane(
      () => this.engine.queryMetrics(query),
      Lane.ANALYSIS
    );
  }

  // ========== Pattern Memory Operations ==========

  /**
   * Store a pattern (queued in main lane)
   * 
   * Pattern storage with moderate concurrency.
   */
  async storePattern(pattern: Omit<Pattern, 'id'>): Promise<string> {
    return enqueueInLane(
      () => this.engine.storePattern(pattern),
      Lane.MAIN
    );
  }

  /**
   * Update pattern outcome (queued in main lane)
   * 
   * Updates pattern success/failure counts.
   */
  async updatePatternOutcome(id: string, outcome: PatternOutcome): Promise<void> {
    return enqueueInLane(
      () => this.engine.updatePatternOutcome(id, outcome),
      Lane.MAIN
    );
  }

  /**
   * Search patterns (queued in analysis lane)
   * 
   * Read-only search, safe to run concurrently.
   */
  async searchPatterns(
    query: string,
    options?: SearchOptions & {
      category?: string;
      minSuccessRate?: number;
    }
  ): Promise<SearchResult[]> {
    return enqueueInLane(
      () => this.engine.searchPatterns(query, options),
      Lane.ANALYSIS
    );
  }

  // ========== Unified Search ==========

  /**
   * Unified search across all memory sources (queued in analysis lane)
   * 
   * Searches code, decisions, and patterns concurrently.
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return enqueueInLane(
      () => this.engine.search(query, options),
      Lane.ANALYSIS,
      { warnAfterMs: 15000 } // Unified search can take time
    );
  }

  // ========== Database Access ==========

  /**
   * Get underlying database (not queued - for direct access)
   * 
   * WARNING: Direct database access bypasses queue protection!
   * Use only for read-only operations or when you know what you're doing.
   */
  getDatabase(): any {
    return this.engine.getDatabase();
  }

  /**
   * Close database connection (not queued)
   */
  async close(): Promise<void> {
    return this.engine.close();
  }

  // ========== Helper Methods ==========

  /**
   * Extract repository name from path
   * 
   * Examples:
   * - "/path/to/my-repo" -> "my-repo"
   * - "my-repo" -> "my-repo"
   * - "/path/to/my-repo/" -> "my-repo"
   */
  private extractRepoName(repoPath: string): string {
    // Remove trailing slash
    const normalized = repoPath.replace(/\/$/, '');
    
    // Get last path component
    const parts = normalized.split('/');
    return parts[parts.length - 1] || 'default';
  }
}

/**
 * Create a queued memory engine
 * 
 * @param engine Memory engine instance to wrap
 * @returns Queued memory engine
 */
export function createQueuedMemoryEngine(engine: IMemoryEngine): QueuedMemoryEngine {
  return new QueuedMemoryEngine(engine);
}
