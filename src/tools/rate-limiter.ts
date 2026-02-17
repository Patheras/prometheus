/**
 * Rate Limiter
 * 
 * Limits tool call frequency per conversation to prevent abuse.
 */

export interface RateLimitConfig {
  maxCallsPerWindow: number;  // Maximum calls allowed in time window
  windowMs: number;            // Time window in milliseconds
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalCalls: number;
}

interface CallRecord {
  timestamp: number;
  toolName: string;
}

/**
 * Rate Limiter for tool calls
 */
export class RateLimiter {
  private callHistory: Map<string, CallRecord[]>;
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.callHistory = new Map();
    this.config = {
      maxCallsPerWindow: config.maxCallsPerWindow || 50,  // 50 calls per window
      windowMs: config.windowMs || 60000,                  // 1 minute window
    };
  }

  /**
   * Check if a call is allowed for a conversation
   * 
   * @param conversationId Conversation ID
   * @param toolName Tool name
   * @returns Rate limit status
   */
  checkLimit(conversationId: string, toolName: string): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get call history for this conversation
    let calls = this.callHistory.get(conversationId) || [];

    // Remove calls outside the current window
    calls = calls.filter(call => call.timestamp > windowStart);

    // Update call history
    this.callHistory.set(conversationId, calls);

    // Calculate remaining calls
    const totalCalls = calls.length;
    const remaining = Math.max(0, this.config.maxCallsPerWindow - totalCalls);
    const allowed = totalCalls < this.config.maxCallsPerWindow;

    // Calculate reset time (end of current window)
    const oldestCall = calls.length > 0 ? calls[0].timestamp : now;
    const resetTime = oldestCall + this.config.windowMs;

    return {
      allowed,
      remaining,
      resetTime,
      totalCalls,
    };
  }

  /**
   * Record a tool call
   * 
   * @param conversationId Conversation ID
   * @param toolName Tool name
   */
  recordCall(conversationId: string, toolName: string): void {
    const now = Date.now();
    const calls = this.callHistory.get(conversationId) || [];

    calls.push({
      timestamp: now,
      toolName,
    });

    this.callHistory.set(conversationId, calls);
  }

  /**
   * Get call statistics for a conversation
   * 
   * @param conversationId Conversation ID
   * @returns Call statistics
   */
  getStats(conversationId: string): {
    totalCalls: number;
    callsByTool: Record<string, number>;
    oldestCall: number | null;
    newestCall: number | null;
  } {
    const calls = this.callHistory.get(conversationId) || [];
    const callsByTool: Record<string, number> = {};

    for (const call of calls) {
      callsByTool[call.toolName] = (callsByTool[call.toolName] || 0) + 1;
    }

    return {
      totalCalls: calls.length,
      callsByTool,
      oldestCall: calls.length > 0 ? calls[0].timestamp : null,
      newestCall: calls.length > 0 ? calls[calls.length - 1].timestamp : null,
    };
  }

  /**
   * Clear call history for a conversation
   * 
   * @param conversationId Conversation ID
   */
  clearHistory(conversationId: string): void {
    this.callHistory.delete(conversationId);
  }

  /**
   * Clear all call history
   */
  clearAllHistory(): void {
    this.callHistory.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create global rate limiter
 */
export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Initialize rate limiter with custom config
 */
export function initializeRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  globalRateLimiter = new RateLimiter(config);
  return globalRateLimiter;
}
