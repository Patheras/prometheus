/**
 * Tests for tool call storage and retrieval in Memory Engine
 * 
 * Tests Requirements:
 * - 4.1: Store tool call messages with their arguments
 * - 4.2: Store tool result messages with their outputs
 * - 4.3: Include tool calls and results in conversation history retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrometheusDatabase, initializeDatabase } from '../database';
import { MemoryEngine } from '../engine';
import { unlinkSync, existsSync } from 'fs';

describe('Memory Engine - Tool Calls', () => {
  let db: PrometheusDatabase;
  let engine: MemoryEngine;
  const testDbPath = './test-tool-calls.db';

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Initialize database and engine
    db = await initializeDatabase({ path: testDbPath });
    engine = new MemoryEngine(db, testDbPath);
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('storeMessage with tool calls', () => {
    it('should store a message with tool calls', async () => {
      // Requirement 4.1: Store tool call messages with their arguments
      const conversationId = await engine.createConversation('Test Conversation');

      const toolCalls = [
        {
          id: 'call_123',
          name: 'analyze_code_quality',
          arguments: {
            filePath: 'src/test.ts',
            sourceCode: 'console.log("test");'
          }
        }
      ];

      const messageId = await engine.storeMessage(
        conversationId,
        'assistant',
        '', // No text content when tool calls present
        { model: 'gpt-4' },
        toolCalls
      );

      expect(messageId).toBeTruthy();

      // Retrieve and verify
      const history = await engine.getConversationHistory(conversationId);
      expect(history).toHaveLength(1);
      expect(history[0]!.tool_calls).toBeTruthy();

      const storedToolCalls = JSON.parse(history[0]!.tool_calls!);
      expect(storedToolCalls).toHaveLength(1);
      expect(storedToolCalls[0].id).toBe('call_123');
      expect(storedToolCalls[0].name).toBe('analyze_code_quality');
      expect(storedToolCalls[0].arguments.filePath).toBe('src/test.ts');
    });

    it('should store a message without tool calls', async () => {
      const conversationId = await engine.createConversation('Test Conversation');

      const messageId = await engine.storeMessage(
        conversationId,
        'user',
        'Hello, analyze my code',
        {}
      );

      expect(messageId).toBeTruthy();

      const history = await engine.getConversationHistory(conversationId);
      expect(history).toHaveLength(1);
      expect(history[0]!.tool_calls).toBeNull();
    });

    it('should store multiple tool calls in one message', async () => {
      const conversationId = await engine.createConversation('Test Conversation');

      const toolCalls = [
        {
          id: 'call_1',
          name: 'list_repositories',
          arguments: {}
        },
        {
          id: 'call_2',
          name: 'get_system_stats',
          arguments: { category: 'memory' }
        }
      ];

      await engine.storeMessage(
        conversationId,
        'assistant',
        '',
        {},
        toolCalls
      );

      const history = await engine.getConversationHistory(conversationId);
      const storedToolCalls = JSON.parse(history[0]!.tool_calls!);
      expect(storedToolCalls).toHaveLength(2);
      expect(storedToolCalls[0].name).toBe('list_repositories');
      expect(storedToolCalls[1].name).toBe('get_system_stats');
    });
  });

  describe('storeToolResult', () => {
    it('should store tool execution result', async () => {
      // Requirement 4.2: Store tool result messages with their outputs
      const conversationId = await engine.createConversation('Test Conversation');

      // First, store a message with tool calls
      const toolCalls = [
        {
          id: 'call_123',
          name: 'analyze_code_quality',
          arguments: { filePath: 'src/test.ts' }
        }
      ];

      await engine.storeMessage(
        conversationId,
        'assistant',
        '',
        {},
        toolCalls
      );

      // Store tool result
      const result = {
        success: true,
        qualityScore: 85,
        issues: [],
        executionTime: 150
      };

      await engine.storeToolResult(conversationId, 'call_123', result);

      // Retrieve and verify
      const history = await engine.getConversationHistory(conversationId);
      expect(history[0]!.tool_results).toBeTruthy();

      const storedResults = JSON.parse(history[0]!.tool_results!);
      expect(storedResults).toHaveLength(1);
      expect(storedResults[0].toolCallId).toBe('call_123');
      expect(storedResults[0].success).toBe(true);
      expect(storedResults[0].result.qualityScore).toBe(85);
    });

    it('should store multiple tool results for one message', async () => {
      const conversationId = await engine.createConversation('Test Conversation');

      const toolCalls = [
        { id: 'call_1', name: 'tool1', arguments: {} },
        { id: 'call_2', name: 'tool2', arguments: {} }
      ];

      await engine.storeMessage(conversationId, 'assistant', '', {}, toolCalls);

      // Store results for both tools
      await engine.storeToolResult(conversationId, 'call_1', { success: true, data: 'result1' });
      await engine.storeToolResult(conversationId, 'call_2', { success: true, data: 'result2' });

      const history = await engine.getConversationHistory(conversationId);
      const storedResults = JSON.parse(history[0]!.tool_results!);
      expect(storedResults).toHaveLength(2);
      expect(storedResults[0].toolCallId).toBe('call_1');
      expect(storedResults[1].toolCallId).toBe('call_2');
    });

    it('should throw error if tool call not found', async () => {
      const conversationId = await engine.createConversation('Test Conversation');

      await expect(
        engine.storeToolResult(conversationId, 'nonexistent_call', { success: true })
      ).rejects.toThrow('Message with tool call nonexistent_call not found');
    });
  });

  describe('getConversationHistory with tool calls', () => {
    it('should include tool calls and results in history', async () => {
      // Requirement 4.3: Include tool calls and results in conversation history retrieval
      const conversationId = await engine.createConversation('Test Conversation');

      // User message
      await engine.storeMessage(conversationId, 'user', 'Analyze my code', {});

      // Assistant message with tool calls
      const toolCalls = [
        {
          id: 'call_123',
          name: 'analyze_code_quality',
          arguments: { filePath: 'src/test.ts' }
        }
      ];
      await engine.storeMessage(conversationId, 'assistant', '', {}, toolCalls);

      // Tool result
      await engine.storeToolResult(conversationId, 'call_123', {
        success: true,
        result: { qualityScore: 85 }
      });

      // Final assistant response
      await engine.storeMessage(
        conversationId,
        'assistant',
        'Your code has a quality score of 85.',
        {}
      );

      // Retrieve history
      const history = await engine.getConversationHistory(conversationId);
      expect(history).toHaveLength(3);

      // Verify user message
      expect(history[0]!.role).toBe('user');
      expect(history[0]!.content).toBe('Analyze my code');
      expect(history[0]!.tool_calls).toBeNull();

      // Verify assistant message with tool calls
      expect(history[1]!.role).toBe('assistant');
      expect(history[1]!.tool_calls).toBeTruthy();
      expect(history[1]!.tool_results).toBeTruthy();

      // Verify final assistant message
      expect(history[2]!.role).toBe('assistant');
      expect(history[2]!.content).toContain('quality score of 85');
    });
  });

  describe('getConversationHistoryWithTokenLimit', () => {
    it('should return messages within token limit', async () => {
      // Requirement 4.7, 4.8: Limit conversation history to prevent context window overflow
      const conversationId = await engine.createConversation('Test Conversation');

      // Add multiple messages
      for (let i = 0; i < 10; i++) {
        await engine.storeMessage(
          conversationId,
          'user',
          `Message ${i}`,
          {}
        );
      }

      // Simple token estimator: 1 token per character
      const estimateTokens = (msg: any) => msg.content.length;

      // Get history with token limit
      const history = await engine.getConversationHistoryWithTokenLimit(
        conversationId,
        50, // Token limit
        estimateTokens
      );

      // Should return only recent messages that fit
      expect(history.length).toBeLessThan(10);
      expect(history.length).toBeGreaterThan(0);

      // Verify total tokens don't exceed limit
      const totalTokens = history.reduce((sum, msg) => sum + estimateTokens(msg), 0);
      expect(totalTokens).toBeLessThanOrEqual(50);
    });

    it('should prioritize recent messages', async () => {
      const conversationId = await engine.createConversation('Test Conversation');

      await engine.storeMessage(conversationId, 'user', 'Old message', {});
      await engine.storeMessage(conversationId, 'user', 'Recent message', {});

      const estimateTokens = (msg: any) => msg.content.length;

      const history = await engine.getConversationHistoryWithTokenLimit(
        conversationId,
        20, // Only fits one message
        estimateTokens
      );

      expect(history).toHaveLength(1);
      expect(history[0]!.content).toBe('Recent message');
    });

    it('should include at least one message even if it exceeds limit', async () => {
      const conversationId = await engine.createConversation('Test Conversation');

      await engine.storeMessage(
        conversationId,
        'user',
        'This is a very long message that exceeds the token limit',
        {}
      );

      const estimateTokens = (msg: any) => msg.content.length;

      const history = await engine.getConversationHistoryWithTokenLimit(
        conversationId,
        10, // Very small limit
        estimateTokens
      );

      // Should still return at least one message
      expect(history).toHaveLength(1);
    });
  });
});
