/**
 * Olympus - Gemini Tab Manager Tests
 * 
 * Unit tests for GeminiTabManager URL retrieval methods
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { GeminiTabManager } from '../gemini-tab-manager.js';

describe('GeminiTabManager - URL Retrieval Methods', () => {
  let db: Database.Database;
  let tabManager: GeminiTabManager;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Create gemini_tabs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS gemini_tabs (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        context_estimate INTEGER DEFAULT 0,
        gem_id TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'idle', 'error')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    tabManager = new GeminiTabManager(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getRoomUrl', () => {
    it('should return URL for existing room with URL', async () => {
      // Insert a room with URL
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-olympus-prime',
        'Olympus Prime',
        'https://gemini.google.com/app/abc123',
        new Date().toISOString(),
        'active',
        new Date().toISOString(),
        new Date().toISOString()
      );

      await tabManager.initialize();

      const url = tabManager.getRoomUrl('Olympus Prime');
      expect(url).toBe('https://gemini.google.com/app/abc123');
    });

    it('should return null for non-existent room', async () => {
      await tabManager.initialize();

      const url = tabManager.getRoomUrl('Non-Existent Room');
      expect(url).toBeNull();
    });

    it('should return null for room with empty URL', async () => {
      // Insert a room with empty URL
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-image-studio',
        'Image Studio',
        '',
        new Date().toISOString(),
        'idle',
        new Date().toISOString(),
        new Date().toISOString()
      );

      await tabManager.initialize();

      const url = tabManager.getRoomUrl('Image Studio');
      expect(url).toBeNull();
    });

    it('should return most recent URL for existing room', async () => {
      // Insert a room
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-video-studio',
        'Video Studio',
        'https://gemini.google.com/app/old-url',
        new Date().toISOString(),
        'active',
        new Date().toISOString(),
        new Date().toISOString()
      );

      await tabManager.initialize();

      // Update the URL
      const tab = tabManager.getTab('Video Studio');
      if (tab) {
        tabManager.updateTabMetadata(tab.id, {
          url: 'https://gemini.google.com/app/new-url'
        });
      }

      const url = tabManager.getRoomUrl('Video Studio');
      expect(url).toBe('https://gemini.google.com/app/new-url');
    });
  });

  describe('navigateToRoom', () => {
    it('should return URL for existing room', async () => {
      // Insert a room with URL
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-deep-search-operations',
        'Deep Search Operations',
        'https://gemini.google.com/app/deep-search-123',
        new Date().toISOString(),
        'active',
        new Date().toISOString(),
        new Date().toISOString()
      );

      await tabManager.initialize();

      const url = await tabManager.navigateToRoom('Deep Search Operations');
      expect(url).toBe('https://gemini.google.com/app/deep-search-123');
    });

    it('should return null for non-existent room', async () => {
      await tabManager.initialize();

      const url = await tabManager.navigateToRoom('Non-Existent Room');
      expect(url).toBeNull();
    });

    it('should return null for room with empty URL', async () => {
      // Insert a room with empty URL
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-canvas-writer',
        'Canvas Writer',
        '',
        new Date().toISOString(),
        'idle',
        new Date().toISOString(),
        new Date().toISOString()
      );

      await tabManager.initialize();

      const url = await tabManager.navigateToRoom('Canvas Writer');
      expect(url).toBeNull();
    });

    it('should log warning for non-existent room', async () => {
      await tabManager.initialize();

      // Capture console output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tabManager.navigateToRoom('Non-Existent Room');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Room "Non-Existent Room" not found or has no URL')
      );

      consoleSpy.mockRestore();
    });

    it('should log navigation message for existing room', async () => {
      // Insert a room with URL
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-social-media-master',
        'Social Media Master',
        'https://gemini.google.com/app/social-123',
        new Date().toISOString(),
        'active',
        new Date().toISOString(),
        new Date().toISOString()
      );

      await tabManager.initialize();

      // Capture console output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tabManager.navigateToRoom('Social Media Master');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Navigating to room: Social Media Master')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('URL retrieval integration', () => {
    it('should handle multiple rooms with different URLs', async () => {
      // Insert multiple rooms
      const rooms = [
        { id: 'tab-olympus-prime', category: 'Olympus Prime', url: 'https://gemini.google.com/app/prime-123' },
        { id: 'tab-image-studio', category: 'Image Studio', url: 'https://gemini.google.com/app/image-456' },
        { id: 'tab-video-studio', category: 'Video Studio', url: 'https://gemini.google.com/app/video-789' },
      ];

      for (const room of rooms) {
        db.prepare(`
          INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          room.id,
          room.category,
          room.url,
          new Date().toISOString(),
          'active',
          new Date().toISOString(),
          new Date().toISOString()
        );
      }

      await tabManager.initialize();

      // Verify each room returns correct URL
      expect(tabManager.getRoomUrl('Olympus Prime')).toBe('https://gemini.google.com/app/prime-123');
      expect(tabManager.getRoomUrl('Image Studio')).toBe('https://gemini.google.com/app/image-456');
      expect(tabManager.getRoomUrl('Video Studio')).toBe('https://gemini.google.com/app/video-789');
    });

    it('should handle mix of rooms with and without URLs', async () => {
      // Insert rooms with mixed URL states
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-with-url',
        'With URL',
        'https://gemini.google.com/app/valid-url',
        new Date().toISOString(),
        'active',
        new Date().toISOString(),
        new Date().toISOString()
      );

      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'tab-without-url',
        'Without URL',
        '',
        new Date().toISOString(),
        'idle',
        new Date().toISOString(),
        new Date().toISOString()
      );

      await tabManager.initialize();

      expect(tabManager.getRoomUrl('With URL')).toBe('https://gemini.google.com/app/valid-url');
      expect(tabManager.getRoomUrl('Without URL')).toBeNull();
    });
  });
});
