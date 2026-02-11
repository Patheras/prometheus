/**
 * Tests for Model Alias System
 */

import {
  MODEL_ALIASES,
  resolveModelAlias,
  isValidAlias,
  getAvailableAliases,
  getAliasInfo,
  resolveModel
} from '../model-aliases.js';
import { DEFAULT_MODEL } from '../model-catalog.js';
import { ModelRef } from '../types.js';

describe('Model Alias System', () => {
  describe('MODEL_ALIASES', () => {
    it('should contain common aliases', () => {
      const aliasNames = MODEL_ALIASES.map(a => a.alias);
      
      expect(aliasNames).toContain('fast');
      expect(aliasNames).toContain('best');
      expect(aliasNames).toContain('balanced');
      expect(aliasNames).toContain('default');
    });

    it('should have valid targets for all aliases', () => {
      for (const alias of MODEL_ALIASES) {
        expect(alias.target).toBeDefined();
        expect(alias.target.provider).toBeDefined();
        expect(alias.target.model).toBeDefined();
      }
    });

    it('should have descriptions for all aliases', () => {
      for (const alias of MODEL_ALIASES) {
        expect(alias.description).toBeDefined();
        expect(alias.description.length).toBeGreaterThan(0);
      }
    });

    it('should have unique alias names', () => {
      const aliasNames = MODEL_ALIASES.map(a => a.alias.toLowerCase());
      const uniqueNames = new Set(aliasNames);
      
      expect(aliasNames.length).toBe(uniqueNames.size);
    });
  });

  describe('resolveModelAlias', () => {
    it('should resolve valid aliases', () => {
      const resolved = resolveModelAlias('fast');
      
      expect(resolved).toBeDefined();
      expect(resolved?.provider).toBe('openai');
      expect(resolved?.model).toBe('gpt-4o-mini');
    });

    it('should be case-insensitive', () => {
      const lower = resolveModelAlias('fast');
      const upper = resolveModelAlias('FAST');
      const mixed = resolveModelAlias('FaSt');
      
      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('should return undefined for invalid alias', () => {
      const resolved = resolveModelAlias('invalid-alias');
      
      expect(resolved).toBeUndefined();
    });

    it('should resolve all defined aliases', () => {
      for (const alias of MODEL_ALIASES) {
        const resolved = resolveModelAlias(alias.alias);
        
        expect(resolved).toBeDefined();
        expect(resolved).toEqual(alias.target);
      }
    });

    it('should resolve speed-based aliases', () => {
      expect(resolveModelAlias('fast')).toBeDefined();
      expect(resolveModelAlias('fastest')).toBeDefined();
    });

    it('should resolve quality-based aliases', () => {
      expect(resolveModelAlias('best')).toBeDefined();
      expect(resolveModelAlias('balanced')).toBeDefined();
    });

    it('should resolve task-specific aliases', () => {
      expect(resolveModelAlias('reasoning')).toBeDefined();
      expect(resolveModelAlias('code')).toBeDefined();
      expect(resolveModelAlias('vision')).toBeDefined();
    });

    it('should resolve provider-specific aliases', () => {
      expect(resolveModelAlias('claude')).toBeDefined();
      expect(resolveModelAlias('gpt')).toBeDefined();
      expect(resolveModelAlias('gemini')).toBeDefined();
    });

    it('should resolve context window aliases', () => {
      expect(resolveModelAlias('large-context')).toBeDefined();
      expect(resolveModelAlias('huge-context')).toBeDefined();
    });

    it('should resolve default alias', () => {
      const resolved = resolveModelAlias('default');
      
      expect(resolved).toEqual(DEFAULT_MODEL);
    });
  });

  describe('isValidAlias', () => {
    it('should return true for valid aliases', () => {
      expect(isValidAlias('fast')).toBe(true);
      expect(isValidAlias('best')).toBe(true);
      expect(isValidAlias('default')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isValidAlias('fast')).toBe(true);
      expect(isValidAlias('FAST')).toBe(true);
      expect(isValidAlias('FaSt')).toBe(true);
    });

    it('should return false for invalid aliases', () => {
      expect(isValidAlias('invalid')).toBe(false);
      expect(isValidAlias('not-an-alias')).toBe(false);
    });

    it('should return true for all defined aliases', () => {
      for (const alias of MODEL_ALIASES) {
        expect(isValidAlias(alias.alias)).toBe(true);
      }
    });
  });

  describe('getAvailableAliases', () => {
    it('should return all aliases', () => {
      const aliases = getAvailableAliases();
      
      expect(aliases.length).toBe(MODEL_ALIASES.length);
    });

    it('should include common aliases', () => {
      const aliases = getAvailableAliases();
      
      expect(aliases).toContain('fast');
      expect(aliases).toContain('best');
      expect(aliases).toContain('balanced');
      expect(aliases).toContain('default');
    });
  });

  describe('getAliasInfo', () => {
    it('should return alias info for valid alias', () => {
      const info = getAliasInfo('fast');
      
      expect(info).toBeDefined();
      expect(info?.alias).toBe('fast');
      expect(info?.target).toBeDefined();
      expect(info?.description).toBeDefined();
    });

    it('should be case-insensitive', () => {
      const lower = getAliasInfo('fast');
      const upper = getAliasInfo('FAST');
      
      expect(lower).toEqual(upper);
    });

    it('should return undefined for invalid alias', () => {
      const info = getAliasInfo('invalid');
      
      expect(info).toBeUndefined();
    });

    it('should return complete info for all aliases', () => {
      for (const alias of MODEL_ALIASES) {
        const info = getAliasInfo(alias.alias);
        
        expect(info).toBeDefined();
        expect(info?.alias).toBe(alias.alias);
        expect(info?.target).toEqual(alias.target);
        expect(info?.description).toBe(alias.description);
      }
    });
  });

  describe('resolveModel', () => {
    it('should return ModelRef object unchanged', () => {
      const modelRef: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      const resolved = resolveModel(modelRef);
      
      expect(resolved).toEqual(modelRef);
    });

    it('should resolve alias string to ModelRef', () => {
      const resolved = resolveModel('fast');
      
      expect(resolved).toBeDefined();
      expect(resolved.provider).toBe('openai');
      expect(resolved.model).toBe('gpt-4o-mini');
    });

    it('should parse provider/model format', () => {
      const resolved = resolveModel('anthropic/claude-sonnet-4');
      
      expect(resolved.provider).toBe('anthropic');
      expect(resolved.model).toBe('claude-sonnet-4');
    });

    it('should fall back to default for invalid string', () => {
      const resolved = resolveModel('invalid-string');
      
      expect(resolved).toEqual(DEFAULT_MODEL);
    });

    it('should handle all alias types', () => {
      // Speed-based
      expect(resolveModel('fast').provider).toBeDefined();
      
      // Quality-based
      expect(resolveModel('best').provider).toBeDefined();
      
      // Task-specific
      expect(resolveModel('code').provider).toBeDefined();
      
      // Provider-specific
      expect(resolveModel('claude').provider).toBeDefined();
    });

    it('should handle provider/model format for all providers', () => {
      const anthropic = resolveModel('anthropic/claude-sonnet-4');
      expect(anthropic.provider).toBe('anthropic');
      expect(anthropic.model).toBe('claude-sonnet-4');
      
      const openai = resolveModel('openai/gpt-4o');
      expect(openai.provider).toBe('openai');
      expect(openai.model).toBe('gpt-4o');
      
      const google = resolveModel('google/gemini-2.0-flash-exp');
      expect(google.provider).toBe('google');
      expect(google.model).toBe('gemini-2.0-flash-exp');
    });
  });

  describe('Alias Coverage Requirements', () => {
    it('should have aliases for different speed tiers', () => {
      const aliases = getAvailableAliases();
      
      expect(aliases.some(a => a.includes('fast'))).toBe(true);
    });

    it('should have aliases for different quality tiers', () => {
      const aliases = getAvailableAliases();
      
      expect(aliases.some(a => a.includes('best'))).toBe(true);
      expect(aliases.some(a => a.includes('balanced'))).toBe(true);
    });

    it('should have aliases for each major provider', () => {
      const claudeAlias = resolveModelAlias('claude');
      const gptAlias = resolveModelAlias('gpt');
      const geminiAlias = resolveModelAlias('gemini');
      
      expect(claudeAlias?.provider).toBe('anthropic');
      expect(gptAlias?.provider).toBe('openai');
      expect(geminiAlias?.provider).toBe('google');
    });

    it('should have task-specific aliases', () => {
      expect(isValidAlias('reasoning')).toBe(true);
      expect(isValidAlias('code')).toBe(true);
      expect(isValidAlias('vision')).toBe(true);
    });
  });
});
