/**
 * Task Queue Types
 * 
 * Lane-based queue system for concurrent task execution with isolation.
 * Based on OpenClaw's proven lane queue pattern.
 */

/**
 * Entry in a lane queue
 */
export type QueueEntry = {
  /** Unique identifier for this queue entry */
  id: string;
  /** The task to execute */
  task: () => Promise<unknown>;
  /** Promise resolve function */
  resolve: (value: unknown) => void;
  /** Promise reject function */
  reject: (reason?: unknown) => void;
  /** Timestamp when task was enqueued */
  enqueuedAt: number;
  /** Warn if task waits longer than this (ms) */
  warnAfterMs: number;
  /** Optional callback when wait time exceeds threshold */
  onWait?: (waitMs: number, queuedAhead: number) => void;
};

/**
 * State of a single lane
 */
export type LaneState = {
  /** Lane identifier */
  lane: string;
  /** Queue of pending tasks */
  queue: QueueEntry[];
  /** Number of currently executing tasks */
  active: number;
  /** Maximum concurrent tasks allowed in this lane */
  maxConcurrent: number;
  /** Whether the lane is currently draining */
  draining: boolean;
};

/**
 * Lane status information
 */
export type LaneStatus = {
  /** Lane identifier */
  lane: string;
  /** Number of tasks in queue */
  queueDepth: number;
  /** Number of active tasks */
  activeCount: number;
  /** Maximum concurrent tasks */
  maxConcurrent: number;
  /** Average wait time (ms) */
  avgWaitTime: number;
  /** Is lane currently draining */
  isDraining: boolean;
};

/**
 * Options for enqueueing a task
 */
export type EnqueueOptions = {
  /** Warn if task waits longer than this (ms) */
  warnAfterMs?: number;
  /** Optional callback when wait time exceeds threshold */
  onWait?: (waitMs: number, queuedAhead: number) => void;
};

/**
 * Lane types for different operation categories
 */
export enum Lane {
  // Core lanes
  MAIN = 'main',
  ANALYSIS = 'analysis',
  DECISION = 'decision',
  EVOLUTION = 'evolution',
  
  // Resource-specific lane prefixes
  REPO_PREFIX = 'repo:',
  FILE_PREFIX = 'file:',
  DB_PREFIX = 'db:',
  
  // Integration lanes
  GITHUB = 'github',
  SUPABASE = 'supabase',
  MONITORING = 'monitoring',
  CI_CD = 'cicd',
}

/**
 * Default concurrency limits per lane type
 */
export const DEFAULT_LANE_CONCURRENCY: Record<string, number> = {
  [Lane.MAIN]: 4,
  [Lane.ANALYSIS]: 8,
  [Lane.DECISION]: 2,
  [Lane.EVOLUTION]: 1,  // Serial for self-modification safety
  [Lane.GITHUB]: 4,
  [Lane.SUPABASE]: 8,
  [Lane.MONITORING]: 4,
  [Lane.CI_CD]: 4,
};

/**
 * Default wait warning threshold (ms)
 */
export const DEFAULT_WARN_AFTER_MS = 5000;
