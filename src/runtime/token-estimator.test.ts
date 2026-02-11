/**
 * Token Estimator Tests
 */

import {
  estimateTokens,
  estimateTokensForSegments,
  estimateTokensForRequest,
  TokenUsageTracker
} from './token-estimator.js';

describe('Token Estimator', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for empty string', () => {
      const result = estimateTokens('');
      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
      expect(result.method).toBe('heuristic');
    });
    
    it('should estimate tokens using 4 chars per token heuristic', () => {
      const text = 'Hello world!'; // 12 characters
      const result = estimateTokens(text);
      expect(result.tokens).toBe(3); // ceil(12 / 4) = 3
      expect(result.characters).toBe(12);
      expect(result.method).toBe('heuristic');
    });
    
    it('should round up partial tokens', () => {
      const text = 'Hi'; // 2 characters
      const result = estimateTokens(text);
      expect(result.tokens).toBe(1); // ceil(2 / 4) = 1
    });
    
    it('should handle longer text', () => {
      const text = 'This is a longer piece of text that should be estimated correctly.'; // 66 chars
      const result = estimateTokens(text);
      expect(result.tokens).toBe(17); // ceil(66 / 4) = 17
      expect(result.characters).toBe(66);
    });
    
    it('should handle text with special characters', () => {
      const text = 'Hello! @#$% 123 \n\t'; // 18 characters
      const result = estimateTokens(text);
      expect(result.tokens).toBe(5); // ceil(18 / 4) = 5
    });
  });
  
  describe('estimateTokensForSegments', () => {
    it('should estimate tokens for multiple segments', () => {
      const segments = ['Hello', ' ', 'world', '!']; // Total: 12 chars
      const result = estimateTokensForSegments(segments);
      expect(result.tokens).toBe(3); // ceil(12 / 4) = 3
      expect(result.characters).toBe(12);
    });
    
    it('should handle empty segments array', () => {
      const result = estimateTokensForSegments([]);
      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
    });
    
    it('should handle segments with empty strings', () => {
      const segments = ['Hello', '', 'world']; // Total: 10 chars
      const result = estimateTokensForSegments(segments);
      expect(result.tokens).toBe(3); // ceil(10 / 4) = 3
    });
  });
  
  describe('estimateTokensForRequest', () => {
    it('should estimate tokens for prompt and context separately', () => {
      const prompt = 'What is the weather?'; // 20 chars
      const context = 'User is in Seattle'; // 18 chars
      
      const result = estimateTokensForRequest(prompt, context);
      
      expect(result.prompt.tokens).toBe(5); // ceil(20 / 4)
      expect(result.prompt.characters).toBe(20);
      
      expect(result.context.tokens).toBe(5); // ceil(18 / 4)
      expect(result.context.characters).toBe(18);
      
      expect(result.total.tokens).toBe(10); // 5 + 5
      expect(result.total.characters).toBe(38); // 20 + 18
    });
    
    it('should handle empty prompt', () => {
      const result = estimateTokensForRequest('', 'Some context');
      expect(result.prompt.tokens).toBe(0);
      expect(result.context.tokens).toBe(3); // ceil(12 / 4)
      expect(result.total.tokens).toBe(3);
    });
    
    it('should handle empty context', () => {
      const result = estimateTokensForRequest('Some prompt', '');
      expect(result.prompt.tokens).toBe(3); // ceil(11 / 4)
      expect(result.context.tokens).toBe(0);
      expect(result.total.tokens).toBe(3);
    });
  });
  
  describe('TokenUsageTracker', () => {
    let tracker: TokenUsageTracker;
    
    beforeEach(() => {
      tracker = new TokenUsageTracker();
    });
    
    it('should track token usage', () => {
      const usage = tracker.track('Hello', 'World');
      
      expect(usage.prompt).toBe(2); // ceil(5 / 4)
      expect(usage.context).toBe(2); // ceil(5 / 4)
      expect(usage.total).toBe(4);
      expect(usage.timestamp).toBeGreaterThan(0);
    });
    
    it('should maintain usage history', () => {
      tracker.track('First', 'request');
      tracker.track('Second', 'request');
      tracker.track('Third', 'request');
      
      const recent = tracker.getRecentUsage(3);
      expect(recent).toHaveLength(3);
    });
    
    it('should calculate statistics', () => {
      tracker.track('Hello', 'World'); // 2 + 2 = 4 tokens
      tracker.track('Hi', 'There'); // 1 + 2 = 3 tokens
      tracker.track('Hey', 'You'); // 1 + 1 = 2 tokens
      
      const stats = tracker.getStats();
      
      expect(stats.totalRequests).toBe(3);
      expect(stats.averageTotalTokens).toBeCloseTo(3, 1); // (4 + 3 + 2) / 3 = 3
      expect(stats.maxTotalTokens).toBe(4);
      expect(stats.minTotalTokens).toBe(2);
    });
    
    it('should return zero stats for empty history', () => {
      const stats = tracker.getStats();
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.averageTotalTokens).toBe(0);
      expect(stats.maxTotalTokens).toBe(0);
      expect(stats.minTotalTokens).toBe(0);
    });
    
    it('should limit history size', () => {
      const smallTracker = new TokenUsageTracker(5);
      
      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        smallTracker.track(`Prompt ${i}`, `Context ${i}`);
      }
      
      const stats = smallTracker.getStats();
      expect(stats.totalRequests).toBe(5); // Should only keep last 5
    });
    
    it('should get recent usage with limit', () => {
      for (let i = 0; i < 10; i++) {
        tracker.track(`Prompt ${i}`, `Context ${i}`);
      }
      
      const recent = tracker.getRecentUsage(3);
      expect(recent).toHaveLength(3);
    });
    
    it('should clear history', () => {
      tracker.track('Hello', 'World');
      tracker.track('Hi', 'There');
      
      tracker.clear();
      
      const stats = tracker.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });
});
