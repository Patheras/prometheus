/**
 * Tests for Mock LLM Provider
 * 
 * Tests deterministic responses, error simulation, and call tracking.
 */

import { MockLLMProvider, createMockLLMProvider, createErrorConditions } from './mock-llm-provider.js';
import { RuntimeRequest, ModelRef } from '../types/index.js';

describe('MockLLMProvider', () => {
  let provider: MockLLMProvider;
  let request: RuntimeRequest;
  let model: ModelRef;
  
  beforeEach(() => {
    provider = createMockLLMProvider();
    request = {
      taskType: 'code_analysis',
      prompt: 'Test prompt',
      context: 'Test context',
      model: { provider: 'anthropic', model: 'claude-sonnet-4' }
    };
    model = { provider: 'anthropic', model: 'claude-sonnet-4' };
  });
  
  describe('call', () => {
    it('should return deterministic response', async () => {
      const response = await provider.call(request, model, 'test-key');
      
      expect(response.content).toBe('Mock LLM response');
      expect(response.model).toEqual(model);
      expect(response.finishReason).toBe('stop');
    });
    
    it('should return custom default response', async () => {
      provider = createMockLLMProvider({
        defaultResponse: 'Custom response'
      });
      
      const response = await provider.call(request, model, 'test-key');
      
      expect(response.content).toBe('Custom response');
    });
    
    it('should return model-specific response override', async () => {
      const responseOverrides = new Map();
      responseOverrides.set('anthropic:claude-sonnet-4', 'Anthropic response');
      responseOverrides.set('openai:gpt-4-turbo', 'OpenAI response');
      
      provider = createMockLLMProvider({ responseOverrides });
      
      const response1 = await provider.call(request, model, 'test-key');
      expect(response1.content).toBe('Anthropic response');
      
      const response2 = await provider.call(
        request,
        { provider: 'openai', model: 'gpt-4-turbo' },
        'test-key'
      );
      expect(response2.content).toBe('OpenAI response');
    });
    
    it('should track call statistics', async () => {
      await provider.call(request, model, 'key-1');
      await provider.call(request, model, 'key-2');
      await provider.call(
        request,
        { provider: 'openai', model: 'gpt-4-turbo' },
        'key-1'
      );
      
      const stats = provider.getStats();
      
      expect(stats.totalCalls).toBe(3);
      expect(stats.callsByProvider.get('anthropic')).toBe(2);
      expect(stats.callsByProvider.get('openai')).toBe(1);
      expect(stats.callsByModel.get('anthropic:claude-sonnet-4')).toBe(2);
      expect(stats.callsByModel.get('openai:gpt-4-turbo')).toBe(1);
      expect(stats.callsByApiKey.get('key-1')).toBe(2);
      expect(stats.callsByApiKey.get('key-2')).toBe(1);
      expect(stats.successfulCalls).toHaveLength(3);
    });
    
    it('should simulate response delay', async () => {
      provider = createMockLLMProvider({ responseDelay: 50 });
      
      const start = Date.now();
      await provider.call(request, model, 'test-key');
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some variance
    });
    
    it('should throw configured error', async () => {
      const error = new Error('Test error');
      provider = createMockLLMProvider({ errorToThrow: error });
      
      await expect(provider.call(request, model, 'test-key')).rejects.toThrow('Test error');
      
      const stats = provider.getStats();
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0].error).toBe(error);
    });
    
    it('should throw model-specific error', async () => {
      const errorConditions = new Map();
      errorConditions.set('anthropic:claude-sonnet-4', new Error('Anthropic error'));
      errorConditions.set('openai:gpt-4-turbo', new Error('OpenAI error'));
      
      provider = createMockLLMProvider({ errorConditions });
      
      await expect(provider.call(request, model, 'test-key')).rejects.toThrow('Anthropic error');
      
      await expect(
        provider.call(request, { provider: 'openai', model: 'gpt-4-turbo' }, 'test-key')
      ).rejects.toThrow('OpenAI error');
    });
    
    it('should fail after max calls', async () => {
      provider = createMockLLMProvider({ maxCalls: 2 });
      
      await provider.call(request, model, 'test-key');
      await provider.call(request, model, 'test-key');
      
      await expect(provider.call(request, model, 'test-key')).rejects.toThrow('Maximum calls exceeded');
    });
    
    it('should simulate rate limiting', async () => {
      provider = createMockLLMProvider({ rateLimitAfter: 2 });
      
      await provider.call(request, model, 'test-key');
      await provider.call(request, model, 'test-key');
      
      await expect(provider.call(request, model, 'test-key')).rejects.toThrow('Rate limit exceeded');
    });
    
    it('should fail for specific API keys', async () => {
      const failingApiKeys = new Set(['bad-key-1', 'bad-key-2']);
      provider = createMockLLMProvider({ failingApiKeys });
      
      await expect(provider.call(request, model, 'bad-key-1')).rejects.toThrow('Invalid API key');
      
      // Good key should work
      await provider.call(request, model, 'good-key');
    });
    
    it('should enforce context window limit', async () => {
      provider = createMockLLMProvider({ contextWindowLimit: 50 }); // Lower limit
      
      const largeRequest: RuntimeRequest = {
        ...request,
        prompt: 'a'.repeat(200),
        context: 'b'.repeat(200)
      };
      
      // 400 chars / 4 = 100 tokens, which exceeds 50 token limit
      await expect(provider.call(largeRequest, model, 'test-key')).rejects.toThrow('Context window exceeded');
      
      // Small request should work
      await provider.call(request, model, 'test-key');
    });
    
    it('should respect abort signal', async () => {
      provider = createMockLLMProvider({ responseDelay: 100 });
      
      const abortController = new AbortController();
      
      // Abort after 20ms
      setTimeout(() => abortController.abort(), 20);
      
      await expect(
        provider.call(request, model, 'test-key', abortController.signal)
      ).rejects.toThrow('Request aborted');
    });
    
    it('should include usage statistics in response', async () => {
      const response = await provider.call(request, model, 'test-key');
      
      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
      // Allow for rounding differences
      expect(response.usage.totalTokens).toBeGreaterThanOrEqual(
        response.usage.promptTokens + response.usage.completionTokens - 1
      );
      expect(response.usage.totalTokens).toBeLessThanOrEqual(
        response.usage.promptTokens + response.usage.completionTokens + 1
      );
    });
  });
  
  describe('callStreaming', () => {
    it('should stream response in chunks', async () => {
      const chunks: string[] = [];
      
      for await (const chunk of provider.callStreaming(request, model, 'test-key')) {
        chunks.push(chunk.text);
      }
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toBe('Mock LLM response');
    });
    
    it('should stream custom response', async () => {
      provider = createMockLLMProvider({
        defaultResponse: 'This is a longer custom response for streaming'
      });
      
      const chunks: string[] = [];
      
      for await (const chunk of provider.callStreaming(request, model, 'test-key')) {
        chunks.push(chunk.text);
      }
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toBe('This is a longer custom response for streaming');
    });
    
    it('should track streaming call statistics', async () => {
      for await (const chunk of provider.callStreaming(request, model, 'test-key')) {
        // Consume chunks
      }
      
      const stats = provider.getStats();
      
      expect(stats.totalCalls).toBe(1);
      expect(stats.callsByProvider.get('anthropic')).toBe(1);
      expect(stats.successfulCalls).toHaveLength(1);
    });
    
    it('should simulate delay between chunks', async () => {
      provider = createMockLLMProvider({ responseDelay: 50 });
      
      const start = Date.now();
      let chunkCount = 0;
      
      for await (const chunk of provider.callStreaming(request, model, 'test-key')) {
        chunkCount++;
      }
      
      const elapsed = Date.now() - start;
      
      // Should have some delay (responseDelay / 5 per chunk)
      expect(elapsed).toBeGreaterThan(10);
      expect(chunkCount).toBeGreaterThan(1);
    });
    
    it('should throw error during streaming', async () => {
      const error = new Error('Streaming error');
      provider = createMockLLMProvider({ errorToThrow: error });
      
      await expect(async () => {
        for await (const chunk of provider.callStreaming(request, model, 'test-key')) {
          // Should not get here
        }
      }).rejects.toThrow('Streaming error');
    });
    
    it('should respect abort signal during streaming', async () => {
      provider = createMockLLMProvider({
        defaultResponse: 'This is a very long response that will be streamed in multiple chunks',
        responseDelay: 50
      });
      
      const abortController = new AbortController();
      
      // Abort after first chunk
      let chunkCount = 0;
      
      await expect(async () => {
        for await (const chunk of provider.callStreaming(request, model, 'test-key', abortController.signal)) {
          chunkCount++;
          if (chunkCount === 1) {
            abortController.abort();
          }
        }
      }).rejects.toThrow('Request aborted');
      
      expect(chunkCount).toBe(1);
    });
  });
  
  describe('statistics management', () => {
    it('should reset statistics', async () => {
      await provider.call(request, model, 'test-key');
      await provider.call(request, model, 'test-key');
      
      let stats = provider.getStats();
      expect(stats.totalCalls).toBe(2);
      
      provider.resetStats();
      
      stats = provider.getStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.callsByProvider.size).toBe(0);
      expect(stats.successfulCalls).toHaveLength(0);
    });
    
    it('should track errors separately', async () => {
      const error = new Error('Test error');
      provider = createMockLLMProvider({ errorToThrow: error });
      
      try {
        await provider.call(request, model, 'test-key');
      } catch (e) {
        // Expected
      }
      
      const stats = provider.getStats();
      
      expect(stats.totalCalls).toBe(1);
      expect(stats.errors).toHaveLength(1);
      expect(stats.successfulCalls).toHaveLength(0);
    });
  });
  
  describe('configuration management', () => {
    it('should update configuration', () => {
      provider.updateConfig({ defaultResponse: 'Updated response' });
      
      const config = provider.getConfig();
      expect(config.defaultResponse).toBe('Updated response');
    });
    
    it('should merge configuration updates', () => {
      provider = createMockLLMProvider({
        defaultResponse: 'Original',
        responseDelay: 100
      });
      
      provider.updateConfig({ defaultResponse: 'Updated' });
      
      const config = provider.getConfig();
      expect(config.defaultResponse).toBe('Updated');
      expect(config.responseDelay).toBe(100); // Should be preserved
    });
  });
  
  describe('createErrorConditions', () => {
    it('should create standard error conditions', () => {
      const errors = createErrorConditions();
      
      expect(errors.authError.message).toContain('API key');
      expect(errors.billingError.message).toContain('quota');
      expect(errors.contextError.message).toContain('Context window');
      expect(errors.timeoutError.message).toContain('timeout');
      expect(errors.rateLimitError.message).toContain('Rate limit');
      expect(errors.unavailableError.message).toContain('unavailable');
      expect(errors.unknownError.message).toContain('Unknown');
    });
  });
});
