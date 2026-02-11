/**
 * Model Selector Integration Tests
 * 
 * Demonstrates real-world usage scenarios for model selection.
 */

import { describe, it, expect } from '@jest/globals';
import { selectModel, selectModelWithMetadata } from './model-selector.js';
import { TaskType } from './types.js';
import { getModelInfo } from './model-catalog.js';

describe('ModelSelector Integration Tests', () => {
  describe('Scenario: Code Review Agent', () => {
    it('should select appropriate model for code analysis with quality focus', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS);
      
      // Should get Claude Sonnet (balanced quality and speed for code)
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
      
      const info = getModelInfo(model);
      expect(info?.capabilities.code).toBe(true);
      expect(info?.characteristics.qualityTier).toBe('high');
    });
    
    it('should select fast model for quick code checks', () => {
      const model = selectModel(TaskType.GENERAL, {
        maxCostTier: 'low',
        requireCapabilities: { code: true }
      });
      
      // Should get a fast, low-cost model with code capability
      const info = getModelInfo(model);
      expect(info?.characteristics.costTier).toBe('low');
      expect(info?.characteristics.speedTier).toBe('fast');
      expect(info?.capabilities.code).toBe(true);
    });
  });
  
  describe('Scenario: Strategic Decision Making', () => {
    it('should select best reasoning model for complex decisions', () => {
      const model = selectModel(TaskType.DECISION_MAKING);
      
      // Should get Claude Opus (best for reasoning)
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-opus-4'
      });
      
      const info = getModelInfo(model);
      expect(info?.capabilities.reasoning).toBe(true);
      expect(info?.characteristics.qualityTier).toBe('premium');
    });
    
    it('should respect budget constraints for routine decisions', () => {
      const model = selectModel(TaskType.DECISION_MAKING, {
        maxCostTier: 'high'
      });
      
      // Should get a high-quality but not premium model
      const info = getModelInfo(model);
      expect(['low', 'medium', 'high']).toContain(info?.characteristics.costTier);
      expect(info?.capabilities.reasoning).toBe(true);
    });
  });
  
  describe('Scenario: Large Codebase Analysis', () => {
    it('should select model with huge context window', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        contextWindowMin: 1000000
      });
      
      // Should get Gemini with massive context
      expect(model.provider).toBe('google');
      
      const info = getModelInfo(model);
      expect(info?.contextWindow).toBeGreaterThanOrEqual(1000000);
    });
    
    it('should balance context window and code capability', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        contextWindowMin: 200000,
        requireCapabilities: { code: true, reasoning: true }
      });
      
      const info = getModelInfo(model);
      expect(info?.contextWindow).toBeGreaterThanOrEqual(200000);
      expect(info?.capabilities.code).toBe(true);
      expect(info?.capabilities.reasoning).toBe(true);
    });
  });
  
  describe('Scenario: Enterprise with Provider Restrictions', () => {
    it('should respect Anthropic-only policy', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['anthropic']
      });
      
      expect(model.provider).toBe('anthropic');
    });
    
    it('should respect OpenAI-only policy', () => {
      const model = selectModel(TaskType.DECISION_MAKING, {
        allowedProviders: ['openai']
      });
      
      expect(model.provider).toBe('openai');
    });
    
    it('should handle multi-provider allowlist', () => {
      const model = selectModel(TaskType.GENERAL, {
        allowedProviders: ['anthropic', 'google']
      });
      
      expect(['anthropic', 'google']).toContain(model.provider);
    });
  });
  
  describe('Scenario: Cost-Optimized Operations', () => {
    it('should select cheapest viable model for batch processing', () => {
      const model = selectModel(TaskType.GENERAL, {
        maxCostTier: 'low'
      });
      
      const info = getModelInfo(model);
      expect(info?.characteristics.costTier).toBe('low');
      expect(info?.characteristics.speedTier).toBe('fast');
    });
    
    it('should balance cost and quality for production workloads', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        maxCostTier: 'high',
        requireCapabilities: { code: true }
      });
      
      const info = getModelInfo(model);
      expect(['low', 'medium', 'high']).toContain(info?.characteristics.costTier);
      expect(info?.capabilities.code).toBe(true);
    });
  });
  
  describe('Scenario: Multimodal Requirements', () => {
    it('should select model with vision capability', () => {
      const model = selectModel(TaskType.GENERAL, {
        requireCapabilities: { vision: true }
      });
      
      const info = getModelInfo(model);
      expect(info?.capabilities.vision).toBe(true);
    });
    
    it('should select model with tools capability', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        requireCapabilities: { tools: true }
      });
      
      const info = getModelInfo(model);
      expect(info?.capabilities.tools).toBe(true);
    });
  });
  
  describe('Scenario: Forced Model Selection', () => {
    it('should use specific model when forced by user', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: { provider: 'openai', model: 'gpt-4o' }
      });
      
      expect(model).toEqual({
        provider: 'openai',
        model: 'gpt-4o'
      });
    });
    
    it('should use alias when forced', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: 'fast'
      });
      
      expect(model).toEqual({
        provider: 'openai',
        model: 'gpt-4o-mini'
      });
    });
    
    it('should use provider/model format when forced', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: 'google/gemini-1.5-pro'
      });
      
      expect(model).toEqual({
        provider: 'google',
        model: 'gemini-1.5-pro'
      });
    });
  });
  
  describe('Scenario: Selection Metadata for Monitoring', () => {
    it('should provide metadata for preference-based selection', () => {
      const result = selectModelWithMetadata(TaskType.CODE_ANALYSIS);
      
      expect(result.reason).toBe('preference');
      expect(result.preferenceRank).toBe(0);
      expect(result.model.provider).toBe('anthropic');
    });
    
    it('should provide metadata for forced selection', () => {
      const result = selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
        forceModel: 'fast'
      });
      
      expect(result.reason).toBe('forced');
      expect(result.model.model).toBe('gpt-4o-mini');
    });
    
    it('should provide metadata for fallback selection', () => {
      const result = selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['nonexistent']
      });
      
      expect(result.reason).toBe('fallback');
      expect(result.filteredCount).toBeGreaterThan(0);
    });
    
    it('should track how many models were filtered', () => {
      const result = selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
        excludedProviders: ['anthropic']
      });
      
      expect(result.filteredCount).toBeGreaterThan(0);
      expect(result.preferenceRank).toBeGreaterThan(0);
    });
  });
  
  describe('Scenario: Complex Multi-Constraint Selection', () => {
    it('should handle multiple constraints together', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['anthropic', 'openai'],
        maxCostTier: 'high',
        contextWindowMin: 128000,
        requireCapabilities: { code: true, reasoning: true }
      });
      
      // Should find a model meeting all criteria
      expect(['anthropic', 'openai']).toContain(model.provider);
      
      const info = getModelInfo(model);
      expect(['low', 'medium', 'high']).toContain(info?.characteristics.costTier);
      expect(info?.contextWindow).toBeGreaterThanOrEqual(128000);
      expect(info?.capabilities.code).toBe(true);
      expect(info?.capabilities.reasoning).toBe(true);
    });
    
    it('should gracefully handle impossible constraints', () => {
      const model = selectModel(TaskType.CODE_ANALYSIS, {
        contextWindowMin: 10000000, // Impossibly high
        maxCostTier: 'low',
        requireCapabilities: { reasoning: true, vision: true }
      });
      
      // Should fall back to default
      expect(model).toBeDefined();
    });
  });
  
  describe('Scenario: Task-Specific Optimizations', () => {
    it('should optimize for metric analysis tasks', () => {
      const model = selectModel(TaskType.METRIC_ANALYSIS);
      
      // Should get o1-mini (good for data analysis)
      expect(model).toEqual({
        provider: 'openai',
        model: 'o1-mini'
      });
    });
    
    it('should optimize for refactoring tasks', () => {
      const model = selectModel(TaskType.REFACTORING);
      
      // Should get Claude Sonnet (good for code generation)
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4'
      });
    });
    
    it('should optimize for consultation tasks', () => {
      const model = selectModel(TaskType.CONSULTATION);
      
      // Should get Claude Opus (best for explanations)
      expect(model).toEqual({
        provider: 'anthropic',
        model: 'claude-opus-4'
      });
    });
  });
});
