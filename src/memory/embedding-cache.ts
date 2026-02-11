/**
 * Embedding Cache System with Content Hashing
 * 
 * This module implements a content-hash-based cache for vector embeddings
 * to avoid redundant API calls when indexing identical content.
 * 
 * Features:
 * - SHA-256 content hashing for cache keys
 * - Cache lookup by (provider, model, hash) tuple
 * - LRU eviction when cache grows too large
 * - Automatic cache hit/miss tracking
 * 
 * Requirements: 1.4
 * Validates: Property 3 - Embedding Cache Efficiency
 */

import { createHash } from 'crypto';
import { PrometheusDatabase } from './database';
import { EmbeddingCacheEntry } from './types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Maximum number of cache entries before LRU eviction kicks in
 * Default: 100,000 entries (approximately 600MB for 1536-dim embeddings)
 */
const DEFAULT_MAX_CACHE_SIZE = 100000;

/**
 * Maximum age of cache entries in milliseconds
 * Default: 30 days
 */
const DEFAULT_MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingCacheConfig {
  /**
   * Maximum number of cache entries before eviction
   */
  maxSize?: number;
  
  /**
   * Maximum age of cache entries in milliseconds
   */
  maxAgeMs?: number;
  
  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

export interface CacheStats {
  /**
   * Total number of cache entries
   */
  totalEntries: number;
  
  /**
   * Number of cache hits since last reset
   */
  hits: number;
  
  /**
   * Number of cache misses since last reset
   */
  misses: number;
  
  /**
   * Cache hit rate (hits / (hits + misses))
   */
  hitRate: number;
  
  /**
   * Number of entries evicted due to LRU
   */
  evictions: number;
}

// ============================================================================
// Embedding Cache Implementation
// ============================================================================

/**
 * Embedding cache with content hashing and LRU eviction
 * 
 * This class provides efficient caching of vector embeddings using
 * content-based hashing to avoid redundant API calls.
 */
export class EmbeddingCache {
  private db: PrometheusDatabase;
  private config: Required<EmbeddingCacheConfig>;
  private stats: CacheStats;
  
  constructor(db: PrometheusDatabase, config: EmbeddingCacheConfig = {}) {
    this.db = db;
    this.config = {
      maxSize: config.maxSize ?? DEFAULT_MAX_CACHE_SIZE,
      maxAgeMs: config.maxAgeMs ?? DEFAULT_MAX_CACHE_AGE_MS,
      verbose: config.verbose ?? false,
    };
    this.stats = {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
    };
    
    // Initialize stats
    this.updateStats();
  }
  
  // ========== Core Cache Operations ==========
  
  /**
   * Get embedding from cache
   * 
   * @param content Text content to hash
   * @param provider Embedding provider (e.g., 'openai', 'anthropic')
   * @param model Model name (e.g., 'text-embedding-3-small')
   * @returns Cached embedding or null if not found
   */
  async get(
    content: string,
    provider: string,
    model: string
  ): Promise<number[] | null> {
    const hash = this.hashContent(content);
    const dbInstance = this.db.getDb();
    
    const result = dbInstance
      .prepare(`
        SELECT embedding, dims, updated_at
        FROM embedding_cache
        WHERE provider = ? AND model = ? AND hash = ?
      `)
      .get(provider, model, hash) as EmbeddingCacheEntry | undefined;
    
    if (!result) {
      this.stats.misses++;
      this.updateHitRate();
      
      if (this.config.verbose) {
        console.log(`Cache miss: ${provider}/${model}/${hash.substring(0, 8)}...`);
      }
      
      return null;
    }
    
    // Check if entry is too old
    const age = Date.now() - result.updated_at;
    if (age > this.config.maxAgeMs) {
      // Entry expired, remove it
      this.delete(provider, model, hash);
      this.stats.misses++;
      this.updateHitRate();
      
      if (this.config.verbose) {
        console.log(`Cache expired: ${provider}/${model}/${hash.substring(0, 8)}... (age: ${Math.round(age / 1000 / 60 / 60)}h)`);
      }
      
      return null;
    }
    
    // Update access time (for LRU)
    dbInstance
      .prepare(`
        UPDATE embedding_cache
        SET updated_at = ?
        WHERE provider = ? AND model = ? AND hash = ?
      `)
      .run(Date.now(), provider, model, hash);
    
    this.stats.hits++;
    this.updateHitRate();
    
    if (this.config.verbose) {
      console.log(`Cache hit: ${provider}/${model}/${hash.substring(0, 8)}...`);
    }
    
    return JSON.parse(result.embedding);
  }
  
  /**
   * Store embedding in cache
   * 
   * @param content Text content to hash
   * @param provider Embedding provider
   * @param model Model name
   * @param embedding Vector embedding to cache
   */
  async set(
    content: string,
    provider: string,
    model: string,
    embedding: number[]
  ): Promise<void> {
    const hash = this.hashContent(content);
    const dbInstance = this.db.getDb();
    
    // Check if we need to evict entries
    await this.evictIfNeeded();
    
    // Insert or replace entry
    dbInstance
      .prepare(`
        INSERT OR REPLACE INTO embedding_cache (
          provider, model, hash, embedding, dims, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        provider,
        model,
        hash,
        JSON.stringify(embedding),
        embedding.length,
        Date.now()
      );
    
    this.updateStats();
    
    if (this.config.verbose) {
      console.log(`Cache set: ${provider}/${model}/${hash.substring(0, 8)}... (dims: ${embedding.length})`);
    }
  }
  
  /**
   * Check if content is cached
   * 
   * @param content Text content to check
   * @param provider Embedding provider
   * @param model Model name
   * @returns True if cached, false otherwise
   */
  async has(content: string, provider: string, model: string): Promise<boolean> {
    const hash = this.hashContent(content);
    const dbInstance = this.db.getDb();
    
    const result = dbInstance
      .prepare(`
        SELECT 1 FROM embedding_cache
        WHERE provider = ? AND model = ? AND hash = ?
      `)
      .get(provider, model, hash);
    
    return result !== undefined;
  }
  
  /**
   * Delete a cache entry
   * 
   * @param provider Embedding provider
   * @param model Model name
   * @param hash Content hash
   */
  private delete(provider: string, model: string, hash: string): void {
    const dbInstance = this.db.getDb();
    
    dbInstance
      .prepare(`
        DELETE FROM embedding_cache
        WHERE provider = ? AND model = ? AND hash = ?
      `)
      .run(provider, model, hash);
    
    this.updateStats();
  }
  
  // ========== Content Hashing ==========
  
  /**
   * Hash content using SHA-256
   * 
   * @param content Text content to hash
   * @returns Hex-encoded SHA-256 hash
   */
  private hashContent(content: string): string {
    return createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }
  
  // ========== LRU Eviction ==========
  
  /**
   * Evict old entries if cache size exceeds limit
   * 
   * Uses LRU (Least Recently Used) strategy based on updated_at timestamp
   */
  private async evictIfNeeded(): Promise<void> {
    const dbInstance = this.db.getDb();
    
    // Check current cache size
    const sizeResult = dbInstance
      .prepare('SELECT COUNT(*) as count FROM embedding_cache')
      .get() as { count: number };
    
    if (sizeResult.count < this.config.maxSize) {
      return; // No eviction needed
    }
    
    // Calculate how many entries to evict (10% of max size)
    const evictCount = Math.floor(this.config.maxSize * 0.1);
    
    // Get oldest entries by updated_at
    const oldestEntries = dbInstance
      .prepare(`
        SELECT provider, model, hash
        FROM embedding_cache
        ORDER BY updated_at ASC
        LIMIT ?
      `)
      .all(evictCount) as Array<{ provider: string; model: string; hash: string }>;
    
    // Delete oldest entries
    const deleteStmt = dbInstance.prepare(`
      DELETE FROM embedding_cache
      WHERE provider = ? AND model = ? AND hash = ?
    `);
    
    this.db.transaction(() => {
      for (const entry of oldestEntries) {
        deleteStmt.run(entry.provider, entry.model, entry.hash);
      }
    });
    
    this.stats.evictions += evictCount;
    this.updateStats();
    
    if (this.config.verbose) {
      console.log(`Evicted ${evictCount} old cache entries (LRU)`);
    }
  }
  
  // ========== Cache Statistics ==========
  
  /**
   * Get cache statistics
   * 
   * @returns Current cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * Reset cache statistics (hits, misses, evictions)
   * 
   * Note: Does not reset totalEntries
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.updateHitRate();
  }
  
  /**
   * Update total entries count
   */
  private updateStats(): void {
    const dbInstance = this.db.getDb();
    
    const result = dbInstance
      .prepare('SELECT COUNT(*) as count FROM embedding_cache')
      .get() as { count: number };
    
    this.stats.totalEntries = result.count;
  }
  
  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
  
  // ========== Cache Management ==========
  
  /**
   * Clear all cache entries
   * 
   * WARNING: This will delete all cached embeddings
   */
  async clear(): Promise<void> {
    const dbInstance = this.db.getDb();
    
    dbInstance.prepare('DELETE FROM embedding_cache').run();
    
    this.stats.totalEntries = 0;
    this.stats.evictions = 0;
    
    if (this.config.verbose) {
      console.log('Cache cleared');
    }
  }
  
  /**
   * Clear cache entries for a specific provider/model
   * 
   * @param provider Embedding provider
   * @param model Model name (optional, clears all models for provider if omitted)
   */
  async clearProvider(provider: string, model?: string): Promise<void> {
    const dbInstance = this.db.getDb();
    
    if (model) {
      dbInstance
        .prepare('DELETE FROM embedding_cache WHERE provider = ? AND model = ?')
        .run(provider, model);
      
      if (this.config.verbose) {
        console.log(`Cache cleared for ${provider}/${model}`);
      }
    } else {
      dbInstance
        .prepare('DELETE FROM embedding_cache WHERE provider = ?')
        .run(provider);
      
      if (this.config.verbose) {
        console.log(`Cache cleared for provider ${provider}`);
      }
    }
    
    this.updateStats();
  }
  
  /**
   * Remove expired cache entries
   * 
   * @returns Number of entries removed
   */
  async cleanExpired(): Promise<number> {
    const dbInstance = this.db.getDb();
    const cutoffTime = Date.now() - this.config.maxAgeMs;
    
    const result = dbInstance
      .prepare('DELETE FROM embedding_cache WHERE updated_at < ?')
      .run(cutoffTime);
    
    this.updateStats();
    
    if (this.config.verbose && result.changes > 0) {
      console.log(`Cleaned ${result.changes} expired cache entries`);
    }
    
    return result.changes;
  }
  
  /**
   * Get cache size in bytes (approximate)
   * 
   * @returns Approximate cache size in bytes
   */
  async getSizeBytes(): Promise<number> {
    const dbInstance = this.db.getDb();
    
    const result = dbInstance
      .prepare(`
        SELECT SUM(LENGTH(embedding)) as total_size
        FROM embedding_cache
      `)
      .get() as { total_size: number | null };
    
    return result.total_size || 0;
  }
  
  /**
   * Get cache entries grouped by provider/model
   * 
   * @returns Array of provider/model statistics
   */
  async getProviderStats(): Promise<Array<{
    provider: string;
    model: string;
    count: number;
    avgDims: number;
  }>> {
    const dbInstance = this.db.getDb();
    
    const results = dbInstance
      .prepare(`
        SELECT 
          provider,
          model,
          COUNT(*) as count,
          AVG(dims) as avg_dims
        FROM embedding_cache
        GROUP BY provider, model
        ORDER BY count DESC
      `)
      .all() as Array<{
        provider: string;
        model: string;
        count: number;
        avg_dims: number;
      }>;
    
    return results.map(r => ({
      provider: r.provider,
      model: r.model,
      count: r.count,
      avgDims: Math.round(r.avg_dims),
    }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new embedding cache instance
 * 
 * @param db Database connection
 * @param config Cache configuration
 * @returns Embedding cache instance
 */
export function createEmbeddingCache(
  db: PrometheusDatabase,
  config?: EmbeddingCacheConfig
): EmbeddingCache {
  return new EmbeddingCache(db, config);
}
