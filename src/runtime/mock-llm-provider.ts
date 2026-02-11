/**
 * Mock LLM Provider for Testing
 * 
 * Provides deterministic responses, simulates various error conditions,
 * and tracks API call counts for testing the Runtime Engine.
 * 
 * Requirements: 6.1, 7.1, 7.2, 9.1
 */

import { ModelRef, RuntimeRequest, RuntimeResponse } from '../types/index.js';

/**
 * Configuration for mock LLM provider behavior
 */
export type MockLLMConfig = {
  /** Default response text */
  defaultResponse?: string;
  
  /** Delay in ms before responding (simulates network latency) */
  responseDelay?: number;
  
  /** Error to throw (if any) */
  errorToThrow?: Error;
  
  /** Error condition based on model */
  errorConditions?: Map<string, Error>;
  
  /** Response overrides per model */
  responseOverrides?: Map<string, string>;
  
  /** Whether to track call counts */
  trackCalls?: boolean;
  
  /** Maximum calls before failing (for testing exhaustion) */
  maxCalls?: number;
  
  /** Simulate rate limiting after N calls */
  rateLimitAfter?: number;
  
  /** Simulate auth failures for specific API keys */
  failingApiKeys?: Set<string>;
  
  /** Simulate context window errors for large prompts */
  contextWindowLimit?: number;
};

/**
 * Call statistics for tracking
 */
export type CallStats = {
  totalCalls: number;
  callsByProvider: Map<string, number>;
  callsByModel: Map<string, number>;
  callsByApiKey: Map<string, number>;
  errors: Array<{ model: ModelRef; error: Error; timestamp: number }>;
  successfulCalls: Array<{ model: ModelRef; timestamp: number }>;
};

/**
 * Mock LLM Provider for testing
 * 
 * Provides deterministic responses and simulates various error conditions
 * to test Runtime Engine behavior including fallback, auth rotation, and
 * error handling.
 */
export class MockLLMProvider {
  private config: MockLLMConfig;
  private stats: CallStats;
  private callCount: number;
  
  constructor(config: MockLLMConfig = {}) {
    this.config = {
      defaultResponse: 'Mock LLM response',
      responseDelay: 0,
      trackCalls: true,
      ...config
    };
    
    this.stats = {
      totalCalls: 0,
      callsByProvider: new Map(),
      callsByModel: new Map(),
      callsByApiKey: new Map(),
      errors: [],
      successfulCalls: []
    };
    
    this.callCount = 0;
  }
  
  /**
   * Call the mock LLM provider
   * 
   * Simulates LLM API call with configurable behavior:
   * - Returns deterministic responses
   * - Simulates various error conditions
   * - Tracks call statistics
   * - Respects abort signals
   * 
   * @param request Runtime request
   * @param model Model to use
   * @param apiKey API key for authentication
   * @param signal Optional abort signal
   * @returns Runtime response
   */
  async call(
    request: RuntimeRequest,
    model: ModelRef,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<RuntimeResponse> {
    // Check if aborted before starting
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }
    
    // Increment call count
    this.callCount++;
    
    // Track statistics
    if (this.config.trackCalls) {
      this.stats.totalCalls++;
      this.stats.callsByProvider.set(
        model.provider,
        (this.stats.callsByProvider.get(model.provider) || 0) + 1
      );
      this.stats.callsByModel.set(
        `${model.provider}:${model.model}`,
        (this.stats.callsByModel.get(`${model.provider}:${model.model}`) || 0) + 1
      );
      this.stats.callsByApiKey.set(
        apiKey,
        (this.stats.callsByApiKey.get(apiKey) || 0) + 1
      );
    }
    
    // Check for max calls limit
    if (this.config.maxCalls && this.callCount > this.config.maxCalls) {
      const error = new Error('Maximum calls exceeded');
      this.recordError(model, error);
      throw error;
    }
    
    // Check for rate limiting
    if (this.config.rateLimitAfter && this.callCount > this.config.rateLimitAfter) {
      const error = new Error('Rate limit exceeded. Please try again later.');
      this.recordError(model, error);
      throw error;
    }
    
    // Check for failing API keys
    if (this.config.failingApiKeys?.has(apiKey)) {
      const error = new Error('Invalid API key or unauthorized access');
      this.recordError(model, error);
      throw error;
    }
    
    // Check for context window limit
    if (this.config.contextWindowLimit !== undefined) {
      const estimatedTokens = Math.ceil((request.prompt.length + request.context.length) / 4);
      if (estimatedTokens > this.config.contextWindowLimit) {
        const error = new Error(
          `Context window exceeded: ${estimatedTokens} tokens > ${this.config.contextWindowLimit} limit`
        );
        this.recordError(model, error);
        throw error;
      }
    }
    
    // Check for model-specific error conditions
    const modelKey = `${model.provider}:${model.model}`;
    if (this.config.errorConditions?.has(modelKey)) {
      const error = this.config.errorConditions.get(modelKey)!;
      this.recordError(model, error);
      throw error;
    }
    
    // Check for global error
    if (this.config.errorToThrow) {
      this.recordError(model, this.config.errorToThrow);
      throw this.config.errorToThrow;
    }
    
    // Simulate network delay
    if (this.config.responseDelay && this.config.responseDelay > 0) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, this.config.responseDelay);
        
        // Handle abort during delay
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Request aborted'));
          });
        }
      });
    }
    
    // Check if aborted after delay
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }
    
    // Get response text
    let responseText = this.config.defaultResponse || 'Mock LLM response';
    
    // Check for model-specific response override
    if (this.config.responseOverrides?.has(modelKey)) {
      responseText = this.config.responseOverrides.get(modelKey)!;
    }
    
    // Record successful call
    this.recordSuccess(model);
    
    // Return response
    return {
      content: responseText,
      model,
      usage: {
        promptTokens: Math.ceil((request.prompt.length + request.context.length) / 4),
        completionTokens: Math.ceil(responseText.length / 4),
        totalTokens: Math.ceil((request.prompt.length + request.context.length + responseText.length) / 4)
      },
      finishReason: 'stop'
    };
  }
  
  /**
   * Call the mock LLM provider with streaming
   * 
   * Simulates streaming LLM API call with configurable behavior.
   * Yields chunks of text incrementally.
   * 
   * @param request Runtime request
   * @param model Model to use
   * @param apiKey API key for authentication
   * @param signal Optional abort signal
   * @returns Async iterator of text chunks
   */
  async *callStreaming(
    request: RuntimeRequest,
    model: ModelRef,
    apiKey: string,
    signal?: AbortSignal
  ): AsyncIterableIterator<{ text: string }> {
    // Check if aborted before starting
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }
    
    // Increment call count
    this.callCount++;
    
    // Track statistics
    if (this.config.trackCalls) {
      this.stats.totalCalls++;
      this.stats.callsByProvider.set(
        model.provider,
        (this.stats.callsByProvider.get(model.provider) || 0) + 1
      );
      this.stats.callsByModel.set(
        `${model.provider}:${model.model}`,
        (this.stats.callsByModel.get(`${model.provider}:${model.model}`) || 0) + 1
      );
      this.stats.callsByApiKey.set(
        apiKey,
        (this.stats.callsByApiKey.get(apiKey) || 0) + 1
      );
    }
    
    // Check for max calls limit
    if (this.config.maxCalls && this.callCount > this.config.maxCalls) {
      const error = new Error('Maximum calls exceeded');
      this.recordError(model, error);
      throw error;
    }
    
    // Check for rate limiting
    if (this.config.rateLimitAfter && this.callCount > this.config.rateLimitAfter) {
      const error = new Error('Rate limit exceeded. Please try again later.');
      this.recordError(model, error);
      throw error;
    }
    
    // Check for failing API keys
    if (this.config.failingApiKeys?.has(apiKey)) {
      const error = new Error('Invalid API key or unauthorized access');
      this.recordError(model, error);
      throw error;
    }
    
    // Check for context window limit
    if (this.config.contextWindowLimit !== undefined) {
      const estimatedTokens = Math.ceil((request.prompt.length + request.context.length) / 4);
      if (estimatedTokens > this.config.contextWindowLimit) {
        const error = new Error(
          `Context window exceeded: ${estimatedTokens} tokens > ${this.config.contextWindowLimit} limit`
        );
        this.recordError(model, error);
        throw error;
      }
    }
    
    // Check for model-specific error conditions
    const modelKey = `${model.provider}:${model.model}`;
    if (this.config.errorConditions?.has(modelKey)) {
      const error = this.config.errorConditions.get(modelKey)!;
      this.recordError(model, error);
      throw error;
    }
    
    // Check for global error
    if (this.config.errorToThrow) {
      this.recordError(model, this.config.errorToThrow);
      throw this.config.errorToThrow;
    }
    
    // Get response text
    let responseText = this.config.defaultResponse || 'Mock LLM response';
    
    // Check for model-specific response override
    if (this.config.responseOverrides?.has(modelKey)) {
      responseText = this.config.responseOverrides.get(modelKey)!;
    }
    
    // Split response into chunks (simulate streaming)
    const words = responseText.split(' ');
    const chunkSize = Math.max(1, Math.floor(words.length / 5)); // ~5 chunks
    
    for (let i = 0; i < words.length; i += chunkSize) {
      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }
      
      // Simulate delay between chunks
      if (this.config.responseDelay && this.config.responseDelay > 0) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, this.config.responseDelay / 5);
          
          // Handle abort during delay
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Request aborted'));
            });
          }
        });
      }
      
      // Yield chunk
      const chunk = words.slice(i, i + chunkSize).join(' ');
      yield { text: i === 0 ? chunk : ' ' + chunk };
    }
    
    // Record successful call
    this.recordSuccess(model);
  }
  
  /**
   * Get call statistics
   * 
   * @returns Call statistics
   */
  getStats(): CallStats {
    return {
      ...this.stats,
      callsByProvider: new Map(this.stats.callsByProvider),
      callsByModel: new Map(this.stats.callsByModel),
      callsByApiKey: new Map(this.stats.callsByApiKey),
      errors: [...this.stats.errors],
      successfulCalls: [...this.stats.successfulCalls]
    };
  }
  
  /**
   * Reset call statistics
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      callsByProvider: new Map(),
      callsByModel: new Map(),
      callsByApiKey: new Map(),
      errors: [],
      successfulCalls: []
    };
    this.callCount = 0;
  }
  
  /**
   * Update configuration
   * 
   * @param config New configuration (merged with existing)
   */
  updateConfig(config: Partial<MockLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   * 
   * @returns Current configuration
   */
  getConfig(): MockLLMConfig {
    return { ...this.config };
  }
  
  /**
   * Record an error
   * 
   * @param model Model that errored
   * @param error Error that occurred
   */
  private recordError(model: ModelRef, error: Error): void {
    if (this.config.trackCalls) {
      this.stats.errors.push({
        model,
        error,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Record a successful call
   * 
   * @param model Model that succeeded
   */
  private recordSuccess(model: ModelRef): void {
    if (this.config.trackCalls) {
      this.stats.successfulCalls.push({
        model,
        timestamp: Date.now()
      });
    }
  }
}

/**
 * Create a mock LLM provider with default configuration
 * 
 * @param config Optional configuration
 * @returns Mock LLM provider instance
 */
export function createMockLLMProvider(config?: MockLLMConfig): MockLLMProvider {
  return new MockLLMProvider(config);
}

/**
 * Create error conditions for testing fallback scenarios
 */
export function createErrorConditions(): {
  authError: Error;
  billingError: Error;
  contextError: Error;
  timeoutError: Error;
  rateLimitError: Error;
  unavailableError: Error;
  unknownError: Error;
} {
  const authError = new Error('Invalid API key or unauthorized access');
  const billingError = new Error('Insufficient quota or billing issue');
  const contextError = new Error('Context window exceeded: 150000 tokens > 128000 limit');
  const timeoutError = new Error('Request timeout after 30 seconds');
  const rateLimitError = new Error('Rate limit exceeded. Please try again later.');
  const unavailableError = new Error('Model is currently unavailable or overloaded');
  const unknownError = new Error('Unknown error occurred');
  
  return {
    authError,
    billingError,
    contextError,
    timeoutError,
    rateLimitError,
    unavailableError,
    unknownError
  };
}
