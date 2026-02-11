# Embedding Cache System

The Embedding Cache is a content-hash-based caching system for vector embeddings that avoids redundant API calls when indexing identical content.

## Features

- **SHA-256 Content Hashing**: Deterministic hashing ensures identical content always produces the same cache key
- **Multi-Provider Support**: Cache entries are keyed by (provider, model, hash) tuple, allowing different embeddings for the same content
- **LRU Eviction**: Automatically evicts least recently used entries when cache grows too large
- **Cache Statistics**: Track hits, misses, hit rate, and evictions
- **Expiration**: Automatic expiration of old cache entries
- **Provider Management**: Clear cache entries by provider/model or clear entire cache

## Architecture

### Cache Key Structure

Cache entries are uniquely identified by three components:

```
(provider, model, content_hash)
```

- **provider**: Embedding provider (e.g., 'openai', 'anthropic')
- **model**: Model name (e.g., 'text-embedding-3-small')
- **content_hash**: SHA-256 hash of the text content

This structure allows:
- Same content with different providers/models to have separate cache entries
- Efficient lookup without storing the full content
- Deterministic cache keys for identical content

### Database Schema

```sql
CREATE TABLE embedding_cache (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  hash TEXT NOT NULL,
  embedding TEXT NOT NULL,  -- JSON array of floats
  dims INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, hash)
);

CREATE INDEX idx_embedding_cache_hash ON embedding_cache(hash);
CREATE INDEX idx_embedding_cache_updated ON embedding_cache(updated_at);
```

### LRU Eviction Strategy

When the cache size exceeds `maxSize`:
1. Sort entries by `updated_at` (ascending)
2. Evict oldest 10% of entries
3. Update statistics

The `updated_at` timestamp is refreshed on every cache hit, implementing true LRU behavior.

## Usage

### Basic Usage

```typescript
import { initializeDatabase } from './database';
import { createEmbeddingCache } from './embedding-cache';

// Initialize database and cache
const db = await initializeDatabase({ path: './data/prometheus.db' });
const cache = createEmbeddingCache(db, {
  maxSize: 100000,           // Max 100k entries
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,  // 30 days
  verbose: true,
});

// Check cache before generating embedding
const content = 'The quick brown fox jumps over the lazy dog';
const provider = 'openai';
const model = 'text-embedding-3-small';

let embedding = await cache.get(content, provider, model);

if (!embedding) {
  // Cache miss - generate embedding
  embedding = await generateEmbedding(content);
  
  // Store in cache
  await cache.set(content, provider, model, embedding);
}
```

### Configuration Options

```typescript
interface EmbeddingCacheConfig {
  /**
   * Maximum number of cache entries before eviction
   * Default: 100,000
   */
  maxSize?: number;
  
  /**
   * Maximum age of cache entries in milliseconds
   * Default: 30 days
   */
  maxAgeMs?: number;
  
  /**
   * Enable verbose logging
   * Default: false
   */
  verbose?: boolean;
}
```

### Cache Statistics

```typescript
const stats = cache.getStats();
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Cache hits: ${stats.hits}`);
console.log(`Cache misses: ${stats.misses}`);
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Evictions: ${stats.evictions}`);
```

### Provider Statistics

```typescript
const providerStats = await cache.getProviderStats();
for (const stat of providerStats) {
  console.log(`${stat.provider}/${stat.model}: ${stat.count} entries`);
}
```

### Cache Management

```typescript
// Clear all cache entries
await cache.clear();

// Clear specific provider/model
await cache.clearProvider('openai', 'text-embedding-3-small');

// Clear all models for a provider
await cache.clearProvider('openai');

// Clean expired entries
const removed = await cache.cleanExpired();
console.log(`Removed ${removed} expired entries`);

// Check if content is cached
const isCached = await cache.has(content, provider, model);

// Get cache size
const sizeBytes = await cache.getSizeBytes();
const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
console.log(`Cache size: ${sizeMB} MB`);
```

## Performance Characteristics

### Memory Usage

For 1536-dimensional embeddings (OpenAI text-embedding-3-small):
- Each embedding: ~12 KB (1536 floats × 8 bytes)
- 100,000 entries: ~1.2 GB
- Plus overhead for hash keys and metadata: ~1.5 GB total

For 3072-dimensional embeddings (OpenAI text-embedding-3-large):
- Each embedding: ~24 KB
- 100,000 entries: ~2.4 GB
- Plus overhead: ~3 GB total

### Lookup Performance

- Cache hit: O(1) - Direct hash lookup
- Cache miss: O(1) - Hash computation + lookup
- LRU eviction: O(n log n) where n = eviction count (10% of maxSize)

### Hash Computation

SHA-256 hashing is fast:
- ~1 MB/s on typical hardware
- For 1 KB text: ~1 ms
- For 10 KB text: ~10 ms

## Best Practices

### 1. Choose Appropriate Cache Size

```typescript
// For development/testing
const cache = createEmbeddingCache(db, { maxSize: 1000 });

// For production with limited memory
const cache = createEmbeddingCache(db, { maxSize: 10000 });

// For production with ample memory
const cache = createEmbeddingCache(db, { maxSize: 100000 });
```

### 2. Monitor Cache Hit Rate

```typescript
// Periodically check hit rate
setInterval(() => {
  const stats = cache.getStats();
  if (stats.hitRate < 0.5) {
    console.warn(`Low cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  }
}, 60000); // Every minute
```

### 3. Clean Expired Entries Regularly

```typescript
// Clean expired entries daily
setInterval(async () => {
  const removed = await cache.cleanExpired();
  console.log(`Cleaned ${removed} expired cache entries`);
}, 24 * 60 * 60 * 1000); // Every 24 hours
```

### 4. Use Consistent Provider/Model Names

```typescript
// Good - consistent naming
const provider = 'openai';
const model = 'text-embedding-3-small';

// Bad - inconsistent naming
const provider1 = 'openai';
const provider2 = 'OpenAI';  // Won't match cache entries
```

### 5. Handle Cache Misses Gracefully

```typescript
async function getEmbeddingWithRetry(
  content: string,
  provider: string,
  model: string,
  cache: EmbeddingCache,
  maxRetries = 3
): Promise<number[]> {
  // Check cache
  const cached = await cache.get(content, provider, model);
  if (cached) return cached;
  
  // Generate with retry
  for (let i = 0; i < maxRetries; i++) {
    try {
      const embedding = await generateEmbedding(content);
      await cache.set(content, provider, model, embedding);
      return embedding;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw new Error('Failed to generate embedding');
}
```

## Testing

The embedding cache includes comprehensive unit tests covering:

- Content hashing (SHA-256)
- Cache lookup by provider/model/hash
- Cache insertion and retrieval
- LRU eviction
- Cache statistics
- Provider statistics
- Cache management operations
- Expiration handling

Run tests:

```bash
npm test -- embedding-cache.test.ts
```

## Example

See `src/memory/examples/embedding-cache-example.ts` for a complete working example demonstrating:

- First-time indexing (cache miss)
- Re-indexing same content (cache hit)
- Batch processing with mixed hits/misses
- Cache statistics
- Provider statistics
- Cache management

Run example:

```bash
npx tsx src/memory/examples/embedding-cache-example.ts
```

## Requirements

Validates **Requirement 1.4**: "WHEN content is unchanged, THE Memory_Engine SHALL reuse cached embeddings based on content hash"

Validates **Property 3 - Embedding Cache Efficiency**: "For any content, indexing it twice with the same provider and model should reuse the cached embedding (no duplicate API calls)"

## Related Components

- **Memory Engine** (`engine.ts`): Uses embedding cache for codebase indexing
- **Database** (`database.ts`): Provides underlying storage for cache
- **Types** (`types.ts`): Defines `EmbeddingCacheEntry` type

## Future Enhancements

Potential improvements for future versions:

1. **Compression**: Compress embeddings to reduce storage size
2. **Distributed Cache**: Support for Redis or other distributed caches
3. **Cache Warming**: Pre-populate cache with common embeddings
4. **Smart Eviction**: Use access frequency in addition to recency
5. **Cache Metrics**: Export metrics to monitoring systems
6. **Batch Operations**: Optimize bulk cache operations
