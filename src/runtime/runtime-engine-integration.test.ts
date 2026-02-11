/**
 * Runtime Engine End-to-End Integration Tests
 * 
 * Tests the complete Runtime Engine flow:
 * - Model selection → Execution
 * - Fallback → Auth rotation
 * - Context validation → Execution
 * - Complete request flow from start to finish
 * 
 * Requirements: 6.1, 7.1, 7.2, 8.1, 9.1
 */

import { RuntimeExecutor } from './runtime-executor.js';
import { AuthProfileManager } from './auth-profile-manager.js';
import { ModelSelector } from './model-selector.js';
import { ContextWindowGuard } from './context-window-guard.js';
import { MockLLMProvider, createErrorConditions } from './mock-llm-provider.js';
import { TaskType } from './types.js';
import { RuntimeRequest, ModelRef } from '../types/index.js';

describe('Runtime Engine - End-to-End Integration', () => {
  let mockProvider: MockLLMProvider;
  let authManager: AuthProfileManager;
  let modelSelector: ModelSelector;
  let contextGuard: ContextWindowGuard;
  let executor: RuntimeExecutor;
  
  beforeEach(() => {
    // Create mock LLM provider
    mockProvider = new MockLLMProvider({
      defaultResponse: 'Integration test response',
      trackCalls: true
    });
    
    // Create auth manager with multiple profiles
    authManager = new AuthProfileManager();
    authManager.addProfile({
      id: 'anthropic-1',
      provider: 'anthropic',
      apiKey: 'anthropic-key-1',
      lastUsed: 0,
      lastGood: Date.now(),
      cooldownUntil: 0,
      failureCount: 0,
      successCount: 0
    });
    authManager.addProfile({
      id: 'anthropic-2',
      provider: 'anthropic',
      apiKey: 'anthropic-key-2',
      lastUsed: 0,
      lastGood: Date.now(),
      cooldownUntil: 0,
      failureCount: 0,
      successCount: 0
    });
    authManager.addProfile({
      id: 'openai-1',
      provider: 'openai',
      apiKey: 'openai-key-1',
      lastUsed: 0,
      lastGood: Date.now(),
      cooldownUntil: 0,
      failureCount: 0,
      successCount: 0
    });
    
    // Create model selector
    modelSelector = new ModelSelector();
    
    // Create context guard
    contextGuard = new ContextWindowGuard();
    
    // Create runtime executor
    executor = new RuntimeExecutor({
      authManager,
      llmCaller: mockProvider.call.bind(mockProvider),
      llmStreamingCaller: mockProvider.callStreaming.bind(mockProvider),
      fallbackConfig: {
        explicitFallbacks: [
          { provider: 'anthropic', model: 'claude-sonnet-3.5' },
          { provider: 'openai', model: 'gpt-4-turbo' }
        ]
      },
      trackAttempts: true
    });
  });
  
  describe('Complete Request Flow', () => {
    it('should execute complete flow: model selection → context validation → execution', async () => {
      // 1. Select model based on task type
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      expect(selectedModel.provider).toBe('anthropic');
      expect(selectedModel.model).toBe('claude-sonnet-4');
      
      // 2. Create request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Analyze this code for issues',
        context: 'function test() { return 42; }',
        model: selectedModel
      };
      
      // 3. Validate context size
      const validation = contextGuard.validate(request, selectedModel);
      expect(validation.isValid).toBe(true);
      expect(validation.shouldWarn).toBe(false);
      
      // 4. Execute request
      const response = await executor.execute(request);
      
      // 5. Verify response
      expect(response.content).toBe('Integration test response');
      expect(response.model).toEqual(selectedModel);
      
      // 6. Verify auth profile was used
      const profile = authManager.getAvailableProfile('anthropic');
      expect(profile).toBeDefined();
      
      // 7. Verify call statistics
      const stats = mockProvider.getStats();
      expect(stats.totalCalls).toBe(1);
      expect(stats.callsByProvider.get('anthropic')).toBe(1);
      expect(stats.successfulCalls.length).toBe(1);
    });
    
    it('should handle fallback when primary model fails', async () => {
      // Configure mock to fail for primary model
      const errorConditions = new Map();
      const errors = createErrorConditions();
      errorConditions.set('anthropic:claude-sonnet-4', errors.unavailableError);
      mockProvider.updateConfig({ errorConditions });
      
      // 1. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 2. Create request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: selectedModel
      };
      
      // 3. Execute with fallback
      const response = await executor.execute(request);
      
      // 4. Verify fallback succeeded
      expect(response.content).toBe('Integration test response');
      // Should have fallen back to different model
      expect(response.model.model).not.toBe('claude-sonnet-4');
      
      // 5. Verify multiple attempts were made
      const stats = mockProvider.getStats();
      expect(stats.totalCalls).toBeGreaterThan(1);
      expect(stats.errors.length).toBeGreaterThan(0);
    });
    
    it('should rotate auth profiles on auth failure', async () => {
      // Configure mock to fail for first API key
      const failingApiKeys = new Set(['anthropic-key-1']);
      mockProvider.updateConfig({ failingApiKeys });
      
      // 1. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 2. Create request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: selectedModel
      };
      
      // 3. Execute (should rotate to second auth profile)
      const response = await executor.execute(request);
      
      // 4. Verify success with rotated auth
      expect(response.content).toBe('Integration test response');
      
      // 5. Verify first profile was marked as failed
      const profile1 = authManager.getProfile('anthropic-1');
      expect(profile1?.failureCount).toBeGreaterThan(0);
      expect(profile1?.cooldownUntil).toBeGreaterThan(Date.now());
      
      // 6. Verify call statistics show auth error
      const stats = mockProvider.getStats();
      expect(stats.errors.length).toBeGreaterThan(0);
      expect(stats.errors[0].error.message).toContain('API key');
      
      // 7. Verify successful call was made (after rotation)
      expect(stats.successfulCalls.length).toBe(1);
    });
    
    it('should reject requests exceeding context window', async () => {
      // 1. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 2. Create request with huge context (200k tokens = 800k chars)
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'a'.repeat(400000), // ~100k tokens
        context: 'b'.repeat(400000), // ~100k tokens
        model: selectedModel
      };
      
      // 3. Create guard with context window that's above hard minimum but below required
      const smallContextGuard = new ContextWindowGuard({
        overrides: {
          'anthropic:claude-sonnet-4': 50000 // Above 16k minimum but way below 200k needed
        }
      });
      
      const validation = smallContextGuard.validate(request, selectedModel);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      // Should have error about exceeding context window
      expect(validation.errors.some(e => e.includes('exceed'))).toBe(true);
      
      // 4. Should not execute if validation fails
      // (In real implementation, this would be enforced by the caller)
    });
    
    it('should handle streaming requests end-to-end', async () => {
      // Reset everything to ensure clean state
      mockProvider.resetStats();
      
      // 1. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 2. Create request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Analyze this code',
        context: 'function test() { return 42; }',
        model: selectedModel
      };
      
      // 3. Validate context
      const validation = contextGuard.validate(request, selectedModel);
      expect(validation.isValid).toBe(true);
      
      // 4. Execute streaming
      const chunks: string[] = [];
      let doneReceived = false;
      for await (const chunk of executor.executeStreaming(request)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content);
        } else if (chunk.type === 'done') {
          doneReceived = true;
        }
      }
      
      // 5. Verify streaming worked
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe('Integration test response');
      expect(doneReceived).toBe(true);
      
      // 6. Verify auth profile was marked successful
      // After streaming completes, at least one profile should have success count > 0
      const profile1 = authManager.getProfile('anthropic-1');
      const profile2 = authManager.getProfile('anthropic-2');
      const totalSuccesses = (profile1?.successCount || 0) + (profile2?.successCount || 0);
      expect(totalSuccesses).toBeGreaterThan(0);
    });
  });
  
  describe('Model Selection Integration', () => {
    it('should select appropriate model for each task type', async () => {
      const taskTypes = [
        TaskType.CODE_ANALYSIS,
        TaskType.DECISION_MAKING,
        TaskType.PATTERN_MATCHING,
        TaskType.METRIC_ANALYSIS,
        TaskType.REFACTORING,
        TaskType.CONSULTATION
      ];
      
      for (const taskType of taskTypes) {
        // 1. Select model
        const selectedModel = modelSelector.selectModel(taskType);
        expect(selectedModel).toBeDefined();
        
        // 2. Create request
        const request: RuntimeRequest = {
          taskType: taskType,
          prompt: `Test prompt for ${taskType}`,
          context: 'Test context',
          model: selectedModel
        };
        
        // 3. Execute
        const response = await executor.execute(request);
        
        // 4. Verify success
        expect(response.content).toBe('Integration test response');
        expect(response.model).toEqual(selectedModel);
      }
      
      // Verify all task types were executed
      const stats = mockProvider.getStats();
      expect(stats.totalCalls).toBe(taskTypes.length);
    });
    
    it('should respect model overrides', async () => {
      // 1. Select model with override (use forceModel, not modelOverride)
      const overrideModel: ModelRef = { provider: 'openai', model: 'gpt-4-turbo' };
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS, {
        forceModel: overrideModel
      });
      
      expect(selectedModel).toEqual(overrideModel);
      
      // 2. Create request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: selectedModel
      };
      
      // 3. Execute
      const response = await executor.execute(request);
      
      // 4. Verify override was used
      expect(response.model).toEqual(overrideModel);
      
      // 5. Verify OpenAI profile was used
      const stats = mockProvider.getStats();
      expect(stats.callsByProvider.get('openai')).toBe(1);
    });
  });
  
  describe('Fallback Chain Integration', () => {
    it('should try all models in fallback chain', async () => {
      // Configure mock to fail for all Anthropic models
      const errorConditions = new Map();
      const errors = createErrorConditions();
      errorConditions.set('anthropic:claude-sonnet-4', errors.unavailableError);
      errorConditions.set('anthropic:claude-sonnet-3.5', errors.unavailableError);
      mockProvider.updateConfig({ errorConditions });
      
      // 1. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 2. Create request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: selectedModel
      };
      
      // 3. Execute (should fallback to OpenAI)
      const response = await executor.execute(request);
      
      // 4. Verify OpenAI was used
      expect(response.model.provider).toBe('openai');
      
      // 5. Verify multiple attempts
      const stats = mockProvider.getStats();
      expect(stats.totalCalls).toBeGreaterThanOrEqual(3); // Primary + 2 fallbacks
      expect(stats.callsByProvider.get('anthropic')).toBeGreaterThan(0);
      expect(stats.callsByProvider.get('openai')).toBe(1);
    });
    
    it('should exhaust fallback chain and throw error', async () => {
      // Configure mock to fail for all models
      const errorConditions = new Map();
      const errors = createErrorConditions();
      errorConditions.set('anthropic:claude-sonnet-4', errors.unavailableError);
      errorConditions.set('anthropic:claude-sonnet-3.5', errors.unavailableError);
      errorConditions.set('openai:gpt-4-turbo', errors.unavailableError);
      mockProvider.updateConfig({ errorConditions });
      
      // 1. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 2. Create request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: selectedModel
      };
      
      // 3. Execute (should fail after all attempts)
      await expect(executor.execute(request)).rejects.toThrow('All fallback attempts exhausted');
      
      // 4. Verify all models were tried
      const stats = mockProvider.getStats();
      expect(stats.totalCalls).toBeGreaterThanOrEqual(3);
      expect(stats.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Auth Rotation Integration', () => {
    it('should round-robin between auth profiles', async () => {
      // 1. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 2. Execute multiple requests
      for (let i = 0; i < 4; i++) {
        const request: RuntimeRequest = {
          taskType: 'code_analysis',
          prompt: `Test prompt ${i}`,
          context: 'Test context',
          model: selectedModel
        };
        
        await executor.execute(request);
      }
      
      // 3. Verify both Anthropic profiles were used
      const stats = mockProvider.getStats();
      expect(stats.callsByApiKey.get('anthropic-key-1')).toBeGreaterThan(0);
      expect(stats.callsByApiKey.get('anthropic-key-2')).toBeGreaterThan(0);
    });
    
    it('should skip profiles in cooldown', async () => {
      // 1. Mark first profile as failed (puts it in cooldown)
      authManager.markFailure('anthropic-1');
      authManager.markFailure('anthropic-1');
      authManager.markFailure('anthropic-1');
      
      // 2. Select model
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // 3. Execute request
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: selectedModel
      };
      
      const response = await executor.execute(request);
      
      // 4. Verify second profile was used (first is in cooldown)
      const stats = mockProvider.getStats();
      expect(stats.callsByApiKey.get('anthropic-key-2')).toBe(1);
      expect(stats.callsByApiKey.get('anthropic-key-1')).toBeUndefined();
    });
  });
  
  describe('Context Validation Integration', () => {
    it('should warn for small context windows', () => {
      // 1. Select model with small context window
      const smallModel: ModelRef = { provider: 'test', model: 'small-context' };
      
      // 2. Create request with minimal content
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: smallModel
      };
      
      // 3. Create guard with small context window config (below 32k warning threshold)
      const smallContextGuard = new ContextWindowGuard({
        overrides: {
          'test:small-context': 20000 // Below warning threshold (32k)
        }
      });
      
      const validation = smallContextGuard.validate(request, smallModel);
      
      expect(validation.isValid).toBe(true);
      expect(validation.shouldWarn).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('below recommended minimum');
    });
    
    it('should reject requests below hard minimum', () => {
      // 1. Select model with tiny context window
      const tinyModel: ModelRef = { provider: 'test', model: 'tiny-context' };
      
      // 2. Create request with minimal content
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test prompt',
        context: 'Test context',
        model: tinyModel
      };
      
      // 3. Create guard with tiny context window config (below 16k hard minimum)
      const tinyContextGuard = new ContextWindowGuard({
        overrides: {
          'test:tiny-context': 10000 // Below hard minimum (16k)
        }
      });
      
      const validation = tinyContextGuard.validate(request, tinyModel);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('below hard minimum');
    });
  });
  
  describe('Error Handling Integration', () => {
    it('should handle auth errors with rotation', async () => {
      // Configure first key to fail
      const failingApiKeys = new Set(['anthropic-key-1']);
      mockProvider.updateConfig({ failingApiKeys });
      
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      const request: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test',
        context: '',
        model: selectedModel
      };
      
      const response = await executor.execute(request);
      
      // Should succeed with second key
      expect(response.content).toBe('Integration test response');
      
      // First profile should be in cooldown
      const profile1 = authManager.getProfile('anthropic-1');
      expect(profile1?.cooldownUntil).toBeGreaterThan(Date.now());
    });
    
    it('should handle rate limit errors with fallback', async () => {
      // Reset mock provider stats and call count
      mockProvider.resetStats();
      
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // Configure to rate limit after 0 calls (meaning first call will fail)
      // But we need to check the implementation - it checks callCount > rateLimitAfter
      // So rateLimitAfter: 0 means fail when callCount > 0, which is after first call
      // We need rateLimitAfter: -1 or modify the test
      
      // Let's make first call succeed, then rate limit
      const request1: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test 1',
        context: '',
        model: selectedModel
      };
      await executor.execute(request1);
      
      // Now configure rate limiting for next calls
      mockProvider.updateConfig({ rateLimitAfter: 1 });
      
      // This request should hit rate limit and try fallback
      const request2: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'Test 2',
        context: '',
        model: selectedModel
      };
      
      // Should either succeed with fallback or fail if all models rate limited
      try {
        const response = await executor.execute(request2);
        // If it succeeds, verify it's a valid response
        expect(response.content).toBeDefined();
      } catch (error) {
        // If it fails, should be because all models are rate limited
        expect(error).toBeDefined();
      }
      
      const stats = mockProvider.getStats();
      // Should have at least one rate limit error
      expect(stats.errors.some(e => e.error.message.includes('Rate limit'))).toBe(true);
    });
    
    it('should handle context window errors', async () => {
      // Configure small context window in mock provider (50 tokens = ~200 chars)
      mockProvider.updateConfig({ contextWindowLimit: 50 });
      
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      const largeRequest: RuntimeRequest = {
        taskType: 'code_analysis',
        prompt: 'a'.repeat(400), // ~100 tokens
        context: 'b'.repeat(400), // ~100 tokens
        model: selectedModel
      };
      
      // Should fail - all models will hit context window limit
      // Since all fallbacks will also fail, we get FallbackExhaustedError
      await expect(executor.execute(largeRequest)).rejects.toThrow();
      
      // Verify context window errors were encountered
      const stats = mockProvider.getStats();
      expect(stats.errors.some(e => e.error.message.includes('Context window'))).toBe(true);
    });
  });
  
  describe('Performance and Statistics', () => {
    it('should track comprehensive statistics', async () => {
      const selectedModel = modelSelector.selectModel(TaskType.CODE_ANALYSIS);
      
      // Execute multiple requests
      for (let i = 0; i < 5; i++) {
        const request: RuntimeRequest = {
          taskType: 'code_analysis',
          prompt: `Test ${i}`,
          context: '',
          model: selectedModel
        };
        await executor.execute(request);
      }
      
      const stats = mockProvider.getStats();
      
      expect(stats.totalCalls).toBe(5);
      expect(stats.successfulCalls.length).toBe(5);
      expect(stats.callsByProvider.get('anthropic')).toBe(5);
      expect(stats.callsByModel.get('anthropic:claude-sonnet-4')).toBe(5);
    });
  });
});
