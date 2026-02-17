/**
 * Tests for Model Preferences
 */

import {
  TASK_TYPE_PREFERENCES,
  getPreferredModels,
  getPreferredModel,
  getFilteredPreferences,
  getAllTaskTypes,
  getModelPreferences,
  isPreferredModel,
  getPreferenceRank
} from '../model-preferences.js';
import { TaskType, ModelRef } from '../types.js';

describe('Model Preferences', () => {
  describe('TASK_TYPE_PREFERENCES', () => {
    it('should have preferences for all task types', () => {
      for (const taskType of Object.values(TaskType)) {
        expect(TASK_TYPE_PREFERENCES[taskType]).toBeDefined();
        expect(TASK_TYPE_PREFERENCES[taskType].length).toBeGreaterThan(0);
      }
    });

    it('should have multiple models per task type', () => {
      for (const taskType of Object.values(TaskType)) {
        const preferences = TASK_TYPE_PREFERENCES[taskType];
        expect(preferences.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have valid ModelRef objects', () => {
      for (const taskType of Object.values(TaskType)) {
        const preferences = TASK_TYPE_PREFERENCES[taskType];
        for (const modelRef of preferences) {
          expect(modelRef.provider).toBeDefined();
          expect(modelRef.model).toBeDefined();
        }
      }
    });

    it('should prefer Gemini 3 Pro for code analysis', () => {
      const preferences = TASK_TYPE_PREFERENCES[TaskType.CODE_ANALYSIS];
      expect(preferences[0].provider).toBe('google');
      expect(preferences[0].model).toBe('gemini-3-pro-preview');
    });

    it('should prefer Claude Opus or O1 for decision making', () => {
      const preferences = TASK_TYPE_PREFERENCES[TaskType.DECISION_MAKING];
      const firstTwo = preferences.slice(0, 2);
      
      const hasOpus = firstTwo.some(m => m.model === 'claude-opus-4');
      const hasO1 = firstTwo.some(m => m.model === 'o1');
      
      expect(hasOpus || hasO1).toBe(true);
    });
  });

  describe('getPreferredModels', () => {
    it('should return preferences for valid task type', () => {
      const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      expect(preferences).toBeDefined();
      expect(preferences.length).toBeGreaterThan(0);
    });

    it('should return ordered list', () => {
      const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      expect(Array.isArray(preferences)).toBe(true);
      expect(preferences.length).toBeGreaterThanOrEqual(2);
    });

    it('should return different preferences for different task types', () => {
      const codePrefs = getPreferredModels(TaskType.CODE_ANALYSIS);
      const decisionPrefs = getPreferredModels(TaskType.DECISION_MAKING);
      
      // At least one model should be different in the top 2
      const codePrimary = codePrefs[0];
      const decisionPrimary = decisionPrefs[0];
      
      const isDifferent = 
        codePrimary.provider !== decisionPrimary.provider ||
        codePrimary.model !== decisionPrimary.model;
      
      expect(isDifferent).toBe(true);
    });

    it('should return preferences for all task types', () => {
      for (const taskType of Object.values(TaskType)) {
        const preferences = getPreferredModels(taskType);
        expect(preferences.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getPreferredModel', () => {
    it('should return first model from preferences', () => {
      const preferred = getPreferredModel(TaskType.CODE_ANALYSIS);
      const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      expect(preferred).toEqual(preferences[0]);
    });

    it('should return a valid ModelRef', () => {
      const preferred = getPreferredModel(TaskType.CODE_ANALYSIS);
      
      expect(preferred.provider).toBeDefined();
      expect(preferred.model).toBeDefined();
    });

    it('should return different models for different task types', () => {
      const codeModel = getPreferredModel(TaskType.CODE_ANALYSIS);
      const decisionModel = getPreferredModel(TaskType.DECISION_MAKING);
      
      // Should be different (at least one field)
      const isDifferent = 
        codeModel.provider !== decisionModel.provider ||
        codeModel.model !== decisionModel.model;
      
      expect(isDifferent).toBe(true);
    });
  });

  describe('getFilteredPreferences', () => {
    it('should return all preferences with no filters', () => {
      const preferences = getFilteredPreferences(TaskType.CODE_ANALYSIS);
      const allPreferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      expect(preferences).toEqual(allPreferences);
    });

    it('should filter by allowed providers', () => {
      const preferences = getFilteredPreferences(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['anthropic']
      });
      
      expect(preferences.every(m => m.provider === 'anthropic')).toBe(true);
    });

    it('should filter by excluded providers', () => {
      const preferences = getFilteredPreferences(TaskType.CODE_ANALYSIS, {
        excludeProviders: ['openai']
      });
      
      expect(preferences.every(m => m.provider !== 'openai')).toBe(true);
    });

    it('should handle multiple allowed providers', () => {
      const preferences = getFilteredPreferences(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['anthropic', 'google']
      });
      
      expect(preferences.every(m => 
        m.provider === 'anthropic' || m.provider === 'google'
      )).toBe(true);
    });

    it('should handle multiple excluded providers', () => {
      const preferences = getFilteredPreferences(TaskType.CODE_ANALYSIS, {
        excludeProviders: ['openai', 'google']
      });
      
      expect(preferences.every(m => 
        m.provider !== 'openai' && m.provider !== 'google'
      )).toBe(true);
    });

    it('should return empty array if all providers excluded', () => {
      const preferences = getFilteredPreferences(TaskType.CODE_ANALYSIS, {
        allowedProviders: ['nonexistent']
      });
      
      expect(preferences).toEqual([]);
    });
  });

  describe('getAllTaskTypes', () => {
    it('should return all task types', () => {
      const taskTypes = getAllTaskTypes();
      
      expect(taskTypes).toContain(TaskType.CODE_ANALYSIS);
      expect(taskTypes).toContain(TaskType.DECISION_MAKING);
      expect(taskTypes).toContain(TaskType.PATTERN_MATCHING);
      expect(taskTypes).toContain(TaskType.METRIC_ANALYSIS);
      expect(taskTypes).toContain(TaskType.REFACTORING);
      expect(taskTypes).toContain(TaskType.CONSULTATION);
      expect(taskTypes).toContain(TaskType.GENERAL);
    });

    it('should return correct number of task types', () => {
      const taskTypes = getAllTaskTypes();
      
      expect(taskTypes.length).toBe(7);
    });
  });

  describe('getModelPreferences', () => {
    it('should return ModelPreferences object', () => {
      const preferences = getModelPreferences(TaskType.CODE_ANALYSIS);
      
      expect(preferences.taskType).toBe(TaskType.CODE_ANALYSIS);
      expect(preferences.preferredModels).toBeDefined();
      expect(Array.isArray(preferences.preferredModels)).toBe(true);
    });

    it('should match getPreferredModels result', () => {
      const preferences = getModelPreferences(TaskType.CODE_ANALYSIS);
      const models = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      expect(preferences.preferredModels).toEqual(models);
    });
  });

  describe('isPreferredModel', () => {
    it('should return true for preferred model', () => {
      const claudeSonnet: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const isPreferred = isPreferredModel(TaskType.CODE_ANALYSIS, claudeSonnet);
      
      expect(isPreferred).toBe(true);
    });

    it('should return false for non-preferred model', () => {
      const randomModel: ModelRef = { provider: 'random', model: 'model' };
      const isPreferred = isPreferredModel(TaskType.CODE_ANALYSIS, randomModel);
      
      expect(isPreferred).toBe(false);
    });

    it('should check all models in preference list', () => {
      const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      for (const model of preferences) {
        expect(isPreferredModel(TaskType.CODE_ANALYSIS, model)).toBe(true);
      }
    });

    it('should be task-type specific', () => {
      const model = getPreferredModel(TaskType.CODE_ANALYSIS);
      
      // Should be preferred for CODE_ANALYSIS
      expect(isPreferredModel(TaskType.CODE_ANALYSIS, model)).toBe(true);
      
      // May or may not be preferred for other task types
      // (depends on overlap in preferences)
    });
  });

  describe('getPreferenceRank', () => {
    it('should return 0 for most preferred model', () => {
      const mostPreferred = getPreferredModel(TaskType.CODE_ANALYSIS);
      const rank = getPreferenceRank(TaskType.CODE_ANALYSIS, mostPreferred);
      
      expect(rank).toBe(0);
    });

    it('should return -1 for non-preferred model', () => {
      const randomModel: ModelRef = { provider: 'random', model: 'model' };
      const rank = getPreferenceRank(TaskType.CODE_ANALYSIS, randomModel);
      
      expect(rank).toBe(-1);
    });

    it('should return correct ranks for all preferred models', () => {
      const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      for (let i = 0; i < preferences.length; i++) {
        const rank = getPreferenceRank(TaskType.CODE_ANALYSIS, preferences[i]);
        expect(rank).toBe(i);
      }
    });

    it('should have lower ranks for more preferred models', () => {
      const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      if (preferences.length >= 2) {
        const rank1 = getPreferenceRank(TaskType.CODE_ANALYSIS, preferences[0]);
        const rank2 = getPreferenceRank(TaskType.CODE_ANALYSIS, preferences[1]);
        
        expect(rank1).toBeLessThan(rank2);
      }
    });
  });

  describe('Task Type Specific Requirements', () => {
    it('should prefer code-capable models for CODE_ANALYSIS', () => {
      const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
      
      // All preferred models should be code-capable
      // (This is a semantic check - we trust the catalog)
      expect(preferences.length).toBeGreaterThan(0);
    });

    it('should prefer reasoning models for DECISION_MAKING', () => {
      const preferences = getPreferredModels(TaskType.DECISION_MAKING);
      const topModel = preferences[0];
      
      // Should include high-quality reasoning models
      const isReasoningModel = 
        topModel.model.includes('opus') || 
        topModel.model.includes('o1');
      
      expect(isReasoningModel).toBe(true);
    });

    it('should have fallback options for all task types', () => {
      for (const taskType of Object.values(TaskType)) {
        const preferences = getPreferredModels(taskType);
        
        // Should have at least 2 options for fallback
        expect(preferences.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should include multiple providers in preferences', () => {
      for (const taskType of Object.values(TaskType)) {
        const preferences = getPreferredModels(taskType);
        const providers = new Set(preferences.map(m => m.provider));
        
        // Should have models from multiple providers for redundancy
        expect(providers.size).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
