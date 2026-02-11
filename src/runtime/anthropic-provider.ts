/**
 * Anthropic LLM Provider
 * 
 * Provides integration with Anthropic's Claude models via their API.
 * Supports both streaming and non-streaming requests.
 */

import { ModelRef, RuntimeRequest, RuntimeResponse } from '../types/index.js';

/**
 * Anthropic API message format
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Anthropic API request
 */
interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Anthropic API response
 */
interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic streaming event
 */
interface AnthropicStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  message?: Partial<AnthropicResponse>;
  delta?: {
    type: 'text_delta';
    text: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call Anthropic API (non-streaming)
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param apiKey Anthropic API key
 * @param signal Optional abort signal
 * @returns Runtime response
 */
export async function callAnthropic(
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
): Promise<RuntimeResponse> {
  const startTime = Date.now();
  
  // Build messages
  const messages: AnthropicMessage[] = [
    {
      role: 'user',
      content: `${request.context}\n\n${request.prompt}`,
    },
  ];
  
  // Build API request
  const apiRequest: AnthropicRequest = {
    model: model.model,
    messages,
    max_tokens: request.maxTokens || 4096,
    temperature: 0.7,
    stream: false,
  };
  
  // Call API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }
  
  const data = (await response.json()) as AnthropicResponse;
  
  // Extract content
  const content = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  
  return {
    content,
    model,
    tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
    latency: Date.now() - startTime,
  };
}

/**
 * Call Anthropic API with streaming
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param apiKey Anthropic API key
 * @param signal Optional abort signal
 * @returns Async iterator of text chunks
 */
export async function* callAnthropicStreaming(
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
): AsyncIterableIterator<{ text: string }> {
  // Build messages
  const messages: AnthropicMessage[] = [
    {
      role: 'user',
      content: `${request.context}\n\n${request.prompt}`,
    },
  ];
  
  // Build API request
  const apiRequest: AnthropicRequest = {
    model: model.model,
    messages,
    max_tokens: request.maxTokens || 4096,
    temperature: 0.7,
    stream: true,
  };
  
  // Call API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
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
          const event = JSON.parse(data) as AnthropicStreamEvent;
          
          // Yield text deltas
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            yield { text: event.delta.text };
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
 * Get available Anthropic models
 */
export function getAnthropicModels(): ModelRef[] {
  return [
    { provider: 'anthropic', model: 'claude-opus-4' },
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'anthropic', model: 'claude-haiku-4' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  ];
}

/**
 * Get context window for Anthropic model
 */
export function getAnthropicContextWindow(model: string): number {
  if (model.includes('opus-4')) return 200000;
  if (model.includes('sonnet-4')) return 200000;
  if (model.includes('haiku-4')) return 200000;
  if (model.includes('3-5-sonnet')) return 200000;
  if (model.includes('3-5-haiku')) return 200000;
  return 200000; // Default
}
