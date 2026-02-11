/**
 * Runtime Engine - Model Catalog and Alias System
 * 
 * Exports model catalog, aliases, and preferences for model selection.
 * Implements Requirements 6.1, 6.2, 6.3, 6.4
 */

// Types
export {
  TaskType,
  ModelRef,
  ModelCapabilities,
  ModelCharacteristics,
  ModelCatalogEntry,
  ModelPreferences,
  ModelAlias,
  AuthProfile
} from './types.js';

// Model Catalog
export {
  MODEL_CATALOG,
  DEFAULT_MODEL,
  getModelInfo,
  getContextWindow,
  isModelInCatalog,
  getProviderModels,
  getAvailableProviders
} from './model-catalog.js';

// Model Aliases
export {
  MODEL_ALIASES,
  resolveModelAlias,
  isValidAlias,
  getAvailableAliases,
  getAliasInfo,
  resolveModel
} from './model-aliases.js';

// Model Preferences
export {
  TASK_TYPE_PREFERENCES,
  getPreferredModels,
  getPreferredModel,
  getFilteredPreferences,
  getAllTaskTypes,
  getModelPreferences,
  isPreferredModel,
  getPreferenceRank
} from './model-preferences.js';

// Model Selector
export {
  ModelSelector,
  selectModel,
  selectModelWithMetadata,
  modelSelector
} from './model-selector.js';

export type {
  SelectionOptions,
  SelectionResult
} from './model-selector.js';

// Auth Profile Manager
export {
  AuthProfileManager
} from './auth-profile-manager.js';

export type {
  AuthProfileConfig
} from './auth-profile-manager.js';

// Error Classifier
export {
  classifyError,
  shouldFallback,
  shouldMarkAuthFailure,
  getFailoverReasonDescription
} from './error-classifier.js';

// Fallback Chain Builder
export {
  FallbackChainBuilder,
  fallbackChainBuilder,
  buildFallbackChain,
  buildFallbackChainWithProviderPreference
} from './fallback-chain-builder.js';

export type {
  FallbackChainConfig
} from './fallback-chain-builder.js';

// Runtime Executor
export {
  RuntimeExecutor,
  createRuntimeExecutor,
  FallbackExhaustedError,
  UserAbortError
} from './runtime-executor.js';

export type {
  RuntimeExecutorConfig,
  LLMCaller
} from './runtime-executor.js';

// Token Estimator
export {
  estimateTokens,
  estimateTokensForSegments,
  estimateTokensForRequest,
  TokenUsageTracker
} from './token-estimator.js';

export type {
  TokenUsage,
  TokenEstimate
} from './token-estimator.js';

// Context Window Resolver
export {
  ContextWindowResolver,
  createContextWindowResolver,
  resolveContextWindow
} from './context-window-resolver.js';

export type {
  ContextWindowConfig,
  ContextWindowResolution
} from './context-window-resolver.js';

// Context Window Guard
export {
  ContextWindowGuard,
  createContextWindowGuard,
  validateContextSize,
  ContextValidationError,
  CONTEXT_WINDOW_HARD_MIN,
  CONTEXT_WINDOW_WARN_BELOW
} from './context-window-guard.js';

export type {
  ContextValidation
} from './context-window-guard.js';

// LLM Providers
export {
  callAnthropic,
  callAnthropicStreaming,
  getAnthropicModels,
  getAnthropicContextWindow
} from './anthropic-provider.js';

export {
  callOpenAI,
  callOpenAIStreaming,
  getOpenAIModels,
  getOpenAIContextWindow
} from './openai-provider.js';

export {
  callAzureOpenAI,
  callAzureOpenAIStreaming,
  getAzureOpenAIModels,
  getAzureOpenAIContextWindow,
  getAzureOpenAIConfig,
  getAzureOpenAICodexConfig
} from './azure-openai-provider.js';

export type {
  AzureOpenAIConfig
} from './azure-openai-provider.js';

export {
  MockLLMProvider,
  createMockLLMProvider,
  createErrorConditions
} from './mock-llm-provider.js';

// LLM Provider Factory
export {
  createLLMCaller,
  createLLMStreamingCaller,
  getAvailableModels as getProviderModels,
  getContextWindow as getModelContextWindow,
  getAllProviders as getAllLLMProviders,
  validateProviderConfig,
  createMultiProviderCaller
} from './llm-provider-factory.js';

export type {
  LLMProviderConfig,
  LLMCaller as ProviderLLMCaller,
  LLMStreamingCaller
} from './llm-provider-factory.js';
