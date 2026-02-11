/**
 * Tests for Model Catalog
 */

import {
  MODEL_CATALOG,
  DEFAULT_MODEL,
  getModelInfo,
  getContextWindow,
  isModelInCatalog,
  getProviderModels,
  getAvailableProviders
} from '../model-catalog.js';
import { ModelRef } from '../types.js';

describe('Model Catalog', () => {
  describe('MODEL_CATALOG', () => {
    it('should contain anthropic models', () => {
      expect(MODEL_CATALOG.anthropic).toBeDefined();
      expect(MODEL_CATALOG.anthropic['claude-sonnet-4']).toBeDefined();
      expect(MODEL_CATALOG.anthropic['claude-opus-4']).toBeDefined();
      expect(MODEL_CATALOG.anthropic['claude-haiku-4']).toBeDefined();
    });

    it('should contain openai models', () => {
      expect(MODEL_CATALOG.openai).toBeDefined();
      expect(MODEL_CATALOG.openai['gpt-4-turbo']).toBeDefined();
      expect(MODEL_CATALOG.openai['gpt-4o']).toBeDefined();
      expect(MODEL_CATALOG.openai['gpt-4o-mini']).toBeDefined();
      expect(MODEL_CATALOG.openai['o1']).toBeDefined();
      expect(MODEL_CATALOG.openai['o1-mini']).toBeDefined();
    });

    it('should contain google models', () => {
      expect(MODEL_CATALOG.google).toBeDefined();
      expect(MODEL_CATALOG.google['gemini-2.0-flash-exp']).toBeDefined();
      expect(MODEL_CATALOG.google['gemini-1.5-pro']).toBeDefined();
      expect(MODEL_CATALOG.google['gemini-1.5-flash']).toBeDefined();
    });

    it('should have valid context windows for all models', () => {
      for (const provider of Object.keys(MODEL_CATALOG)) {
        for (const model of Object.values(MODEL_CATALOG[provider])) {
          expect(model.contextWindow).toBeGreaterThan(0);
          expect(typeof model.contextWindow).toBe('number');
        }
      }
    });

    it('should have complete capabilities for all models', () => {
      for (const provider of Object.keys(MODEL_CATALOG)) {
        for (const model of Object.values(MODEL_CATALOG[provider])) {
          expect(model.capabilities).toBeDefined();
          expect(typeof model.capabilities.code).toBe('boolean');
          expect(typeof model.capabilities.reasoning).toBe('boolean');
          expect(typeof model.capabilities.general).toBe('boolean');
        }
      }
    });

    it('should have complete characteristics for all models', () => {
      for (const provider of Object.keys(MODEL_CATALOG)) {
        for (const model of Object.values(MODEL_CATALOG[provider])) {
          expect(model.characteristics).toBeDefined();
          expect(['low', 'medium', 'high', 'premium']).toContain(model.characteristics.costTier);
          expect(['fast', 'medium', 'slow']).toContain(model.characteristics.speedTier);
          expect(['standard', 'high', 'premium']).toContain(model.characteristics.qualityTier);
        }
      }
    });

    it('should have descriptions for all models', () => {
      for (const provider of Object.keys(MODEL_CATALOG)) {
        for (const model of Object.values(MODEL_CATALOG[provider])) {
          expect(model.description).toBeDefined();
          expect(model.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('DEFAULT_MODEL', () => {
    it('should be defined', () => {
      expect(DEFAULT_MODEL).toBeDefined();
      expect(DEFAULT_MODEL.provider).toBeDefined();
      expect(DEFAULT_MODEL.model).toBeDefined();
    });

    it('should exist in catalog', () => {
      expect(isModelInCatalog(DEFAULT_MODEL)).toBe(true);
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for valid model', () => {
      const modelRef: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const info = getModelInfo(modelRef);
      
      expect(info).toBeDefined();
      expect(info?.ref.provider).toBe('anthropic');
      expect(info?.ref.model).toBe('claude-sonnet-4');
      expect(info?.contextWindow).toBe(200000);
    });

    it('should return undefined for invalid provider', () => {
      const modelRef: ModelRef = { provider: 'invalid', model: 'model' };
      const info = getModelInfo(modelRef);
      
      expect(info).toBeUndefined();
    });

    it('should return undefined for invalid model', () => {
      const modelRef: ModelRef = { provider: 'anthropic', model: 'invalid-model' };
      const info = getModelInfo(modelRef);
      
      expect(info).toBeUndefined();
    });

    it('should return correct info for all catalog models', () => {
      for (const provider of Object.keys(MODEL_CATALOG)) {
        for (const modelName of Object.keys(MODEL_CATALOG[provider])) {
          const modelRef: ModelRef = { provider, model: modelName };
          const info = getModelInfo(modelRef);
          
          expect(info).toBeDefined();
          expect(info?.ref.provider).toBe(provider);
          expect(info?.ref.model).toBe(modelName);
        }
      }
    });
  });

  describe('getContextWindow', () => {
    it('should return correct context window for valid model', () => {
      const modelRef: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const contextWindow = getContextWindow(modelRef);
      
      expect(contextWindow).toBe(200000);
    });

    it('should return default context window for invalid model', () => {
      const modelRef: ModelRef = { provider: 'invalid', model: 'model' };
      const contextWindow = getContextWindow(modelRef);
      
      expect(contextWindow).toBe(128000); // Default
    });

    it('should return correct context windows for different models', () => {
      expect(getContextWindow({ provider: 'google', model: 'gemini-1.5-pro' })).toBe(2000000);
      expect(getContextWindow({ provider: 'openai', model: 'gpt-4-turbo' })).toBe(128000);
      expect(getContextWindow({ provider: 'anthropic', model: 'claude-opus-4' })).toBe(200000);
    });
  });

  describe('isModelInCatalog', () => {
    it('should return true for valid models', () => {
      expect(isModelInCatalog({ provider: 'anthropic', model: 'claude-sonnet-4' })).toBe(true);
      expect(isModelInCatalog({ provider: 'openai', model: 'gpt-4o' })).toBe(true);
      expect(isModelInCatalog({ provider: 'google', model: 'gemini-2.0-flash-exp' })).toBe(true);
    });

    it('should return false for invalid provider', () => {
      expect(isModelInCatalog({ provider: 'invalid', model: 'model' })).toBe(false);
    });

    it('should return false for invalid model', () => {
      expect(isModelInCatalog({ provider: 'anthropic', model: 'invalid-model' })).toBe(false);
    });
  });

  describe('getProviderModels', () => {
    it('should return all models for valid provider', () => {
      const anthropicModels = getProviderModels('anthropic');
      
      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(anthropicModels.every(m => m.ref.provider === 'anthropic')).toBe(true);
    });

    it('should return empty array for invalid provider', () => {
      const models = getProviderModels('invalid');
      
      expect(models).toEqual([]);
    });

    it('should return correct number of models per provider', () => {
      expect(getProviderModels('anthropic').length).toBe(3);
      expect(getProviderModels('openai').length).toBe(5);
      expect(getProviderModels('google').length).toBe(3);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return all providers', () => {
      const providers = getAvailableProviders();
      
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
    });

    it('should return correct number of providers', () => {
      const providers = getAvailableProviders();
      
      expect(providers.length).toBe(3);
    });
  });

  describe('Context Window Requirements', () => {
    it('should have models with large context windows', () => {
      const largeContextModels = Object.values(MODEL_CATALOG)
        .flatMap(provider => Object.values(provider))
        .filter(model => model.contextWindow >= 200000);
      
      expect(largeContextModels.length).toBeGreaterThan(0);
    });

    it('should have at least one model with 1M+ context window', () => {
      const hugeContextModels = Object.values(MODEL_CATALOG)
        .flatMap(provider => Object.values(provider))
        .filter(model => model.contextWindow >= 1000000);
      
      expect(hugeContextModels.length).toBeGreaterThan(0);
    });
  });

  describe('Model Capabilities Requirements', () => {
    it('should have models optimized for code', () => {
      const codeModels = Object.values(MODEL_CATALOG)
        .flatMap(provider => Object.values(provider))
        .filter(model => model.capabilities.code);
      
      expect(codeModels.length).toBeGreaterThan(0);
    });

    it('should have models optimized for reasoning', () => {
      const reasoningModels = Object.values(MODEL_CATALOG)
        .flatMap(provider => Object.values(provider))
        .filter(model => model.capabilities.reasoning);
      
      expect(reasoningModels.length).toBeGreaterThan(0);
    });

    it('should have models with vision capabilities', () => {
      const visionModels = Object.values(MODEL_CATALOG)
        .flatMap(provider => Object.values(provider))
        .filter(model => model.capabilities.vision);
      
      expect(visionModels.length).toBeGreaterThan(0);
    });
  });
});
