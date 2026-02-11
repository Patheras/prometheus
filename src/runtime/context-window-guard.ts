/**
 * Context Window Guard
 * 
 * Validates context sizes before requests to prevent token limit violations.
 * Enforces hard minimum (16k) and recommended minimum (32k) thresholds.
 * 
 * Requirements: 8.4
 */

import { ModelRef, RuntimeRequest } from '../types/index.js';
import { estimateTokensForRequest } from './token-estimator.js';
import { ContextWindowResolver, ContextWindowConfig } from './context-window-resolver.js';

/**
 * Hard minimum context window (16k tokens)
 * Requests with smaller context windows are rejected
 */
export const CONTEXT_WINDOW_HARD_MIN = 16000;

/**
 * Recommended minimum context window (32k tokens)
 * Requests with smaller context windows trigger warnings
 */
export const CONTEXT_WINDOW_WARN_BELOW = 32000;

/**
 * Context validation result
 */
export type ContextValidation = {
  /** Whether the context is valid (passes hard minimum and doesn't exceed window) */
  isValid: boolean;
  
  /** Whether a warning should be issued (below recommended minimum) */
  shouldWarn: boolean;
  
  /** Available context window size in tokens */
  available: number;
  
  /** Required tokens for the request */
  required: number;
  
  /** Source of the context window value */
  source: 'model' | 'config' | 'default';
  
  /** Validation errors (if any) */
  errors: string[];
  
  /** Validation warnings (if any) */
  warnings: string[];
};

/**
 * Error thrown when context validation fails
 */
export class ContextValidationError extends Error {
  constructor(
    public readonly validation: ContextValidation,
    message?: string
  ) {
    super(message || validation.errors.join('; '));
    this.name = 'ContextValidationError';
  }
}

/**
 * Context window guard
 * 
 * Validates context sizes before requests to prevent token limit violations.
 */
export class ContextWindowGuard {
  private resolver: ContextWindowResolver;
  
  constructor(config?: ContextWindowConfig) {
    this.resolver = new ContextWindowResolver(config);
  }
  
  /**
   * Validate context size for a request
   * 
   * Validation rules:
   * 1. Context window must be >= CONTEXT_WINDOW_HARD_MIN (16k)
   * 2. Required tokens must not exceed context window
   * 3. Warning if context window < CONTEXT_WINDOW_WARN_BELOW (32k)
   * 
   * @param request Runtime request to validate
   * @param model Model reference
   * @returns Context validation result
   */
  validate(request: RuntimeRequest, model: ModelRef): ContextValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Resolve context window for the model
    const resolution = this.resolver.resolve(model);
    const contextWindow = resolution.contextWindow;
    
    // Estimate required tokens
    const estimates = estimateTokensForRequest(request.prompt, request.context);
    const requiredTokens = estimates.total.tokens;
    
    // Check hard minimum
    if (contextWindow < CONTEXT_WINDOW_HARD_MIN) {
      errors.push(
        `Context window ${contextWindow} is below hard minimum ${CONTEXT_WINDOW_HARD_MIN}`
      );
    }
    
    // Check if required tokens exceed context window
    if (requiredTokens > contextWindow) {
      errors.push(
        `Required tokens ${requiredTokens} exceed context window ${contextWindow}`
      );
    }
    
    // Check recommended minimum
    let shouldWarn = false;
    if (contextWindow < CONTEXT_WINDOW_WARN_BELOW) {
      shouldWarn = true;
      warnings.push(
        `Context window ${contextWindow} is below recommended minimum ${CONTEXT_WINDOW_WARN_BELOW}`
      );
    }
    
    // Check if we're close to the limit (>90% usage)
    const usagePercent = (requiredTokens / contextWindow) * 100;
    if (usagePercent > 90 && errors.length === 0) {
      warnings.push(
        `Token usage is ${usagePercent.toFixed(1)}% of context window (${requiredTokens}/${contextWindow})`
      );
    }
    
    const isValid = errors.length === 0;
    
    return {
      isValid,
      shouldWarn,
      available: contextWindow,
      required: requiredTokens,
      source: resolution.source === 'catalog' ? 'model' : resolution.source,
      errors,
      warnings
    };
  }
  
  /**
   * Validate and throw if invalid
   * 
   * @param request Runtime request to validate
   * @param model Model reference
   * @throws ContextValidationError if validation fails
   * @returns Context validation result (only if valid)
   */
  validateOrThrow(request: RuntimeRequest, model: ModelRef): ContextValidation {
    const validation = this.validate(request, model);
    
    if (!validation.isValid) {
      throw new ContextValidationError(validation);
    }
    
    return validation;
  }
  
  /**
   * Check if a request would fit in the context window
   * 
   * @param request Runtime request
   * @param model Model reference
   * @returns True if request fits in context window
   */
  wouldFit(request: RuntimeRequest, model: ModelRef): boolean {
    const validation = this.validate(request, model);
    return validation.isValid;
  }
  
  /**
   * Get available tokens for a model
   * 
   * @param model Model reference
   * @returns Available context window size
   */
  getAvailableTokens(model: ModelRef): number {
    const resolution = this.resolver.resolve(model);
    return resolution.contextWindow;
  }
  
  /**
   * Estimate how many tokens are needed for a request
   * 
   * @param request Runtime request
   * @returns Estimated token count
   */
  estimateRequiredTokens(request: RuntimeRequest): number {
    const estimates = estimateTokensForRequest(request.prompt, request.context);
    return estimates.total.tokens;
  }
  
  /**
   * Calculate remaining tokens after a request
   * 
   * @param request Runtime request
   * @param model Model reference
   * @returns Remaining tokens (negative if exceeds window)
   */
  getRemainingTokens(request: RuntimeRequest, model: ModelRef): number {
    const available = this.getAvailableTokens(model);
    const required = this.estimateRequiredTokens(request);
    return available - required;
  }
  
  /**
   * Update configuration
   * 
   * @param config New configuration
   */
  updateConfig(config: Partial<ContextWindowConfig>): void {
    this.resolver.updateConfig(config);
  }
  
  /**
   * Get the context window resolver
   * 
   * @returns Context window resolver
   */
  getResolver(): ContextWindowResolver {
    return this.resolver;
  }
}

/**
 * Create a context window guard with default configuration
 * 
 * @param config Optional configuration
 * @returns Context window guard instance
 */
export function createContextWindowGuard(
  config?: ContextWindowConfig
): ContextWindowGuard {
  return new ContextWindowGuard(config);
}

/**
 * Validate context size for a request (convenience function)
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param config Optional configuration
 * @returns Context validation result
 */
export function validateContextSize(
  request: RuntimeRequest,
  model: ModelRef,
  config?: ContextWindowConfig
): ContextValidation {
  const guard = new ContextWindowGuard(config);
  return guard.validate(request, model);
}
