/**
 * LLM Provider Factory Tests
 */

import { 
  getAllProviders, 
  getAvailableModels,
  validateProviderConfig,
  LLMProviderConfig
} from '../llm-provider-factory.js';

describe('LLM Provider Factory', () => {
  describe('getAllProviders', () => {
    it('should return all available providers including google', () => {
      const providers = getAllProviders();
      
      expect(providers).toContain('azure-openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
      expect(providers).toContain('mock');
    });
  });
  
  describe('getAvailableModels', () => {
    it('should return Gemini models for google provider', () => {
      const models = getAvailableModels('google');
      
      expect(models.length).toBeGreaterThan(0);
      expect(models[0].provider).toBe('google');
      expect(models.some(m => m.model.includes('gemini'))).toBe(true);
    });
    
    it('should return empty array for unknown provider', () => {
      const models = getAvailableModels('unknown');
      expect(models).toEqual([]);
    });
  });
  
  describe('validateProviderConfig', () => {
    it('should accept valid google provider config', () => {
      const config: LLMProviderConfig = {
        provider: 'google',
        apiKey: 'test-key'
      };
      
      expect(() => validateProviderConfig(config)).not.toThrow();
    });
    
    it('should reject config without provider', () => {
      const config = {} as LLMProviderConfig;
      
      expect(() => validateProviderConfig(config)).toThrow('Provider is required');
    });
    
    it('should reject invalid provider', () => {
      const config: LLMProviderConfig = {
        provider: 'invalid' as any,
        apiKey: 'test-key'
      };
      
      expect(() => validateProviderConfig(config)).toThrow('Invalid provider');
    });
    
    it('should reject non-mock provider without API key', () => {
      const config: LLMProviderConfig = {
        provider: 'google'
      };
      
      expect(() => validateProviderConfig(config)).toThrow('API key is required');
    });
    
    it('should accept mock provider without API key', () => {
      const config: LLMProviderConfig = {
        provider: 'mock'
      };
      
      expect(() => validateProviderConfig(config)).not.toThrow();
    });
  });
});
