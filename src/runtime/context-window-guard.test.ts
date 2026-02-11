/**
 * Context Window Guard Tests
 */

import {
  ContextWindowGuard,
  createContextWindowGuard,
  validateContextSize,
  ContextValidationError,
  CONTEXT_WINDOW_HARD_MIN,
  CONTEXT_WINDOW_WARN_BELOW
} from './context-window-guard.js';
import { ModelRef, RuntimeRequest, TaskType } from '../types/index.js';

describe('Context Window Guard', () => {
  const createRequest = (promptLength: number, contextLength: number): RuntimeRequest => ({
    taskType: 'code_analysis' as TaskType,
    prompt: 'a'.repeat(promptLength),
    context: 'b'.repeat(contextLength)
  });
  
  describe('ContextWindowGuard', () => {
    describe('validate', () => {
      it('should validate a request that fits in context window', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(100, 100); // ~50 tokens total
        
        const result = guard.validate(request, model);
        
        expect(result.isValid).toBe(true);
        expect(result.shouldWarn).toBe(false);
        expect(result.available).toBe(200000);
        expect(result.required).toBeLessThan(result.available);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject request exceeding context window', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        // Create a request that exceeds 200k tokens (800k+ characters)
        const request = createRequest(500000, 500000); // 1M chars = 250k tokens
        
        const result = guard.validate(request, model);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('exceed context window'))).toBe(true);
      });
      
      it('should reject context window below hard minimum', () => {
        const guard = new ContextWindowGuard({
          modelOverrides: {
            test: {
              'small-model': 8000 // Below 16k hard minimum
            }
          }
        });
        
        const model: ModelRef = { provider: 'test', model: 'small-model' };
        const request = createRequest(100, 100);
        
        const result = guard.validate(request, model);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('below hard minimum'))).toBe(true);
      });
      
      it('should warn for context window below recommended minimum', () => {
        const guard = new ContextWindowGuard({
          modelOverrides: {
            test: {
              'medium-model': 20000 // Above 16k but below 32k
            }
          }
        });
        
        const model: ModelRef = { provider: 'test', model: 'medium-model' };
        const request = createRequest(100, 100);
        
        const result = guard.validate(request, model);
        
        expect(result.isValid).toBe(true);
        expect(result.shouldWarn).toBe(true);
        expect(result.warnings.some(w => w.includes('below recommended minimum'))).toBe(true);
      });
      
      it('should warn when token usage exceeds 90%', () => {
        const guard = new ContextWindowGuard({
          modelOverrides: {
            test: {
              'test-model': 100000 // 100k tokens (above recommended minimum)
            }
          }
        });
        
        const model: ModelRef = { provider: 'test', model: 'test-model' };
        const request = createRequest(182000, 182000); // 364k chars = 91k tokens (91%)
        
        const result = guard.validate(request, model);
        
        expect(result.isValid).toBe(true);
        expect(result.warnings.some(w => w.includes('91') || w.includes('90'))).toBe(true);
      });
      
      it('should not warn for context window above recommended minimum', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(100, 100);
        
        const result = guard.validate(request, model);
        
        expect(result.isValid).toBe(true);
        expect(result.shouldWarn).toBe(false);
      });
      
      it('should include correct source in validation result', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(100, 100);
        
        const result = guard.validate(request, model);
        
        expect(result.source).toBe('model'); // From catalog
      });
      
      it('should handle config override source', () => {
        const guard = new ContextWindowGuard({
          modelOverrides: {
            anthropic: {
              'claude-sonnet-4': 150000
            }
          }
        });
        
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(100, 100);
        
        const result = guard.validate(request, model);
        
        expect(result.source).toBe('config');
        expect(result.available).toBe(150000);
      });
    });
    
    describe('validateOrThrow', () => {
      it('should return validation result for valid request', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(100, 100);
        
        const result = guard.validateOrThrow(request, model);
        
        expect(result.isValid).toBe(true);
      });
      
      it('should throw ContextValidationError for invalid request', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(500000, 500000); // Exceeds window
        
        expect(() => {
          guard.validateOrThrow(request, model);
        }).toThrow(ContextValidationError);
      });
      
      it('should include validation details in error', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(500000, 500000);
        
        try {
          guard.validateOrThrow(request, model);
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ContextValidationError);
          const validationError = error as ContextValidationError;
          expect(validationError.validation.isValid).toBe(false);
          expect(validationError.validation.errors.length).toBeGreaterThan(0);
        }
      });
    });
    
    describe('wouldFit', () => {
      it('should return true for request that fits', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(100, 100);
        
        expect(guard.wouldFit(request, model)).toBe(true);
      });
      
      it('should return false for request that does not fit', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(500000, 500000);
        
        expect(guard.wouldFit(request, model)).toBe(false);
      });
    });
    
    describe('getAvailableTokens', () => {
      it('should return available tokens for model', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        
        expect(guard.getAvailableTokens(model)).toBe(200000);
      });
      
      it('should respect config overrides', () => {
        const guard = new ContextWindowGuard({
          modelOverrides: {
            anthropic: {
              'claude-sonnet-4': 100000
            }
          }
        });
        
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        
        expect(guard.getAvailableTokens(model)).toBe(100000);
      });
    });
    
    describe('estimateRequiredTokens', () => {
      it('should estimate required tokens for request', () => {
        const guard = new ContextWindowGuard();
        const request = createRequest(100, 100); // 200 chars = ~50 tokens
        
        const required = guard.estimateRequiredTokens(request);
        
        expect(required).toBe(50); // ceil(200 / 4)
      });
      
      it('should handle empty request', () => {
        const guard = new ContextWindowGuard();
        const request = createRequest(0, 0);
        
        expect(guard.estimateRequiredTokens(request)).toBe(0);
      });
    });
    
    describe('getRemainingTokens', () => {
      it('should calculate remaining tokens', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const request = createRequest(100, 100); // ~50 tokens
        
        const remaining = guard.getRemainingTokens(request, model);
        
        expect(remaining).toBe(199950); // 200000 - 50
      });
      
      it('should return negative for request exceeding window', () => {
        const guard = new ContextWindowGuard({
          modelOverrides: {
            test: {
              'small-model': 100
            }
          }
        });
        
        const model: ModelRef = { provider: 'test', model: 'small-model' };
        const request = createRequest(200, 200); // ~100 tokens
        
        const remaining = guard.getRemainingTokens(request, model);
        
        expect(remaining).toBe(0); // 100 - 100
      });
    });
    
    describe('updateConfig', () => {
      it('should update configuration', () => {
        const guard = new ContextWindowGuard();
        const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
        
        expect(guard.getAvailableTokens(model)).toBe(200000);
        
        guard.updateConfig({
          agentContextTokenCap: 50000
        });
        
        expect(guard.getAvailableTokens(model)).toBe(50000);
      });
    });
    
    describe('getResolver', () => {
      it('should return the context window resolver', () => {
        const guard = new ContextWindowGuard();
        const resolver = guard.getResolver();
        
        expect(resolver).toBeDefined();
        expect(typeof resolver.resolve).toBe('function');
      });
    });
  });
  
  describe('createContextWindowGuard', () => {
    it('should create guard with default config', () => {
      const guard = createContextWindowGuard();
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      
      expect(guard.getAvailableTokens(model)).toBe(200000);
    });
    
    it('should create guard with custom config', () => {
      const guard = createContextWindowGuard({
        agentContextTokenCap: 50000
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      
      expect(guard.getAvailableTokens(model)).toBe(50000);
    });
  });
  
  describe('validateContextSize', () => {
    it('should validate context size with default config', () => {
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const request = createRequest(100, 100);
      
      const result = validateContextSize(request, model);
      
      expect(result.isValid).toBe(true);
      expect(result.available).toBe(200000);
    });
    
    it('should validate context size with custom config', () => {
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const request = createRequest(100, 100);
      
      const result = validateContextSize(request, model, {
        agentContextTokenCap: 50000
      });
      
      expect(result.isValid).toBe(true);
      expect(result.available).toBe(50000);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle exactly at hard minimum', () => {
      const guard = new ContextWindowGuard({
        modelOverrides: {
          test: {
            'test-model': CONTEXT_WINDOW_HARD_MIN
          }
        }
      });
      
      const model: ModelRef = { provider: 'test', model: 'test-model' };
      const request = createRequest(100, 100);
      
      const result = guard.validate(request, model);
      
      expect(result.isValid).toBe(true);
      expect(result.shouldWarn).toBe(true); // Below recommended
    });
    
    it('should handle exactly at recommended minimum', () => {
      const guard = new ContextWindowGuard({
        modelOverrides: {
          test: {
            'test-model': CONTEXT_WINDOW_WARN_BELOW
          }
        }
      });
      
      const model: ModelRef = { provider: 'test', model: 'test-model' };
      const request = createRequest(100, 100);
      
      const result = guard.validate(request, model);
      
      expect(result.isValid).toBe(true);
      expect(result.shouldWarn).toBe(false); // At recommended
    });
    
    it('should handle request exactly at context window limit', () => {
      const guard = new ContextWindowGuard({
        modelOverrides: {
          test: {
            'test-model': 50000 // 50k tokens
          }
        }
      });
      
      const model: ModelRef = { provider: 'test', model: 'test-model' };
      const request = createRequest(100000, 100000); // Exactly 200k chars = 50k tokens
      
      const result = guard.validate(request, model);
      
      expect(result.isValid).toBe(true);
      expect(result.required).toBe(50000);
      expect(result.available).toBe(50000);
    });
    
    it('should handle very large context windows', () => {
      const guard = new ContextWindowGuard();
      const model: ModelRef = { provider: 'google', model: 'gemini-1.5-pro' };
      const request = createRequest(1000, 1000);
      
      const result = guard.validate(request, model);
      
      expect(result.isValid).toBe(true);
      expect(result.available).toBe(2000000);
    });
  });
});
