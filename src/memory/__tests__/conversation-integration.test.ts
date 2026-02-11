/**
 * Conversation Integration Tests
 * 
 * Tests the complete conversation flow following OpenClaw pattern:
 * 1. Write to JSONL file
 * 2. Index into SQLite
 * 3. Search with FTS5
 * 4. File watcher auto-reindex
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  initializeDatabase,
  createMemoryEngine,
  appendMessageToFile,
  listConversationFiles,
  indexConversationFiles,
  searchConversationsKeyword,
  createConversationWatcher,
  getConversationsDir,
  type PrometheusDatabase,
  type MemoryEngine,
  type ConversationWatcher,
} from '../index';

describe('Conversation Integration Tests', () => {
  const testDbPath = './test-data/test-conversations.db';
  let db: PrometheusDatabase;
  let memoryEngine: MemoryEngine;
  let watcher: ConversationWatcher | null = null;
  
  beforeEach(async () => {
    // Clean up test data
    if (existsSync('./test-data')) {
      rmSync('./test-data', { recursive: true, force: true });
    }
    mkdirSync('./test-data', { recursive: true });
    
    // Initialize database
    db = await initializeDatabase({ path: testDbPath });
    memoryEngine = createMemoryEngine(db, testDbPath);
  });
  
  afterEach(async () => {
    // Stop watcher if running
    if (watcher) {
      await watcher.stop();
      watcher = null;
    }
    
    // Close database
    if (memoryEngine) {
      memoryEngine.close();
    }
    
    // Clean up test data
    if (existsSync('./test-data')) {
      rmSync('./test-data', { recursive: true, force: true });
    }
  });
  
  describe('JSONL File Storage', () => {
    it('should write messages to JSONL file', async () => {
      const conversationId = 'conv_test_123';
      
      // Create conversation
      await memoryEngine.createConversation();
      
      // Write messages to JSONL
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'user',
        content: 'Hello, how can I improve my code?',
        timestamp: Date.now(),
      });
      
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'assistant',
        content: 'I can help you improve your code by analyzing it.',
        timestamp: Date.now(),
        metadata: { model: 'claude-sonnet-4' },
      });
      
      // Check that JSONL file exists
      const conversationsDir = getConversationsDir(testDbPath);
      const filePath = join(conversationsDir, `${conversationId}.jsonl`);
      expect(existsSync(filePath)).toBe(true);
      
      // List conversation files
      const files = await listConversationFiles(testDbPath);
      expect(files.length).toBe(1);
      expect(files[0]).toContain(conversationId);
    });
  });
  
  describe('Conversation Indexing', () => {
    it('should index JSONL files into SQLite', async () => {
      const conversationId = 'conv_test_456';
      
      // Write messages to JSONL
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'user',
        content: 'What is the best way to handle authentication?',
        timestamp: Date.now(),
      });
      
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'assistant',
        content: 'For authentication, I recommend using JWT tokens with refresh tokens.',
        timestamp: Date.now(),
      });
      
      // Index conversations
      const stats = await indexConversationFiles(db, testDbPath);
      
      expect(stats.totalFiles).toBe(1);
      expect(stats.indexedFiles).toBe(1);
      expect(stats.totalMessages).toBe(2);
      
      // Check that conversation exists in database
      const conversations = await memoryEngine.getAllConversations();
      expect(conversations.length).toBe(1);
      expect(conversations[0]?.id).toBe(conversationId);
      
      // Check that messages exist in database
      const messages = await memoryEngine.getConversationHistory(conversationId);
      expect(messages.length).toBe(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
    });
    
    it('should skip unchanged files on re-index', async () => {
      const conversationId = 'conv_test_789';
      
      // Write messages
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      });
      
      // First index
      const stats1 = await indexConversationFiles(db, testDbPath);
      expect(stats1.indexedFiles).toBe(1);
      
      // Second index (should skip unchanged file)
      const stats2 = await indexConversationFiles(db, testDbPath);
      expect(stats2.skippedFiles).toBe(1);
      expect(stats2.indexedFiles).toBe(0);
    });
  });
  
  describe('FTS5 Search', () => {
    it('should search conversations using FTS5', async () => {
      const conversationId = 'conv_test_search';
      
      // Write messages with searchable content
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'user',
        content: 'How do I implement authentication in my React app?',
        timestamp: Date.now(),
      });
      
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'assistant',
        content: 'For React authentication, you can use libraries like Auth0 or implement JWT-based auth.',
        timestamp: Date.now(),
      });
      
      // Index conversations
      await indexConversationFiles(db, testDbPath);
      
      // Search for "authentication"
      const results = await searchConversationsKeyword(db, 'authentication');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.content).toContain('authentication');
      expect(results[0]?.metadata.conversation_id).toBe(conversationId);
    });
    
    it('should search with multiple keywords', async () => {
      const conversationId = 'conv_test_multi';
      
      // Write messages
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'user',
        content: 'I need help with React hooks and state management',
        timestamp: Date.now(),
      });
      
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'assistant',
        content: 'React hooks like useState and useEffect are great for state management.',
        timestamp: Date.now(),
      });
      
      // Index
      await indexConversationFiles(db, testDbPath);
      
      // Search for "React hooks"
      const results = await searchConversationsKeyword(db, 'React hooks');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.content.toLowerCase()).toMatch(/react|hooks/);
    });
  });
  
  describe('Memory Engine Integration', () => {
    it('should store messages to both JSONL and SQLite', async () => {
      // Create conversation
      const conversationId = await memoryEngine.createConversation('Test Conversation');
      
      // Store messages (should write to both JSONL and SQLite)
      await memoryEngine.storeMessage(
        conversationId,
        'user',
        'Hello, this is a test message'
      );
      
      await memoryEngine.storeMessage(
        conversationId,
        'assistant',
        'I received your test message',
        { model: 'claude-sonnet-4' }
      );
      
      // Check JSONL file exists
      const files = await listConversationFiles(testDbPath);
      expect(files.length).toBe(1);
      
      // Check SQLite has messages
      const messages = await memoryEngine.getConversationHistory(conversationId);
      expect(messages.length).toBe(2);
      
      // Index for search
      await indexConversationFiles(db, testDbPath);
      
      // Search should work
      const results = await memoryEngine.searchConversations('test message');
      expect(results.length).toBeGreaterThan(0);
    });
    
    it('should delete both JSONL and SQLite on conversation delete', async () => {
      // Create conversation
      const conversationId = await memoryEngine.createConversation();
      
      // Store message
      await memoryEngine.storeMessage(conversationId, 'user', 'Test');
      
      // Verify JSONL exists
      const filesBefore = await listConversationFiles(testDbPath);
      expect(filesBefore.length).toBe(1);
      
      // Delete conversation
      await memoryEngine.deleteConversation(conversationId);
      
      // Verify JSONL deleted
      const filesAfter = await listConversationFiles(testDbPath);
      expect(filesAfter.length).toBe(0);
      
      // Verify SQLite deleted
      const conversations = await memoryEngine.getAllConversations();
      expect(conversations.length).toBe(0);
    });
  });
  
  describe('File Watcher', () => {
    it.skip('should auto-reindex when JSONL file changes', async () => {
      const conversationId = 'conv_test_watch';
      
      // First, create the conversation in the database
      const dbInstance = db.getDb();
      dbInstance
        .prepare(`
          INSERT INTO conversations (id, title, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(conversationId, null, Date.now(), Date.now());
      
      // Create watcher FIRST
      watcher = await createConversationWatcher(db, {
        dataPath: testDbPath,
        debounceMs: 300,
      });
      
      expect(watcher.isRunning()).toBe(true);
      
      // Wait for watcher to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // NOW write message to JSONL (watcher will detect this)
      await appendMessageToFile(testDbPath, conversationId, {
        role: 'user',
        content: 'Initial message from watcher test',
        timestamp: Date.now(),
      });
      
      // Wait for watcher to process (debounce + processing time)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Check that messages were indexed
      const messages = await memoryEngine.getConversationHistory(conversationId);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]?.content).toContain('watcher test');
    }, 10000); // Increase timeout for file watcher
  });
});
