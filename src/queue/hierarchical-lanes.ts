/**
 * Hierarchical Lane Composition
 * 
 * Supports nested lane queueing without deadlocks.
 * Based on OpenClaw's hierarchical composition pattern.
 */

import { enqueueInLane } from './lane-queue';
import { EnqueueOptions } from './types';

/**
 * Enqueue a task that itself enqueues work in another lane
 * 
 * This pattern allows safe hierarchical composition:
 * - Outer task in one lane
 * - Inner task in another lane
 * - No deadlock risk
 * 
 * Example:
 * ```typescript
 * // Session lane → Global lane hierarchy
 * await enqueueNested(
 *   'session:user123',
 *   'main',
 *   async () => doBackgroundWork()
 * );
 * ```
 * 
 * @param outerLane - Lane for outer task
 * @param innerLane - Lane for inner task
 * @param innerTask - Task to execute in inner lane
 * @param outerOptions - Options for outer lane
 * @param innerOptions - Options for inner lane
 * @returns Promise that resolves when inner task completes
 */
export async function enqueueNested<T>(
  outerLane: string,
  innerLane: string,
  innerTask: () => Promise<T>,
  outerOptions?: EnqueueOptions,
  innerOptions?: EnqueueOptions
): Promise<T> {
  // Outer task enqueues inner task
  return enqueueInLane(
    async () => {
      // Inner task executes in different lane
      return enqueueInLane(innerTask, innerLane, innerOptions);
    },
    outerLane,
    outerOptions
  );
}

/**
 * Create a lane hierarchy builder
 * 
 * Allows fluent API for building lane hierarchies:
 * ```typescript
 * await laneHierarchy()
 *   .in('session:user123')
 *   .then('main')
 *   .execute(async () => doWork());
 * ```
 */
export class LaneHierarchyBuilder<T = unknown> {
  private lanes: string[] = [];
  private options: EnqueueOptions[] = [];

  /**
   * Add a lane to the hierarchy
   */
  in(lane: string, options?: EnqueueOptions): this {
    this.lanes.push(lane);
    this.options.push(options || {});
    return this;
  }

  /**
   * Add another lane to the hierarchy (alias for `in`)
   */
  then(lane: string, options?: EnqueueOptions): this {
    return this.in(lane, options);
  }

  /**
   * Execute task through the lane hierarchy
   */
  async execute(task: () => Promise<T>): Promise<T> {
    if (this.lanes.length === 0) {
      throw new Error('No lanes specified in hierarchy');
    }

    // Build nested enqueue calls from innermost to outermost
    let currentTask = task;
    
    for (let i = this.lanes.length - 1; i >= 0; i--) {
      const lane = this.lanes[i];
      const opts = this.options[i];
      const taskToWrap = currentTask;
      
      currentTask = () => enqueueInLane(taskToWrap, lane, opts);
    }

    return currentTask();
  }
}

/**
 * Create a new lane hierarchy builder
 */
export function laneHierarchy<T = unknown>(): LaneHierarchyBuilder<T> {
  return new LaneHierarchyBuilder<T>();
}

/**
 * Common lane hierarchy patterns
 */
export const LaneHierarchies = {
  /**
   * Session → Main hierarchy
   * 
   * Serializes per session, caps global concurrency
   */
  sessionToMain: (sessionKey: string) => ({
    enqueue: <T>(task: () => Promise<T>, options?: EnqueueOptions) =>
      enqueueNested(`session:${sessionKey}`, 'main', task, options),
  }),

  /**
   * Repository → Analysis hierarchy
   * 
   * Serializes per repository, allows concurrent analysis
   */
  repoToAnalysis: (repoName: string) => ({
    enqueue: <T>(task: () => Promise<T>, options?: EnqueueOptions) =>
      enqueueNested(`repo:${repoName}`, 'analysis', task, options),
  }),

  /**
   * File → Repository hierarchy
   * 
   * Serializes per file, then per repository
   */
  fileToRepo: (filePath: string, repoName: string) => ({
    enqueue: <T>(task: () => Promise<T>, options?: EnqueueOptions) =>
      laneHierarchy<T>()
        .in(`file:${filePath}`)
        .then(`repo:${repoName}`)
        .execute(task),
  }),
};

/**
 * Deadlock prevention utilities
 */
export const DeadlockPrevention = {
  /**
   * Check if lane hierarchy would create a cycle
   * 
   * @param lanes - Array of lane names in hierarchy order
   * @returns true if hierarchy is safe (no cycles)
   */
  isSafeHierarchy: (lanes: string[]): boolean => {
    // Check for duplicate lanes (would create cycle)
    const uniqueLanes = new Set(lanes);
    return uniqueLanes.size === lanes.length;
  },

  /**
   * Validate lane hierarchy before execution
   * 
   * @param lanes - Array of lane names in hierarchy order
   * @throws Error if hierarchy would create deadlock
   */
  validateHierarchy: (lanes: string[]): void => {
    if (!DeadlockPrevention.isSafeHierarchy(lanes)) {
      const duplicates = lanes.filter(
        (lane, index) => lanes.indexOf(lane) !== index
      );
      throw new Error(
        `Lane hierarchy contains cycles: ${duplicates.join(', ')}`
      );
    }
  },
};
