/**
 * Lane-Based Queue System
 * 
 * Implements lane-based task queueing with concurrency control.
 * Based on OpenClaw's proven lane queue pattern.
 * 
 * Key Features:
 * - Lane isolation prevents race conditions
 * - Configurable concurrency per lane
 * - Pump-based self-draining
 * - Wait time monitoring
 * - Error resilience
 */

import { randomUUID } from 'crypto';
import {
  QueueEntry,
  LaneState,
  LaneStatus,
  EnqueueOptions,
  Lane,
  DEFAULT_LANE_CONCURRENCY,
  DEFAULT_WARN_AFTER_MS,
} from './types';

/**
 * Lane state storage
 */
const lanes = new Map<string, LaneState>();

/**
 * Get or create lane state
 */
function getLaneState(lane: string): LaneState {
  if (!lanes.has(lane)) {
    // Determine default concurrency for this lane
    let maxConcurrent = 1; // Serial by default
    
    // Check if lane matches a known type
    if (lane in DEFAULT_LANE_CONCURRENCY) {
      maxConcurrent = DEFAULT_LANE_CONCURRENCY[lane];
    } else {
      // Check if lane starts with a known prefix
      for (const [key, value] of Object.entries(DEFAULT_LANE_CONCURRENCY)) {
        if (lane.startsWith(key)) {
          maxConcurrent = value;
          break;
        }
      }
    }
    
    const state: LaneState = {
      lane,
      queue: [],
      active: 0,
      maxConcurrent,
      draining: false,
    };
    
    lanes.set(lane, state);
  }
  
  return lanes.get(lane)!;
}

/**
 * Enqueue a task in a specific lane
 * 
 * @param task - Async function to execute
 * @param lane - Lane identifier
 * @param options - Enqueue options
 * @returns Promise that resolves when task completes
 */
export async function enqueueInLane<T>(
  task: () => Promise<T>,
  lane: string,
  options: EnqueueOptions = {}
): Promise<T> {
  const state = getLaneState(lane);
  const warnAfterMs = options.warnAfterMs ?? DEFAULT_WARN_AFTER_MS;
  
  return new Promise<T>((resolve, reject) => {
    const entry: QueueEntry = {
      id: randomUUID(),
      task: task as () => Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
      enqueuedAt: Date.now(),
      warnAfterMs,
      onWait: options.onWait,
    };
    
    state.queue.push(entry);
    drainLane(lane);
  });
}

/**
 * Enqueue a task in the default main lane
 * 
 * @param task - Async function to execute
 * @param options - Enqueue options
 * @returns Promise that resolves when task completes
 */
export async function enqueue<T>(
  task: () => Promise<T>,
  options: EnqueueOptions = {}
): Promise<T> {
  return enqueueInLane(task, Lane.MAIN, options);
}

/**
 * Drain tasks from a lane (pump mechanism)
 * 
 * Executes tasks up to maxConcurrent limit.
 * Recursively drains on task completion.
 * Handles errors without blocking queue.
 */
function drainLane(lane: string): void {
  const state = getLaneState(lane);
  
  // Prevent concurrent draining
  if (state.draining) {
    return;
  }
  
  state.draining = true;
  
  try {
    // Pump: drain tasks up to concurrency limit
    while (state.active < state.maxConcurrent && state.queue.length > 0) {
      const entry = state.queue.shift()!;
      
      // Check wait time
      const waitedMs = Date.now() - entry.enqueuedAt;
      if (waitedMs >= entry.warnAfterMs) {
        entry.onWait?.(waitedMs, state.queue.length);
        console.warn(
          `Lane wait exceeded: lane=${lane} waitedMs=${waitedMs} queueAhead=${state.queue.length}`
        );
      }
      
      // Execute task asynchronously
      state.active += 1;
      
      void (async () => {
        try {
          const result = await entry.task();
          state.active -= 1;
          drainLane(lane); // Recursively drain next task
          entry.resolve(result);
        } catch (err) {
          state.active -= 1;
          drainLane(lane); // Drain even on error
          entry.reject(err);
        }
      })();
    }
  } finally {
    state.draining = false;
  }
}

/**
 * Set concurrency limit for a lane
 * 
 * @param lane - Lane identifier
 * @param maxConcurrent - Maximum concurrent tasks (minimum 1)
 */
export function setLaneConcurrency(lane: string, maxConcurrent: number): void {
  const state = getLaneState(lane);
  state.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
  drainLane(lane); // Trigger drain in case queue was blocked
}

/**
 * Get status of a lane
 * 
 * @param lane - Lane identifier
 * @returns Lane status information
 */
export function getLaneStatus(lane: string): LaneStatus {
  const state = getLaneState(lane);
  
  // Calculate average wait time
  let avgWaitTime = 0;
  if (state.queue.length > 0) {
    const now = Date.now();
    const totalWait = state.queue.reduce(
      (sum, entry) => sum + (now - entry.enqueuedAt),
      0
    );
    avgWaitTime = totalWait / state.queue.length;
  }
  
  return {
    lane: state.lane,
    queueDepth: state.queue.length,
    activeCount: state.active,
    maxConcurrent: state.maxConcurrent,
    avgWaitTime,
    isDraining: state.draining,
  };
}

/**
 * Get queue depth for a lane
 * 
 * @param lane - Lane identifier
 * @returns Number of tasks in queue
 */
export function getQueueDepth(lane: string): number {
  const state = getLaneState(lane);
  return state.queue.length;
}

/**
 * Get active task count for a lane
 * 
 * @param lane - Lane identifier
 * @returns Number of currently executing tasks
 */
export function getActiveCount(lane: string): number {
  const state = getLaneState(lane);
  return state.active;
}

/**
 * Get average wait time for a lane
 * 
 * @param lane - Lane identifier
 * @returns Average wait time in milliseconds
 */
export function getWaitTime(lane: string): number {
  return getLaneStatus(lane).avgWaitTime;
}

/**
 * Drain all pending tasks in a lane
 * 
 * Waits for all queued and active tasks to complete.
 * 
 * @param lane - Lane identifier
 * @returns Promise that resolves when lane is empty
 */
export async function drainLaneCompletely(lane: string): Promise<void> {
  const state = getLaneState(lane);
  
  // Wait until queue is empty and no active tasks
  while (state.queue.length > 0 || state.active > 0) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Get all lane names
 * 
 * @returns Array of lane identifiers
 */
export function getAllLanes(): string[] {
  return Array.from(lanes.keys());
}

/**
 * Clear all lanes (for testing)
 * 
 * WARNING: This will reject all pending tasks!
 */
export function clearAllLanes(): void {
  for (const state of lanes.values()) {
    // Reject all pending tasks
    for (const entry of state.queue) {
      entry.reject(new Error('Lane cleared'));
    }
    state.queue = [];
    state.active = 0;
  }
  lanes.clear();
}
