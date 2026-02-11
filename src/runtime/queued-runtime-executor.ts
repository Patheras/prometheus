/**
 * Queued Runtime Executor
 * 
 * Wraps Runtime Executor operations with lane-based queueing for:
 * - LLM call concurrency control
 * - Provider-specific rate limiting
 * - Model-specific serialization
 * 
 * Task 24.2: Wire Runtime Engine operations through queue
 */

import { RuntimeExecutor } from './runtime-executor';
import { enqueueInLane, Lane } from '../queue';
import {
  RuntimeRequest,
  RuntimeResponse,
  RuntimeConfig,
  ModelRef,
} from './types';

/**
 * Queued Runtime Executor
 * 
 * Wraps a Runtime Executor instance and routes all LLM calls through
 * appropriate lanes for concurrency control and rate limiting.
 * 
 * Lane Strategy:
 * - LLM calls: provider-specific lanes (llm:provider)
 * - Streaming calls: provider-specific lanes (llm:provider)
 * - Allows concurrent calls to different providers
 * - Serializes calls to same provider (respects rate limits)
 */
export class QueuedRuntimeExecutor {
  constructor(private executor: RuntimeExecutor) {}

  /**
   * Execute LLM request (queued by provider)
   * 
   * Routes requests to provider-specific lanes to:
   * - Respect provider rate limits
   * - Allow concurrent calls to different providers
   * - Serialize calls to same provider
   */
  async execute(request: RuntimeRequest): Promise<RuntimeResponse> {
    const provider = this.getProviderFromRequest(request);
    const lane = `llm:${provider}`;
    
    return enqueueInLane(
      () => this.executor.execute(request),
      lane,
      { warnAfterMs: 30000 } // LLM calls can take time
    );
  }

  /**
   * Execute streaming LLM request (queued by provider)
   * 
   * Routes streaming requests to provider-specific lanes.
   */
  async *executeStreaming(
    request: RuntimeRequest
  ): AsyncGenerator<RuntimeResponse, void, unknown> {
    const provider = this.getProviderFromRequest(request);
    const lane = `llm:${provider}`;
    
    // Queue the streaming operation
    const generator = await enqueueInLane(
      () => this.executor.executeStreaming(request),
      lane,
      { warnAfterMs: 30000 }
    );
    
    // Yield results from the generator
    for await (const response of generator) {
      yield response;
    }
  }

  /**
   * Abort a streaming request (not queued - immediate)
   * 
   * Abort operations should be immediate, not queued.
   */
  abortStream(streamId: string): boolean {
    return this.executor.abortStream(streamId);
  }

  /**
   * Get active stream IDs (not queued - read-only)
   */
  getActiveStreamIds(): string[] {
    return this.executor.getActiveStreamIds();
  }

  /**
   * Check if stream is active (not queued - read-only)
   */
  isStreamActive(streamId: string): boolean {
    return this.executor.isStreamActive(streamId);
  }

  /**
   * Get configuration (not queued - read-only)
   */
  getConfig(): RuntimeConfig {
    return this.executor.getConfig();
  }

  /**
   * Update configuration (not queued - immediate)
   * 
   * Configuration updates should be immediate.
   */
  updateConfig(config: Partial<RuntimeConfig>): void {
    this.executor.updateConfig(config);
  }

  // ========== Helper Methods ==========

  /**
   * Extract provider from request
   * 
   * Uses model override if present, otherwise uses task type preferences.
   */
  private getProviderFromRequest(request: RuntimeRequest): string {
    // Check for model override
    if (request.modelOverride) {
      return request.modelOverride.provider;
    }
    
    // Use task type to determine provider
    const config = this.executor.getConfig();
    const taskType = request.taskType || 'general';
    
    // Get model preferences for task type
    const preferences = config.modelPreferences?.[taskType];
    if (preferences && preferences.length > 0) {
      return preferences[0].provider;
    }
    
    // Default to anthropic
    return 'anthropic';
  }
}

/**
 * Create a queued runtime executor
 * 
 * @param executor Runtime executor instance to wrap
 * @returns Queued runtime executor
 */
export function createQueuedRuntimeExecutor(
  executor: RuntimeExecutor
): QueuedRuntimeExecutor {
  return new QueuedRuntimeExecutor(executor);
}

/**
 * Lane-based LLM call tracking
 * 
 * Provides utilities for tracking LLM calls per provider/model.
 */
export class LLMCallTracker {
  private callCounts = new Map<string, number>();
  private lastCallTime = new Map<string, number>();

  /**
   * Track an LLM call
   */
  trackCall(provider: string, model: string): void {
    const key = `${provider}:${model}`;
    this.callCounts.set(key, (this.callCounts.get(key) || 0) + 1);
    this.lastCallTime.set(key, Date.now());
  }

  /**
   * Get call count for provider/model
   */
  getCallCount(provider: string, model: string): number {
    const key = `${provider}:${model}`;
    return this.callCounts.get(key) || 0;
  }

  /**
   * Get last call time for provider/model
   */
  getLastCallTime(provider: string, model: string): number | null {
    const key = `${provider}:${model}`;
    return this.lastCallTime.get(key) || null;
  }

  /**
   * Get all tracked providers/models
   */
  getAllTracked(): Array<{ provider: string; model: string; count: number; lastCall: number }> {
    const results: Array<{ provider: string; model: string; count: number; lastCall: number }> = [];
    
    for (const [key, count] of this.callCounts.entries()) {
      const [provider, model] = key.split(':');
      const lastCall = this.lastCallTime.get(key) || 0;
      results.push({ provider, model, count, lastCall });
    }
    
    return results;
  }

  /**
   * Reset tracking
   */
  reset(): void {
    this.callCounts.clear();
    this.lastCallTime.clear();
  }
}
