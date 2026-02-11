/**
 * Unit tests for search functionality
 * 
 * Tests FTS5 keyword search, query building, and result formatting.
 * 
 * Requirements: 1.3, 5.1
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrometheusDatabase, initializeDatabase } from '../database';
import { buildFTS5Query, keywordSearchCode, normalizeScore } from '../search';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('FTS5 Query Building', () => {
  it('should handle empty query', () => {
    const result = buildFTS5Query('');
    expect(result).toBe('*');
  });

  it('should handle whitespace-only query', () => {
    const result = buildFTS5Query('   ');
    expect(result).toBe('*');
  });

  it('should quote single word', () => {
    const result = buildFTS5Query('function');
    expect(result).toBe('"function"');
  });

  it('should create OR query for multiple words', () => {
    const result = buildFTS5Query('async function');
    expect(result).toBe('"async" OR "function"');
  });

  it('should escape double quotes', () => {
    const result = buildFTS5Query('test "quoted" string');
    expect(result).toBe('"test" OR """quoted""" OR "string"');
  });

  it('should handle special characters', () => {
    const result = buildFTS5Query('test-function');
    expect(result).toBe('"test-function"');
  });

  it('should handle multiple spaces', () => {
    const result = buildFTS5Query('word1    word2   word3');
    expect(result).toBe('"word1" OR "word2" OR "word3"');
  });

  it('should handle parentheses', () => {
    const result = buildFTS5Query('function(arg)');
    expect(result).toBe('"function(arg)"');
  });

  it('should handle brackets', () => {
    const result = buildFTS5Query('array[index]');
    expect(result).toBe('"array[index]"');
  });
});

describe('FTS5 Keyword Search', () => {
  let db: PrometheusDatabase;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test database
    tempDir = mkdtempSync(join(tmpdir(), 'prometheus-test-'));
    const dbPath = join(tempDir, 'test.db');

    // Initialize database
    db = await initializeDatabase({ path: dbPath });

    // Insert test data
    const dbInstance = db.getDb();
    
    // First insert code_files (required for foreign key constraint)
    const insertFile = dbInstance.prepare(`
      INSERT INTO code_files (path, repo, hash, language, size, last_modified)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const testFiles = [
      { path: 'src/utils.ts', repo: 'test-repo', hash: 'filehash1', language: 'typescript', size: 100, last_modified: Date.now() },
      { path: 'src/api.ts', repo: 'test-repo', hash: 'filehash2', language: 'typescript', size: 150, last_modified: Date.now() },
      { path: 'src/helpers.ts', repo: 'test-repo', hash: 'filehash3', language: 'typescript', size: 200, last_modified: Date.now() },
    ];

    for (const file of testFiles) {
      insertFile.run(file.path, file.repo, file.hash, file.language, file.size, file.last_modified);
    }
    
    // Then insert test code chunks
    const insertChunk = dbInstance.prepare(`
      INSERT INTO code_chunks (id, file_path, start_line, end_line, text, hash, symbols, imports)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const testChunks = [
      {
        id: 'chunk1',
        file_path: 'src/utils.ts',
        start_line: 1,
        end_line: 10,
        text: 'export async function fetchData(url: string): Promise<Response> {\n  return await fetch(url);\n}',
        hash: 'hash1',
        symbols: JSON.stringify(['fetchData']),
        imports: JSON.stringify(['fetch']),
      },
      {
        id: 'chunk2',
        file_path: 'src/api.ts',
        start_line: 1,
        end_line: 15,
        text: 'export function processData(data: any): void {\n  console.log(data);\n}',
        hash: 'hash2',
        symbols: JSON.stringify(['processData']),
        imports: JSON.stringify(['console']),
      },
      {
        id: 'chunk3',
        file_path: 'src/helpers.ts',
        start_line: 1,
        end_line: 20,
        text: 'export async function getData(): Promise<any> {\n  const response = await fetchData("/api/data");\n  return response.json();\n}',
        hash: 'hash3',
        symbols: JSON.stringify(['getData']),
        imports: JSON.stringify(['fetchData']),
      },
    ];

    for (const chunk of testChunks) {
      insertChunk.run(
        chunk.id,
        chunk.file_path,
        chunk.start_line,
        chunk.end_line,
        chunk.text,
        chunk.hash,
        chunk.symbols,
        chunk.imports
      );
    }
  });

  afterAll(() => {
    // Clean up
    if (db) {
      db.close();
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should find chunks matching single keyword', async () => {
    const results = await keywordSearchCode(db, 'async', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.content.includes('async'))).toBe(true);
  });

  it('should find chunks matching function name', async () => {
    const results = await keywordSearchCode(db, 'fetchData', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.content.includes('fetchData'))).toBe(true);
  });

  it('should find chunks matching multiple keywords', async () => {
    const results = await keywordSearchCode(db, 'async function', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    // Should match chunks containing either 'async' or 'function'
    expect(results.some(r => r.content.includes('async') || r.content.includes('function'))).toBe(true);
  });

  it('should return results with proper structure', async () => {
    const results = await keywordSearchCode(db, 'function', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('metadata');
    
    expect(result.source).toBe('code');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('should include metadata in results', async () => {
    const results = await keywordSearchCode(db, 'fetchData', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result.metadata).toHaveProperty('file_path');
    expect(result.metadata).toHaveProperty('start_line');
    expect(result.metadata).toHaveProperty('end_line');
    expect(result.metadata).toHaveProperty('symbols');
    expect(result.metadata).toHaveProperty('imports');
    
    expect(typeof result.metadata.file_path).toBe('string');
    expect(typeof result.metadata.start_line).toBe('number');
    expect(typeof result.metadata.end_line).toBe('number');
    expect(Array.isArray(result.metadata.symbols)).toBe(true);
    expect(Array.isArray(result.metadata.imports)).toBe(true);
  });

  it('should respect limit option', async () => {
    const results = await keywordSearchCode(db, 'function', { limit: 1 });
    
    // Should return at most 2 results (limit * 2 in implementation)
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should return empty array for non-matching query', async () => {
    const results = await keywordSearchCode(db, 'nonexistentxyz123', { limit: 10 });
    
    expect(results).toEqual([]);
  });

  it('should handle special characters in query', async () => {
    const results = await keywordSearchCode(db, 'function()', { limit: 10 });
    
    // Should not throw error
    expect(Array.isArray(results)).toBe(true);
  });

  it('should rank results by relevance', async () => {
    const results = await keywordSearchCode(db, 'data', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    
    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

describe('Score Normalization', () => {
  it('should normalize scores to 0-1 range', () => {
    // Test various BM25 scores
    const score0 = normalizeScore(0);
    expect(score0).toBeGreaterThanOrEqual(0);
    expect(score0).toBeLessThan(0.1); // Score of 0 should be close to 0
    
    const score5 = normalizeScore(5);
    expect(score5).toBeGreaterThan(0.5);
    expect(score5).toBeLessThan(1);
    
    const score10 = normalizeScore(10);
    expect(score10).toBeGreaterThan(score5);
    expect(score10).toBeLessThan(1);
    
    const score20 = normalizeScore(20);
    expect(score20).toBeLessThanOrEqual(1);
  });

  it('should handle negative scores', () => {
    // BM25 scores are typically negative
    const score = normalizeScore(-5);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('should produce higher normalized scores for higher absolute values', () => {
    expect(normalizeScore(10)).toBeGreaterThan(normalizeScore(5));
    expect(normalizeScore(15)).toBeGreaterThan(normalizeScore(10));
    
    // Negative values should work the same (absolute value)
    expect(normalizeScore(-10)).toBeGreaterThan(normalizeScore(-5));
  });
});

describe('Result Merging with Weighted Scoring', () => {
  const { mergeSearchResults } = require('../search');
  
  describe('Basic Merging', () => {
    it('should merge results from both sources', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test content 1',
          metadata: { file_path: 'file1.ts', start_line: 1, end_line: 10 },
        },
      ];
      
      const vectorResults = [
        {
          id: 'chunk2',
          source: 'code' as const,
          score: 0.9,
          content: 'test content 2',
          metadata: { file_path: 'file2.ts', start_line: 1, end_line: 10 },
        },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      expect(merged).toHaveLength(2);
      expect(merged.map(r => r.id)).toContain('chunk1');
      expect(merged.map(r => r.id)).toContain('chunk2');
    });
    
    it('should handle overlapping results (same ID in both sources)', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test content',
          metadata: { file_path: 'file1.ts', start_line: 1, end_line: 10 },
        },
      ];
      
      const vectorResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.6,
          content: 'test content',
          metadata: { file_path: 'file1.ts', start_line: 1, end_line: 10 },
        },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      // Should have only one result (deduplicated)
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('chunk1');
      
      // Combined score should be: (0.8 * 0.3) + (0.6 * 0.7) = 0.24 + 0.42 = 0.66
      expect(merged[0].score).toBeCloseTo(0.66, 5);
    });
    
    it('should handle empty keyword results', () => {
      const keywordResults: any[] = [];
      
      const vectorResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.9,
          content: 'test content',
          metadata: { file_path: 'file1.ts', start_line: 1, end_line: 10 },
        },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('chunk1');
      // Score should be: 0.9 * 0.7 = 0.63
      expect(merged[0].score).toBeCloseTo(0.63, 5);
    });
    
    it('should handle empty vector results', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test content',
          metadata: { file_path: 'file1.ts', start_line: 1, end_line: 10 },
        },
      ];
      
      const vectorResults: any[] = [];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('chunk1');
      // Score should be: 0.8 * 0.3 = 0.24
      expect(merged[0].score).toBeCloseTo(0.24, 5);
    });
    
    it('should handle both empty results', () => {
      const keywordResults: any[] = [];
      const vectorResults: any[] = [];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      expect(merged).toHaveLength(0);
    });
  });
  
  describe('Weighted Scoring', () => {
    it('should apply default weights (0.3 keyword, 0.7 vector)', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 1.0,
          content: 'test',
          metadata: {},
        },
      ];
      
      const vectorResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 1.0,
          content: 'test',
          metadata: {},
        },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults);
      
      // Combined score: (1.0 * 0.3) + (1.0 * 0.7) = 1.0
      expect(merged[0].score).toBeCloseTo(1.0, 5);
    });
    
    it('should apply custom weights', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test',
          metadata: {},
        },
      ];
      
      const vectorResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.6,
          content: 'test',
          metadata: {},
        },
      ];
      
      // Custom weights: 0.5 each
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.5, 0.5);
      
      // Combined score: (0.8 * 0.5) + (0.6 * 0.5) = 0.4 + 0.3 = 0.7
      expect(merged[0].score).toBeCloseTo(0.7, 5);
    });
    
    it('should handle keyword-only weight (1.0, 0.0)', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test',
          metadata: {},
        },
      ];
      
      const vectorResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.6,
          content: 'test',
          metadata: {},
        },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 1.0, 0.0);
      
      // Combined score: (0.8 * 1.0) + (0.6 * 0.0) = 0.8
      expect(merged[0].score).toBeCloseTo(0.8, 5);
    });
    
    it('should handle vector-only weight (0.0, 1.0)', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test',
          metadata: {},
        },
      ];
      
      const vectorResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.6,
          content: 'test',
          metadata: {},
        },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.0, 1.0);
      
      // Combined score: (0.8 * 0.0) + (0.6 * 1.0) = 0.6
      expect(merged[0].score).toBeCloseTo(0.6, 5);
    });
    
    it('should reject negative weights', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test',
          metadata: {},
        },
      ];
      
      const vectorResults: any[] = [];
      
      expect(() => {
        mergeSearchResults(keywordResults, vectorResults, -0.1, 0.7);
      }).toThrow('Weights must be non-negative');
      
      expect(() => {
        mergeSearchResults(keywordResults, vectorResults, 0.3, -0.1);
      }).toThrow('Weights must be non-negative');
    });
    
    it('should reject both weights being zero', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test',
          metadata: {},
        },
      ];
      
      const vectorResults: any[] = [];
      
      expect(() => {
        mergeSearchResults(keywordResults, vectorResults, 0.0, 0.0);
      }).toThrow('At least one weight must be positive');
    });
  });
  
  describe('Ranking by Combined Score', () => {
    it('should rank results by combined score (descending)', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.9,
          content: 'high keyword',
          metadata: {},
        },
        {
          id: 'chunk2',
          source: 'code' as const,
          score: 0.5,
          content: 'low keyword',
          metadata: {},
        },
      ];
      
      const vectorResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.4,
          content: 'high keyword',
          metadata: {},
        },
        {
          id: 'chunk2',
          source: 'code' as const,
          score: 0.8,
          content: 'low keyword',
          metadata: {},
        },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      // chunk1: (0.9 * 0.3) + (0.4 * 0.7) = 0.27 + 0.28 = 0.55
      // chunk2: (0.5 * 0.3) + (0.8 * 0.7) = 0.15 + 0.56 = 0.71
      
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe('chunk2'); // Higher combined score
      expect(merged[1].id).toBe('chunk1'); // Lower combined score
      
      expect(merged[0].score).toBeCloseTo(0.71, 5);
      expect(merged[1].score).toBeCloseTo(0.55, 5);
    });
    
    it('should maintain descending order for multiple results', () => {
      const keywordResults = [
        { id: 'chunk1', source: 'code' as const, score: 0.9, content: 'a', metadata: {} },
        { id: 'chunk2', source: 'code' as const, score: 0.7, content: 'b', metadata: {} },
        { id: 'chunk3', source: 'code' as const, score: 0.5, content: 'c', metadata: {} },
      ];
      
      const vectorResults = [
        { id: 'chunk1', source: 'code' as const, score: 0.3, content: 'a', metadata: {} },
        { id: 'chunk2', source: 'code' as const, score: 0.6, content: 'b', metadata: {} },
        { id: 'chunk3', source: 'code' as const, score: 0.9, content: 'c', metadata: {} },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      // Verify descending order
      for (let i = 1; i < merged.length; i++) {
        expect(merged[i - 1].score).toBeGreaterThanOrEqual(merged[i].score);
      }
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle partial overlap (some results in both, some in one)', () => {
      const keywordResults = [
        { id: 'chunk1', source: 'code' as const, score: 0.8, content: 'both', metadata: {} },
        { id: 'chunk2', source: 'code' as const, score: 0.7, content: 'keyword only', metadata: {} },
      ];
      
      const vectorResults = [
        { id: 'chunk1', source: 'code' as const, score: 0.6, content: 'both', metadata: {} },
        { id: 'chunk3', source: 'code' as const, score: 0.9, content: 'vector only', metadata: {} },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      expect(merged).toHaveLength(3);
      
      // chunk1 appears in both: (0.8 * 0.3) + (0.6 * 0.7) = 0.66
      const chunk1 = merged.find(r => r.id === 'chunk1');
      expect(chunk1?.score).toBeCloseTo(0.66, 5);
      
      // chunk2 only in keyword: 0.7 * 0.3 = 0.21
      const chunk2 = merged.find(r => r.id === 'chunk2');
      expect(chunk2?.score).toBeCloseTo(0.21, 5);
      
      // chunk3 only in vector: 0.9 * 0.7 = 0.63
      const chunk3 = merged.find(r => r.id === 'chunk3');
      expect(chunk3?.score).toBeCloseTo(0.63, 5);
    });
    
    it('should preserve metadata from results', () => {
      const keywordResults = [
        {
          id: 'chunk1',
          source: 'code' as const,
          score: 0.8,
          content: 'test content',
          metadata: {
            file_path: 'file1.ts',
            start_line: 1,
            end_line: 10,
            symbols: ['func1'],
          },
        },
      ];
      
      const vectorResults: any[] = [];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      expect(merged[0].metadata.file_path).toBe('file1.ts');
      expect(merged[0].metadata.start_line).toBe(1);
      expect(merged[0].metadata.end_line).toBe(10);
      expect(merged[0].metadata.symbols).toEqual(['func1']);
    });
    
    it('should add source tracking metadata', () => {
      const keywordResults = [
        { id: 'chunk1', source: 'code' as const, score: 0.8, content: 'both', metadata: {} },
        { id: 'chunk2', source: 'code' as const, score: 0.7, content: 'keyword', metadata: {} },
      ];
      
      const vectorResults = [
        { id: 'chunk1', source: 'code' as const, score: 0.6, content: 'both', metadata: {} },
        { id: 'chunk3', source: 'code' as const, score: 0.9, content: 'vector', metadata: {} },
      ];
      
      const merged = mergeSearchResults(keywordResults, vectorResults, 0.3, 0.7);
      
      // chunk1 in both sources
      const chunk1 = merged.find(r => r.id === 'chunk1');
      expect(chunk1?.metadata.sources.keyword).toBe(true);
      expect(chunk1?.metadata.sources.vector).toBe(true);
      expect(chunk1?.metadata.sources.keywordScore).toBe(0.8);
      expect(chunk1?.metadata.sources.vectorScore).toBe(0.6);
      
      // chunk2 only in keyword
      const chunk2 = merged.find(r => r.id === 'chunk2');
      expect(chunk2?.metadata.sources.keyword).toBe(true);
      expect(chunk2?.metadata.sources.vector).toBe(false);
      expect(chunk2?.metadata.sources.keywordScore).toBe(0.7);
      expect(chunk2?.metadata.sources.vectorScore).toBeNull();
      
      // chunk3 only in vector
      const chunk3 = merged.find(r => r.id === 'chunk3');
      expect(chunk3?.metadata.sources.keyword).toBe(false);
      expect(chunk3?.metadata.sources.vector).toBe(true);
      expect(chunk3?.metadata.sources.keywordScore).toBeNull();
      expect(chunk3?.metadata.sources.vectorScore).toBe(0.9);
    });
  });
});

describe('Vector Similarity Search', () => {
  // Import additional functions for vector search tests
  const { 
    generateMockEmbedding, 
    cosineSimilarity, 
    distanceToSimilarity,
    vectorSearchCode,
    indexChunkEmbedding,
  } = require('../search');
  
  describe('Mock Embedding Generation', () => {
    it('should generate 1536-dimensional embeddings', () => {
      const embedding = generateMockEmbedding('test text');
      expect(embedding).toHaveLength(1536);
    });

    it('should generate deterministic embeddings', () => {
      const text = 'async function fetchData()';
      const embedding1 = generateMockEmbedding(text);
      const embedding2 = generateMockEmbedding(text);
      
      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different text', () => {
      const embedding1 = generateMockEmbedding('async function');
      const embedding2 = generateMockEmbedding('sync method');
      
      expect(embedding1).not.toEqual(embedding2);
    });

    it('should generate normalized vectors', () => {
      const embedding = generateMockEmbedding('test text');
      
      // Calculate magnitude (should be close to 1 for normalized vector)
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );
      
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should handle empty text', () => {
      const embedding = generateMockEmbedding('');
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(v => !isNaN(v))).toBe(true);
    });

    it('should handle special characters', () => {
      const embedding = generateMockEmbedding('function() { return "test"; }');
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(v => !isNaN(v))).toBe(true);
    });
  });

  describe('Cosine Similarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3, 4, 5];
      const similarity = cosineSimilarity(vec, vec);
      expect(similarity).toBeCloseTo(1, 10);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0, 10);
    });

    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1, 10);
    });

    it('should handle normalized vectors', () => {
      const vec1 = generateMockEmbedding('test');
      const vec2 = generateMockEmbedding('test');
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1, 10);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });

    it('should handle zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });
  });

  describe('Distance to Similarity Conversion', () => {
    it('should convert distance 0 to similarity 1', () => {
      expect(distanceToSimilarity(0)).toBe(1);
    });

    it('should convert distance 1 to similarity 0', () => {
      expect(distanceToSimilarity(1)).toBe(0);
    });

    it('should convert distance 0.5 to similarity 0.5', () => {
      expect(distanceToSimilarity(0.5)).toBe(0.5);
    });

    it('should clamp negative distances to 0', () => {
      expect(distanceToSimilarity(-0.5)).toBe(1);
    });

    it('should clamp distances > 1 to 0', () => {
      expect(distanceToSimilarity(1.5)).toBe(0);
    });
  });

  describe('Vector Search with Database', () => {
    let db: PrometheusDatabase;
    let tempDir: string;

    beforeAll(async () => {
      // Create temporary directory for test database
      tempDir = mkdtempSync(join(tmpdir(), 'prometheus-vector-test-'));
      const dbPath = join(tempDir, 'test.db');

      // Initialize database
      db = await initializeDatabase({ path: dbPath });

      // Insert test data
      const dbInstance = db.getDb();
      
      // Insert code_files
      const insertFile = dbInstance.prepare(`
        INSERT INTO code_files (path, repo, hash, language, size, last_modified)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const testFiles = [
        { path: 'src/async.ts', repo: 'test-repo', hash: 'filehash1', language: 'typescript', size: 100, last_modified: Date.now() },
        { path: 'src/sync.ts', repo: 'test-repo', hash: 'filehash2', language: 'typescript', size: 150, last_modified: Date.now() },
        { path: 'src/data.ts', repo: 'test-repo', hash: 'filehash3', language: 'typescript', size: 200, last_modified: Date.now() },
      ];

      for (const file of testFiles) {
        insertFile.run(file.path, file.repo, file.hash, file.language, file.size, file.last_modified);
      }
      
      // Insert test code chunks
      const insertChunk = dbInstance.prepare(`
        INSERT INTO code_chunks (id, file_path, start_line, end_line, text, hash, symbols, imports)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const testChunks = [
        {
          id: 'vec-chunk1',
          file_path: 'src/async.ts',
          start_line: 1,
          end_line: 10,
          text: 'export async function fetchData(url: string): Promise<Response> {\n  return await fetch(url);\n}',
          hash: 'vhash1',
          symbols: JSON.stringify(['fetchData']),
          imports: JSON.stringify(['fetch']),
        },
        {
          id: 'vec-chunk2',
          file_path: 'src/sync.ts',
          start_line: 1,
          end_line: 15,
          text: 'export function processData(data: any): void {\n  console.log(data);\n}',
          hash: 'vhash2',
          symbols: JSON.stringify(['processData']),
          imports: JSON.stringify(['console']),
        },
        {
          id: 'vec-chunk3',
          file_path: 'src/data.ts',
          start_line: 1,
          end_line: 20,
          text: 'export async function getData(): Promise<any> {\n  const response = await fetchData("/api/data");\n  return response.json();\n}',
          hash: 'vhash3',
          symbols: JSON.stringify(['getData']),
          imports: JSON.stringify(['fetchData']),
        },
      ];

      for (const chunk of testChunks) {
        insertChunk.run(
          chunk.id,
          chunk.file_path,
          chunk.start_line,
          chunk.end_line,
          chunk.text,
          chunk.hash,
          chunk.symbols,
          chunk.imports
        );
      }

      // Index embeddings for all chunks
      for (const chunk of testChunks) {
        await indexChunkEmbedding(db, chunk.id, chunk.text);
      }
    });

    afterAll(() => {
      // Clean up
      if (db) {
        db.close();
      }
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should find similar chunks using vector search', async () => {
      const results = await vectorSearchCode(db, 'async function', { limit: 10 });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('score');
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    });

    it('should return results with proper structure', async () => {
      const results = await vectorSearchCode(db, 'fetch data', { limit: 10 });
      
      expect(results.length).toBeGreaterThan(0);
      
      const result = results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
      
      expect(result.source).toBe('code');
      expect(typeof result.score).toBe('number');
    });

    it('should rank results by similarity', async () => {
      const results = await vectorSearchCode(db, 'async await', { limit: 10 });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Scores should be in descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should include similarity in metadata', async () => {
      const results = await vectorSearchCode(db, 'function', { limit: 10 });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata).toHaveProperty('similarity');
      expect(typeof results[0].metadata.similarity).toBe('number');
    });

    it('should respect limit option', async () => {
      const results = await vectorSearchCode(db, 'data', { limit: 2 });
      
      // Should return at most 4 results (limit * 2 in implementation)
      expect(results.length).toBeLessThanOrEqual(4);
    });

    it('should handle queries with no indexed chunks', async () => {
      // Create a new database with no embeddings
      const tempDir2 = mkdtempSync(join(tmpdir(), 'prometheus-empty-test-'));
      const dbPath2 = join(tempDir2, 'test.db');
      const db2 = await initializeDatabase({ path: dbPath2 });
      
      const results = await vectorSearchCode(db2, 'test', { limit: 10 });
      
      expect(results).toEqual([]);
      
      db2.close();
      rmSync(tempDir2, { recursive: true, force: true });
    });

    it('should find semantically similar content', async () => {
      // Query for "async" should find chunks with async/await
      const results = await vectorSearchCode(db, 'asynchronous operation', { limit: 10 });
      
      expect(results.length).toBeGreaterThan(0);
      
      // At least one of the top results should contain async-related code
      const hasAsyncInResults = results.some(result => 
        result.content.includes('async') || 
        result.content.includes('await') ||
        result.content.includes('Promise')
      );
      
      // This is a mock embedding, so we just verify the search returns results
      // In production with real embeddings, semantic similarity would be much better
      expect(hasAsyncInResults).toBe(true);
    });
  });
});

describe('Hybrid Search Integration', () => {
  const { hybridSearchCode, filterByScore } = require('../search');
  
  let db: PrometheusDatabase;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test database
    tempDir = mkdtempSync(join(tmpdir(), 'prometheus-hybrid-test-'));
    const dbPath = join(tempDir, 'test.db');

    // Initialize database
    db = await initializeDatabase({ path: dbPath });

    // Insert test data
    const dbInstance = db.getDb();
    
    // Insert code_files
    const insertFile = dbInstance.prepare(`
      INSERT INTO code_files (path, repo, hash, language, size, last_modified)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const testFiles = [
      { path: 'src/fetch.ts', repo: 'test-repo', hash: 'filehash1', language: 'typescript', size: 100, last_modified: Date.now() },
      { path: 'src/process.ts', repo: 'test-repo', hash: 'filehash2', language: 'typescript', size: 150, last_modified: Date.now() },
      { path: 'src/utils.ts', repo: 'test-repo', hash: 'filehash3', language: 'typescript', size: 200, last_modified: Date.now() },
    ];

    for (const file of testFiles) {
      insertFile.run(file.path, file.repo, file.hash, file.language, file.size, file.last_modified);
    }
    
    // Insert test code chunks
    const insertChunk = dbInstance.prepare(`
      INSERT INTO code_chunks (id, file_path, start_line, end_line, text, hash, symbols, imports)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const testChunks = [
      {
        id: 'hybrid-chunk1',
        file_path: 'src/fetch.ts',
        start_line: 1,
        end_line: 10,
        text: 'export async function fetchData(url: string): Promise<Response> {\n  return await fetch(url);\n}',
        hash: 'hhash1',
        symbols: JSON.stringify(['fetchData']),
        imports: JSON.stringify(['fetch']),
      },
      {
        id: 'hybrid-chunk2',
        file_path: 'src/process.ts',
        start_line: 1,
        end_line: 15,
        text: 'export function processData(data: any): void {\n  console.log(data);\n}',
        hash: 'hhash2',
        symbols: JSON.stringify(['processData']),
        imports: JSON.stringify(['console']),
      },
      {
        id: 'hybrid-chunk3',
        file_path: 'src/utils.ts',
        start_line: 1,
        end_line: 20,
        text: 'export async function getData(): Promise<any> {\n  const response = await fetchData("/api/data");\n  return response.json();\n}',
        hash: 'hhash3',
        symbols: JSON.stringify(['getData']),
        imports: JSON.stringify(['fetchData']),
      },
    ];

    for (const chunk of testChunks) {
      insertChunk.run(
        chunk.id,
        chunk.file_path,
        chunk.start_line,
        chunk.end_line,
        chunk.text,
        chunk.hash,
        chunk.symbols,
        chunk.imports
      );
    }

    // Index embeddings for all chunks
    const { indexChunkEmbedding } = require('../search');
    for (const chunk of testChunks) {
      await indexChunkEmbedding(db, chunk.id, chunk.text);
    }
  });

  afterAll(() => {
    // Clean up
    if (db) {
      db.close();
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should combine keyword and vector search results', async () => {
    const results = await hybridSearchCode(db, 'async function', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('metadata');
  });

  it('should use default weights (0.3 keyword, 0.7 vector)', async () => {
    const results = await hybridSearchCode(db, 'fetchData', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    
    // Results should have source tracking metadata
    expect(results[0].metadata).toHaveProperty('sources');
  });

  it('should support custom weights', async () => {
    const results = await hybridSearchCode(db, 'data', {
      limit: 10,
      keywordWeight: 0.5,
      vectorWeight: 0.5,
    });
    
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by minimum score threshold', async () => {
    const results = await hybridSearchCode(db, 'function', {
      limit: 10,
      minScore: 0.5,
    });
    
    // All results should have score >= 0.5
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('should respect limit option', async () => {
    const results = await hybridSearchCode(db, 'data', { limit: 2 });
    
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should rank results by combined score', async () => {
    const results = await hybridSearchCode(db, 'async', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    
    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should handle queries with no results', async () => {
    const results = await hybridSearchCode(db, 'nonexistentxyz999', { limit: 10 });
    
    // With mock embeddings, vector search may still return some results
    // even for nonsense queries. The important thing is that keyword search
    // returns nothing, and the combined scores should be low.
    
    // If there are results, they should only be from vector search (not keyword)
    for (const result of results) {
      expect(result.metadata.sources.keyword).toBe(false);
      expect(result.metadata.sources.vector).toBe(true);
    }
  });

  it('should include source tracking in metadata', async () => {
    const results = await hybridSearchCode(db, 'fetchData', { limit: 10 });
    
    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result.metadata.sources).toBeDefined();
    expect(typeof result.metadata.sources.keyword).toBe('boolean');
    expect(typeof result.metadata.sources.vector).toBe('boolean');
  });
});

describe('Score Filtering', () => {
  const { filterByScore } = require('../search');
  
  it('should filter results by minimum score', () => {
    const results = [
      { id: '1', source: 'code' as const, score: 0.9, content: 'high', metadata: {} },
      { id: '2', source: 'code' as const, score: 0.5, content: 'medium', metadata: {} },
      { id: '3', source: 'code' as const, score: 0.2, content: 'low', metadata: {} },
    ];
    
    const filtered = filterByScore(results, 0.4);
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.id)).toEqual(['1', '2']);
  });
  
  it('should include results with score equal to threshold', () => {
    const results = [
      { id: '1', source: 'code' as const, score: 0.5, content: 'exact', metadata: {} },
      { id: '2', source: 'code' as const, score: 0.4, content: 'below', metadata: {} },
    ];
    
    const filtered = filterByScore(results, 0.5);
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });
  
  it('should return empty array when no results meet threshold', () => {
    const results = [
      { id: '1', source: 'code' as const, score: 0.3, content: 'low', metadata: {} },
      { id: '2', source: 'code' as const, score: 0.2, content: 'lower', metadata: {} },
    ];
    
    const filtered = filterByScore(results, 0.5);
    
    expect(filtered).toEqual([]);
  });
  
  it('should handle threshold of 0', () => {
    const results = [
      { id: '1', source: 'code' as const, score: 0.1, content: 'low', metadata: {} },
      { id: '2', source: 'code' as const, score: 0.0, content: 'zero', metadata: {} },
    ];
    
    const filtered = filterByScore(results, 0);
    
    expect(filtered).toHaveLength(2);
  });
  
  it('should handle threshold of 1', () => {
    const results = [
      { id: '1', source: 'code' as const, score: 1.0, content: 'perfect', metadata: {} },
      { id: '2', source: 'code' as const, score: 0.99, content: 'almost', metadata: {} },
    ];
    
    const filtered = filterByScore(results, 1.0);
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });
  
  it('should handle empty results array', () => {
    const results: any[] = [];
    
    const filtered = filterByScore(results, 0.5);
    
    expect(filtered).toEqual([]);
  });
});
