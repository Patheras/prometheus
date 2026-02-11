/**
 * Error Classification System
 * 
 * Classifies LLM provider errors into categories to determine if fallback is appropriate.
 * This is a critical component of the cascading fallback system.
 * 
 * Requirements: 7.4
 */

import { FailoverReason } from '../types';

/**
 * Classifies an error from an LLM provider into a FailoverReason category.
 * 
 * This function analyzes error messages to determine the type of failure,
 * which helps the runtime engine decide whether to:
 * - Retry with a different auth profile (auth, billing)
 * - Fallback to a different model (context, unavailable)
 * - Apply rate limiting backoff (rate_limit)
 * - Report timeout and retry (timeout)
 * - Handle as unknown error (unknown)
 * 
 * @param error - The error object from the LLM provider
 * @returns The classified failover reason
 * 
 * @example
 * ```typescript
 * try {
 *   await callLLM(request);
 * } catch (error) {
 *   const reason = classifyError(error);
 *   if (reason === 'auth') {
 *     // Rotate to next auth profile
 *   } else if (reason === 'context') {
 *     // Try model with larger context window
 *   }
 * }
 * ```
 */
export function classifyError(error: Error): FailoverReason {
  const message = error.message.toLowerCase();
  
  // Authentication failures
  // Examples: "unauthorized", "invalid api key", "authentication failed", "incorrect api key"
  if (
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('incorrect api key') ||
    message.includes('authentication failed') ||
    message.includes('invalid_api_key') ||
    message.includes('invalid_auth')
  ) {
    return 'auth';
  }
  
  // Billing and quota issues
  // Examples: "quota exceeded", "insufficient credits", "billing issue"
  if (
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('insufficient credits') ||
    message.includes('payment required') ||
    message.includes('rate limit exceeded') && message.includes('quota')
  ) {
    return 'billing';
  }
  
  // Context window exceeded
  // Examples: "context length exceeded", "token limit", "maximum context", "prompt is too long"
  if (
    message.includes('context') ||
    message.includes('token limit') ||
    message.includes('context length') ||
    message.includes('maximum context') ||
    message.includes('context_length_exceeded') ||
    message.includes('tokens exceed') ||
    message.includes('prompt is too long') ||
    message.includes('tokens >') ||
    message.includes('maximum')
  ) {
    return 'context';
  }
  
  // Request timeout
  // Examples: "timeout", "timed out", "request timeout"
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('deadline exceeded')
  ) {
    return 'timeout';
  }
  
  // Rate limiting (not quota-related)
  // Examples: "rate limit", "too many requests", "throttled"
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('throttled') ||
    message.includes('rate_limit_exceeded') ||
    message.includes('429')
  ) {
    return 'rate_limit';
  }
  
  // Model unavailable or overloaded
  // Examples: "unavailable", "overloaded", "service unavailable", "model not found", "does not exist"
  if (
    message.includes('unavailable') ||
    message.includes('overloaded') ||
    message.includes('service unavailable') ||
    message.includes('model not found') ||
    message.includes('model_not_found') ||
    message.includes('does not exist') ||
    message.includes('503') ||
    message.includes('502')
  ) {
    return 'unavailable';
  }
  
  // Unknown error - catch-all for unclassified errors
  return 'unknown';
}

/**
 * Determines if an error should trigger fallback to the next model/auth profile.
 * 
 * Some errors are recoverable through fallback (auth, billing, context, unavailable),
 * while others may require different handling (timeout, rate_limit, unknown).
 * 
 * @param reason - The classified failover reason
 * @returns True if fallback should be attempted
 * 
 * @example
 * ```typescript
 * const reason = classifyError(error);
 * if (shouldFallback(reason)) {
 *   // Try next model in fallback chain
 * } else {
 *   // Handle differently (e.g., wait and retry, report error)
 * }
 * ```
 */
export function shouldFallback(reason: FailoverReason): boolean {
  switch (reason) {
    case 'auth':
    case 'billing':
    case 'context':
    case 'unavailable':
      // These errors are likely to be resolved by trying a different model/auth
      return true;
    
    case 'timeout':
    case 'rate_limit':
      // These might resolve with retry, but fallback may also help
      return true;
    
    case 'unknown':
      // Unknown errors - attempt fallback as it might help
      return true;
    
    default:
      return false;
  }
}

/**
 * Determines if an auth profile should be marked as failed for this error.
 * 
 * Auth and billing errors indicate problems with the specific auth profile,
 * so we should mark it as failed and apply cooldown. Other errors are not
 * auth-profile-specific.
 * 
 * @param reason - The classified failover reason
 * @returns True if the auth profile should be marked as failed
 * 
 * @example
 * ```typescript
 * const reason = classifyError(error);
 * if (shouldMarkAuthFailure(reason)) {
 *   markAuthFailure(authProfile);
 * }
 * ```
 */
export function shouldMarkAuthFailure(reason: FailoverReason): boolean {
  return reason === 'auth' || reason === 'billing';
}

/**
 * Gets a human-readable description of the failover reason.
 * Useful for logging and error reporting.
 * 
 * @param reason - The classified failover reason
 * @returns A human-readable description
 */
export function getFailoverReasonDescription(reason: FailoverReason): string {
  switch (reason) {
    case 'auth':
      return 'Authentication failed - invalid or expired API key';
    case 'billing':
      return 'Billing or quota issue - insufficient credits or quota exceeded';
    case 'context':
      return 'Context window exceeded - request too large for model';
    case 'timeout':
      return 'Request timeout - operation took too long';
    case 'rate_limit':
      return 'Rate limit exceeded - too many requests';
    case 'unavailable':
      return 'Model unavailable - service overloaded or model not found';
    case 'unknown':
      return 'Unknown error - unclassified failure';
    default:
      return 'Unrecognized error type';
  }
}
