/**
 * Google Gemini LLM Provider
 * 
 * Provides integration with Google's Gemini models via their API.
 * Supports both streaming and non-streaming requests.
 */

import { ModelRef, RuntimeRequest, RuntimeResponse } from '../types/index.js';

/**
 * Gemini API message format
 */
interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * Gemini API request
 */
interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

/**
 * Gemini API response
 */
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Gemini streaming chunk
 */
interface GeminiStreamChunk {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Call Gemini API (non-streaming)
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param apiKey Gemini API key
 * @param signal Optional abort signal
 * @returns Runtime response
 */
export async function callGemini(
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
): Promise<RuntimeResponse> {
  const startTime = Date.now();
  
  // Build messages - Gemini uses system instruction separately
  const contents: GeminiMessage[] = [
    {
      role: 'user',
      parts: [{ text: `${request.context}\n\n${request.prompt}` }],
    },
  ];
  
  // Build API request
  const apiRequest: GeminiRequest = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: request.maxTokens || 8192,
      topP: 0.95,
      topK: 40,
    },
  };
  
  // Build URL with API key
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent?key=${apiKey}`;
  
  // Call API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }
  
  const data = (await response.json()) as GeminiResponse;
  
  // Extract content
  const content = data.candidates[0]?.content.parts
    .map((part) => part.text)
    .join('\n') || '';
  
  return {
    content,
    model,
    tokensUsed: data.usageMetadata?.totalTokenCount || 0,
    latency: Date.now() - startTime,
  };
}

/**
 * Call Gemini API with streaming
 * 
 * @param request Runtime request
 * @param model Model reference
 * @param apiKey Gemini API key
 * @param signal Optional abort signal
 * @returns Async iterator of text chunks
 */
export async function* callGeminiStreaming(
  request: RuntimeRequest,
  model: ModelRef,
  apiKey: string,
  signal?: AbortSignal
): AsyncIterableIterator<{ text: string }> {
  // Build messages
  const contents: GeminiMessage[] = [
    {
      role: 'user',
      parts: [{ text: `${request.context}\n\n${request.prompt}` }],
    },
  ];
  
  // Build API request
  const apiRequest: GeminiRequest = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: request.maxTokens || 8192,
      topP: 0.95,
      topK: 40,
    },
  };
  
  // Build URL with API key
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:streamGenerateContent?key=${apiKey}`;
  
  // Call API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiRequest),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }
  
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  // Parse streaming response
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
      
      // Process complete JSON objects (separated by newlines)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        
        try {
          const chunk = JSON.parse(line) as GeminiStreamChunk;
          
          // Yield text from candidates
          const text = chunk.candidates?.[0]?.content.parts
            .map((part) => part.text)
            .join('');
          
          if (text) {
            yield { text };
          }
        } catch (err) {
          console.error('Error parsing streaming chunk:', err);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get available Gemini models
 */
export function getGeminiModels(): ModelRef[] {
  return [
    { provider: 'google', model: 'gemini-3-pro-preview' },
    { provider: 'google', model: 'gemini-2.5-pro' },
  ];
}

/**
 * Get context window for Gemini model
 */
export function getGeminiContextWindow(model: string): number {
  if (model.includes('3-pro')) return 1000000;
  if (model.includes('2.5-pro')) return 2000000;
  return 1000000; // Default
}
