/**
 * Fallback Chain Builder
 * 
 * Builds fallback chains for cascading model selection.
 * When a model fails, the system attempts the next model in the chain.
 * 
 * Requirements: 7.1
 */

import { ModelRef } from './types.js';
import { getModelInfo, getAvailableProviders } from './model-catalog.js';

/**
 * Configuration for fallback chain building
 */
export type FallbackChainConfig = {
  /** Explicit fallback models to try after primary */
  explicitFallbacks?: ModelRef[];
  
  /** Default fallback models to use if explicit fallbacks are exhausted */
  defaultFallbacks?: ModelRef[];
  
  /** Limit to specific providers (allowlist) */
  allowedProviders?: string[];
  
  /** Exclude specific providers (blocklist) */
  excludedProviders?: string[];
  
  /** Maximum number of models in the fallback chain */
  maxChainLength?: number;
  
  /** Whether to include cross-provider fallbacks */
  crossProviderFallback?: boolean;
};

/**
 * Default fallback models (used when no explicit fallbacks are configured)
 */
const DEFAULT_FALLBACK_MODELS: ModelRef[] = [
  { provider: 'azure-openai', model: 'gpt-5.1-codex-mini' },  // 2nd priority: Codex for code tasks
  { provider: 'anthropic', model: 'claude-sonnet-4' },
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'google', model: 'gemini-2.5-pro' }
];

/**
 * FallbackChainBuilder creates ordered lists of models to try in sequence
 */
export class FallbackChainBuilder {
  /**
   * Build a fallback chain starting from a primary model
   * 
   * Chain construction logic:
   * 1. Start with primary model
   * 2. Add explicit fallbacks (if configured)
   * 3. Add default fallbacks (if no explicit fallbacks)
   * 4. Filter by allowlist/blocklist
   * 5. Remove duplicates (keep first occurrence)
   * 6. Limit to maxChainLength
   * 
   * @param primary Primary model to start the chain
   * @param config Configuration for chain building
   * @returns Ordered array of models to try
   */
  buildChain(primary: ModelRef, config: FallbackChainConfig = {}): ModelRef[] {
    const chain: ModelRef[] = [];
    
    // 1. Start with primary model
    chain.push(primary);
    
    // 2. Add explicit fallbacks if configured
    if (config.explicitFallbacks && config.explicitFallbacks.length > 0) {
      chain.push(...config.explicitFallbacks);
    } else {
      // 3. Add default fallbacks
      const defaultFallbacks = config.defaultFallbacks || DEFAULT_FALLBACK_MODELS;
      chain.push(...defaultFallbacks);
    }
    
    // 4. Filter by allowlist/blocklist
    let filtered = this.applyProviderFilters(chain, config);
    
    // 5. Remove duplicates (keep first occurrence)
    filtered = this.removeDuplicates(filtered);
    
    // 6. Limit to maxChainLength
    if (config.maxChainLength && config.maxChainLength > 0) {
      filtered = filtered.slice(0, config.maxChainLength);
    }
    
    return filtered;
  }
  
  /**
   * Build a fallback chain with same-provider preference
   * 
   * This variant tries to stay within the same provider first,
   * then falls back to other providers if needed.
   * 
   * Chain construction:
   * 1. Primary model
   * 2. Other models from same provider (by quality tier)
   * 3. Cross-provider fallbacks (if enabled)
   * 
   * @param primary Primary model to start the chain
   * @param config Configuration for chain building
   * @returns Ordered array of models to try
   */
  buildChainWithProviderPreference(
    primary: ModelRef,
    config: FallbackChainConfig = {}
  ): ModelRef[] {
    const chain: ModelRef[] = [];
    
    // 1. Start with primary model
    chain.push(primary);
    
    // 2. Add other models from same provider
    const sameProviderModels = this.getSameProviderFallbacks(primary);
    chain.push(...sameProviderModels);
    
    // 3. Add cross-provider fallbacks if enabled
    if (config.crossProviderFallback !== false) {
      const crossProviderModels = this.getCrossProviderFallbacks(primary);
      chain.push(...crossProviderModels);
    }
    
    // Apply filters and deduplication
    let filtered = this.applyProviderFilters(chain, config);
    filtered = this.removeDuplicates(filtered);
    
    if (config.maxChainLength && config.maxChainLength > 0) {
      filtered = filtered.slice(0, config.maxChainLength);
    }
    
    return filtered;
  }
  
  /**
   * Get fallback models from the same provider
   * Ordered by quality tier (premium > high > standard)
   * 
   * @param primary Primary model
   * @returns Array of same-provider fallback models
   */
  private getSameProviderFallbacks(primary: ModelRef): ModelRef[] {
    const primaryInfo = getModelInfo(primary);
    if (!primaryInfo) {
      return [];
    }
    
    const provider = primary.provider;
    const allProviderModels = getAvailableProviders()
      .filter(p => p === provider)
      .flatMap(p => {
        const catalog = require('./model-catalog.js').MODEL_CATALOG[p];
        return Object.values(catalog) as any[];
      });
    
    // Filter out the primary model
    const fallbacks = allProviderModels.filter(
      entry => entry.ref.model !== primary.model
    );
    
    // Sort by quality tier (premium > high > standard)
    const qualityOrder = { premium: 0, high: 1, standard: 2 };
    fallbacks.sort((a: any, b: any) => {
      const aQuality = qualityOrder[a.characteristics.qualityTier as keyof typeof qualityOrder];
      const bQuality = qualityOrder[b.characteristics.qualityTier as keyof typeof qualityOrder];
      return aQuality - bQuality;
    });
    
    return fallbacks.map((entry: any) => entry.ref);
  }
  
  /**
   * Get fallback models from other providers
   * Ordered by quality tier
   * 
   * @param primary Primary model
   * @returns Array of cross-provider fallback models
   */
  private getCrossProviderFallbacks(primary: ModelRef): ModelRef[] {
    const primaryProvider = primary.provider;
    
    // Get all models from other providers
    const otherProviders = getAvailableProviders().filter(p => p !== primaryProvider);
    const allOtherModels = otherProviders.flatMap(p => {
      const catalog = require('./model-catalog.js').MODEL_CATALOG[p];
      return Object.values(catalog) as any[];
    });
    
    // Sort by quality tier
    const qualityOrder = { premium: 0, high: 1, standard: 2 };
    allOtherModels.sort((a: any, b: any) => {
      const aQuality = qualityOrder[a.characteristics.qualityTier as keyof typeof qualityOrder];
      const bQuality = qualityOrder[b.characteristics.qualityTier as keyof typeof qualityOrder];
      return aQuality - bQuality;
    });
    
    return allOtherModels.map((entry: any) => entry.ref);
  }
  
  /**
   * Apply provider filters (allowlist/blocklist)
   * 
   * @param models Array of models to filter
   * @param config Configuration containing filters
   * @returns Filtered array of models
   */
  private applyProviderFilters(
    models: ModelRef[],
    config: FallbackChainConfig
  ): ModelRef[] {
    let filtered = models;
    
    // Apply allowlist
    if (config.allowedProviders && config.allowedProviders.length > 0) {
      filtered = filtered.filter(m => 
        config.allowedProviders!.includes(m.provider)
      );
    }
    
    // Apply blocklist
    if (config.excludedProviders && config.excludedProviders.length > 0) {
      filtered = filtered.filter(m => 
        !config.excludedProviders!.includes(m.provider)
      );
    }
    
    return filtered;
  }
  
  /**
   * Remove duplicate models from chain (keep first occurrence)
   * 
   * @param models Array of models
   * @returns Array with duplicates removed
   */
  private removeDuplicates(models: ModelRef[]): ModelRef[] {
    const seen = new Set<string>();
    const unique: ModelRef[] = [];
    
    for (const model of models) {
      const key = `${model.provider}:${model.model}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(model);
      }
    }
    
    return unique;
  }
}

/**
 * Default fallback chain builder instance
 */
export const fallbackChainBuilder = new FallbackChainBuilder();

/**
 * Convenience function to build a fallback chain
 * 
 * @param primary Primary model to start the chain
 * @param config Configuration for chain building
 * @returns Ordered array of models to try
 */
export function buildFallbackChain(
  primary: ModelRef,
  config: FallbackChainConfig = {}
): ModelRef[] {
  return fallbackChainBuilder.buildChain(primary, config);
}

/**
 * Convenience function to build a fallback chain with provider preference
 * 
 * @param primary Primary model to start the chain
 * @param config Configuration for chain building
 * @returns Ordered array of models to try
 */
export function buildFallbackChainWithProviderPreference(
  primary: ModelRef,
  config: FallbackChainConfig = {}
): ModelRef[] {
  return fallbackChainBuilder.buildChainWithProviderPreference(primary, config);
}
