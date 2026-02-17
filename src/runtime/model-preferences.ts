/**
 * Model Preferences
 * 
 * Maps task types to preferred models with fallback chains.
 * Based on Requirements 6.3, 6.4
 */

import { TaskType, ModelRef, ModelPreferences } from './types.js';

/**
 * Model preferences for each task type
 * Models are ordered by preference (first is most preferred)
 */
export const TASK_TYPE_PREFERENCES: Record<TaskType, ModelRef[]> = {
  [TaskType.CODE_ANALYSIS]: [
    { provider: 'google', model: 'gemini-3-pro-preview' },  // Best for code analysis with Deep Think
    { provider: 'azure-openai', model: 'gpt-5.1-codex-mini' },  // Codex for code understanding
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'openai', model: 'gpt-4-turbo' },
    { provider: 'google', model: 'gemini-2.5-pro' }
  ],
  
  [TaskType.DECISION_MAKING]: [
    { provider: 'anthropic', model: 'claude-opus-4' },
    { provider: 'openai', model: 'o1' },
    { provider: 'google', model: 'gemini-3-pro-preview' },
    { provider: 'anthropic', model: 'claude-sonnet-4' }
  ],
  
  [TaskType.PATTERN_MATCHING]: [
    { provider: 'google', model: 'gemini-3-pro-preview' },  // Excellent for pattern recognition
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'google', model: 'gemini-2.5-pro' }
  ],
  
  [TaskType.METRIC_ANALYSIS]: [
    { provider: 'openai', model: 'o1-mini' },
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'google', model: 'gemini-2.5-pro' }
  ],
  
  [TaskType.REFACTORING]: [
    { provider: 'google', model: 'gemini-3-pro-preview' },  // Best for agentic coding
    { provider: 'azure-openai', model: 'gpt-5.1-codex-mini' },  // Codex for code generation
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'anthropic', model: 'claude-opus-4' },
    { provider: 'google', model: 'gemini-2.5-pro' }
  ],
  
  [TaskType.CONSULTATION]: [
    { provider: 'anthropic', model: 'claude-opus-4' },
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'google', model: 'gemini-3-pro-preview' },
    { provider: 'openai', model: 'gpt-4o' }
  ],
  
  [TaskType.GENERAL]: [
    { provider: 'google', model: 'gemini-2.5-pro' },  // Large context for general tasks
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'anthropic', model: 'claude-haiku-4' }
  ]
};

/**
 * Get preferred models for a task type
 * @param taskType Task type
 * @returns Ordered array of preferred models (first is most preferred)
 */
export function getPreferredModels(taskType: TaskType): ModelRef[] {
  return TASK_TYPE_PREFERENCES[taskType] || TASK_TYPE_PREFERENCES[TaskType.GENERAL];
}

/**
 * Get the most preferred model for a task type
 * @param taskType Task type
 * @returns Most preferred model for the task type
 */
export function getPreferredModel(taskType: TaskType): ModelRef {
  const preferences = getPreferredModels(taskType);
  return preferences[0];
}

/**
 * Get model preferences with filtering
 * @param taskType Task type
 * @param options Filtering options
 * @returns Filtered array of preferred models
 */
export function getFilteredPreferences(
  taskType: TaskType,
  options: {
    allowedProviders?: string[];
    excludeProviders?: string[];
    minContextWindow?: number;
    maxCostTier?: 'low' | 'medium' | 'high' | 'premium';
  } = {}
): ModelRef[] {
  let preferences = getPreferredModels(taskType);
  
  // Filter by allowed providers
  if (options.allowedProviders && options.allowedProviders.length > 0) {
    preferences = preferences.filter(m => 
      options.allowedProviders!.includes(m.provider)
    );
  }
  
  // Filter by excluded providers
  if (options.excludeProviders && options.excludeProviders.length > 0) {
    preferences = preferences.filter(m => 
      !options.excludeProviders!.includes(m.provider)
    );
  }
  
  // Additional filtering (context window, cost) would require model catalog lookup
  // This is a simplified version - full implementation would integrate with model-catalog.ts
  
  return preferences;
}

/**
 * Get all task types
 * @returns Array of all task types
 */
export function getAllTaskTypes(): TaskType[] {
  return Object.values(TaskType);
}

/**
 * Get model preferences object for a task type
 * @param taskType Task type
 * @returns ModelPreferences object
 */
export function getModelPreferences(taskType: TaskType): ModelPreferences {
  return {
    taskType,
    preferredModels: getPreferredModels(taskType)
  };
}

/**
 * Check if a model is preferred for a task type
 * @param taskType Task type
 * @param modelRef Model reference to check
 * @returns True if model is in the preference list for this task type
 */
export function isPreferredModel(taskType: TaskType, modelRef: ModelRef): boolean {
  const preferences = getPreferredModels(taskType);
  return preferences.some(
    m => m.provider === modelRef.provider && m.model === modelRef.model
  );
}

/**
 * Get preference rank for a model in a task type
 * @param taskType Task type
 * @param modelRef Model reference
 * @returns Rank (0-based, lower is better) or -1 if not in preferences
 */
export function getPreferenceRank(taskType: TaskType, modelRef: ModelRef): number {
  const preferences = getPreferredModels(taskType);
  return preferences.findIndex(
    m => m.provider === modelRef.provider && m.model === modelRef.model
  );
}
