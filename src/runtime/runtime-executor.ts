/**
 * Runtime Executor
 * 
 * Executes LLM requests with cascading fallback across models and auth profiles.
 * Handles error classification, auth rotation, and attempt tracking.
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { ModelRef, RuntimeRequest, RuntimeResponse, FallbackAttempt, StreamChunk } from '../types/index.js';
import { AuthProfileManager } from './auth-profile-manager.js';
import { classifyError, shouldFallback, shouldMarkAuthFailure } from './error-classifier.js';
import { buildFallbackChain, FallbackChainConfig } from './fallback-chain-builder.js';

/**
 * Configuration for runtime execution
 */
export type RuntimeExecutorConfig = {
  /** Auth profile manager for auth rotation */
  authManager: AuthProfileManager;
  
  /** Fallback chain configuration */
  fallbackConfig?: FallbackChainConfig;
  
  /** Function to call LLM (injected for testing) */
  llmCaller: LLMCaller;
  
  /** Function to call LLM with streaming (injected for testing) */
  llmStreamingCaller?: LLMStreamingCaller;
  
  /** Whether to track attempts for reporting */
  trackAttempts?: boolean;
};

/**
 * Function type for calling LLM providers
 */
export type LLMCaller = (
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
) => Promise<RuntimeResponse>;

/**
 * Function type for streaming LLM providers
 */
export type LLMStreamingCaller = (
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
) => AsyncIterableIterator<{ text: string }>;

/**
 * Error thrown when all fallback attempts are exhausted
 */
export class FallbackExhaustedError extends Error {
  constructor(
    public readonly attempts: FallbackAttempt[],
    public readonly primaryModel: ModelRef
  ) {
    super(
      `All fallback attempts exhausted for ${primaryModel.provider}:${primaryModel.model}. ` +
      `Tried ${attempts.length} models: ${attempts.map(a => `${a.provider}:${a.model}`).join(', ')}`
    );
    this.name = 'FallbackExhaustedError';
  }
}

/**
 * Error thrown when user aborts the operation
 */
export class UserAbortError extends Error {
  constructor(message: string = 'Operation aborted by user') {
    super(message);
    this.name = 'UserAbortError';
  }
}

/**
 * RuntimeExecutor handles LLM request execution with cascading fallback
 */
export class RuntimeExecutor {
  private config: RuntimeExecutorConfig;
  private activeStreams: Map<string, AbortController>;
  
  constructor(config: RuntimeExecutorConfig) {
    this.config = config;
    this.activeStreams = new Map();
  }
  
  /**
   * Execute a runtime request with cascading fallback
   * 
   * Execution flow:
   * 1. Build fallback chain from primary model
   * 2. For each model in chain:
   *    a. Get available auth profile
   *    b. Attempt LLM call
   *    c. On success: mark auth success and return
   *    d. On failure: classify error
   *    e. If user abort: rethrow immediately
   *    f. If recoverable: mark auth failure (if needed) and try next
   * 3. If all attempts fail: throw FallbackExhaustedError
   * 
   * @param request Runtime request to execute
   * @returns Runtime response from successful model
   * @throws UserAbortError if user aborts
   * @throws FallbackExhaustedError if all fallbacks fail
   */
  async execute(request: RuntimeRequest): Promise<RuntimeResponse> {
    const primaryModel = request.model || { provider: 'anthropic', model: 'claude-sonnet-4' };
    const fallbackChain = buildFallbackChain(primaryModel, this.config.fallbackConfig);
    const attempts: FallbackAttempt[] = [];
    
    for (const model of fallbackChain) {
      try {
        // Get available auth profile for this provider
        const authProfile = this.config.authManager.getAvailableProfile(model.provider);
        
        if (!authProfile) {
          // No auth profile available - record attempt and continue
          attempts.push({
            provider: model.provider,
            model: model.model,
            error: 'No available auth profile',
            reason: 'auth'
          });
          continue;
        }
        
        // Attempt LLM call
        const response = await this.config.llmCaller(request, model, authProfile.apiKey);
        
        // Success! Mark auth profile as successful
        this.config.authManager.markSuccess(authProfile.id);
        
        return response;
        
      } catch (error) {
        // Check if this is a user abort
        if (this.isUserAbort(error)) {
          throw new UserAbortError(error instanceof Error ? error.message : 'User aborted');
        }
        
        // Classify the error
        const reason = classifyError(error instanceof Error ? error : new Error(String(error)));
        
        // Record attempt
        if (this.config.trackAttempts !== false) {
          attempts.push({
            provider: model.provider,
            model: model.model,
            error: error instanceof Error ? error.message : String(error),
            reason
          });
        }
        
        // Mark auth failure if appropriate
        if (shouldMarkAuthFailure(reason)) {
          const authProfile = this.config.authManager.getAvailableProfile(model.provider);
          if (authProfile) {
            this.config.authManager.markFailure(authProfile.id);
          }
        }
        
        // Check if we should attempt fallback
        if (!shouldFallback(reason)) {
          // Non-recoverable error - throw immediately
          throw error;
        }
        
        // Continue to next model in fallback chain
        continue;
      }
    }
    
    // All attempts failed
    throw new FallbackExhaustedError(attempts, primaryModel);
  }
  
  /**
   * Execute a runtime request with a specific model (no fallback)
   * 
   * This is useful for testing or when you want to force a specific model
   * without fallback behavior.
   * 
   * @param request Runtime request to execute
   * @param model Specific model to use
   * @returns Runtime response
   */
  async executeWithModel(request: RuntimeRequest, model: ModelRef): Promise<RuntimeResponse> {
    const authProfile = this.config.authManager.getAvailableProfile(model.provider);
    
    if (!authProfile) {
      throw new Error(`No available auth profile for provider: ${model.provider}`);
    }
    
    try {
      const response = await this.config.llmCaller(request, model, authProfile.apiKey);
      this.config.authManager.markSuccess(authProfile.id);
      return response;
    } catch (error) {
      // Check if this is a user abort
      if (this.isUserAbort(error)) {
        throw new UserAbortError(error instanceof Error ? error.message : 'User aborted');
      }
      
      // Classify and mark auth failure if needed
      const reason = classifyError(error instanceof Error ? error : new Error(String(error)));
      if (shouldMarkAuthFailure(reason)) {
        this.config.authManager.markFailure(authProfile.id);
      }
      
      throw error;
    }
  }
  
  /**
   * Execute a streaming request with cascading fallback
   * 
   * Returns an async iterator that yields StreamChunk objects as results become available.
   * Supports abort signals for cancellation.
   * 
   * Requirements: 9.1, 9.2
   * 
   * @param request Runtime request to execute
   * @param streamId Optional stream ID for tracking (generated if not provided)
   * @returns Async iterator of stream chunks
   */
  async *executeStreaming(
    request: RuntimeRequest,
    streamId?: string
  ): AsyncIterableIterator<StreamChunk> {
    const id = streamId || this.generateStreamId();
    const abortController = new AbortController();
    
    // Track this stream
    this.activeStreams.set(id, abortController);
    
    try {
      // Check if streaming caller is available
      if (!this.config.llmStreamingCaller) {
        throw new Error('Streaming caller not configured');
      }
      
      const primaryModel = request.model || { provider: 'anthropic', model: 'claude-sonnet-4' };
      const fallbackChain = buildFallbackChain(primaryModel, this.config.fallbackConfig);
      const attempts: FallbackAttempt[] = [];
      
      // Try each model in the fallback chain
      for (const model of fallbackChain) {
        try {
          // Get available auth profile for this provider
          const authProfile = this.config.authManager.getAvailableProfile(model.provider);
          
          if (!authProfile) {
            // No auth profile available - record attempt and continue
            attempts.push({
              provider: model.provider,
              model: model.model,
              error: 'No available auth profile',
              reason: 'auth'
            });
            continue;
          }
          
          // Attempt streaming LLM call
          const stream = this.config.llmStreamingCaller(
            request,
            model,
            authProfile.apiKey,
            abortController.signal
          );
          
          // Stream chunks
          for await (const chunk of stream) {
            yield {
              type: 'content',
              content: chunk.text,
              model
            };
          }
          
          // Success! Mark auth profile as successful
          this.config.authManager.markSuccess(authProfile.id);
          
          // Yield done chunk
          yield {
            type: 'done',
            model
          };
          
          return;
          
        } catch (error) {
          // Check if this is a user abort
          if (this.isUserAbort(error) || this.isAbortError(error)) {
            yield {
              type: 'aborted',
              reason: 'user_cancelled'
            };
            return;
          }
          
          // Classify the error
          const reason = classifyError(error instanceof Error ? error : new Error(String(error)));
          
          // Record attempt
          if (this.config.trackAttempts !== false) {
            attempts.push({
              provider: model.provider,
              model: model.model,
              error: error instanceof Error ? error.message : String(error),
              reason
            });
          }
          
          // Mark auth failure if appropriate
          if (shouldMarkAuthFailure(reason)) {
            const authProfile = this.config.authManager.getAvailableProfile(model.provider);
            if (authProfile) {
              this.config.authManager.markFailure(authProfile.id);
            }
          }
          
          // Check if we should attempt fallback
          if (!shouldFallback(reason)) {
            // Non-recoverable error - yield error and return
            yield {
              type: 'error',
              error: error instanceof Error ? error.message : String(error)
            };
            return;
          }
          
          // Continue to next model in fallback chain
          continue;
        }
      }
      
      // All attempts failed
      yield {
        type: 'error',
        error: `All fallback attempts exhausted. Tried ${attempts.length} models: ${attempts.map(a => `${a.provider}:${a.model}`).join(', ')}`
      };
      
    } finally {
      // Clean up stream tracking
      this.activeStreams.delete(id);
    }
  }
  
  /**
   * Abort a streaming request
   * 
   * Cancels the LLM request gracefully and cleans up resources.
   * 
   * Requirements: 9.2
   * 
   * @param streamId Stream ID to abort
   * @returns True if stream was found and aborted, false otherwise
   */
  abortStream(streamId: string): boolean {
    const abortController = this.activeStreams.get(streamId);
    
    if (abortController) {
      abortController.abort();
      this.activeStreams.delete(streamId);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get all active stream IDs
   * 
   * @returns Array of active stream IDs
   */
  getActiveStreamIds(): string[] {
    return Array.from(this.activeStreams.keys());
  }
  
  /**
   * Check if a stream is active
   * 
   * @param streamId Stream ID to check
   * @returns True if stream is active
   */
  isStreamActive(streamId: string): boolean {
    return this.activeStreams.has(streamId);
  }
  
  /**
   * Check if an error represents a user abort
   * 
   * User abort errors should skip fallback and be rethrown immediately.
   * Common patterns:
   * - Error message contains "abort", "cancel", "user cancel"
   * - Error name is "AbortError"
   * - Error is an instance of AbortError or UserAbortError
   * 
   * @param error Error to check
   * @returns True if this is a user abort error
   */
  private isUserAbort(error: unknown): boolean {
    if (error instanceof UserAbortError) {
      return true;
    }
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const name = error.name.toLowerCase();
      
      return (
        name === 'aborterror' ||
        name === 'userabort' ||
        message.includes('abort') ||
        message.includes('cancel') ||
        message.includes('user cancel')
      );
    }
    
    return false;
  }
  
  /**
   * Check if an error is an AbortError from AbortController
   * 
   * @param error Error to check
   * @returns True if this is an AbortError
   */
  private isAbortError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'AbortError';
    }
    return false;
  }
  
  /**
   * Generate a unique stream ID
   * 
   * @returns Unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Get the auth manager
   * @returns Auth profile manager
   */
  getAuthManager(): AuthProfileManager {
    return this.config.authManager;
  }
  
  /**
   * Update the fallback configuration
   * @param config New fallback configuration
   */
  updateFallbackConfig(config: FallbackChainConfig): void {
    this.config.fallbackConfig = config;
  }
}

/**
 * Create a runtime executor with default configuration
 * 
 * @param authManager Auth profile manager
 * @param llmCaller Function to call LLM
 * @param fallbackConfig Optional fallback configuration
 * @returns Runtime executor instance
 */
export function createRuntimeExecutor(
  authManager: AuthProfileManager,
  llmCaller: LLMCaller,
  fallbackConfig?: FallbackChainConfig
): RuntimeExecutor {
  return new RuntimeExecutor({
    authManager,
    llmCaller,
    fallbackConfig,
    trackAttempts: true
  });
}
