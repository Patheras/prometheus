/**
 * Tests for Runtime Executor
 */

import {
  RuntimeExecutor,
  createRuntimeExecutor,
  FallbackExhaustedError,
  UserAbortError,
  LLMCaller
} from '../runtime-executor';
import { AuthProfileManager } from '../auth-profile-manager';
import { ModelRef, RuntimeRequest, RuntimeResponse, AuthProfile } from '../types';

describe('RuntimeExecutor', () => {
  let authManager: AuthProfileManager;
  let mockLLMCaller: jest.MockedFunction<LLMCaller>;
  let executor: RuntimeExecutor;
  
  beforeEach(() => {
    authManager = new AuthProfileManager();
    mockLLMCaller = jest.fn();
    
    // Add test auth profiles
    const anthropicProfile: AuthProfile = {
      id: 'anthropic-1',
      provider: 'anthropic',
      apiKey: 'test-key-anthropic',
      lastUsed: 0,
      lastGood: 0,
      failureCount: 0,
      cooldownUntil: 0,
      successCount: 0
    };
    
    const openaiProfile: AuthProfile = {
      id: 'openai-1',
      provider: 'openai',
      apiKey: 'test-key-openai',
      lastUsed: 0,
      lastGood: 0,
      failureCount: 0,
      cooldownUntil: 0,
      successCount: 0
    };
    
    const googleProfile: AuthProfile = {
      id: 'google-1',
      provider: 'google',
      apiKey: 'test-key-google',
      lastUsed: 0,
      lastGood: 0,
      failureCount: 0,
      cooldownUntil: 0,
      successCount: 0
    };
    
    authManager.addProfile(anthropicProfile);
    authManager.addProfile(openaiProfile);
    authManager.addProfile(googleProfile);
    
    executor = new RuntimeExecutor({
      authManager,
      llmCaller: mockLLMCaller,
      trackAttempts: true
    });
  });
  
  describe('execute', () => {
    it('should return response on successful primary model call', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const expectedResponse: RuntimeResponse = {
        content: 'Test response',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 100,
        latency: 500
      };
      
      mockLLMCaller.mockResolvedValueOnce(expectedResponse);
      
      const response = await executor.execute(request);
      
      expect(response).toEqual(expectedResponse);
      expect(mockLLMCaller).toHaveBeenCalledTimes(1);
    });
    
    it('should mark auth profile as successful on success', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const expectedResponse: RuntimeResponse = {
        content: 'Test response',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' },
        tokensUsed: 100,
        latency: 500
      };
      
      mockLLMCaller.mockResolvedValueOnce(expectedResponse);
      
      await executor.execute(request);
      
      const profile = authManager.getProfile('anthropic-1');
      expect(profile?.successCount).toBe(1);
      expect(profile?.failureCount).toBe(0);
    });
    
    it('should attempt fallback on auth error', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const fallbackResponse: RuntimeResponse = {
        content: 'Fallback response',
        model: { provider: 'openai', model: 'gpt-4o' },
        tokensUsed: 100,
        latency: 500
      };
      
      // First call fails with auth error
      mockLLMCaller.mockRejectedValueOnce(new Error('unauthorized'));
      // Second call succeeds
      mockLLMCaller.mockResolvedValueOnce(fallbackResponse);
      
      const response = await executor.execute(request);
      
      expect(response).toEqual(fallbackResponse);
      expect(mockLLMCaller).toHaveBeenCalledTimes(2);
    });
    
    it('should mark auth profile as failed on auth error', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const fallbackResponse: RuntimeResponse = {
        content: 'Fallback response',
        model: { provider: 'openai', model: 'gpt-4o' },
        tokensUsed: 100,
        latency: 500
      };
      
      mockLLMCaller.mockRejectedValueOnce(new Error('unauthorized'));
      mockLLMCaller.mockResolvedValueOnce(fallbackResponse);
      
      await executor.execute(request);
      
      const profile = authManager.getProfile('anthropic-1');
      expect(profile?.failureCount).toBe(1);
      expect(profile?.cooldownUntil).toBeGreaterThan(0);
    });
    
    it('should throw UserAbortError on user abort', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      mockLLMCaller.mockRejectedValueOnce(new Error('Operation aborted by user'));
      
      await expect(executor.execute(request)).rejects.toThrow(UserAbortError);
      expect(mockLLMCaller).toHaveBeenCalledTimes(1); // Should not attempt fallback
    });
    
    it('should throw FallbackExhaustedError when all fallbacks fail', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      // All calls fail
      mockLLMCaller.mockRejectedValue(new Error('Service unavailable'));
      
      await expect(executor.execute(request)).rejects.toThrow(FallbackExhaustedError);
    });
    
    it('should track all attempts in FallbackExhaustedError', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      mockLLMCaller.mockRejectedValue(new Error('Service unavailable'));
      
      try {
        await executor.execute(request);
        fail('Should have thrown FallbackExhaustedError');
      } catch (error) {
        expect(error).toBeInstanceOf(FallbackExhaustedError);
        const fallbackError = error as FallbackExhaustedError;
        expect(fallbackError.attempts.length).toBeGreaterThan(0);
        expect(fallbackError.attempts[0].provider).toBe('anthropic');
        expect(fallbackError.attempts[0].model).toBe('claude-sonnet-4');
      }
    });
    
    it('should handle no available auth profile', async () => {
      // Remove all profiles
      authManager.clear();
      
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      await expect(executor.execute(request)).rejects.toThrow(FallbackExhaustedError);
    });
    
    it('should attempt multiple models in fallback chain', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const finalResponse: RuntimeResponse = {
        content: 'Final response',
        model: { provider: 'google', model: 'gemini-2.0-flash-exp' },
        tokensUsed: 100,
        latency: 500
      };
      
      // First two fail, third succeeds
      mockLLMCaller.mockRejectedValueOnce(new Error('unavailable'));
      mockLLMCaller.mockRejectedValueOnce(new Error('unavailable'));
      mockLLMCaller.mockResolvedValueOnce(finalResponse);
      
      const response = await executor.execute(request);
      
      expect(response).toEqual(finalResponse);
      expect(mockLLMCaller).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('executeWithModel', () => {
    it('should execute with specific model', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context'
      };
      
      const model: ModelRef = { provider: 'openai', model: 'gpt-4o' };
      
      const expectedResponse: RuntimeResponse = {
        content: 'Test response',
        model,
        tokensUsed: 100,
        latency: 500
      };
      
      mockLLMCaller.mockResolvedValueOnce(expectedResponse);
      
      const response = await executor.executeWithModel(request, model);
      
      expect(response).toEqual(expectedResponse);
      expect(mockLLMCaller).toHaveBeenCalledWith(
        request,
        model,
        'test-key-openai'
      );
    });
    
    it('should throw error if no auth profile available', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context'
      };
      
      const model: ModelRef = { provider: 'nonexistent', model: 'test' };
      
      await expect(executor.executeWithModel(request, model)).rejects.toThrow(
        'No available auth profile'
      );
    });
    
    it('should throw UserAbortError on user abort', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context'
      };
      
      const model: ModelRef = { provider: 'anthropic', model: 'claude-sonnet-4' };
      
      mockLLMCaller.mockRejectedValueOnce(new Error('user cancelled'));
      
      await expect(executor.executeWithModel(request, model)).rejects.toThrow(UserAbortError);
    });
  });
  
  describe('user abort detection', () => {
    it('should detect abort error by name', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      const abortError = new Error('Test');
      abortError.name = 'AbortError';
      
      mockLLMCaller.mockRejectedValueOnce(abortError);
      
      await expect(executor.execute(request)).rejects.toThrow(UserAbortError);
    });
    
    it('should detect abort error by message', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      mockLLMCaller.mockRejectedValueOnce(new Error('Request was aborted'));
      
      await expect(executor.execute(request)).rejects.toThrow(UserAbortError);
    });
    
    it('should detect cancel in message', async () => {
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: { provider: 'anthropic', model: 'claude-sonnet-4' }
      };
      
      mockLLMCaller.mockRejectedValueOnce(new Error('User cancelled the operation'));
      
      await expect(executor.execute(request)).rejects.toThrow(UserAbortError);
    });
  });
  
  describe('createRuntimeExecutor', () => {
    it('should create executor with default config', () => {
      const executor = createRuntimeExecutor(authManager, mockLLMCaller);
      
      expect(executor).toBeInstanceOf(RuntimeExecutor);
      expect(executor.getAuthManager()).toBe(authManager);
    });
    
    it('should create executor with fallback config', () => {
      const fallbackConfig = {
        maxChainLength: 3,
        allowedProviders: ['anthropic', 'openai']
      };
      
      const executor = createRuntimeExecutor(authManager, mockLLMCaller, fallbackConfig);
      
      expect(executor).toBeInstanceOf(RuntimeExecutor);
    });
  });
});
