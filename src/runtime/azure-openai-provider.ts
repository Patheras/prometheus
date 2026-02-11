/**
 * Azure OpenAI LLM Provider
 * 
 * Provides integration with Azure OpenAI Service (GPT-OSS-120B).
 * Supports both streaming and non-streaming requests with reasoning effort control.
 */

import { ModelRef, RuntimeRequest, RuntimeResponse } from '../types/index.js';

/**
 * Azure OpenAI API message format
 */
interface AzureOpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Azure OpenAI API request
 */
interface AzureOpenAIRequest {
  messages: AzureOpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  reasoning_effort?: 'low' | 'medium' | 'high';
}

/**
 * Azure OpenAI API response
 */
interface AzureOpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
      reasoning_content?: string; // GPT-OSS-120B thinking mode (actual field name!)
      reasoning?: string; // Alternative field name (for compatibility)
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number; // GPT-5 reasoning tokens
    completion_tokens_details?: {
      reasoning_tokens?: number;
      accepted_prediction_tokens?: number;
      rejected_prediction_tokens?: number;
    };
  };
}

/**
 * Azure OpenAI streaming chunk
 */
interface AzureOpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      reasoning?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Azure OpenAI configuration
 */
export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * Get Azure OpenAI configuration from environment (GPT-OSS-120B)
 */
export function getAzureOpenAIConfig(): AzureOpenAIConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-oss-120b';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
  const reasoningEffort = (process.env.AZURE_OPENAI_REASONING_EFFORT || 'high') as 'low' | 'medium' | 'high';
  
  if (!endpoint || !apiKey) {
    return null;
  }
  
  return {
    endpoint,
    apiKey,
    deploymentName,
    apiVersion,
    reasoningEffort,
  };
}

/**
 * Get Azure OpenAI Codex configuration from environment (GPT-5.1-Codex-Mini)
 */
export function getAzureOpenAICodexConfig(): AzureOpenAIConfig | null {
  const endpoint = process.env.AZURE_OPENAI_CODEX_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_CODEX_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_CODEX_DEPLOYMENT || 'gpt-5.1-codex-mini';
  const apiVersion = process.env.AZURE_OPENAI_CODEX_API_VERSION || '2024-12-01-preview';
  
  if (!endpoint || !apiKey) {
    return null;
  }
  
  return {
    endpoint,
    apiKey,
    deploymentName,
    apiVersion,
    reasoningEffort: 'medium', // Codex uses medium reasoning by default
  };
}

/**
 * Build Azure OpenAI API URL
 */
function buildAzureOpenAIUrl(config: AzureOpenAIConfig, stream: boolean = false): string {
  const baseUrl = config.endpoint.replace(/\/$/, '');
  const path = stream ? 'chat/completions' : 'chat/completions';
  return `${baseUrl}/openai/deployments/${config.deploymentName}/${path}?api-version=${config.apiVersion}`;
}

/**
 * Call Azure OpenAI API (non-streaming)
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param config Azure OpenAI configuration
 * @param signal Optional abort signal
 * @returns Runtime response
 */
export async function callAzureOpenAI(
  request: RuntimeRequest,
  model: ModelRef,
  config: AzureOpenAIConfig,
  signal?: AbortSignal
): Promise<RuntimeResponse> {
  const startTime = Date.now();
  
  // Build messages
  const messages: AzureOpenAIMessage[] = [
    {
      role: 'system',
      content: request.context,
    },
    {
      role: 'user',
      content: request.prompt,
    },
  ];
  
  // Build API request
  const apiRequest: AzureOpenAIRequest = {
    messages,
    max_tokens: request.maxTokens || 4096,
    temperature: 0.7,
    stream: false,
  };
  
  // Add reasoning effort for GPT-OSS-120B
  if (config.reasoningEffort) {
    apiRequest.reasoning_effort = config.reasoningEffort;
  }
  
  // Call API
  const url = buildAzureOpenAIUrl(config, false);
  
  // Log request for debugging
  console.log('Azure OpenAI Request:', {
    url,
    deployment: config.deploymentName,
    reasoning_effort: apiRequest.reasoning_effort,
    max_tokens: apiRequest.max_tokens,
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
  }
  
  const data = (await response.json()) as AzureOpenAIResponse;
  
  // Log response summary
  console.log('Azure OpenAI Response Summary:', {
    model: data.model,
    finishReason: data.choices[0]?.finish_reason,
    hasReasoning: !!(data.choices[0]?.message.reasoning_content || data.choices[0]?.message.reasoning),
    reasoningLength: (data.choices[0]?.message.reasoning_content || data.choices[0]?.message.reasoning || '').length,
    tokensUsed: data.usage.total_tokens,
    latency: Date.now() - startTime,
  });
  
  // Extract content and reasoning
  const content = data.choices[0]?.message.content || '';
  const reasoning = data.choices[0]?.message.reasoning_content || data.choices[0]?.message.reasoning;
  
  return {
    content,
    model,
    tokensUsed: data.usage.total_tokens,
    latency: Date.now() - startTime,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    finishReason: data.choices[0]?.finish_reason,
    ...(reasoning && { reasoning }), // Include reasoning if available
  };
}

/**
 * Call Azure OpenAI API with streaming
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param config Azure OpenAI configuration
 * @param signal Optional abort signal
 * @returns Async iterator of text chunks
 */
export async function* callAzureOpenAIStreaming(
  request: RuntimeRequest,
  model: ModelRef,
  config: AzureOpenAIConfig,
  signal?: AbortSignal
): AsyncIterableIterator<{ text: string; reasoning?: string }> {
  // Build messages
  const messages: AzureOpenAIMessage[] = [
    {
      role: 'system',
      content: request.context,
    },
    {
      role: 'user',
      content: request.prompt,
    },
  ];
  
  // Build API request
  const apiRequest: AzureOpenAIRequest = {
    messages,
    max_tokens: request.maxTokens || 4096,
    temperature: 0.7,
    stream: true,
  };
  
  // Add reasoning effort for GPT-OSS-120B
  if (config.reasoningEffort) {
    apiRequest.reasoning_effort = config.reasoningEffort;
  }
  
  // Call API
  const url = buildAzureOpenAIUrl(config, true);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
  }
  
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode chunk
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) {
          continue;
        }
        
        const data = line.slice(6); // Remove 'data: ' prefix
        
        if (data === '[DONE]') {
          break;
        }
        
        try {
          const chunk = JSON.parse(data) as AzureOpenAIStreamChunk;
          
          // Yield content deltas
          const content = chunk.choices[0]?.delta.content;
          const reasoning = chunk.choices[0]?.delta.reasoning;
          
          if (content || reasoning) {
            yield {
              text: content || '',
              ...(reasoning && { reasoning }),
            };
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get available Azure OpenAI models
 */
export function getAzureOpenAIModels(): ModelRef[] {
  return [
    { provider: 'azure-openai', model: 'gpt-oss-120b' },
    { provider: 'azure-openai', model: 'gpt-5.1-codex-mini' },
    { provider: 'azure-openai', model: 'gpt-5' },
  ];
}

/**
 * Get context window for Azure OpenAI model
 */
export function getAzureOpenAIContextWindow(model: string): number {
  if (model.includes('gpt-oss-120b') || model.includes('gpt-5')) {
    return 128000; // 128K tokens
  }
  if (model.includes('codex-mini')) {
    return 128000; // 128K tokens
  }
  return 128000; // Default
}
