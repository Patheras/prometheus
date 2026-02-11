/**
 * Model Catalog
 * 
 * Defines available models with their context windows, capabilities, and characteristics.
 * Based on Requirements 6.1, 6.2, 6.3, 6.4
 */

import { ModelRef, ModelCatalogEntry, ModelCapabilities, ModelCharacteristics } from './types.js';

/**
 * Model catalog containing all available models
 */
export const MODEL_CATALOG: Record<string, Record<string, ModelCatalogEntry>> = {
  anthropic: {
    'claude-opus-4': {
      ref: { provider: 'anthropic', model: 'claude-opus-4' },
      contextWindow: 200000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'premium',
        speedTier: 'medium',
        qualityTier: 'premium'
      },
      description: 'Most capable Claude model, excellent for complex reasoning and code analysis'
    },
    'claude-sonnet-4': {
      ref: { provider: 'anthropic', model: 'claude-sonnet-4' },
      contextWindow: 200000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'high',
        speedTier: 'fast',
        qualityTier: 'high'
      },
      description: 'Balanced Claude model, great for code and reasoning with good speed'
    },
    'claude-haiku-4': {
      ref: { provider: 'anthropic', model: 'claude-haiku-4' },
      contextWindow: 200000,
      capabilities: {
        code: true,
        reasoning: false,
        general: true,
        vision: false,
        tools: true
      },
      characteristics: {
        costTier: 'low',
        speedTier: 'fast',
        qualityTier: 'standard'
      },
      description: 'Fast and efficient Claude model for simpler tasks'
    }
  },
  
  openai: {
    'o1': {
      ref: { provider: 'openai', model: 'o1' },
      contextWindow: 200000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: false,
        tools: false
      },
      characteristics: {
        costTier: 'premium',
        speedTier: 'slow',
        qualityTier: 'premium'
      },
      description: 'OpenAI reasoning model, excellent for complex problem solving'
    },
    'o1-mini': {
      ref: { provider: 'openai', model: 'o1-mini' },
      contextWindow: 128000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: false,
        tools: false
      },
      characteristics: {
        costTier: 'high',
        speedTier: 'medium',
        qualityTier: 'high'
      },
      description: 'Faster reasoning model for code and STEM tasks'
    },
    'gpt-4-turbo': {
      ref: { provider: 'openai', model: 'gpt-4-turbo' },
      contextWindow: 128000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'high',
        speedTier: 'fast',
        qualityTier: 'high'
      },
      description: 'Latest GPT-4 Turbo with vision and tools'
    },
    'gpt-4o': {
      ref: { provider: 'openai', model: 'gpt-4o' },
      contextWindow: 128000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'medium',
        speedTier: 'fast',
        qualityTier: 'high'
      },
      description: 'Optimized GPT-4 model with multimodal capabilities'
    },
    'gpt-4o-mini': {
      ref: { provider: 'openai', model: 'gpt-4o-mini' },
      contextWindow: 128000,
      capabilities: {
        code: true,
        reasoning: false,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'low',
        speedTier: 'fast',
        qualityTier: 'standard'
      },
      description: 'Fast and affordable model for simpler tasks'
    }
  },
  
  google: {
    'gemini-2.0-flash-exp': {
      ref: { provider: 'google', model: 'gemini-2.0-flash-exp' },
      contextWindow: 1000000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'medium',
        speedTier: 'fast',
        qualityTier: 'high'
      },
      description: 'Experimental Gemini model with massive context window'
    },
    'gemini-1.5-pro': {
      ref: { provider: 'google', model: 'gemini-1.5-pro' },
      contextWindow: 2000000,
      capabilities: {
        code: true,
        reasoning: true,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'high',
        speedTier: 'medium',
        qualityTier: 'high'
      },
      description: 'Pro model with extremely large context window'
    },
    'gemini-1.5-flash': {
      ref: { provider: 'google', model: 'gemini-1.5-flash' },
      contextWindow: 1000000,
      capabilities: {
        code: true,
        reasoning: false,
        general: true,
        vision: true,
        tools: true
      },
      characteristics: {
        costTier: 'low',
        speedTier: 'fast',
        qualityTier: 'standard'
      },
      description: 'Fast model with large context window'
    }
  }
};

/**
 * Default model to use when no preference is specified
 */
export const DEFAULT_MODEL: ModelRef = {
  provider: 'anthropic',
  model: 'claude-sonnet-4'
};

/**
 * Get model information from catalog
 * @param modelRef Model reference
 * @returns Model catalog entry or undefined if not found
 */
export function getModelInfo(modelRef: ModelRef): ModelCatalogEntry | undefined {
  const providerModels = MODEL_CATALOG[modelRef.provider];
  if (!providerModels) {
    return undefined;
  }
  
  return providerModels[modelRef.model];
}

/**
 * Get context window for a model
 * @param modelRef Model reference
 * @returns Context window size in tokens, or default if not found
 */
export function getContextWindow(modelRef: ModelRef): number {
  const info = getModelInfo(modelRef);
  return info?.contextWindow ?? 128000; // Default to 128k
}

/**
 * Check if a model exists in the catalog
 * @param modelRef Model reference
 * @returns True if model exists in catalog
 */
export function isModelInCatalog(modelRef: ModelRef): boolean {
  return getModelInfo(modelRef) !== undefined;
}

/**
 * Get all models from a specific provider
 * @param provider Provider name
 * @returns Array of model catalog entries
 */
export function getProviderModels(provider: string): ModelCatalogEntry[] {
  const providerModels = MODEL_CATALOG[provider];
  if (!providerModels) {
    return [];
  }
  
  return Object.values(providerModels);
}

/**
 * Get all available providers
 * @returns Array of provider names
 */
export function getAvailableProviders(): string[] {
  return Object.keys(MODEL_CATALOG);
}
