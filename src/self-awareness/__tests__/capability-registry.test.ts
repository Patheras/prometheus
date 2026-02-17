/**
 * Tests for CapabilityRegistry
 */

import { CapabilityRegistry, getCapabilityRegistry, resetCapabilityRegistry } from '../capability-registry';

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    resetCapabilityRegistry();
    registry = new CapabilityRegistry();
  });

  describe('Default Capabilities', () => {
    it('should register default capabilities on initialization', () => {
      const all = registry.getAll();
      expect(all.length).toBeGreaterThan(0);
    });

    it('should have self-analysis capability', () => {
      const cap = registry.get('self-analysis');
      expect(cap).toBeDefined();
      expect(cap?.name).toBe('Self-Analysis');
      expect(cap?.category).toBe('evolution');
      expect(cap?.status).toBe('available');
    });

    it('should have self-improvement capability', () => {
      const cap = registry.get('self-improvement');
      expect(cap).toBeDefined();
      expect(cap?.name).toBe('Self-Improvement');
      expect(cap?.requirements).toContain('User approval for production deployment');
    });

    it('should have safety-monitoring capability', () => {
      const cap = registry.get('safety-monitoring');
      expect(cap).toBeDefined();
      expect(cap?.description).toContain('circuit breaker');
    });
  });

  describe('Category Filtering', () => {
    it('should get capabilities by category', () => {
      const evolutionCaps = registry.getByCategory('evolution');
      expect(evolutionCaps.length).toBeGreaterThan(0);
      expect(evolutionCaps.every(cap => cap.category === 'evolution')).toBe(true);
    });

    it('should get analysis capabilities', () => {
      const analysisCaps = registry.getByCategory('analysis');
      expect(analysisCaps.length).toBeGreaterThan(0);
      expect(analysisCaps.some(cap => cap.id === 'code-quality-analysis')).toBe(true);
    });

    it('should get memory capabilities', () => {
      const memoryCaps = registry.getByCategory('memory');
      expect(memoryCaps.length).toBeGreaterThan(0);
      expect(memoryCaps.some(cap => cap.id === 'pattern-learning')).toBe(true);
    });
  });

  describe('Search', () => {
    it('should search capabilities by keyword', () => {
      const results = registry.search('analysis');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(cap => cap.id === 'self-analysis')).toBe(true);
      expect(results.some(cap => cap.id === 'code-quality-analysis')).toBe(true);
    });

    it('should search in descriptions', () => {
      const results = registry.search('circuit breaker');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(cap => cap.id === 'safety-monitoring')).toBe(true);
    });

    it('should search in examples', () => {
      const results = registry.search('rollback');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const lower = registry.search('analysis');
      const upper = registry.search('ANALYSIS');
      expect(lower.length).toBe(upper.length);
    });
  });

  describe('Availability', () => {
    it('should get only available capabilities', () => {
      const available = registry.getAvailable();
      expect(available.every(cap => cap.status !== 'disabled')).toBe(true);
    });

    it('should check if capability is available', () => {
      expect(registry.isAvailable('self-analysis')).toBe(true);
      expect(registry.isAvailable('non-existent')).toBe(false);
    });

    it('should include experimental capabilities in available', () => {
      const available = registry.getAvailable();
      const experimental = available.filter(cap => cap.status === 'experimental');
      expect(experimental.length).toBeGreaterThan(0);
    });
  });

  describe('Related Capabilities', () => {
    it('should get related capabilities', () => {
      const related = registry.getRelated('self-improvement');
      expect(related.length).toBeGreaterThan(0);
      expect(related.some(cap => cap.id === 'self-analysis')).toBe(true);
      expect(related.some(cap => cap.id === 'dev-prod-workflow')).toBe(true);
    });

    it('should return empty array for capability without relations', () => {
      const related = registry.getRelated('conversation-memory');
      expect(related).toEqual([]);
    });

    it('should return empty array for non-existent capability', () => {
      const related = registry.getRelated('non-existent');
      expect(related).toEqual([]);
    });
  });

  describe('System Prompt Generation', () => {
    it('should generate system prompt', () => {
      const prompt = registry.generateSystemPrompt();
      expect(prompt).toContain('Prometheus');
      expect(prompt).toContain('Self-Evolution');
      expect(prompt).toContain('Code Analysis');
      expect(prompt).toContain('Memory & Learning');
    });

    it('should include capability descriptions', () => {
      const prompt = registry.generateSystemPrompt();
      expect(prompt).toContain('Self-Analysis');
      expect(prompt).toContain('Self-Improvement');
      expect(prompt).toContain('Safety Monitoring');
    });

    it('should include examples', () => {
      const prompt = registry.generateSystemPrompt();
      expect(prompt).toContain('Examples:');
    });

    it('should include requirements', () => {
      const prompt = registry.generateSystemPrompt();
      expect(prompt).toContain('Requirements:');
      expect(prompt).toContain('User approval');
    });

    it('should include important notes', () => {
      const prompt = registry.generateSystemPrompt();
      expect(prompt).toContain('IMPORTANT NOTES');
      expect(prompt).toContain('DEV first');
      expect(prompt).toContain('Safety monitoring');
    });
  });

  describe('Category Summary', () => {
    it('should generate category summary', () => {
      const summary = registry.getCategorySummary('evolution');
      expect(summary).toContain('Self-Analysis');
      expect(summary).toContain('Self-Improvement');
    });

    it('should return message for empty category', () => {
      // Create a new registry and clear all capabilities
      const emptyRegistry = new CapabilityRegistry();
      emptyRegistry['capabilities'].clear();
      
      const summary = emptyRegistry.getCategorySummary('evolution');
      expect(summary).toContain('No evolution capabilities available');
    });
  });

  describe('Custom Capabilities', () => {
    it('should register custom capability', () => {
      registry.register({
        id: 'custom-test',
        name: 'Custom Test',
        description: 'A custom test capability',
        category: 'analysis',
        status: 'experimental',
        examples: ['Test example'],
      });

      const cap = registry.get('custom-test');
      expect(cap).toBeDefined();
      expect(cap?.name).toBe('Custom Test');
    });

    it('should override existing capability', () => {
      const original = registry.get('self-analysis');
      expect(original?.status).toBe('available');

      registry.register({
        id: 'self-analysis',
        name: 'Modified Self-Analysis',
        description: 'Modified description',
        category: 'evolution',
        status: 'disabled',
        examples: [],
      });

      const modified = registry.get('self-analysis');
      expect(modified?.name).toBe('Modified Self-Analysis');
      expect(modified?.status).toBe('disabled');
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getCapabilityRegistry();
      const instance2 = getCapabilityRegistry();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getCapabilityRegistry();
      resetCapabilityRegistry();
      const instance2 = getCapabilityRegistry();
      expect(instance1).not.toBe(instance2);
    });
  });
});
