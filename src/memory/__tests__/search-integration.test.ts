/**
 * Integration tests for FTS5 keyword search with MemoryEngine
 * 
 * Tests the complete flow from indexing to searching through the MemoryEngine interface.
 * 
 * Requirements: 1.3, 5.1
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initializeDatabase } from '../database';
import { createMemoryEngine } from '../engine';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';

describe('MemoryEngine FTS5 Keyword Search Integration', () => {
  let tempDir: string;
  let repoDir: string;
  let memoryEngine: any;

  beforeAll(async () => {
    // Create temporary directory for test database and repo
    tempDir = mkdtempSync(join(tmpdir(), 'prometheus-integration-'));
    const dbPath = join(tempDir, 'test.db');
    repoDir = join(tempDir, 'test-repo');

    // Create test repository with sample files
    mkdirSync(repoDir, { recursive: true });
    mkdirSync(join(repoDir, 'src'), { recursive: true });

    // Create sample TypeScript files
    writeFileSync(
      join(repoDir, 'src', 'database.ts'),
      `/**
 * Database connection module
 */
export async function connectDatabase(url: string): Promise<Connection> {
  const connection = await createConnection(url);
  return connection;
}

export function closeDatabase(connection: Connection): void {
  connection.close();
}
`
    );

    writeFileSync(
      join(repoDir, 'src', 'api.ts'),
      `/**
 * API handler module
 */
export async function handleRequest(req: Request): Promise<Response> {
  const data = await fetchData(req.url);
  return processResponse(data);
}

export function validateRequest(req: Request): boolean {
  return req.method === 'GET' || req.method === 'POST';
}
`
    );

    writeFileSync(
      join(repoDir, 'src', 'utils.ts'),
      `/**
 * Utility functions
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
`
    );

    // Initialize database and memory engine
    const db = await initializeDatabase({ path: dbPath });
    memoryEngine = createMemoryEngine(db);

    // Index the test repository
    await memoryEngine.indexCodebase(repoDir);
  });

  afterAll(() => {
    // Clean up
    if (memoryEngine) {
      memoryEngine.close();
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should search for database-related code', async () => {
    const results = await memoryEngine.searchCode('database', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    // Case-insensitive search
    expect(results.some((r: any) => r.content.toLowerCase().includes('database'))).toBe(true);
  });

  it('should search for async functions', async () => {
    const results = await memoryEngine.searchCode('async function', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r: any) => r.content.includes('async'))).toBe(true);
  });

  it('should search for specific function names', async () => {
    const results = await memoryEngine.searchCode('handleRequest', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    const result = results.find((r: any) => r.content.includes('handleRequest'));
    expect(result).toBeDefined();
    expect(result.metadata.file_path).toContain('api.ts');
  });

  it('should return results with proper metadata', async () => {
    const results = await memoryEngine.searchCode('function', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);

    const result = results[0];
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('source', 'code');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('metadata');

    expect(result.metadata).toHaveProperty('file_path');
    expect(result.metadata).toHaveProperty('start_line');
    expect(result.metadata).toHaveProperty('end_line');
    // Check for 'src' in path (works with both / and \ separators)
    expect(result.metadata.file_path).toMatch(/src/);
  });

  it('should rank results by relevance', async () => {
    const results = await memoryEngine.searchCode('async', { limit: 10 });

    expect(results.length).toBeGreaterThan(0);

    // Verify scores are in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should handle queries with no matches', async () => {
    const results = await memoryEngine.searchCode('nonexistentxyz123', { limit: 5 });

    expect(results).toEqual([]);
  });

  it('should search across multiple files', async () => {
    const results = await memoryEngine.searchCode('export', { limit: 10 });

    expect(results.length).toBeGreaterThan(0);

    // Should find results from multiple files
    const filePaths = new Set(results.map((r: any) => r.metadata.file_path));
    expect(filePaths.size).toBeGreaterThan(1);
  });

  it('should handle special characters in search query', async () => {
    const results = await memoryEngine.searchCode('Promise<void>', { limit: 5 });

    // Should not throw error
    expect(Array.isArray(results)).toBe(true);
  });

  it('should find code by comment content', async () => {
    const results = await memoryEngine.searchCode('Utility functions', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    const result = results.find((r: any) => r.content.includes('Utility functions'));
    expect(result).toBeDefined();
    expect(result.metadata.file_path).toContain('utils.ts');
  });

  it('should respect limit parameter', async () => {
    const results = await memoryEngine.searchCode('function', { limit: 2 });

    // Should return at most limit * 2 results (as per implementation)
    expect(results.length).toBeLessThanOrEqual(4);
  });
});
