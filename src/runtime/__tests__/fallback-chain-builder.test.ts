/**
 * Tests for Fallback Chain Builder
 */

import {
  FallbackChainBuilder,
  buildFallbackChain,
  buildFallbackChainWithProviderPreference
} from '../fallback-chain-builder';
import { ModelRef } from '../types';

describe('FallbackChainBuilder', () => {
  let builder: FallbackChainBuilder;
  
  beforeEach(() => {
    builder = new FallbackChainBuilder();
  });
  
  describe('buildChain', () => {
    it('should start with primary model', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChain(primary);
      
      expect(chain[0]).toEqual(primary);
    });
    
    it('should include explicit fallbacks when configured', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const fallback1: ModelRef = { provider: 'openai', model: 'gpt-4o' };
      const fallback2: ModelRef = { provider: 'google', model: 'gemini-2.0-flash-exp' };
      
      const chain = builder.buildChain(primary, {
        explicitFallbacks: [fallback1, fallback2]
      });
      
      expect(chain).toHaveLength(3);
      expect(chain[0]).toEqual(primary);
      expect(chain[1]).toEqual(fallback1);
      expect(chain[2]).toEqual(fallback2);
    });
    
    it('should include default fallbacks when no explicit fallbacks', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-opus-4' };
      const chain = builder.buildChain(primary);
      
      // Should have primary + default fallbacks
      expect(chain.length).toBeGreaterThan(1);
      expect(chain[0]).toEqual(primary);
    });
    
    it('should filter by allowlist', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChain(primary, {
        allowedProviders: ['anthropic']
      });
      
      // All models should be from anthropic
      chain.forEach(model => {
        expect(model.provider).toBe('anthropic');
      });
    });
    
    it('should filter by blocklist', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChain(primary, {
        excludedProviders: ['openai']
      });
      
      // No models should be from openai
      chain.forEach(model => {
        expect(model.provider).not.toBe('openai');
      });
    });
    
    it('should remove duplicates', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const duplicate: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      
      const chain = builder.buildChain(primary, {
        explicitFallbacks: [duplicate]
      });
      
      // Should only have one instance of the model
      expect(chain).toHaveLength(1);
      expect(chain[0]).toEqual(primary);
    });
    
    it('should respect maxChainLength', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChain(primary, {
        maxChainLength: 2
      });
      
      expect(chain.length).toBeLessThanOrEqual(2);
    });
    
    it('should handle empty allowlist (no models)', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChain(primary, {
        allowedProviders: ['nonexistent']
      });
      
      // Should return empty chain since primary is filtered out
      expect(chain).toHaveLength(0);
    });
  });
  
  describe('buildChainWithProviderPreference', () => {
    it('should prefer same-provider models', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChainWithProviderPreference(primary);
      
      expect(chain[0]).toEqual(primary);
      
      // Next models should be from same provider (if available)
      const sameProviderCount = chain.filter(m => m.provider === 'anthropic').length;
      expect(sameProviderCount).toBeGreaterThan(1);
    });
    
    it('should include cross-provider fallbacks by default', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChainWithProviderPreference(primary);
      
      // Should have models from multiple providers
      const providers = new Set(chain.map(m => m.provider));
      expect(providers.size).toBeGreaterThan(1);
    });
    
    it('should exclude cross-provider fallbacks when disabled', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChainWithProviderPreference(primary, {
        crossProviderFallback: false
      });
      
      // All models should be from same provider
      chain.forEach(model => {
        expect(model.provider).toBe('anthropic');
      });
    });
    
    it('should respect allowlist with provider preference', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = builder.buildChainWithProviderPreference(primary, {
        allowedProviders: ['anthropic', 'openai']
      });
      
      // All models should be from allowed providers
      chain.forEach(model => {
        expect(['anthropic', 'openai']).toContain(model.provider);
      });
    });
  });
  
  describe('convenience functions', () => {
    it('buildFallbackChain should work', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = buildFallbackChain(primary);
      
      expect(chain[0]).toEqual(primary);
      expect(chain.length).toBeGreaterThan(1);
    });
    
    it('buildFallbackChainWithProviderPreference should work', () => {
      const primary: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const chain = buildFallbackChainWithProviderPreference(primary);
      
      expect(chain[0]).toEqual(primary);
      expect(chain.length).toBeGreaterThan(1);
    });
  });
});
