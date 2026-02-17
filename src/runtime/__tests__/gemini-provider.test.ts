/**
 * Gemini Provider Tests
 */

import { getGeminiModels, getGeminiContextWindow } from '../gemini-provider.js';

describe('Gemini Provider', () => {
  describe('getGeminiModels', () => {
    it('should return available Gemini models', () => {
      const models = getGeminiModels();
      
      expect(models).toHaveLength(2);
      expect(models).toEqual([
        { provider: 'google', model: 'gemini-3-pro-preview' },
        { provider: 'google', model: 'gemini-2.5-pro' },
      ]);
    });
    
    it('should return models with google provider', () => {
      const models = getGeminiModels();
      
      for (const model of models) {
        expect(model.provider).toBe('google');
      }
    });
  });
  
  describe('getGeminiContextWindow', () => {
    it('should return correct context window for gemini-3-pro-preview', () => {
      const contextWindow = getGeminiContextWindow('gemini-3-pro-preview');
      expect(contextWindow).toBe(1000000);
    });
    
    it('should return correct context window for gemini-2.5-pro', () => {
      const contextWindow = getGeminiContextWindow('gemini-2.5-pro');
      expect(contextWindow).toBe(2000000);
    });
    
    it('should return default context window for unknown model', () => {
      const contextWindow = getGeminiContextWindow('unknown-model');
      expect(contextWindow).toBe(1000000);
    });
  });
});
