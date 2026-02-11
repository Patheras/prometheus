/**
 * Model Selector
 * 
 * Selects appropriate models based on task type, configuration, and constraints.
 * Based on Requirements 6.1, 6.3, 6.4
 */

import { TaskType, ModelRef } from './types.js';
import { DEFAULT_MODEL, getModelInfo, getContextWindow } from './model-catalog.js';
import { resolveModel } from './model-aliases.js';
import { getPreferredModels } from './model-preferences.js';

/**
 * Options for model selection
 */
export type SelectionOptions = {
  /** Force a specific model or alias (overrides task type preferences) */
  forceModel?: string | ModelRef;
  
  /** Limit to specific providers (allowlist) */
  allowedProviders?: string[];
  
  /** Exclude specific providers (blocklist) */
  excludedProviders?: string[];
  
  /** Minimum context window required (in tokens) */
  contextWindowMin?: number;
  
  /** Maximum cost tier allowed */
  maxCostTier?: 'low' | 'medium' | 'high' | 'premium';
  
  /** Require specific capabilities */
  requireCapabilities?: {
    code?: boolean;
    reasoning?: boolean;
    vision?: boolean;
    tools?: boolean;
  };
};

/**
 * Result of model selection with metadata
 */
export type SelectionResult = {
  /** Selected model */
  model: ModelRef;
  
  /** Reason for selection */
  reason: 'forced' | 'preference' | 'fallback';
  
  /** Rank in preference list (0-based, lower is better) */
  preferenceRank?: number;
  
  /** Number of models filtered out */
  filteredCount?: number;
};

/**
 * Model Selector class
 * 
 * Handles model selection logic with support for:
 * - Task type preferences
 * - Configuration overrides
 * - Provider filtering
 * - Context window requirements
 * - Capability requirements
 */
export class ModelSelector {
  /**
   * Select a model based on task type and options
   * 
   * Selection logic:
   * 1. If forceModel is specified, use it (with validation)
   * 2. Get task type preferences
   * 3. Apply filters (providers, context window, capabilities)
   * 4. Return first valid model
   * 5. Fall back to default if no preferences match
   * 
   * @param taskType Type of task to select model for
   * @param options Selection options and constraints
   * @returns Selected model reference
   */
  selectModel(taskType: TaskType, options: SelectionOptions = {}): ModelRef {
    const result = this.selectModelWithMetadata(taskType, options);
    return result.model;
  }
  
  /**
   * Select a model with detailed metadata about the selection
   * 
   * @param taskType Type of task to select model for
   * @param options Selection options and constraints
   * @returns Selection result with metadata
   */
  selectModelWithMetadata(taskType: TaskType, options: SelectionOptions = {}): SelectionResult {
    // 1. Check for explicit override
    if (options.forceModel) {
      const forced = this.resolveAndValidate(options.forceModel, options);
      if (forced) {
        return {
          model: forced,
          reason: 'forced'
        };
      }
      // If forced model doesn't meet requirements, fall through to preferences
    }
    
    // 2. Get preferences for task type
    const preferences = getPreferredModels(taskType);
    
    // 3. Apply filters
    const filtered = this.applyFilters(preferences, options);
    
    // 4. Return first valid model from filtered preferences
    if (filtered.length > 0) {
      const selected = filtered[0];
      const rank = preferences.findIndex(
        m => m.provider === selected.provider && m.model === selected.model
      );
      
      return {
        model: selected,
        reason: 'preference',
        preferenceRank: rank,
        filteredCount: preferences.length - filtered.length
      };
    }
    
    // 5. Fall back to default model
    // Validate default against constraints
    const validatedDefault = this.validateModel(DEFAULT_MODEL, options);
    if (validatedDefault) {
      return {
        model: DEFAULT_MODEL,
        reason: 'fallback',
        filteredCount: preferences.length
      };
    }
    
    // 6. Last resort: return default without validation
    // This ensures we always return a model, even if constraints are too strict
    return {
      model: DEFAULT_MODEL,
      reason: 'fallback',
      filteredCount: preferences.length
    };
  }
  
  /**
   * Resolve a model reference or alias and validate against constraints
   * 
   * @param modelOrAlias Model reference or alias string
   * @param options Selection options for validation
   * @returns Resolved and validated model, or undefined if invalid
   */
  private resolveAndValidate(
    modelOrAlias: string | ModelRef,
    options: SelectionOptions
  ): ModelRef | undefined {
    const resolved = resolveModel(modelOrAlias);
    return this.validateModel(resolved, options) ? resolved : undefined;
  }
  
  /**
   * Apply all filters to a list of model preferences
   * 
   * @param models List of models to filter
   * @param options Selection options containing filter criteria
   * @returns Filtered list of models
   */
  private applyFilters(models: ModelRef[], options: SelectionOptions): ModelRef[] {
    let filtered = models;
    
    // Filter by allowed providers
    if (options.allowedProviders && options.allowedProviders.length > 0) {
      filtered = filtered.filter(m => 
        options.allowedProviders!.includes(m.provider)
      );
    }
    
    // Filter by excluded providers
    if (options.excludedProviders && options.excludedProviders.length > 0) {
      filtered = filtered.filter(m => 
        !options.excludedProviders!.includes(m.provider)
      );
    }
    
    // Filter by context window
    if (options.contextWindowMin !== undefined) {
      filtered = filtered.filter(m => {
        const contextWindow = getContextWindow(m);
        return contextWindow >= options.contextWindowMin!;
      });
    }
    
    // Filter by cost tier
    if (options.maxCostTier) {
      filtered = filtered.filter(m => {
        const info = getModelInfo(m);
        if (!info) return true; // Keep models not in catalog
        
        return this.compareCostTiers(
          info.characteristics.costTier,
          options.maxCostTier!
        ) <= 0;
      });
    }
    
    // Filter by required capabilities
    if (options.requireCapabilities) {
      filtered = filtered.filter(m => {
        const info = getModelInfo(m);
        if (!info) return true; // Keep models not in catalog
        
        const caps = options.requireCapabilities!;
        
        if (caps.code && !info.capabilities.code) return false;
        if (caps.reasoning && !info.capabilities.reasoning) return false;
        if (caps.vision && !info.capabilities.vision) return false;
        if (caps.tools && !info.capabilities.tools) return false;
        
        return true;
      });
    }
    
    return filtered;
  }
  
  /**
   * Validate a model against selection constraints
   * 
   * @param model Model to validate
   * @param options Selection options containing constraints
   * @returns True if model meets all constraints
   */
  private validateModel(model: ModelRef, options: SelectionOptions): boolean {
    // Check allowed providers
    if (options.allowedProviders && options.allowedProviders.length > 0) {
      if (!options.allowedProviders.includes(model.provider)) {
        return false;
      }
    }
    
    // Check excluded providers
    if (options.excludedProviders && options.excludedProviders.length > 0) {
      if (options.excludedProviders.includes(model.provider)) {
        return false;
      }
    }
    
    // Check context window
    if (options.contextWindowMin !== undefined) {
      const contextWindow = getContextWindow(model);
      if (contextWindow < options.contextWindowMin) {
        return false;
      }
    }
    
    // Check cost tier
    if (options.maxCostTier) {
      const info = getModelInfo(model);
      if (info) {
        if (this.compareCostTiers(info.characteristics.costTier, options.maxCostTier) > 0) {
          return false;
        }
      }
    }
    
    // Check capabilities
    if (options.requireCapabilities) {
      const info = getModelInfo(model);
      if (info) {
        const caps = options.requireCapabilities;
        
        if (caps.code && !info.capabilities.code) return false;
        if (caps.reasoning && !info.capabilities.reasoning) return false;
        if (caps.vision && !info.capabilities.vision) return false;
        if (caps.tools && !info.capabilities.tools) return false;
      }
    }
    
    return true;
  }
  
  /**
   * Compare cost tiers
   * 
   * @param tier1 First cost tier
   * @param tier2 Second cost tier
   * @returns Negative if tier1 < tier2, 0 if equal, positive if tier1 > tier2
   */
  private compareCostTiers(
    tier1: 'low' | 'medium' | 'high' | 'premium',
    tier2: 'low' | 'medium' | 'high' | 'premium'
  ): number {
    const tierOrder = { low: 0, medium: 1, high: 2, premium: 3 };
    return tierOrder[tier1] - tierOrder[tier2];
  }
}

/**
 * Default model selector instance
 */
export const modelSelector = new ModelSelector();

/**
 * Convenience function to select a model
 * 
 * @param taskType Type of task to select model for
 * @param options Selection options and constraints
 * @returns Selected model reference
 */
export function selectModel(taskType: TaskType, options: SelectionOptions = {}): ModelRef {
  return modelSelector.selectModel(taskType, options);
}

/**
 * Convenience function to select a model with metadata
 * 
 * @param taskType Type of task to select model for
 * @param options Selection options and constraints
 * @returns Selection result with metadata
 */
export function selectModelWithMetadata(
  taskType: TaskType,
  options: SelectionOptions = {}
): SelectionResult {
  return modelSelector.selectModelWithMetadata(taskType, options);
}
