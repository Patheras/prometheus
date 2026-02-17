/**
 * Olympus - Hermes Basic Tests
 * 
 * Basic functionality tests for Hermes
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { GeminiMessenger } from '../gemini-messenger.js';
import { GeminiTabManager } from '../gemini-tab-manager.js';
import { DEFAULT_HERMES_CONFIG } from '../config.js';

describe('Hermes - Basic Tests', () => {
  let db: Database.Database;
  let messenger: GeminiMessenger;
  
  beforeAll(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Run migrations
    db.exec(`
      CREATE TABLE gemini_tabs (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        context_estimate INTEGER DEFAULT 0,
        gem_id TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE gemini_messages (
        id TEXT PRIMARY KEY,
        tab_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens_estimate INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Initialize messenger
    messenger = new GeminiMessenger(db);
    await messenger.initialize();
  });
  
  it('should initialize tab manager with 20 tabs', () => {
    const tabManager = messenger.getTabManager();
    const tabs = tabManager.listTabs();
    
    expect(tabs.length).toBe(20);
    expect(tabs.map(t => t.category)).toContain('Coding');
    expect(tabs.map(t => t.category)).toContain('Design');
    expect(tabs.map(t => t.category)).toContain('General');
  });
  
  it('should get tab by category', () => {
    const tabManager = messenger.getTabManager();
    const codingTab = tabManager.getTab('Coding');
    
    expect(codingTab).toBeDefined();
    expect(codingTab?.category).toBe('Coding');
    expect(codingTab?.status).toBe('idle');
  });
  
  it('should track metrics', () => {
    const metrics = messenger.getMetrics();
    
    expect(metrics).toHaveProperty('messagesSent');
    expect(metrics).toHaveProperty('responsesReceived');
    expect(metrics).toHaveProperty('averageResponseTime');
    expect(metrics.messagesSent).toBe(0);
  });
  
  it('should get tab health', () => {
    const tabManager = messenger.getTabManager();
    const tabs = tabManager.listTabs();
    const health = tabManager.getTabHealth(tabs[0].id);
    
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('contextUsage');
    expect(health.status).toBe('healthy');
    expect(health.contextUsage).toBe(0);
  });
});
