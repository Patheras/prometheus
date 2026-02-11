/**
 * Context Window Resolver
 * 
 * Resolves context window sizes from multiple sources with priority:
 * 1. Config override (highest priority)
 * 2. Model catalog
 * 3. Agent context token cap
 * 4. Default fallback (lowest priority)
 * 
 * Requirements: 8.1
 */

import { ModelRef } from '../types/index.js';
import { getContextWindow as getCatalogContextWindow } from './model-catalog.js';

/**
 * Configuration for context window resolution
 */
export type ContextWindowConfig = {
  /** Model-specific context window overrides (provider:model format or nested) */
  overrides?: Record<string, number>;
  
  /** Model-specific context window overrides (nested format) */
  modelOverrides?: Record<string, Record<string, number>>;
  
  /** Agent-wide context token cap (applies to all models) */
  agentContextTokenCap?: number;
  
  /** Default context window if not found elsewhere */
  defaultContextWindow?: number;
};

/**
 * Context window resolution result
 */
export type ContextWindowResolution = {
  /** Resolved context window size in tokens */
  contextWindow: number;
  
  /** Source of the context window value */
  source: 'config' | 'catalog' | 'agent_cap' | 'default';
  
  /** Whether the value was capped by agent limit */
  cappedByAgent: boolean;
};

/**
 * Default context window size (128k tokens)
 */
const DEFAULT_CONTEXT_WINDOW = 128000;

/**
 * Context window resolver
 * 
 * Resolves context windows from multiple sources with priority order.
 */
export class ContextWindowResolver {
  private config: ContextWindowConfig;
  
  constructor(config: ContextWindowConfig = {}) {
    this.config = config;
  }
  
  /**
   * Resolve context window for a model
   * 
   * Resolution priority:
   * 1. Config override (overrides or modelOverrides)
   * 2. Model catalog
   * 3. Default fallback
   * 4. Apply agent context token cap if configured
   * 
   * @param model Model reference
   * @returns Context window resolution
   */
  resolve(model: ModelRef): ContextWindowResolution {
    let contextWindow: number;
    let source: 'config' | 'catalog' | 'agent_cap' | 'default';
    
    // 1. Check config override (flat format: "provider:model")
    const flatKey = `${model.provider}:${model.model}`;
    const flatOverride = this.config.overrides?.[flatKey];
    if (flatOverride !== undefined) {
      contextWindow = flatOverride;
      source = 'config';
    }
    // 1b. Check config override (nested format)
    else {
      const nestedOverride = this.config.modelOverrides?.[model.provider]?.[model.model];
      if (nestedOverride !== undefined) {
        contextWindow = nestedOverride;
        source = 'config';
      }
      // 2. Check model catalog
      else {
        const catalogWindow = getCatalogContextWindow(model);
        if (catalogWindow !== 128000 || this.isModelInCatalog(model)) {
          // Use catalog value if it's not the default OR if model is in catalog
          contextWindow = catalogWindow;
          source = 'catalog';
        }
        // 3. Use default
        else {
          contextWindow = this.config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW;
          source = 'default';
        }
      }
    }
    
    // 4. Apply agent context token cap if configured
    let cappedByAgent = false;
    if (this.config.agentContextTokenCap !== undefined) {
      if (contextWindow > this.config.agentContextTokenCap) {
        contextWindow = this.config.agentContextTokenCap;
        cappedByAgent = true;
      }
    }
    
    return {
      contextWindow,
      source,
      cappedByAgent
    };
  }
  
  /**
   * Check if a model is in the catalog
   * 
   * @param model Model reference
   * @returns True if model is in catalog
   */
  private isModelInCatalog(model: ModelRef): boolean {
    // Import dynamically to avoid circular dependency
    const { isModelInCatalog } = require('./model-catalog.js');
    return isModelInCatalog(model);
  }
  
  /**
   * Update configuration
   * 
   * @param config New configuration (merged with existing)
   */
  updateConfig(config: Partial<ContextWindowConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      overrides: {
        ...this.config.overrides,
        ...config.overrides
      },
      modelOverrides: {
        ...this.config.modelOverrides,
        ...config.modelOverrides
      }
    };
  }
  
  /**
   * Get current configuration
   * 
   * @returns Current configuration
   */
  getConfig(): ContextWindowConfig {
    return { ...this.config };
  }
}

/**
 * Create a context window resolver with default configuration
 * 
 * @param config Optional configuration
 * @returns Context window resolver instance
 */
export function createContextWindowResolver(
  config?: ContextWindowConfig
): ContextWindowResolver {
  return new ContextWindowResolver(config);
}

/**
 * Resolve context window for a model (convenience function)
 * 
 * @param model Model reference
 * @param config Optional configuration
 * @returns Context window resolution
 */
export function resolveContextWindow(
  model: ModelRef,
  config?: ContextWindowConfig
): ContextWindowResolution {
  const resolver = new ContextWindowResolver(config);
  return resolver.resolve(model);
}
