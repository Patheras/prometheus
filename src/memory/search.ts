/**
 * Search functionality for Prometheus Memory Engine
 * 
 * This module provides:
 * - FTS5 keyword search with BM25 ranking
 * - Vector similarity search
 * - Hybrid search combining keyword and vector results
 * - Query building and sanitization
 * 
 * Requirements: 1.3, 5.1
 */

import { PrometheusDatabase } from './database';
import { SearchOptions, SearchResult, MemorySource } from './types';

// ============================================================================
// FTS5 Keyword Search
// ============================================================================

/**
 * Build an FTS5 query from user input
 * 
 * This function sanitizes user input and builds a valid FTS5 query string.
 * It handles special characters and applies proper escaping to prevent
 * syntax errors.
 * 
 * @param query User query string
 * @returns FTS5-compatible query string
 */
export function buildFTS5Query(query: string): string {
  // Trim whitespace
  let sanitized = query.trim();
  
  // If empty, return match-all query
  if (!sanitized) {
    return '*';
  }
  
  // Escape special FTS5 characters: " * ( ) [ ] { } : ^ - +
  // We'll escape them by wrapping the entire query in quotes
  // and escaping internal quotes
  sanitized = sanitized.replace(/"/g, '""');
  
  // Split into words for better matching
  const words = sanitized.split(/\s+/).filter(w => w.length > 0);
  
  // If single word, just quote it
  if (words.length === 1) {
    return `"${words[0]}"`;
  }
  
  // For multiple words, create an OR query with each word quoted
  // This allows matching any of the words (more permissive)
  // For phrase matching, the user can provide the query in quotes
  const quotedWords = words.map(w => `"${w}"`);
  return quotedWords.join(' OR ');
}

/**
 * Execute FTS5 keyword search on code chunks
 * 
 * Uses SQLite's FTS5 full-text search with BM25 ranking to find
 * relevant code chunks based on keyword matching.
 * 
 * @param db Database instance
 * @param query User query string
 * @param options Search options
 * @returns Array of search results with relevance scores
 */
export async function keywordSearchCode(
  db: PrometheusDatabase,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const dbInstance = db.getDb();
  const limit = options.limit || 10;
  
  // Build FTS5 query
  const ftsQuery = buildFTS5Query(query);
  
  // Execute FTS5 search with BM25 ranking
  // The rank column contains negative values where lower (more negative) = better match
  // We'll convert to positive scores for consistency
  const results = dbInstance
    .prepare(`
      SELECT 
        c.id,
        c.file_path,
        c.start_line,
        c.end_line,
        c.text,
        c.symbols,
        c.imports,
        -fts.rank as relevance_score
      FROM code_chunks_fts fts
      JOIN code_chunks c ON c.id = fts.id
      WHERE code_chunks_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `)
    .all(ftsQuery, limit * 2) as Array<{
      id: string;
      file_path: string;
      start_line: number;
      end_line: number;
      text: string;
      symbols: string | null;
      imports: string | null;
      relevance_score: number;
    }>;
  
  // Convert to SearchResult format
  return results.map(row => ({
    id: row.id,
    source: 'code' as MemorySource,
    score: normalizeScore(row.relevance_score),
    content: row.text,
    metadata: {
      file_path: row.file_path,
      start_line: row.start_line,
      end_line: row.end_line,
      symbols: row.symbols ? JSON.parse(row.symbols) : [],
      imports: row.imports ? JSON.parse(row.imports) : [],
    },
  }));
}

/**
 * Normalize BM25 scores to 0-1 range
 * 
 * FTS5 rank values are negative, with more negative = better match.
 * We convert to positive scores in 0-1 range for consistency with
 * vector similarity scores.
 * 
 * @param score Raw BM25 score (negative value)
 * @returns Normalized score in 0-1 range
 */
export function normalizeScore(score: number): number {
  // BM25 scores typically range from 0 to -10 or so
  // We'll use a sigmoid-like transformation to map to 0-1
  // Higher absolute values = higher normalized score
  
  // Take absolute value and clamp to reasonable range
  const absScore = Math.abs(score);
  const clamped = Math.min(absScore, 20);
  
  // Map to 0-1 using exponential decay
  // score of 0 -> ~0
  // score of 5 -> ~0.63
  // score of 10 -> ~0.86
  // score of 20 -> ~0.98
  return 1 - Math.exp(-clamped / 5);
}

// ============================================================================
// Vector Similarity Search
// ============================================================================

/**
 * Generate mock embedding for text
 * 
 * This is a deterministic mock implementation for testing and development.
 * In production, this will be replaced with actual LLM embedding API calls.
 * 
 * The mock generates a 1536-dimensional vector (matching OpenAI's text-embedding-3-small)
 * based on simple text features to provide somewhat meaningful similarity.
 * 
 * @param text Text to embed
 * @returns 1536-dimensional embedding vector
 */
export function generateMockEmbedding(text: string): number[] {
  const dims = 1536;
  const embedding = new Array(dims).fill(0);
  
  // Handle empty text - return zero vector
  if (!text || text.trim().length === 0) {
    return embedding;
  }
  
  // Use simple text features to generate deterministic but somewhat meaningful embeddings
  const normalized = text.toLowerCase();
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  const chars = normalized.split('');
  
  // Feature 1: Word count (affects first 100 dimensions)
  const wordCountFeature = Math.min(words.length / 100, 1);
  for (let i = 0; i < 100; i++) {
    embedding[i] = wordCountFeature * Math.sin(i * 0.1);
  }
  
  // Feature 2: Character distribution (affects next 256 dimensions)
  const charCounts = new Map<string, number>();
  for (const char of chars) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }
  let idx = 100;
  for (let i = 0; i < 256 && idx < dims; i++) {
    const char = String.fromCharCode(i);
    const count = charCounts.get(char) || 0;
    embedding[idx++] = count / chars.length;
  }
  
  // Feature 3: Word hashes (affects remaining dimensions)
  for (let i = 0; i < words.length && idx < dims; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Distribute hash across multiple dimensions
    for (let j = 0; j < 10 && idx < dims; j++) {
      embedding[idx++] = Math.sin(hash * (j + 1)) * 0.1;
    }
  }
  
  // Normalize to unit vector (L2 normalization)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dims; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param a First vector
 * @param b Second vector
 * @returns Cosine similarity in range [-1, 1]
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Convert cosine distance to similarity score (0-1 range)
 * 
 * Cosine similarity ranges from -1 (opposite) to 1 (identical).
 * We convert to 0-1 range where 1 is most similar.
 * 
 * @param distance Cosine distance (1 - cosine similarity)
 * @returns Similarity score in 0-1 range
 */
export function distanceToSimilarity(distance: number): number {
  // Distance is typically 1 - similarity
  // So similarity = 1 - distance
  const similarity = 1 - distance;
  
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Execute vector similarity search on code chunks
 * 
 * Uses mock embeddings for now. In production, this will use actual
 * LLM embeddings and sqlite-vec for efficient nearest neighbor search.
 * 
 * @param db Database instance
 * @param query User query string
 * @param options Search options
 * @returns Array of search results with similarity scores
 */
export async function vectorSearchCode(
  db: PrometheusDatabase,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const dbInstance = db.getDb();
  const limit = options.limit || 10;
  
  // Generate embedding for query
  const queryEmbedding = generateMockEmbedding(query);
  const queryEmbeddingJson = JSON.stringify(queryEmbedding);
  
  // Get all code chunks with embeddings
  // In production with sqlite-vec, we would use:
  // SELECT id, distance FROM code_chunks_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ?
  // For now, we'll fetch all and compute similarity in-memory
  const chunks = dbInstance
    .prepare(`
      SELECT 
        c.id,
        c.file_path,
        c.start_line,
        c.end_line,
        c.text,
        c.symbols,
        c.imports,
        v.embedding
      FROM code_chunks c
      LEFT JOIN code_chunks_vec v ON c.id = v.id
      WHERE v.embedding IS NOT NULL
    `)
    .all() as Array<{
      id: string;
      file_path: string;
      start_line: number;
      end_line: number;
      text: string;
      symbols: string | null;
      imports: string | null;
      embedding: string;
    }>;
  
  // Calculate similarity for each chunk
  const results: Array<{
    chunk: typeof chunks[0];
    similarity: number;
  }> = [];
  
  for (const chunk of chunks) {
    const chunkEmbedding = JSON.parse(chunk.embedding);
    const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
    
    results.push({
      chunk,
      similarity,
    });
  }
  
  // Sort by similarity (descending) and take top results
  results.sort((a, b) => b.similarity - a.similarity);
  const topResults = results.slice(0, limit * 2);
  
  // Convert to SearchResult format
  return topResults.map(({ chunk, similarity }) => ({
    id: chunk.id,
    source: 'code' as MemorySource,
    score: distanceToSimilarity(1 - similarity), // Convert similarity to distance-based score
    content: chunk.text,
    metadata: {
      file_path: chunk.file_path,
      start_line: chunk.start_line,
      end_line: chunk.end_line,
      symbols: chunk.symbols ? JSON.parse(chunk.symbols) : [],
      imports: chunk.imports ? JSON.parse(chunk.imports) : [],
      similarity, // Include raw similarity for debugging
    },
  }));
}

// ============================================================================
// Hybrid Search
// ============================================================================

/**
 * Execute hybrid search combining keyword and vector results
 * 
 * Combines FTS5 keyword search with vector similarity search,
 * merging results with configurable weights.
 * 
 * @param db Database instance
 * @param query User query string
 * @param options Search options
 * @returns Array of merged search results
 */
export async function hybridSearchCode(
  db: PrometheusDatabase,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const limit = options.limit || 10;
  const keywordWeight = options.keywordWeight ?? 0.3;
  const vectorWeight = options.vectorWeight ?? 0.7;
  const minScore = options.minScore ?? 0;
  
  // Execute both searches in parallel
  const [keywordResults, vectorResults] = await Promise.all([
    keywordSearchCode(db, query, { limit }),
    vectorSearchCode(db, query, { limit }),
  ]);
  
  // Merge results with weighted scoring
  const merged = mergeSearchResults(
    keywordResults,
    vectorResults,
    keywordWeight,
    vectorWeight
  );
  
  // Filter by minimum score and limit
  return merged
    .filter(r => r.score >= minScore)
    .slice(0, limit);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge keyword and vector search results with weighted scoring
 * 
 * This function implements hybrid search result merging with proper weighted scoring:
 * 
 * 1. **Results in both sources**: Combined score = (keyword_score * keyword_weight) + (vector_score * vector_weight)
 * 2. **Results in keyword only**: Score = keyword_score * keyword_weight
 * 3. **Results in vector only**: Score = vector_score * vector_weight
 * 
 * The weights should sum to 1.0 for proper normalization. Default weights are:
 * - Keyword: 0.3 (30%) - Good for exact matches and specific terms
 * - Vector: 0.7 (70%) - Good for semantic similarity and context
 * 
 * Results are ranked by combined score in descending order.
 * 
 * Requirements: 1.3, 5.1, 5.2
 * 
 * @param keywordResults Results from keyword search
 * @param vectorResults Results from vector search
 * @param keywordWeight Weight for keyword scores (default 0.3)
 * @param vectorWeight Weight for vector scores (default 0.7)
 * @returns Merged and ranked results
 */
export function mergeSearchResults(
  keywordResults: SearchResult[],
  vectorResults: SearchResult[],
  keywordWeight: number = 0.3,
  vectorWeight: number = 0.7
): SearchResult[] {
  // Validate weights
  if (keywordWeight < 0 || vectorWeight < 0) {
    throw new Error('Weights must be non-negative');
  }
  
  if (keywordWeight === 0 && vectorWeight === 0) {
    throw new Error('At least one weight must be positive');
  }
  
  // Create a map to track which results appear in which source
  const resultMap = new Map<string, {
    result: SearchResult;
    keywordScore: number | null;
    vectorScore: number | null;
  }>();
  
  // Process keyword results
  for (const result of keywordResults) {
    resultMap.set(result.id, {
      result: { ...result },
      keywordScore: result.score,
      vectorScore: null,
    });
  }
  
  // Process vector results
  for (const result of vectorResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      // Result appears in both sources - store vector score
      existing.vectorScore = result.score;
    } else {
      // Result only in vector source
      resultMap.set(result.id, {
        result: { ...result },
        keywordScore: null,
        vectorScore: result.score,
      });
    }
  }
  
  // Calculate combined scores
  const merged: SearchResult[] = [];
  
  for (const [id, { result, keywordScore, vectorScore }] of resultMap) {
    let combinedScore = 0;
    
    // Add weighted keyword score if present
    if (keywordScore !== null) {
      combinedScore += keywordScore * keywordWeight;
    }
    
    // Add weighted vector score if present
    if (vectorScore !== null) {
      combinedScore += vectorScore * vectorWeight;
    }
    
    // Create merged result with combined score
    merged.push({
      ...result,
      score: combinedScore,
      metadata: {
        ...result.metadata,
        // Add debug info about which sources contributed
        sources: {
          keyword: keywordScore !== null,
          vector: vectorScore !== null,
          keywordScore,
          vectorScore,
          combinedScore,
        },
      },
    });
  }
  
  // Sort by combined score (descending)
  merged.sort((a, b) => b.score - a.score);
  
  return merged;
}

/**
 * Filter search results by minimum score threshold
 * 
 * @param results Search results to filter
 * @param minScore Minimum score threshold (0-1)
 * @returns Filtered results
 */
export function filterByScore(
  results: SearchResult[],
  minScore: number
): SearchResult[] {
  return results.filter(r => r.score >= minScore);
}

// ============================================================================
// Embedding Integration
// ============================================================================

/**
 * Index code chunk with embedding
 * 
 * Generates embedding for a code chunk and stores it in the vector table.
 * Uses embedding cache to avoid redundant API calls.
 * 
 * @param db Database instance
 * @param chunkId Chunk ID to index
 * @param text Chunk text content
 * @returns True if indexed successfully
 */
export async function indexChunkEmbedding(
  db: PrometheusDatabase,
  chunkId: string,
  text: string
): Promise<boolean> {
  const dbInstance = db.getDb();
  
  // Generate embedding (mock for now)
  const embedding = generateMockEmbedding(text);
  const embeddingJson = JSON.stringify(embedding);
  
  // Store in vector table
  dbInstance
    .prepare(`
      INSERT OR REPLACE INTO code_chunks_vec (id, embedding)
      VALUES (?, ?)
    `)
    .run(chunkId, embeddingJson);
  
  return true;
}

/**
 * Index all code chunks with embeddings
 * 
 * Generates embeddings for all code chunks that don't have them yet.
 * Uses embedding cache to avoid redundant work.
 * 
 * @param db Database instance
 * @returns Number of chunks indexed
 */
export async function indexAllChunkEmbeddings(
  db: PrometheusDatabase
): Promise<number> {
  const dbInstance = db.getDb();
  
  // Get chunks without embeddings
  const chunks = dbInstance
    .prepare(`
      SELECT c.id, c.text
      FROM code_chunks c
      LEFT JOIN code_chunks_vec v ON c.id = v.id
      WHERE v.embedding IS NULL
    `)
    .all() as Array<{ id: string; text: string }>;
  
  // Index each chunk
  for (const chunk of chunks) {
    await indexChunkEmbedding(db, chunk.id, chunk.text);
  }
  
  return chunks.length;
}
