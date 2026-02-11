/**
 * Context Window Resolver Tests
 */

import {
  ContextWindowResolver,
  createContextWindowResolver,
  resolveContextWindow
} from './context-window-resolver.js';
import { ModelRef } from '../types/index.js';

describe('Context Window Resolver', () => {
  describe('ContextWindowResolver', () => {
    it('should resolve from model catalog', () => {
      const resolver = new ContextWindowResolver();
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(200000); // From catalog
      expect(result.source).toBe('catalog');
      expect(result.cappedByAgent).toBe(false);
    });
    
    it('should resolve from config override', () => {
      const resolver = new ContextWindowResolver({
        modelOverrides: {
          anthropic: {
            'claude-sonnet-4': 100000
          }
        }
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(100000); // From config
      expect(result.source).toBe('config');
      expect(result.cappedByAgent).toBe(false);
    });
    
    it('should use default for unknown model', () => {
      const resolver = new ContextWindowResolver();
      const model: ModelRef = { provider: 'unknown', model: 'unknown-model' };
      
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(128000); // Default
      expect(result.source).toBe('default');
      expect(result.cappedByAgent).toBe(false);
    });
    
    it('should use custom default when configured', () => {
      const resolver = new ContextWindowResolver({
        defaultContextWindow: 64000
      });
      
      const model: ModelRef = { provider: 'unknown', model: 'unknown-model' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(64000); // Custom default
      expect(result.source).toBe('default');
    });
    
    it('should apply agent context token cap', () => {
      const resolver = new ContextWindowResolver({
        agentContextTokenCap: 50000
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(50000); // Capped
      expect(result.source).toBe('catalog');
      expect(result.cappedByAgent).toBe(true);
    });
    
    it('should not cap if agent limit is higher than model window', () => {
      const resolver = new ContextWindowResolver({
        agentContextTokenCap: 300000
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(200000); // Not capped
      expect(result.source).toBe('catalog');
      expect(result.cappedByAgent).toBe(false);
    });
    
    it('should prioritize config over catalog', () => {
      const resolver = new ContextWindowResolver({
        modelOverrides: {
          anthropic: {
            'claude-sonnet-4': 150000
          }
        }
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(150000); // Config wins
      expect(result.source).toBe('config');
    });
    
    it('should apply agent cap to config override', () => {
      const resolver = new ContextWindowResolver({
        modelOverrides: {
          anthropic: {
            'claude-sonnet-4': 150000
          }
        },
        agentContextTokenCap: 100000
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(100000); // Capped
      expect(result.source).toBe('config');
      expect(result.cappedByAgent).toBe(true);
    });
    
    it('should handle multiple providers in config', () => {
      const resolver = new ContextWindowResolver({
        modelOverrides: {
          anthropic: {
            'claude-sonnet-4': 100000
          },
          openai: {
            'gpt-4-turbo': 80000
          }
        }
      });
      
      const anthropicModel: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const openaiModel: ModelRef = { provider: 'openai', model: 'gpt-4-turbo' };
      
      expect(resolver.resolve(anthropicModel).contextWindow).toBe(100000);
      expect(resolver.resolve(openaiModel).contextWindow).toBe(80000);
    });
    
    it('should update configuration', () => {
      const resolver = new ContextWindowResolver();
      
      resolver.updateConfig({
        agentContextTokenCap: 50000
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(50000);
      expect(result.cappedByAgent).toBe(true);
    });
    
    it('should merge model overrides when updating config', () => {
      const resolver = new ContextWindowResolver({
        modelOverrides: {
          anthropic: {
            'claude-sonnet-4': 100000
          }
        }
      });
      
      resolver.updateConfig({
        modelOverrides: {
          openai: {
            'gpt-4-turbo': 80000
          }
        }
      });
      
      const anthropicModel: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const openaiModel: ModelRef = { provider: 'openai', model: 'gpt-4-turbo' };
      
      // Both should be present after merge
      expect(resolver.resolve(anthropicModel).contextWindow).toBe(100000);
      expect(resolver.resolve(openaiModel).contextWindow).toBe(80000);
    });
    
    it('should get current configuration', () => {
      const config = {
        agentContextTokenCap: 50000,
        defaultContextWindow: 64000
      };
      
      const resolver = new ContextWindowResolver(config);
      const retrievedConfig = resolver.getConfig();
      
      expect(retrievedConfig.agentContextTokenCap).toBe(50000);
      expect(retrievedConfig.defaultContextWindow).toBe(64000);
    });
  });
  
  describe('createContextWindowResolver', () => {
    it('should create resolver with default config', () => {
      const resolver = createContextWindowResolver();
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      
      const result = resolver.resolve(model);
      expect(result.contextWindow).toBe(200000);
    });
    
    it('should create resolver with custom config', () => {
      const resolver = createContextWindowResolver({
        agentContextTokenCap: 50000
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(50000);
      expect(result.cappedByAgent).toBe(true);
    });
  });
  
  describe('resolveContextWindow', () => {
    it('should resolve context window with default config', () => {
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolveContextWindow(model);
      
      expect(result.contextWindow).toBe(200000);
      expect(result.source).toBe('catalog');
    });
    
    it('should resolve context window with custom config', () => {
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolveContextWindow(model, {
        agentContextTokenCap: 50000
      });
      
      expect(result.contextWindow).toBe(50000);
      expect(result.cappedByAgent).toBe(true);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero agent cap', () => {
      const resolver = new ContextWindowResolver({
        agentContextTokenCap: 0
      });
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(0);
      expect(result.cappedByAgent).toBe(true);
    });
    
    it('should handle very large context windows', () => {
      const resolver = new ContextWindowResolver();
      const model: ModelRef = { provider: 'google', model: 'gemini-1.5-pro' };
      
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(2000000); // 2M tokens
      expect(result.source).toBe('catalog');
    });
    
    it('should handle empty config', () => {
      const resolver = new ContextWindowResolver({});
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      
      const result = resolver.resolve(model);
      
      expect(result.contextWindow).toBe(200000);
      expect(result.source).toBe('catalog');
    });
  });
});
