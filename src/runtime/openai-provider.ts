/**
 * OpenAI LLM Provider
 * 
 * Provides integration with OpenAI's GPT models via their API.
 * Supports both streaming and non-streaming requests.
 */

import { ModelRef, RuntimeRequest, RuntimeResponse } from '../types/index.js';

/**
 * OpenAI API message format
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI API request
 */
interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * OpenAI API response
 */
interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk
 */
interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Call OpenAI API (non-streaming)
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param apiKey OpenAI API key
 * @param signal Optional abort signal
 * @returns Runtime response
 */
export async function callOpenAI(
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
): Promise<RuntimeResponse> {
  const startTime = Date.now();
  
  // Build messages
  const messages: OpenAIMessage[] = [
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
  const apiRequest: OpenAIRequest = {
    model: model.model,
    messages,
    max_tokens: request.maxTokens || 4096,
    temperature: 0.7,
    stream: false,
  };
  
  // Call API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }
  
  const data = (await response.json()) as OpenAIResponse;
  
  // Extract content
  const content = data.choices[0]?.message.content || '';
  
  return {
    content,
    model,
    tokensUsed: data.usage.total_tokens,
    latency: Date.now() - startTime,
  };
}

/**
 * Call OpenAI API with streaming
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param apiKey OpenAI API key
 * @param signal Optional abort signal
 * @returns Async iterator of text chunks
 */
export async function* callOpenAIStreaming(
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
): AsyncIterableIterator<{ text: string }> {
  // Build messages
  const messages: OpenAIMessage[] = [
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
  const apiRequest: OpenAIRequest = {
    model: model.model,
    messages,
    max_tokens: request.maxTokens || 4096,
    temperature: 0.7,
    stream: true,
  };
  
  // Call API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
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
          const chunk = JSON.parse(data) as OpenAIStreamChunk;
          
          // Yield content deltas
          const content = chunk.choices[0]?.delta.content;
          if (content) {
            yield { text: content };
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
 * Get available OpenAI models
 */
export function getOpenAIModels(): ModelRef[] {
  return [
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'openai', model: 'gpt-4-turbo' },
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'openai', model: 'gpt-3.5-turbo' },
    { provider: 'openai', model: 'o1' },
    { provider: 'openai', model: 'o1-mini' },
  ];
}

/**
 * Get context window for OpenAI model
 */
export function getOpenAIContextWindow(model: string): number {
  if (model.includes('gpt-4o')) return 128000;
  if (model.includes('gpt-4-turbo')) return 128000;
  if (model.includes('gpt-4')) return 8192;
  if (model.includes('gpt-3.5-turbo')) return 16385;
  if (model.includes('o1')) return 128000;
  return 128000; // Default
}
