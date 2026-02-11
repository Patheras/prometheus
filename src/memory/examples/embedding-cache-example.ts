/**
 * Embedding Cache Example
 * 
 * This example demonstrates how to use the embedding cache to avoid
 * redundant API calls when generating embeddings for identical content.
 * 
 * The cache uses SHA-256 content hashing to identify duplicate content
 * and implements LRU eviction when the cache grows too large.
 */

import { initializeDatabase } from '../database';
import { createEmbeddingCache } from '../embedding-cache';

/**
 * Mock embedding function (simulates API call)
 * In production, this would call OpenAI, Anthropic, etc.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  console.log(`  [API CALL] Generating embedding for: "${text.substring(0, 50)}..."`);
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Generate mock embedding (1536 dimensions for OpenAI text-embedding-3-small)
  return new Array(1536).fill(0).map(() => Math.random());
}

/**
 * Get embedding with caching
 * This function checks the cache first before making an API call
 */
async function getEmbeddingWithCache(
  text: string,
  provider: string,
  model: string,
  cache: ReturnType<typeof createEmbeddingCache>
): Promise<number[]> {
  // Check cache first
  const cached = await cache.get(text, provider, model);
  if (cached) {
    console.log(`  [CACHE HIT] Retrieved from cache`);
    return cached;
  }
  
  console.log(`  [CACHE MISS] Not in cache, generating...`);
  
  // Generate embedding (API call)
  const embedding = await generateEmbedding(text);
  
  // Store in cache for future use
  await cache.set(text, provider, model, embedding);
  
  return embedding;
}

/**
 * Main example function
 */
async function main() {
  console.log('=== Embedding Cache Example ===\n');
  
  // Initialize database and cache
  const db = await initializeDatabase({
    path: './data/example-cache.db',
    verbose: false,
  });
  
  const cache = createEmbeddingCache(db, {
    maxSize: 10000,
    maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
    verbose: true,
  });
  
  const provider = 'openai';
  const model = 'text-embedding-3-small';
  
  // Example 1: First-time indexing (cache miss)
  console.log('\n--- Example 1: First-time indexing ---');
  const text1 = 'The quick brown fox jumps over the lazy dog';
  const embedding1 = await getEmbeddingWithCache(text1, provider, model, cache);
  console.log(`Embedding dimensions: ${embedding1.length}`);
  
  // Example 2: Re-indexing same content (cache hit)
  console.log('\n--- Example 2: Re-indexing same content ---');
  const embedding2 = await getEmbeddingWithCache(text1, provider, model, cache);
  console.log(`Embedding dimensions: ${embedding2.length}`);
  console.log(`Embeddings match: ${JSON.stringify(embedding1) === JSON.stringify(embedding2)}`);
  
  // Example 3: Different content (cache miss)
  console.log('\n--- Example 3: Different content ---');
  const text2 = 'A completely different piece of text';
  const embedding3 = await getEmbeddingWithCache(text2, provider, model, cache);
  console.log(`Embedding dimensions: ${embedding3.length}`);
  
  // Example 4: Batch processing with mixed hits/misses
  console.log('\n--- Example 4: Batch processing ---');
  const texts = [
    'The quick brown fox jumps over the lazy dog', // cache hit
    'A completely different piece of text',        // cache hit
    'Yet another unique text string',              // cache miss
    'The quick brown fox jumps over the lazy dog', // cache hit (duplicate)
    'Final unique text for this example',          // cache miss
  ];
  
  console.log(`Processing ${texts.length} texts...`);
  const startTime = Date.now();
  
  for (const text of texts) {
    const index = texts.indexOf(text) + 1;
    console.log(`\nText ${index}:`);
    await getEmbeddingWithCache(text, provider, model, cache);
  }
  
  const endTime = Date.now();
  console.log(`\nTotal time: ${endTime - startTime}ms`);
  
  // Example 5: Cache statistics
  console.log('\n--- Example 5: Cache statistics ---');
  const stats = cache.getStats();
  console.log(`Total entries: ${stats.totalEntries}`);
  console.log(`Cache hits: ${stats.hits}`);
  console.log(`Cache misses: ${stats.misses}`);
  console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`Evictions: ${stats.evictions}`);
  
  // Example 6: Provider statistics
  console.log('\n--- Example 6: Provider statistics ---');
  const providerStats = await cache.getProviderStats();
  for (const stat of providerStats) {
    console.log(`${stat.provider}/${stat.model}: ${stat.count} entries (avg ${stat.avgDims} dims)`);
  }
  
  // Example 7: Cache size
  console.log('\n--- Example 7: Cache size ---');
  const sizeBytes = await cache.getSizeBytes();
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
  console.log(`Cache size: ${sizeMB} MB`);
  
  // Example 8: Different providers/models
  console.log('\n--- Example 8: Different providers/models ---');
  const text3 = 'Test content for multiple providers';
  
  // Same content, different providers
  await getEmbeddingWithCache(text3, 'openai', 'text-embedding-3-small', cache);
  await getEmbeddingWithCache(text3, 'openai', 'text-embedding-3-large', cache);
  await getEmbeddingWithCache(text3, 'anthropic', 'claude-embed', cache);
  
  // Check cache has separate entries
  const finalStats = cache.getStats();
  console.log(`Total entries after multi-provider test: ${finalStats.totalEntries}`);
  
  // Example 9: Cache management
  console.log('\n--- Example 9: Cache management ---');
  console.log('Clearing cache for openai/text-embedding-3-small...');
  await cache.clearProvider('openai', 'text-embedding-3-small');
  
  const afterClear = cache.getStats();
  console.log(`Entries after clearing: ${afterClear.totalEntries}`);
  
  // Cleanup
  console.log('\n--- Cleanup ---');
  db.close();
  console.log('Database closed');
  
  console.log('\n=== Example Complete ===');
}

// Run example
main().catch(console.error);
