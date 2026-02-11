/**
 * Error Classifier Tests
 * 
 * Tests the error classification system that categorizes LLM provider errors
 * to determine appropriate fallback strategies.
 * 
 * Requirements: 7.4
 */

import {
  classifyError,
  shouldFallback,
  shouldMarkAuthFailure,
  getFailoverReasonDescription
} from '../error-classifier';

describe('Error Classifier', () => {
  describe('classifyError', () => {
    describe('auth errors', () => {
      it('should classify "unauthorized" as auth error', () => {
        const error = new Error('Unauthorized access');
        expect(classifyError(error)).toBe('auth');
      });

      it('should classify "invalid api key" as auth error', () => {
        const error = new Error('Invalid API key provided');
        expect(classifyError(error)).toBe('auth');
      });

      it('should classify "authentication failed" as auth error', () => {
        const error = new Error('Authentication failed');
        expect(classifyError(error)).toBe('auth');
      });

      it('should classify "invalid_api_key" as auth error', () => {
        const error = new Error('Error: invalid_api_key');
        expect(classifyError(error)).toBe('auth');
      });

      it('should classify "invalid_auth" as auth error', () => {
        const error = new Error('invalid_auth token');
        expect(classifyError(error)).toBe('auth');
      });

      it('should be case-insensitive', () => {
        const error = new Error('UNAUTHORIZED ACCESS');
        expect(classifyError(error)).toBe('auth');
      });
    });

    describe('billing errors', () => {
      it('should classify "quota exceeded" as billing error', () => {
        const error = new Error('Quota exceeded for this API key');
        expect(classifyError(error)).toBe('billing');
      });

      it('should classify "billing issue" as billing error', () => {
        const error = new Error('Billing issue detected');
        expect(classifyError(error)).toBe('billing');
      });

      it('should classify "insufficient credits" as billing error', () => {
        const error = new Error('Insufficient credits remaining');
        expect(classifyError(error)).toBe('billing');
      });

      it('should classify "payment required" as billing error', () => {
        const error = new Error('Payment required to continue');
        expect(classifyError(error)).toBe('billing');
      });

      it('should classify quota-related rate limits as billing error', () => {
        const error = new Error('Rate limit exceeded due to quota');
        expect(classifyError(error)).toBe('billing');
      });
    });

    describe('context errors', () => {
      it('should classify "context length exceeded" as context error', () => {
        const error = new Error('Context length exceeded');
        expect(classifyError(error)).toBe('context');
      });

      it('should classify "token limit" as context error', () => {
        const error = new Error('Token limit reached');
        expect(classifyError(error)).toBe('context');
      });

      it('should classify "maximum context" as context error', () => {
        const error = new Error('Maximum context window exceeded');
        expect(classifyError(error)).toBe('context');
      });

      it('should classify "context_length_exceeded" as context error', () => {
        const error = new Error('Error: context_length_exceeded');
        expect(classifyError(error)).toBe('context');
      });

      it('should classify "tokens exceed" as context error', () => {
        const error = new Error('Tokens exceed model limit');
        expect(classifyError(error)).toBe('context');
      });
    });

    describe('timeout errors', () => {
      it('should classify "timeout" as timeout error', () => {
        const error = new Error('Request timeout');
        expect(classifyError(error)).toBe('timeout');
      });

      it('should classify "timed out" as timeout error', () => {
        const error = new Error('Operation timed out');
        expect(classifyError(error)).toBe('timeout');
      });

      it('should classify "deadline exceeded" as timeout error', () => {
        const error = new Error('Deadline exceeded');
        expect(classifyError(error)).toBe('timeout');
      });
    });

    describe('rate_limit errors', () => {
      it('should classify "rate limit" as rate_limit error', () => {
        const error = new Error('Rate limit exceeded');
        expect(classifyError(error)).toBe('rate_limit');
      });

      it('should classify "too many requests" as rate_limit error', () => {
        const error = new Error('Too many requests');
        expect(classifyError(error)).toBe('rate_limit');
      });

      it('should classify "throttled" as rate_limit error', () => {
        const error = new Error('Request throttled');
        expect(classifyError(error)).toBe('rate_limit');
      });

      it('should classify "rate_limit_exceeded" as rate_limit error', () => {
        const error = new Error('Error: rate_limit_exceeded');
        expect(classifyError(error)).toBe('rate_limit');
      });

      it('should classify "429" as rate_limit error', () => {
        const error = new Error('HTTP 429 error');
        expect(classifyError(error)).toBe('rate_limit');
      });
    });

    describe('unavailable errors', () => {
      it('should classify "unavailable" as unavailable error', () => {
        const error = new Error('Service unavailable');
        expect(classifyError(error)).toBe('unavailable');
      });

      it('should classify "overloaded" as unavailable error', () => {
        const error = new Error('Server overloaded');
        expect(classifyError(error)).toBe('unavailable');
      });

      it('should classify "model not found" as unavailable error', () => {
        const error = new Error('Model not found');
        expect(classifyError(error)).toBe('unavailable');
      });

      it('should classify "model_not_found" as unavailable error', () => {
        const error = new Error('Error: model_not_found');
        expect(classifyError(error)).toBe('unavailable');
      });

      it('should classify "503" as unavailable error', () => {
        const error = new Error('HTTP 503 Service Unavailable');
        expect(classifyError(error)).toBe('unavailable');
      });

      it('should classify "502" as unavailable error', () => {
        const error = new Error('HTTP 502 Bad Gateway');
        expect(classifyError(error)).toBe('unavailable');
      });
    });

    describe('unknown errors', () => {
      it('should classify unrecognized errors as unknown', () => {
        const error = new Error('Something went wrong');
        expect(classifyError(error)).toBe('unknown');
      });

      it('should classify empty message as unknown', () => {
        const error = new Error('');
        expect(classifyError(error)).toBe('unknown');
      });

      it('should classify generic errors as unknown', () => {
        const error = new Error('Internal server error');
        expect(classifyError(error)).toBe('unknown');
      });
    });

    describe('edge cases', () => {
      it('should handle errors with mixed keywords', () => {
        // "rate limit" appears but with "quota" - should be billing
        const error = new Error('Rate limit exceeded due to quota');
        expect(classifyError(error)).toBe('billing');
      });

      it('should prioritize auth over other classifications', () => {
        // Auth keywords appear first in the classification logic
        const error = new Error('Unauthorized: rate limit exceeded');
        expect(classifyError(error)).toBe('auth');
      });

      it('should handle multi-line error messages', () => {
        const error = new Error('Error occurred:\nUnauthorized access\nPlease check your API key');
        expect(classifyError(error)).toBe('auth');
      });

      it('should handle errors with special characters', () => {
        const error = new Error('Error [401]: Unauthorized - Invalid API Key!');
        expect(classifyError(error)).toBe('auth');
      });
    });
  });

  describe('shouldFallback', () => {
    it('should return true for auth errors', () => {
      expect(shouldFallback('auth')).toBe(true);
    });

    it('should return true for billing errors', () => {
      expect(shouldFallback('billing')).toBe(true);
    });

    it('should return true for context errors', () => {
      expect(shouldFallback('context')).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(shouldFallback('timeout')).toBe(true);
    });

    it('should return true for rate_limit errors', () => {
      expect(shouldFallback('rate_limit')).toBe(true);
    });

    it('should return true for unavailable errors', () => {
      expect(shouldFallback('unavailable')).toBe(true);
    });

    it('should return true for unknown errors', () => {
      expect(shouldFallback('unknown')).toBe(true);
    });
  });

  describe('shouldMarkAuthFailure', () => {
    it('should return true for auth errors', () => {
      expect(shouldMarkAuthFailure('auth')).toBe(true);
    });

    it('should return true for billing errors', () => {
      expect(shouldMarkAuthFailure('billing')).toBe(true);
    });

    it('should return false for context errors', () => {
      expect(shouldMarkAuthFailure('context')).toBe(false);
    });

    it('should return false for timeout errors', () => {
      expect(shouldMarkAuthFailure('timeout')).toBe(false);
    });

    it('should return false for rate_limit errors', () => {
      expect(shouldMarkAuthFailure('rate_limit')).toBe(false);
    });

    it('should return false for unavailable errors', () => {
      expect(shouldMarkAuthFailure('unavailable')).toBe(false);
    });

    it('should return false for unknown errors', () => {
      expect(shouldMarkAuthFailure('unknown')).toBe(false);
    });
  });

  describe('getFailoverReasonDescription', () => {
    it('should return description for auth', () => {
      const desc = getFailoverReasonDescription('auth');
      expect(desc).toContain('Authentication');
      expect(desc).toContain('API key');
    });

    it('should return description for billing', () => {
      const desc = getFailoverReasonDescription('billing');
      expect(desc).toContain('Billing');
      expect(desc).toContain('quota');
    });

    it('should return description for context', () => {
      const desc = getFailoverReasonDescription('context');
      expect(desc).toContain('Context window');
      expect(desc).toContain('too large');
    });

    it('should return description for timeout', () => {
      const desc = getFailoverReasonDescription('timeout');
      expect(desc).toContain('timeout');
      expect(desc).toContain('too long');
    });

    it('should return description for rate_limit', () => {
      const desc = getFailoverReasonDescription('rate_limit');
      expect(desc).toContain('Rate limit');
      expect(desc).toContain('too many');
    });

    it('should return description for unavailable', () => {
      const desc = getFailoverReasonDescription('unavailable');
      expect(desc).toContain('unavailable');
    });

    it('should return description for unknown', () => {
      const desc = getFailoverReasonDescription('unknown');
      expect(desc).toContain('Unknown');
      expect(desc).toContain('unclassified');
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical OpenAI auth error', () => {
      const error = new Error('Incorrect API key provided: sk-****. You can find your API key at https://platform.openai.com/account/api-keys.');
      const reason = classifyError(error);
      expect(reason).toBe('auth');
      expect(shouldFallback(reason)).toBe(true);
      expect(shouldMarkAuthFailure(reason)).toBe(true);
    });

    it('should handle typical Anthropic rate limit error', () => {
      const error = new Error('Rate limit exceeded. Please try again later.');
      const reason = classifyError(error);
      expect(reason).toBe('rate_limit');
      expect(shouldFallback(reason)).toBe(true);
      expect(shouldMarkAuthFailure(reason)).toBe(false);
    });

    it('should handle typical context window error', () => {
      const error = new Error('This model\'s maximum context length is 128000 tokens. However, your messages resulted in 150000 tokens.');
      const reason = classifyError(error);
      expect(reason).toBe('context');
      expect(shouldFallback(reason)).toBe(true);
      expect(shouldMarkAuthFailure(reason)).toBe(false);
    });

    it('should handle typical service unavailable error', () => {
      const error = new Error('The server is currently overloaded. Please try again later.');
      const reason = classifyError(error);
      expect(reason).toBe('unavailable');
      expect(shouldFallback(reason)).toBe(true);
      expect(shouldMarkAuthFailure(reason)).toBe(false);
    });

    it('should handle typical quota exceeded error', () => {
      const error = new Error('You exceeded your current quota, please check your plan and billing details.');
      const reason = classifyError(error);
      expect(reason).toBe('billing');
      expect(shouldFallback(reason)).toBe(true);
      expect(shouldMarkAuthFailure(reason)).toBe(true);
    });
  });

  describe('real-world error messages', () => {
    it('should classify OpenAI 401 error', () => {
      const error = new Error('Request failed with status code 401: Unauthorized');
      expect(classifyError(error)).toBe('auth');
    });

    it('should classify OpenAI 429 error', () => {
      const error = new Error('Request failed with status code 429: Too Many Requests');
      expect(classifyError(error)).toBe('rate_limit');
    });

    it('should classify OpenAI 503 error', () => {
      const error = new Error('Request failed with status code 503: Service Unavailable');
      expect(classifyError(error)).toBe('unavailable');
    });

    it('should classify Anthropic context error', () => {
      const error = new Error('prompt is too long: 200000 tokens > 100000 maximum');
      expect(classifyError(error)).toBe('context');
    });

    it('should classify Google timeout error', () => {
      const error = new Error('Request timed out after 60000ms');
      expect(classifyError(error)).toBe('timeout');
    });

    it('should classify model not found error', () => {
      const error = new Error('The model `gpt-5` does not exist');
      expect(classifyError(error)).toBe('unavailable');
    });
  });
});
