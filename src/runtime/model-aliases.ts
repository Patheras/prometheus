/**
 * Model Alias System
 * 
 * Maps friendly names to specific model versions for flexible model references.
 * Based on Requirement 6.2
 */

import { ModelRef, ModelAlias } from './types.js';
import { DEFAULT_MODEL } from './model-catalog.js';

/**
 * Model aliases mapping friendly names to specific models
 */
export const MODEL_ALIASES: ModelAlias[] = [
  // Speed-based aliases
  {
    alias: 'fast',
    target: { provider: 'openai', model: 'gpt-4o-mini' },
    description: 'Fast and affordable model for simple tasks'
  },
  {
    alias: 'fastest',
    target: { provider: 'anthropic', model: 'claude-haiku-4' },
    description: 'Fastest available model'
  },
  
  // Quality-based aliases
  {
    alias: 'best',
    target: { provider: 'anthropic', model: 'claude-opus-4' },
    description: 'Highest quality model for complex tasks'
  },
  {
    alias: 'balanced',
    target: { provider: 'anthropic', model: 'claude-sonnet-4' },
    description: 'Balanced quality and speed'
  },
  
  // Task-specific aliases
  {
    alias: 'reasoning',
    target: { provider: 'openai', model: 'o1' },
    description: 'Best for complex reasoning tasks'
  },
  {
    alias: 'code',
    target: { provider: 'anthropic', model: 'claude-sonnet-4' },
    description: 'Optimized for code analysis and generation'
  },
  {
    alias: 'vision',
    target: { provider: 'openai', model: 'gpt-4o' },
    description: 'Best for vision and multimodal tasks'
  },
  
  // Provider-specific version pinning
  {
    alias: 'claude',
    target: { provider: 'anthropic', model: 'claude-sonnet-4' },
    description: 'Default Claude model'
  },
  {
    alias: 'claude-best',
    target: { provider: 'anthropic', model: 'claude-opus-4' },
    description: 'Best Claude model'
  },
  {
    alias: 'claude-fast',
    target: { provider: 'anthropic', model: 'claude-haiku-4' },
    description: 'Fastest Claude model'
  },
  {
    alias: 'gpt',
    target: { provider: 'openai', model: 'gpt-4o' },
    description: 'Default GPT model'
  },
  {
    alias: 'gpt-best',
    target: { provider: 'openai', model: 'o1' },
    description: 'Best GPT model for reasoning'
  },
  {
    alias: 'gpt-fast',
    target: { provider: 'openai', model: 'gpt-4o-mini' },
    description: 'Fastest GPT model'
  },
  {
    alias: 'gemini',
    target: { provider: 'google', model: 'gemini-2.0-flash-exp' },
    description: 'Default Gemini model'
  },
  {
    alias: 'gemini-pro',
    target: { provider: 'google', model: 'gemini-1.5-pro' },
    description: 'Gemini Pro with massive context'
  },
  
  // Context window aliases
  {
    alias: 'large-context',
    target: { provider: 'google', model: 'gemini-1.5-pro' },
    description: 'Model with largest context window (2M tokens)'
  },
  {
    alias: 'huge-context',
    target: { provider: 'google', model: 'gemini-1.5-pro' },
    description: 'Model with huge context window'
  },
  
  // Default alias
  {
    alias: 'default',
    target: DEFAULT_MODEL,
    description: 'Default model for general tasks'
  }
];

/**
 * Alias lookup map for fast resolution
 */
const ALIAS_MAP = new Map<string, ModelRef>(
  MODEL_ALIASES.map(a => [a.alias.toLowerCase(), a.target])
);

/**
 * Resolve a model alias to a ModelRef
 * @param alias Alias string (case-insensitive)
 * @returns ModelRef if alias exists, undefined otherwise
 */
export function resolveModelAlias(alias: string): ModelRef | undefined {
  return ALIAS_MAP.get(alias.toLowerCase());
}

/**
 * Check if a string is a valid alias
 * @param alias Alias string
 * @returns True if alias exists
 */
export function isValidAlias(alias: string): boolean {
  return ALIAS_MAP.has(alias.toLowerCase());
}

/**
 * Get all available aliases
 * @returns Array of alias strings
 */
export function getAvailableAliases(): string[] {
  return MODEL_ALIASES.map(a => a.alias);
}

/**
 * Get alias information
 * @param alias Alias string
 * @returns ModelAlias object or undefined if not found
 */
export function getAliasInfo(alias: string): ModelAlias | undefined {
  return MODEL_ALIASES.find(a => a.alias.toLowerCase() === alias.toLowerCase());
}

/**
 * Resolve a model reference or alias to a ModelRef
 * Handles both direct ModelRef objects and alias strings
 * @param modelOrAlias ModelRef object or alias string
 * @returns Resolved ModelRef
 */
export function resolveModel(modelOrAlias: ModelRef | string): ModelRef {
  // If it's already a ModelRef object, return it
  if (typeof modelOrAlias === 'object') {
    return modelOrAlias;
  }
  
  // Try to resolve as alias
  const resolved = resolveModelAlias(modelOrAlias);
  if (resolved) {
    return resolved;
  }
  
  // If not an alias, try to parse as "provider/model" format
  if (modelOrAlias.includes('/')) {
    const [provider, model] = modelOrAlias.split('/');
    return { provider, model };
  }
  
  // Fall back to default model
  return DEFAULT_MODEL;
}
