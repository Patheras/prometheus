/**
 * Unit tests for Embedding Cache
 * 
 * Tests the embedding cache functionality including:
 * - Content hashing (SHA-256)
 * - Cache lookup by provider/model/hash
 * - Cache insertion and retrieval
 * - LRU eviction
 * - Cache statistics
 * 
 * Requirements: 1.4
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrometheusDatabase, initializeDatabase } from '../database';
import { EmbeddingCache, createEmbeddingCache } from '../embedding-cache';
import { unlinkSync, existsSync } from 'fs';

describe('EmbeddingCache', () => {
  let db: PrometheusDatabase;
  let cache: EmbeddingCache;
  const testDbPath = './test-embedding-cache.db';

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Initialize database
    db = await initializeDatabase({ path: testDbPath });
    cache = createEmbeddingCache(db, { verbose: false });
  });

  afterEach(() => {
    // Close database and clean up
    db.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Content Hashing', () => {
    it('should generate consistent hashes for identical content', async () => {
      const content = 'Hello, world!';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      // Store embedding
      await cache.set(content, provider, model, embedding);

      // Retrieve with same content
      const retrieved = await cache.get(content, provider, model);

      expect(retrieved).toEqual(embedding);
    });

    it('should generate different hashes for different content', async () => {
      const content1 = 'Hello, world!';
      const content2 = 'Goodbye, world!';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      // Store both embeddings
      await cache.set(content1, provider, model, embedding1);
      await cache.set(content2, provider, model, embedding2);

      // Retrieve both
      const retrieved1 = await cache.get(content1, provider, model);
      const retrieved2 = await cache.get(content2, provider, model);

      expect(retrieved1).toEqual(embedding1);
      expect(retrieved2).toEqual(embedding2);
      expect(retrieved1).not.toEqual(retrieved2);
    });

    it('should be case-sensitive', async () => {
      const content1 = 'Hello';
      const content2 = 'hello';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      await cache.set(content1, provider, model, embedding1);
      await cache.set(content2, provider, model, embedding2);

      const retrieved1 = await cache.get(content1, provider, model);
      const retrieved2 = await cache.get(content2, provider, model);

      expect(retrieved1).toEqual(embedding1);
      expect(retrieved2).toEqual(embedding2);
    });
  });

  describe('Cache Lookup', () => {
    it('should return null for cache miss', async () => {
      const result = await cache.get('nonexistent', 'openai', 'text-embedding-3-small');
      expect(result).toBeNull();
    });

    it('should return embedding for cache hit', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      await cache.set(content, provider, model, embedding);
      const retrieved = await cache.get(content, provider, model);

      expect(retrieved).toEqual(embedding);
    });

    it('should differentiate by provider', async () => {
      const content = 'Test content';
      const model = 'text-embedding-3-small';
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      await cache.set(content, 'openai', model, embedding1);
      await cache.set(content, 'anthropic', model, embedding2);

      const retrieved1 = await cache.get(content, 'openai', model);
      const retrieved2 = await cache.get(content, 'anthropic', model);

      expect(retrieved1).toEqual(embedding1);
      expect(retrieved2).toEqual(embedding2);
    });

    it('should differentiate by model', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      await cache.set(content, provider, 'text-embedding-3-small', embedding1);
      await cache.set(content, provider, 'text-embedding-3-large', embedding2);

      const retrieved1 = await cache.get(content, provider, 'text-embedding-3-small');
      const retrieved2 = await cache.get(content, provider, 'text-embedding-3-large');

      expect(retrieved1).toEqual(embedding1);
      expect(retrieved2).toEqual(embedding2);
    });

    it('should handle large embeddings', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-large';
      const embedding = new Array(3072).fill(0).map((_, i) => i / 3072);

      await cache.set(content, provider, model, embedding);
      const retrieved = await cache.get(content, provider, model);

      expect(retrieved).toEqual(embedding);
      expect(retrieved?.length).toBe(3072);
    });
  });

  describe('Cache Insertion', () => {
    it('should store embedding with correct dimensions', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = new Array(1536).fill(0).map((_, i) => i / 1536);

      await cache.set(content, provider, model, embedding);
      const retrieved = await cache.get(content, provider, model);

      expect(retrieved).toEqual(embedding);
      expect(retrieved?.length).toBe(1536);
    });

    it('should update existing entry on duplicate insert', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      await cache.set(content, provider, model, embedding1);
      await cache.set(content, provider, model, embedding2);

      const retrieved = await cache.get(content, provider, model);
      expect(retrieved).toEqual(embedding2);

      // Should still have only one entry
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);
    });

    it('should handle empty embeddings', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'test-model';
      const embedding: number[] = [];

      await cache.set(content, provider, model, embedding);
      const retrieved = await cache.get(content, provider, model);

      expect(retrieved).toEqual([]);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict old entries when cache is full', async () => {
      // Create cache with small max size
      const smallCache = createEmbeddingCache(db, {
        maxSize: 10,
        verbose: false,
      });

      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        await smallCache.set(`content-${i}`, provider, model, embedding);
      }

      let stats = smallCache.getStats();
      expect(stats.totalEntries).toBe(10);

      // Add one more entry, should trigger eviction
      await smallCache.set('content-new', provider, model, embedding);

      stats = smallCache.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(10);
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should evict least recently used entries', async () => {
      const smallCache = createEmbeddingCache(db, {
        maxSize: 5,
        verbose: false,
      });

      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      // Fill cache
      for (let i = 0; i < 5; i++) {
        await smallCache.set(`content-${i}`, provider, model, embedding);
      }

      // Access first entry to make it recently used
      await smallCache.get('content-0', provider, model);

      // Add new entry, should evict one of the others (not content-0)
      await smallCache.set('content-new', provider, model, embedding);

      // content-0 should still be in cache
      const retrieved = await smallCache.get('content-0', provider, model);
      expect(retrieved).toEqual(embedding);
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      // Initial stats
      let stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // Cache miss
      await cache.get(content, provider, model);
      stats = cache.getStats();
      expect(stats.misses).toBe(1);

      // Store and hit
      await cache.set(content, provider, model, embedding);
      await cache.get(content, provider, model);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      // Store one entry
      await cache.set('content-1', provider, model, embedding);

      // 2 hits, 1 miss
      await cache.get('content-1', provider, model); // hit
      await cache.get('content-1', provider, model); // hit
      await cache.get('content-2', provider, model); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should reset statistics', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      await cache.set(content, provider, model, embedding);
      await cache.get(content, provider, model);

      let stats = cache.getStats();
      expect(stats.hits).toBe(1);

      cache.resetStats();
      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.totalEntries).toBe(1); // Should not reset total entries
    });

    it('should track total entries', async () => {
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      let stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);

      await cache.set('content-1', provider, model, embedding);
      stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);

      await cache.set('content-2', provider, model, embedding);
      stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
    });
  });

  describe('Cache Management', () => {
    it('should clear all cache entries', async () => {
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      // Add multiple entries
      for (let i = 0; i < 5; i++) {
        await cache.set(`content-${i}`, provider, model, embedding);
      }

      let stats = cache.getStats();
      expect(stats.totalEntries).toBe(5);

      // Clear cache
      await cache.clear();

      stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);

      // Verify entries are gone
      const retrieved = await cache.get('content-0', provider, model);
      expect(retrieved).toBeNull();
    });

    it('should clear cache for specific provider/model', async () => {
      const embedding = [0.1, 0.2, 0.3];

      // Add entries for different providers/models
      await cache.set('content', 'openai', 'model-1', embedding);
      await cache.set('content', 'openai', 'model-2', embedding);
      await cache.set('content', 'anthropic', 'model-1', embedding);

      // Clear openai/model-1
      await cache.clearProvider('openai', 'model-1');

      // Check what remains
      expect(await cache.get('content', 'openai', 'model-1')).toBeNull();
      expect(await cache.get('content', 'openai', 'model-2')).toEqual(embedding);
      expect(await cache.get('content', 'anthropic', 'model-1')).toEqual(embedding);
    });

    it('should clear all models for a provider', async () => {
      const embedding = [0.1, 0.2, 0.3];

      await cache.set('content', 'openai', 'model-1', embedding);
      await cache.set('content', 'openai', 'model-2', embedding);
      await cache.set('content', 'anthropic', 'model-1', embedding);

      // Clear all openai models
      await cache.clearProvider('openai');

      expect(await cache.get('content', 'openai', 'model-1')).toBeNull();
      expect(await cache.get('content', 'openai', 'model-2')).toBeNull();
      expect(await cache.get('content', 'anthropic', 'model-1')).toEqual(embedding);
    });

    it('should check if content is cached', async () => {
      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      expect(await cache.has(content, provider, model)).toBe(false);

      await cache.set(content, provider, model, embedding);

      expect(await cache.has(content, provider, model)).toBe(true);
    });
  });

  describe('Provider Statistics', () => {
    it('should get statistics by provider/model', async () => {
      const embedding = [0.1, 0.2, 0.3];

      // Add entries for different providers/models
      await cache.set('content-1', 'openai', 'text-embedding-3-small', embedding);
      await cache.set('content-2', 'openai', 'text-embedding-3-small', embedding);
      await cache.set('content-3', 'openai', 'text-embedding-3-large', new Array(3072).fill(0.1));
      await cache.set('content-4', 'anthropic', 'claude-embed', embedding);

      const stats = await cache.getProviderStats();

      expect(stats).toHaveLength(3);
      
      const openaiSmall = stats.find(s => s.provider === 'openai' && s.model === 'text-embedding-3-small');
      expect(openaiSmall?.count).toBe(2);
      expect(openaiSmall?.avgDims).toBe(3);

      const openaiLarge = stats.find(s => s.provider === 'openai' && s.model === 'text-embedding-3-large');
      expect(openaiLarge?.count).toBe(1);
      expect(openaiLarge?.avgDims).toBe(3072);
    });
  });

  describe('Cache Expiration', () => {
    it('should expire old entries', async () => {
      // Create cache with short max age (1 second)
      const shortCache = createEmbeddingCache(db, {
        maxAgeMs: 1000,
        verbose: false,
      });

      const content = 'Test content';
      const provider = 'openai';
      const model = 'text-embedding-3-small';
      const embedding = [0.1, 0.2, 0.3];

      await shortCache.set(content, provider, model, embedding);

      // Should be cached immediately
      let retrieved = await shortCache.get(content, provider, model);
      expect(retrieved).toEqual(embedding);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired now
      retrieved = await shortCache.get(content, provider, model);
      expect(retrieved).toBeNull();
    });

    it('should clean expired entries', async () => {
      const shortCache = createEmbeddingCache(db, {
        maxAgeMs: 1000,
        verbose: false,
      });

      const embedding = [0.1, 0.2, 0.3];

      // Add multiple entries
      for (let i = 0; i < 5; i++) {
        await shortCache.set(`content-${i}`, 'openai', 'model', embedding);
      }

      let stats = shortCache.getStats();
      expect(stats.totalEntries).toBe(5);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Clean expired entries
      const removed = await shortCache.cleanExpired();
      expect(removed).toBe(5);

      stats = shortCache.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
