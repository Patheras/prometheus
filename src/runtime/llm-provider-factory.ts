/**
 * LLM Provider Factory
 * 
 * Creates and manages LLM providers for different services.
 * Provides a unified interface for calling different LLM APIs.
 */

import { ModelRef, RuntimeRequest, RuntimeResponse } from '../types/index.js';
import { callAnthropic, callAnthropicStreaming, getAnthropicModels, getAnthropicContextWindow } from './anthropic-provider.js';
import { callOpenAI, callOpenAIStreaming, getOpenAIModels, getOpenAIContextWindow } from './openai-provider.js';
import { callAzureOpenAI, callAzureOpenAIStreaming, getAzureOpenAIModels, getAzureOpenAIContextWindow, AzureOpenAIConfig } from './azure-openai-provider.js';
import { callGemini, callGeminiStreaming, getGeminiModels, getGeminiContextWindow } from './gemini-provider.js';
import { callLMStudio, callLMStudioStreaming, getLMStudioModels, getLMStudioContextWindow, LMStudioConfig } from './lmstudio-provider.js';
import { MockLLMProvider } from './mock-llm-provider.js';

/**
 * LLM Provider configuration
 */
export interface LLMProviderConfig {
  /** Provider type */
  provider: 'azure-openai' | 'anthropic' | 'openai' | 'google' | 'lmstudio' | 'mock';
  
  /** API key */
  apiKey?: string;
  
  /** Azure OpenAI configuration */
  azureConfig?: AzureOpenAIConfig;
  
  /** LM Studio configuration */
  lmstudioConfig?: LMStudioConfig;
  
  /** Mock provider configuration (for testing) */
  mockConfig?: {
    defaultResponse?: string;
    responseDelay?: number;
  };
}

/**
 * Unified LLM caller function type
 */
export type LLMCaller = (
  request: RuntimeRequest,
  model: ModelRef,
  apiKeyOrConfig: string | AzureOpenAIConfig,
  signal?: AbortSignal
) => Promise<RuntimeResponse>;

/**
 * Unified LLM streaming caller function type
 */
export type LLMStreamingCaller = (
  request: RuntimeRequest,
  model: ModelRef,
  apiKeyOrConfig: string | AzureOpenAIConfig,
  signal?: AbortSignal
) => AsyncIterableIterator<{ text: string; reasoning?: string }>;

/**
 * Create LLM caller for a provider
 * 
 * @param config Provider configuration
 * @returns LLM caller function
 */
export function createLLMCaller(config: LLMProviderConfig): LLMCaller {
  switch (config.provider) {
    case 'azure-openai': {
      if (!config.azureConfig) {
        throw new Error('Azure OpenAI configuration is required');
      }
      return async (request, model, apiKeyOrConfig, signal) => {
        const azureConfig = typeof apiKeyOrConfig === 'string' 
          ? { ...config.azureConfig!, apiKey: apiKeyOrConfig }
          : apiKeyOrConfig;
        return await callAzureOpenAI(request, model, azureConfig, signal);
      };
    }
    
    case 'anthropic':
      return callAnthropic;
    
    case 'openai':
      return callOpenAI;
    
    case 'google':
      return callGemini;
    
    case 'lmstudio': {
      if (!config.lmstudioConfig) {
        throw new Error('LM Studio configuration is required');
      }
      return async (request, model, _apiKeyOrConfig, signal) => {
        return await callLMStudio(request, model, config.lmstudioConfig!, signal);
      };
    }
    
    case 'mock': {
      const mockProvider = new MockLLMProvider(config.mockConfig);
      return async (request, model, apiKey, signal) => {
        return await mockProvider.call(request, model, apiKey as string, signal);
      };
    }
    
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Create LLM streaming caller for a provider
 * 
 * @param config Provider configuration
 * @returns LLM streaming caller function
 */
export function createLLMStreamingCaller(config: LLMProviderConfig): LLMStreamingCaller {
  switch (config.provider) {
    case 'azure-openai': {
      if (!config.azureConfig) {
        throw new Error('Azure OpenAI configuration is required');
      }
      return async function* (request, model, apiKeyOrConfig, signal) {
        const azureConfig = typeof apiKeyOrConfig === 'string'
          ? { ...config.azureConfig!, apiKey: apiKeyOrConfig }
          : apiKeyOrConfig;
        yield* callAzureOpenAIStreaming(request, model, azureConfig, signal);
      };
    }
    
    case 'anthropic':
      return callAnthropicStreaming;
    
    case 'openai':
      return callOpenAIStreaming;
    
    case 'google':
      return callGeminiStreaming;
    
    case 'lmstudio': {
      if (!config.lmstudioConfig) {
        throw new Error('LM Studio configuration is required');
      }
      return async function* (request, model, _apiKeyOrConfig, signal) {
        yield* callLMStudioStreaming(request, model, config.lmstudioConfig!, signal);
      };
    }
    
    case 'mock': {
      const mockProvider = new MockLLMProvider(config.mockConfig);
      return async function* (request, model, apiKey, signal) {
        yield* mockProvider.callStreaming(request, model, apiKey as string, signal);
      };
    }
    
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Get available models for a provider
 * 
 * @param provider Provider name
 * @returns Array of model references
 */
export function getAvailableModels(provider: string): ModelRef[] {
  switch (provider) {
    case 'azure-openai':
      return getAzureOpenAIModels();
    
    case 'anthropic':
      return getAnthropicModels();
    
    case 'openai':
      return getOpenAIModels();
    
    case 'google':
      return getGeminiModels();
    
    case 'lmstudio':
      return getLMStudioModels();
    
    case 'mock':
      return [
        { provider: 'mock', model: 'mock-model' },
      ];
    
    default:
      return [];
  }
}

/**
 * Get context window size for a model
 * 
 * @param model Model reference
 * @returns Context window size in tokens
 */
export function getContextWindow(model: ModelRef): number {
  switch (model.provider) {
    case 'azure-openai':
      return getAzureOpenAIContextWindow(model.model);
    
    case 'anthropic':
      return getAnthropicContextWindow(model.model);
    
    case 'openai':
      return getOpenAIContextWindow(model.model);
    
    case 'google':
      return getGeminiContextWindow(model.model);
    
    case 'lmstudio':
      return getLMStudioContextWindow(model.model);
    
    case 'mock':
      return 128000;
    
    default:
      return 128000; // Default
  }
}

/**
 * Get all available providers
 */
export function getAllProviders(): string[] {
  return ['azure-openai', 'anthropic', 'openai', 'google', 'lmstudio', 'mock'];
}

/**
 * Validate provider configuration
 * 
 * @param config Provider configuration
 * @throws Error if configuration is invalid
 */
export function validateProviderConfig(config: LLMProviderConfig): void {
  if (!config.provider) {
    throw new Error('Provider is required');
  }
  
  if (!getAllProviders().includes(config.provider)) {
    throw new Error(`Invalid provider: ${config.provider}`);
  }
  
  if (config.provider !== 'mock' && !config.apiKey) {
    throw new Error(`API key is required for provider: ${config.provider}`);
  }
}

/**
 * Create a multi-provider LLM caller with fallback
 * 
 * Tries providers in order until one succeeds.
 * 
 * @param configs Array of provider configurations (in priority order)
 * @returns LLM caller function with fallback
 */
export function createMultiProviderCaller(configs: LLMProviderConfig[]): LLMCaller {
  if (configs.length === 0) {
    throw new Error('At least one provider configuration is required');
  }
  
  // Validate all configs
  for (const config of configs) {
    validateProviderConfig(config);
  }
  
  // Create callers for each provider
  const callers = configs.map((config) => ({
    caller: createLLMCaller(config),
    apiKeyOrConfig: config.azureConfig || config.apiKey || '',
    provider: config.provider,
  }));
  
  // Return fallback caller
  return async (request, model, _apiKeyOrConfig, signal) => {
    const errors: Error[] = [];
    
    for (const { caller, apiKeyOrConfig, provider } of callers) {
      try {
        // Use the provider's caller with its API key or config
        return await caller(request, model, apiKeyOrConfig, signal);
      } catch (error) {
        console.error(`Provider ${provider} failed:`, error);
        errors.push(error as Error);
        // Continue to next provider
      }
    }
    
    // All providers failed
    throw new Error(
      `All providers failed:\n${errors.map((e, i) => `${i + 1}. ${e.message}`).join('\n')}`
    );
  };
}
