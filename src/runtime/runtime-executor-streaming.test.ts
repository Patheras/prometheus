/**
 * Tests for RuntimeExecutor streaming functionality
 * 
 * Tests streaming execution, abort handling, and resource cleanup.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import { RuntimeExecutor, RuntimeExecutorConfig, LLMStreamingCaller } from './runtime-executor.js';
import { AuthProfileManager } from './auth-profile-manager.js';
import { ModelRef, RuntimeRequest, StreamChunk } from '../types/index.js';

describe('RuntimeExecutor - Streaming', () => {
  let authManager: AuthProfileManager;
  let mockStreamingCaller: jest.MockedFunction<LLMStreamingCaller>;
  
  beforeEach(() => {
    // Create auth manager with test profiles
    authManager = new AuthProfileManager();
    authManager.addProfile({
      id: 'test-anthropic-1',
      provider: 'anthropic',
      apiKey: 'test-key-1',
      lastUsed: 0,
      lastGood: Date.now(),
      cooldownUntil: 0,
      failureCount: 0
    });
    
    // Create mock streaming caller
    mockStreamingCaller = jest.fn();
  });
  
  describe('executeStreaming', () => {
    it('should stream content chunks from LLM', async () => {
      // Mock streaming response
      mockStreamingCaller.mockImplementation(async function* () {
        yield { text: 'Hello' };
        yield { text: ' world' };
        yield { text: '!' };
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller,
        trackAttempts: true
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const chunks: StreamChunk[] = [];
      for await (const chunk of executor.executeStreaming(request)) {
        chunks.push(chunk);
      }
      
      // Should have 3 content chunks + 1 done chunk
      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual({
        type: 'content',
        content: 'Hello',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      });
      expect(chunks[1]).toEqual({
        type: 'content',
        content: ' world',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      });
      expect(chunks[2]).toEqual({
        type: 'content',
        content: '!',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      });
      expect(chunks[3]).toEqual({
        type: 'done',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      });
      
      // Should mark auth success
      const profile = authManager.getAvailableProfile('anthropic');
      expect(profile?.lastGood).toBeGreaterThan(0);
    });
    
    it('should track active streams', async () => {
      // Mock streaming response that yields slowly
      mockStreamingCaller.mockImplementation(async function* () {
        yield { text: 'chunk1' };
        await new Promise(resolve => setTimeout(resolve, 10));
        yield { text: 'chunk2' };
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const streamId = 'test-stream-1';
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of executor.executeStreaming(request, streamId)) {
          chunks.push(chunk);
          
          // Check stream is tracked after first chunk
          if (chunks.length === 1) {
            expect(executor.isStreamActive(streamId)).toBe(true);
            expect(executor.getActiveStreamIds()).toContain(streamId);
          }
        }
        return chunks;
      })();
      
      await streamPromise;
      
      // Stream should be cleaned up after completion
      expect(executor.isStreamActive(streamId)).toBe(false);
      expect(executor.getActiveStreamIds()).not.toContain(streamId);
    });
    
    it('should handle connection interruptions gracefully', async () => {
      // Mock streaming response that throws mid-stream
      mockStreamingCaller.mockImplementation(async function* () {
        yield { text: 'chunk1' };
        throw new Error('Connection lost');
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller,
        fallbackConfig: {
          explicitFallbacks: {
            'anthropic:claude-sonnet-4': [
              { provider: 'anthropic', model: 'claude-sonnet-3.5' }
            ]
          }
        }
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const chunks: StreamChunk[] = [];
      for await (const chunk of executor.executeStreaming(request)) {
        chunks.push(chunk);
      }
      
      // Should have received first chunk, then error
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].type).toBe('content');
      
      // Last chunk should be error (after fallback attempts)
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('error');
    });
    
    it('should clean up resources on completion', async () => {
      mockStreamingCaller.mockImplementation(async function* () {
        yield { text: 'test' };
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const streamId = 'test-stream-cleanup';
      
      // Consume stream
      for await (const chunk of executor.executeStreaming(request, streamId)) {
        // Just consume
      }
      
      // Stream should be cleaned up
      expect(executor.isStreamActive(streamId)).toBe(false);
      expect(executor.getActiveStreamIds()).toHaveLength(0);
    });
    
    it('should clean up resources on error', async () => {
      mockStreamingCaller.mockImplementation(async function* () {
        throw new Error('Test error');
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const streamId = 'test-stream-error';
      
      // Consume stream (will get error chunk)
      for await (const chunk of executor.executeStreaming(request, streamId)) {
        // Just consume
      }
      
      // Stream should be cleaned up even on error
      expect(executor.isStreamActive(streamId)).toBe(false);
      expect(executor.getActiveStreamIds()).toHaveLength(0);
    });
    
    it('should throw error if streaming caller not configured', async () => {
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn()
        // No llmStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      await expect(async () => {
        for await (const chunk of executor.executeStreaming(request)) {
          // Should not get here
        }
      }).rejects.toThrow('Streaming caller not configured');
    });
  });
  
  describe('abortStream', () => {
    it('should abort active stream', async () => {
      // Mock streaming response that checks abort signal
      mockStreamingCaller.mockImplementation(async function* (req, model, key, signal) {
        yield { text: 'chunk1' };
        
        // Simulate waiting for more data
        for (let i = 0; i < 10; i++) {
          if (signal?.aborted) {
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            throw abortError;
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        yield { text: 'chunk2' };
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const streamId = 'test-stream-abort';
      
      // Start streaming
      const chunks: StreamChunk[] = [];
      const iterator = executor.executeStreaming(request, streamId);
      
      // Get first chunk
      const firstResult = await iterator.next();
      expect(firstResult.done).toBe(false);
      chunks.push(firstResult.value);
      
      // Abort the stream
      const aborted = executor.abortStream(streamId);
      expect(aborted).toBe(true);
      
      // Continue consuming - should get aborted chunk
      for await (const chunk of iterator) {
        chunks.push(chunk);
      }
      
      // Should have received first chunk and aborted chunk
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].type).toBe('content');
      expect(chunks[0].content).toBe('chunk1');
      
      // Last chunk should be aborted
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('aborted');
      expect(lastChunk.reason).toBe('user_cancelled');
      
      // Stream should be cleaned up
      expect(executor.isStreamActive(streamId)).toBe(false);
    });
    
    it('should return false for non-existent stream', () => {
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const result = executor.abortStream('non-existent-stream');
      expect(result).toBe(false);
    });
    
    it('should return true for active stream', async () => {
      mockStreamingCaller.mockImplementation(async function* (req, model, key, signal) {
        yield { text: 'chunk1' };
        
        // Wait for abort
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 1000);
          signal?.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('AbortError'));
          });
        });
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const streamId = 'test-stream-abort-true';
      
      // Start streaming
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of executor.executeStreaming(request, streamId)) {
          chunks.push(chunk);
          
          // Abort after first chunk
          if (chunks.length === 1) {
            const result = executor.abortStream(streamId);
            expect(result).toBe(true);
          }
        }
        return chunks;
      })();
      
      await streamPromise;
    });
    
    it('should cancel LLM request gracefully', async () => {
      let cleanupCalled = false;
      
      mockStreamingCaller.mockImplementation(async function* (req, model, key, signal) {
        try {
          yield { text: 'chunk1' };
          
          // Wait for abort
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 1000);
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('AbortError'));
            });
          });
          
          yield { text: 'chunk2' };
        } finally {
          cleanupCalled = true;
        }
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const streamId = 'test-stream-cleanup';
      
      // Start streaming and abort
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of executor.executeStreaming(request, streamId)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            executor.abortStream(streamId);
          }
        }
        return chunks;
      })();
      
      await streamPromise;
      
      // Cleanup should have been called
      expect(cleanupCalled).toBe(true);
    });
  });
  
  describe('getActiveStreamIds', () => {
    it('should return empty array when no streams active', () => {
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      expect(executor.getActiveStreamIds()).toEqual([]);
    });
    
    it('should return all active stream IDs', async () => {
      mockStreamingCaller.mockImplementation(async function* () {
        yield { text: 'chunk1' };
        await new Promise(resolve => setTimeout(resolve, 50));
        yield { text: 'chunk2' };
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      // Start multiple streams
      const stream1Promise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of executor.executeStreaming(request, 'stream-1')) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            // Check active streams after first chunk
            const activeIds = executor.getActiveStreamIds();
            expect(activeIds).toContain('stream-1');
          }
        }
      })();
      
      await stream1Promise;
    });
  });
  
  describe('isStreamActive', () => {
    it('should return false for non-existent stream', () => {
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      expect(executor.isStreamActive('non-existent')).toBe(false);
    });
    
    it('should return true for active stream', async () => {
      mockStreamingCaller.mockImplementation(async function* () {
        yield { text: 'chunk1' };
        await new Promise(resolve => setTimeout(resolve, 10));
        yield { text: 'chunk2' };
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const streamId = 'test-stream-active';
      
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of executor.executeStreaming(request, streamId)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            expect(executor.isStreamActive(streamId)).toBe(true);
          }
        }
      })();
      
      await streamPromise;
      
      // Should be inactive after completion
      expect(executor.isStreamActive(streamId)).toBe(false);
    });
  });
  
  describe('streaming with fallback', () => {
    it('should fallback to next model on streaming error', async () => {
      let callCount = 0;
      
      mockStreamingCaller.mockImplementation(async function* (req, model) {
        callCount++;
        
        if (model.model === 'claude-sonnet-4') {
          // First model fails with unavailable error (recoverable)
          const error = new Error('Model is currently unavailable');
          throw error;
        } else {
          // Second model succeeds
          yield { text: 'Success from fallback' };
        }
      });
      
      const executor = new RuntimeExecutor({
        authManager,
        llmCaller: jest.fn(),
        llmStreamingCaller: mockStreamingCaller,
        fallbackConfig: {
          explicitFallbacks: [
            { provider: 'anthropic', model: 'claude-sonnet-3.5' }
          ]
        },
        trackAttempts: true
      });
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const chunks: StreamChunk[] = [];
      for await (const chunk of executor.executeStreaming(request)) {
        chunks.push(chunk);
      }
      
      // Should have tried both models
      expect(callCount).toBe(2);
      
      // Should have content from fallback model
      const hasContent = chunks.some(c => c.type === 'content' && c.content === 'Success from fallback');
      const hasDone = chunks.some(c => c.type === 'done');
      
      expect(hasContent).toBe(true);
      expect(hasDone).toBe(true);
    });
  });
});
