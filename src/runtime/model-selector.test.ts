/**
 * Model Selector Tests
 * 
 * Tests for model selection logic with various configurations and constraints.
 */

import { describe, it, expect } from '@jest/globals';
import { ModelSelector, selectModel, selectModelWithMetadata } from './model-selector.js';
import { TaskType, ModelRef } from './types.js';
import { DEFAULT_MODEL } from './model-catalog.js';

describe('ModelSelector', () => {
  const selector = new ModelSelector();
  
  describe('Basic Selection by Task Type', () => {
    it('should select preferred model for code analysis', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should select preferred model for decision making', () => {
      const model = selector.selectModel(TaskType.DECISION_MAKING);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-opus-4'
      });
    });
    
    it('should select preferred model for pattern matching', () => {
      const model = selector.selectModel(TaskType.PATTERN_MATCHING);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should select preferred model for metric analysis', () => {
      const model = selector.selectModel(TaskType.METRIC_ANALYSIS);
      
      expect(model).toEqual({
        provider: 'openai',
        model: 'o1-mini'
      });
    });
    
    it('should select preferred model for refactoring', () => {
      const model = selector.selectModel(TaskType.REFACTORING);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should select preferred model for consultation', () => {
      const model = selector.selectModel(TaskType.CONSULTATION);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-opus-4'
      });
    });
    
    it('should select preferred model for general tasks', () => {
      const model = selector.selectModel(TaskType.GENERAL);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
  });
  
  describe('Configuration Overrides', () => {
    it('should use forceModel when specified as ModelRef', () => {
      const forced: ModelRef = { provider: 'openai', model: 'gpt-4o' };
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: forced
      });
      
      expect(model).toEqual(forced);
    });
    
    it('should use forceModel when specified as alias', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: 'fast'
      });
      
      expect(model).toEqual({
        provider: 'openai',
        model: 'gpt-4o-mini'
      });
    });
    
    it('should use forceModel when specified as provider/model string', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: 'google/gemini-2.0-flash-exp'
      });
      
      expect(model).toEqual({
        provider: 'google',
        model: 'gemini-2.0-flash-exp'
      });
    });
    
    it('should fall back to preferences if forced model violates constraints', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: 'openai/gpt-4o',
        excludedProviders: ['openai']
      });
      
      // Should fall back to first preference that's not OpenAI
      expect(model.provider).toBe('anthropic');
    });
  });
  
  describe('Provider Filtering', () => {
    it('should filter by allowed providers', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['openai']
      });
      
      expect(model.provider).toBe('openai');
    });
    
    it('should filter by excluded providers', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        excludedProviders: ['anthropic']
      });
      
      expect(model.provider).not.toBe('anthropic');
    });
    
    it('should handle multiple allowed providers', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['openai', 'google']
      });
      
      expect(['openai', 'google']).toContain(model.provider);
    });
    
    it('should handle multiple excluded providers', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        excludedProviders: ['anthropic', 'openai']
      });
      
      expect(model.provider).not.toBe('anthropic');
      expect(model.provider).not.toBe('openai');
    });
    
    it('should fall back to default if all providers filtered out', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['nonexistent']
      });
      
      // Should fall back to default model
      expect(model).toEqual(DEFAULT_MODEL);
    });
  });
  
  describe('Context Window Requirements', () => {
    it('should filter by minimum context window', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        contextWindowMin: 500000
      });
      
      // Should select a model with large context window (Gemini)
      expect(model.provider).toBe('google');
    });
    
    it('should keep models meeting context window requirement', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        contextWindowMin: 128000
      });
      
      // Most models meet this requirement, should get first preference
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should fall back to default if context window too high', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        contextWindowMin: 10000000 // Impossibly high
      });
      
      // Should fall back to default
      expect(model).toEqual(DEFAULT_MODEL);
    });
  });
  
  describe('Cost Tier Filtering', () => {
    it('should filter by maximum cost tier - low', () => {
      const model = selector.selectModel(TaskType.GENERAL, {
        maxCostTier: 'low'
      });
      
      // Should select a low-cost model (GENERAL has haiku in preferences)
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.characteristics.costTier).toBe('low');
    });
    
    it('should filter by maximum cost tier - medium', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        maxCostTier: 'medium'
      });
      
      // Should select a model with cost tier <= medium
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(['low', 'medium']).toContain(info?.characteristics.costTier);
    });
    
    it('should allow high cost models when maxCostTier is high', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        maxCostTier: 'high'
      });
      
      // Should get first preference (which is high tier)
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should allow premium models when maxCostTier is premium', () => {
      const model = selector.selectModel(TaskType.DECISION_MAKING, {
        maxCostTier: 'premium'
      });
      
      // Should get first preference (which is premium)
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-opus-4'
      });
    });
  });
  
  describe('Capability Requirements', () => {
    it('should filter by code capability', () => {
      const model = selector.selectModel(TaskType.GENERAL, {
        requireCapabilities: { code: true }
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.capabilities.code).toBe(true);
    });
    
    it('should filter by reasoning capability', () => {
      const model = selector.selectModel(TaskType.GENERAL, {
        requireCapabilities: { reasoning: true }
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.capabilities.reasoning).toBe(true);
    });
    
    it('should filter by vision capability', () => {
      const model = selector.selectModel(TaskType.GENERAL, {
        requireCapabilities: { vision: true }
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.capabilities.vision).toBe(true);
    });
    
    it('should filter by tools capability', () => {
      const model = selector.selectModel(TaskType.GENERAL, {
        requireCapabilities: { tools: true }
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.capabilities.tools).toBe(true);
    });
    
    it('should filter by multiple capabilities', () => {
      const model = selector.selectModel(TaskType.GENERAL, {
        requireCapabilities: {
          code: true,
          reasoning: true,
          vision: true
        }
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.capabilities.code).toBe(true);
      expect(info?.capabilities.reasoning).toBe(true);
      expect(info?.capabilities.vision).toBe(true);
    });
  });
  
  describe('Combined Filters', () => {
    it('should apply multiple filters together', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['anthropic', 'openai'],
        contextWindowMin: 150000,
        maxCostTier: 'high'
      });
      
      // Should find a model meeting all criteria
      expect(['anthropic', 'openai']).toContain(model.provider);
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.contextWindow).toBeGreaterThanOrEqual(150000);
    });
    
    it('should handle conflicting filters gracefully', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['openai'],
        excludedProviders: ['openai']
      });
      
      // Should fall back to default
      expect(model).toEqual(DEFAULT_MODEL);
    });
  });
  
  describe('Selection Metadata', () => {
    it('should return metadata for forced selection', () => {
      const result = selector.selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
        forceModel: 'fast'
      });
      
      expect(result.reason).toBe('forced');
      expect(result.model).toEqual({
        provider: 'openai',
        model: 'gpt-4o-mini'
      });
    });
    
    it('should return metadata for preference selection', () => {
      const result = selector.selectModelWithMetadata(TaskType.CODE_ANALYSIS);
      
      expect(result.reason).toBe('preference');
      expect(result.preferenceRank).toBe(0);
      expect(result.filteredCount).toBe(0);
    });
    
    it('should return metadata for fallback selection', () => {
      const result = selector.selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['nonexistent']
      });
      
      expect(result.reason).toBe('fallback');
      expect(result.filteredCount).toBeGreaterThan(0);
    });
    
    it('should track filtered count', () => {
      const result = selector.selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
        excludedProviders: ['anthropic']
      });
      
      expect(result.filteredCount).toBeGreaterThan(0);
    });
    
    it('should track preference rank', () => {
      const result = selector.selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
        excludedProviders: ['anthropic']
      });
      
      expect(result.preferenceRank).toBeGreaterThan(0);
    });
  });
  
  describe('Fallback Behavior', () => {
    it('should fall back to default when no preferences match', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['unknown-provider']
      });
      
      expect(model).toEqual(DEFAULT_MODEL);
    });
    
    it('should return default even if it violates constraints (last resort)', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['unknown-provider'],
        excludedProviders: [DEFAULT_MODEL.provider]
      });
      
      // Should still return default as last resort
      expect(model).toEqual(DEFAULT_MODEL);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty options', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {});
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should handle undefined options', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should handle empty allowedProviders array', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: []
      });
      
      // Empty array should not filter anything
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should handle empty excludedProviders array', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        excludedProviders: []
      });
      
      // Empty array should not filter anything
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
  });
  
  describe('Convenience Functions', () => {
    it('should work with selectModel convenience function', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS);
      
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should work with selectModelWithMetadata convenience function', () => {
      const result = selectModelWithMetadata(TaskType.CODE_ANALYSIS);
      
      expect(result.model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
      expect(result.reason).toBe('preference');
    });
  });
  
  describe('Real-World Scenarios', () => {
    it('should select fast model for simple tasks with cost constraint', () => {
      const model = selector.selectModel(TaskType.GENERAL, {
        maxCostTier: 'low'
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.characteristics.costTier).toBe('low');
      expect(info?.characteristics.speedTier).toBe('fast');
    });
    
    it('should select reasoning model for complex analysis', () => {
      const model = selector.selectModel(TaskType.DECISION_MAKING, {
        requireCapabilities: { reasoning: true }
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.capabilities.reasoning).toBe(true);
    });
    
    it('should select large context model for big codebases', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        contextWindowMin: 500000
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(info?.contextWindow).toBeGreaterThanOrEqual(500000);
    });
    
    it('should respect provider preferences in enterprise settings', () => {
      const model = selector.selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['anthropic'] // Enterprise only uses Anthropic
      });
      
      expect(model.provider).toBe('anthropic');
    });
    
    it('should handle budget-constrained scenarios', () => {
      const model = selector.selectModel(TaskType.REFACTORING, {
        maxCostTier: 'medium',
        requireCapabilities: { code: true }
      });
      
      const info = require('./model-catalog.js').getModelInfo(model);
      expect(['low', 'medium']).toContain(info?.characteristics.costTier);
      expect(info?.capabilities.code).toBe(true);
    });
  });
});
