/**
 * Token Estimator
 * 
 * Estimates token counts for text using the heuristic: ~4 characters ≈ 1 token
 * Tracks token usage per request for optimization.
 * 
 * Requirements: 8.1
 */

/**
 * Token usage tracking for a request
 */
export type TokenUsage = {
  prompt: number;
  context: number;
  total: number;
  timestamp: number;
};

/**
 * Token estimation result
 */
export type TokenEstimate = {
  tokens: number;
  characters: number;
  method: 'heuristic' | 'exact';
};

/**
 * Average characters per token (heuristic)
 * Based on common LLM tokenization patterns
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count for text using character-based heuristic
 * 
 * Uses the approximation: ~4 characters ≈ 1 token
 * This is a reasonable estimate for English text with typical LLM tokenizers.
 * 
 * @param text Text to estimate tokens for
 * @returns Token estimate
 */
export function estimateTokens(text: string): TokenEstimate {
  const characters = text.length;
  const tokens = Math.ceil(characters / CHARS_PER_TOKEN);
  
  return {
    tokens,
    characters,
    method: 'heuristic'
  };
}

/**
 * Estimate tokens for multiple text segments
 * 
 * @param segments Array of text segments
 * @returns Total token estimate
 */
export function estimateTokensForSegments(segments: string[]): TokenEstimate {
  const totalText = segments.join('');
  return estimateTokens(totalText);
}

/**
 * Estimate tokens for a prompt and context
 * 
 * @param prompt The prompt text
 * @param context The context text
 * @returns Token estimates for prompt, context, and total
 */
export function estimateTokensForRequest(
  prompt: string,
  context: string
): {
  prompt: TokenEstimate;
  context: TokenEstimate;
  total: TokenEstimate;
} {
  const promptEstimate = estimateTokens(prompt);
  const contextEstimate = estimateTokens(context);
  
  return {
    prompt: promptEstimate,
    context: contextEstimate,
    total: {
      tokens: promptEstimate.tokens + contextEstimate.tokens,
      characters: promptEstimate.characters + contextEstimate.characters,
      method: 'heuristic'
    }
  };
}

/**
 * Token usage tracker
 * 
 * Tracks token usage per request for optimization and analysis.
 */
export class TokenUsageTracker {
  private usageHistory: TokenUsage[] = [];
  private maxHistorySize: number;
  
  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }
  
  /**
   * Track token usage for a request
   * 
   * @param prompt Prompt text
   * @param context Context text
   */
  track(prompt: string, context: string): TokenUsage {
    const estimates = estimateTokensForRequest(prompt, context);
    
    const usage: TokenUsage = {
      prompt: estimates.prompt.tokens,
      context: estimates.context.tokens,
      total: estimates.total.tokens,
      timestamp: Date.now()
    };
    
    this.usageHistory.push(usage);
    
    // Trim history if it exceeds max size
    if (this.usageHistory.length > this.maxHistorySize) {
      this.usageHistory.shift();
    }
    
    return usage;
  }
  
  /**
   * Get usage statistics
   * 
   * @returns Usage statistics
   */
  getStats(): {
    totalRequests: number;
    averagePromptTokens: number;
    averageContextTokens: number;
    averageTotalTokens: number;
    maxTotalTokens: number;
    minTotalTokens: number;
  } {
    if (this.usageHistory.length === 0) {
      return {
        totalRequests: 0,
        averagePromptTokens: 0,
        averageContextTokens: 0,
        averageTotalTokens: 0,
        maxTotalTokens: 0,
        minTotalTokens: 0
      };
    }
    
    const totalPrompt = this.usageHistory.reduce((sum, u) => sum + u.prompt, 0);
    const totalContext = this.usageHistory.reduce((sum, u) => sum + u.context, 0);
    const totalTokens = this.usageHistory.reduce((sum, u) => sum + u.total, 0);
    const maxTotal = Math.max(...this.usageHistory.map(u => u.total));
    const minTotal = Math.min(...this.usageHistory.map(u => u.total));
    
    return {
      totalRequests: this.usageHistory.length,
      averagePromptTokens: totalPrompt / this.usageHistory.length,
      averageContextTokens: totalContext / this.usageHistory.length,
      averageTotalTokens: totalTokens / this.usageHistory.length,
      maxTotalTokens: maxTotal,
      minTotalTokens: minTotal
    };
  }
  
  /**
   * Get recent usage history
   * 
   * @param count Number of recent entries to return
   * @returns Recent usage history
   */
  getRecentUsage(count: number = 10): TokenUsage[] {
    return this.usageHistory.slice(-count);
  }
  
  /**
   * Clear usage history
   */
  clear(): void {
    this.usageHistory = [];
  }
}
