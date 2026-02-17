/**
 * LM Studio Provider
 * 
 * Provides integration with LM Studio's local OpenAI-compatible API.
 * LM Studio runs models locally and exposes them via http://localhost:1234/v1
 */

import { ModelRef, RuntimeRequest, RuntimeResponse } from '../types/index.js';

/**
 * LM Studio configuration
 */
export interface LMStudioConfig {
  /** LM Studio endpoint (default: http://localhost:1234/v1) */
  endpoint: string;
  /** Model name loaded in LM Studio */
  model: string;
}

/**
 * Call LM Studio API
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param config LM Studio configuration
 * @param signal Abort signal
 * @returns Runtime response
 */
export async function callLMStudio(
  request: RuntimeRequest,
  model: ModelRef,
  config: LMStudioConfig,
  signal?: AbortSignal
): Promise<RuntimeResponse> {
  const startTime = Date.now();
  
  try {
    // Build OpenAI-compatible request
    const body = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: false,
    };

    // Call LM Studio API
    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Extract response
    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
      text: content,
      model: {
        provider: 'lmstudio',
        model: config.model,
      },
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      latency: Date.now() - startTime,
      cached: false,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LM Studio request was aborted');
    }
    throw error;
  }
}

/**
 * Call LM Studio API with streaming
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param config LM Studio configuration
 * @param signal Abort signal
 * @returns Async iterator of text chunks
 */
export async function* callLMStudioStreaming(
  request: RuntimeRequest,
  model: ModelRef,
  config: LMStudioConfig,
  signal?: AbortSignal
): AsyncIterableIterator<{ text: string }> {
  try {
    // Build OpenAI-compatible request
    const body = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true,
    };

    // Call LM Studio API
    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error: ${response.status} ${errorText}`);
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              yield { text: content };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LM Studio streaming request was aborted');
    }
    throw error;
  }
}

/**
 * Get available LM Studio models
 * 
 * @returns Array of model references
 */
export function getLMStudioModels(): ModelRef[] {
  const modelName = process.env.LM_STUDIO_MODEL || 'local-model';
  
  return [
    {
      provider: 'lmstudio',
      model: modelName,
    },
  ];
}

/**
 * Get context window for LM Studio model
 * 
 * @param model Model name
 * @returns Context window size in tokens
 */
export function getLMStudioContextWindow(model: string): number {
  // DeepSeek-R1 models typically have 32K context
  // Adjust based on your specific model
  if (model.includes('deepseek')) {
    return 32768;
  }
  
  // Default to 8K for unknown models
  return 8192;
}

/**
 * Check if LM Studio is available
 * 
 * @param endpoint LM Studio endpoint
 * @returns True if LM Studio is running and accessible
 */
export async function isLMStudioAvailable(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    return response.ok;
  } catch {
    return false;
  }
}
