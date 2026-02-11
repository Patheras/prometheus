/**
 * Repository Context Management
 * 
 * Maintains clear repository context during operations to prevent
 * cross-repository contamination and ensure data isolation.
 */

import { MemoryEngine } from '../memory/engine';

export interface RepositoryContext {
  repoId: string;
  repoPath: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  url: string;
  currentBranch?: string;
  workingDirectory?: string;
  metadata?: Record<string, any>;
  enteredAt: number;
}

export interface ContextStackEntry {
  context: RepositoryContext;
  previousContext: RepositoryContext | null;
}

export interface ContextValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Repository Context Manager
 * 
 * Manages the current repository context and prevents accidental
 * cross-repository operations.
 */
export class RepositoryContextManager {
  private currentContext: RepositoryContext | null = null;
  private contextStack: ContextStackEntry[] = [];
  private contextHistory: RepositoryContext[] = [];
  private memoryEngine: MemoryEngine;
  private prometheusRepoPath: string;

  constructor(memoryEngine: MemoryEngine, prometheusRepoPath: string) {
    this.memoryEngine = memoryEngine;
    this.prometheusRepoPath = prometheusRepoPath;
  }

  /**
   * Set the current repository context
   */
  setContext(context: RepositoryContext): void {
    // Validate context
    const validation = this.validateContext(context);
    if (!validation.valid) {
      throw new Error(`Invalid context: ${validation.errors.join(', ')}`);
    }

    // Warn about potential issues
    if (validation.warnings.length > 0) {
      console.warn(`[Context] Warnings: ${validation.warnings.join(', ')}`);
    }

    // Save previous context
    const previousContext = this.currentContext;

    // Set new context
    this.currentContext = context;

    // Add to history
    this.contextHistory.push(context);

    // Limit history size
    if (this.contextHistory.length > 100) {
      this.contextHistory.shift();
    }

    console.log(`[Context] Switched to repository: ${context.repoId}`);
    if (previousContext) {
      console.log(`[Context] Previous: ${previousContext.repoId}`);
    }
  }

  /**
   * Push a new context onto the stack (for nested operations)
   */
  pushContext(context: RepositoryContext): void {
    const validation = this.validateContext(context);
    if (!validation.valid) {
      throw new Error(`Invalid context: ${validation.errors.join(', ')}`);
    }

    // Save current context to stack
    this.contextStack.push({
      context,
      previousContext: this.currentContext,
    });

    // Set new context
    this.currentContext = context;

    console.log(`[Context] Pushed context: ${context.repoId} (stack depth: ${this.contextStack.length})`);
  }

  /**
   * Pop the context stack and restore previous context
   */
  popContext(): RepositoryContext | null {
    if (this.contextStack.length === 0) {
      console.warn('[Context] Cannot pop: context stack is empty');
      return null;
    }

    const entry = this.contextStack.pop()!;
    const poppedContext = this.currentContext;

    // Restore previous context
    this.currentContext = entry.previousContext;

    console.log(`[Context] Popped context: ${entry.context.repoId} (stack depth: ${this.contextStack.length})`);
    if (this.currentContext) {
      console.log(`[Context] Restored: ${this.currentContext.repoId}`);
    }

    return poppedContext;
  }

  /**
   * Get the current repository context
   */
  getCurrentContext(): RepositoryContext | null {
    return this.currentContext;
  }

  /**
   * Get the current repository ID
   */
  getCurrentRepoId(): string | null {
    return this.currentContext?.repoId || null;
  }

  /**
   * Check if a repository is currently active
   */
  isActive(repoId: string): boolean {
    return this.currentContext?.repoId === repoId;
  }

  /**
   * Clear the current context
   */
  clearContext(): void {
    const previous = this.currentContext;
    this.currentContext = null;
    this.contextStack = [];

    if (previous) {
      console.log(`[Context] Cleared context: ${previous.repoId}`);
    }
  }

  /**
   * Validate a repository context
   */
  validateContext(context: RepositoryContext): ContextValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!context.repoId) {
      errors.push('repoId is required');
    }

    if (!context.repoPath) {
      errors.push('repoPath is required');
    }

    if (!context.provider) {
      errors.push('provider is required');
    }

    if (!context.url) {
      errors.push('url is required');
    }

    // Check for Prometheus repository
    if (context.repoPath === this.prometheusRepoPath) {
      warnings.push('Setting context to Prometheus repository - self-modifications should go through dev/prod workflow');
    }

    // Check for suspicious patterns
    if (context.repoId.includes('..') || context.repoPath.includes('..')) {
      errors.push('Path traversal detected in context');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Ensure a repository context is active
   */
  requireContext(): RepositoryContext {
    if (!this.currentContext) {
      throw new Error('No repository context is active. Call setContext() first.');
    }
    return this.currentContext;
  }

  /**
   * Ensure a specific repository is active
   */
  requireRepository(repoId: string): RepositoryContext {
    const context = this.requireContext();
    if (context.repoId !== repoId) {
      throw new Error(
        `Expected repository '${repoId}' but current context is '${context.repoId}'`
      );
    }
    return context;
  }

  /**
   * Execute a function with a specific repository context
   */
  async withContext<T>(
    context: RepositoryContext,
    fn: (context: RepositoryContext) => Promise<T>
  ): Promise<T> {
    this.pushContext(context);
    try {
      return await fn(context);
    } finally {
      this.popContext();
    }
  }

  /**
   * Execute a function with a temporary context
   */
  async withTemporaryContext<T>(
    repoId: string,
    repoPath: string,
    provider: 'github' | 'gitlab' | 'bitbucket',
    url: string,
    fn: (context: RepositoryContext) => Promise<T>
  ): Promise<T> {
    const context: RepositoryContext = {
      repoId,
      repoPath,
      provider,
      url,
      enteredAt: Date.now(),
    };

    return this.withContext(context, fn);
  }

  /**
   * Get context history
   */
  getHistory(): RepositoryContext[] {
    return [...this.contextHistory];
  }

  /**
   * Get recent contexts
   */
  getRecentContexts(limit: number = 10): RepositoryContext[] {
    return this.contextHistory.slice(-limit);
  }

  /**
   * Check if Prometheus repository is being modified
   */
  isModifyingPrometheus(): boolean {
    return this.currentContext?.repoPath === this.prometheusRepoPath;
  }

  /**
   * Prevent Prometheus repository modifications
   */
  preventPrometheusModification(): void {
    if (this.isModifyingPrometheus()) {
      throw new Error(
        'Cannot modify Prometheus repository directly. ' +
        'Self-improvements must go through the dev/prod workflow.'
      );
    }
  }

  /**
   * Get context statistics
   */
  getStatistics(): {
    currentRepo: string | null;
    stackDepth: number;
    historySize: number;
    recentRepos: string[];
  } {
    const recentRepos = this.getRecentContexts(5).map(c => c.repoId);
    const uniqueRepos = [...new Set(recentRepos)];

    return {
      currentRepo: this.getCurrentRepoId(),
      stackDepth: this.contextStack.length,
      historySize: this.contextHistory.length,
      recentRepos: uniqueRepos,
    };
  }

  /**
   * Create a context snapshot for debugging
   */
  createSnapshot(): {
    current: RepositoryContext | null;
    stack: ContextStackEntry[];
    history: RepositoryContext[];
    timestamp: number;
  } {
    return {
      current: this.currentContext ? { ...this.currentContext } : null,
      stack: this.contextStack.map(entry => ({
        context: { ...entry.context },
        previousContext: entry.previousContext ? { ...entry.previousContext } : null,
      })),
      history: this.contextHistory.map(c => ({ ...c })),
      timestamp: Date.now(),
    };
  }

  /**
   * Restore from a snapshot (for debugging/testing)
   */
  restoreSnapshot(snapshot: ReturnType<typeof this.createSnapshot>): void {
    this.currentContext = snapshot.current ? { ...snapshot.current } : null;
    this.contextStack = snapshot.stack.map(entry => ({
      context: { ...entry.context },
      previousContext: entry.previousContext ? { ...entry.previousContext } : null,
    }));
    this.contextHistory = snapshot.history.map(c => ({ ...c }));

    console.log('[Context] Restored from snapshot');
  }
}

/**
 * Context-aware operation wrapper
 * 
 * Ensures operations are executed with the correct repository context
 */
export class ContextAwareOperation<T> {
  private contextManager: RepositoryContextManager;
  private requiredRepoId?: string;

  constructor(contextManager: RepositoryContextManager, requiredRepoId?: string) {
    this.contextManager = contextManager;
    this.requiredRepoId = requiredRepoId;
  }

  /**
   * Execute operation with context validation
   */
  async execute(fn: (context: RepositoryContext) => Promise<T>): Promise<T> {
    // Ensure context is active
    const context = this.contextManager.requireContext();

    // Validate required repository
    if (this.requiredRepoId && context.repoId !== this.requiredRepoId) {
      throw new Error(
        `Operation requires repository '${this.requiredRepoId}' ` +
        `but current context is '${context.repoId}'`
      );
    }

    // Prevent Prometheus modifications
    this.contextManager.preventPrometheusModification();

    // Execute operation
    return await fn(context);
  }

  /**
   * Execute operation with automatic context setup
   */
  async executeWithContext(
    context: RepositoryContext,
    fn: (context: RepositoryContext) => Promise<T>
  ): Promise<T> {
    return this.contextManager.withContext(context, async (ctx) => {
      // Validate required repository
      if (this.requiredRepoId && ctx.repoId !== this.requiredRepoId) {
        throw new Error(
          `Operation requires repository '${this.requiredRepoId}' ` +
          `but provided context is '${ctx.repoId}'`
        );
      }

      // Prevent Prometheus modifications
      this.contextManager.preventPrometheusModification();

      return await fn(ctx);
    });
  }
}

/**
 * Context guard decorator
 * 
 * Ensures methods are called with the correct repository context
 */
export function requireContext(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: any, ...args: any[]) {
    if (!this.contextManager) {
      throw new Error('contextManager not found on instance');
    }

    const contextManager = this.contextManager as RepositoryContextManager;
    contextManager.requireContext();

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Prevent Prometheus modification decorator
 */
export function preventPrometheusModification(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: any, ...args: any[]) {
    if (!this.contextManager) {
      throw new Error('contextManager not found on instance');
    }

    const contextManager = this.contextManager as RepositoryContextManager;
    contextManager.preventPrometheusModification();

    return originalMethod.apply(this, args);
  };

  return descriptor;
}
