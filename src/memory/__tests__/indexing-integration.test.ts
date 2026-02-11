/**
 * Integration tests for code indexing
 * 
 * These tests verify the complete flow from scanning to database storage
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { initializeDatabase } from '../database';
import { createMemoryEngine } from '../engine';

describe('Code Indexing Integration', () => {
  const testDir = join(__dirname, 'test-integration-repo');
  const dbPath = join(__dirname, 'test-integration.db');
  
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'src'), { recursive: true });
    
    // Create test files
    writeFileSync(
      join(testDir, 'src', 'calculator.ts'),
      `export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export class Calculator {
  multiply(a: number, b: number): number {
    return a * b;
  }
  
  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  }
}
`
    );
    
    writeFileSync(
      join(testDir, 'src', 'utils.ts'),
      `import { add } from './calculator';

export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => add(acc, n), 0);
}

export const PI = 3.14159;
`
    );
  });
  
  afterAll(() => {
    // Clean up
    rmSync(testDir, { recursive: true, force: true });
    try {
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-shm', { force: true });
      rmSync(dbPath + '-wal', { force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  it('should index a repository and store files in database', async () => {
    // Initialize database
    const db = await initializeDatabase({ path: dbPath });
    const engine = createMemoryEngine(db);
    
    try {
      // Index the repository
      await engine.indexCodebase(testDir);
      
      // Verify files were stored
      const calculatorFile = await engine.getFileMetadata(join('src', 'calculator.ts'));
      expect(calculatorFile).toBeDefined();
      expect(calculatorFile!.language).toBe('typescript');
      expect(calculatorFile!.size).toBeGreaterThan(0);
      
      const utilsFile = await engine.getFileMetadata(join('src', 'utils.ts'));
      expect(utilsFile).toBeDefined();
      expect(utilsFile!.language).toBe('typescript');
      
      // Verify chunks were created
      const dbInstance = db.getDb();
      const chunks = dbInstance
        .prepare('SELECT * FROM code_chunks WHERE file_path = ?')
        .all(join('src', 'calculator.ts'));
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Verify symbols were extracted
      const chunk = chunks[0] as any;
      expect(chunk.symbols).toBeTruthy();
      
      const symbols = JSON.parse(chunk.symbols);
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);
      
      // Check that specific symbols were found
      const symbolNames = symbols.map((s: any) => s.name);
      expect(symbolNames).toContain('add');
      expect(symbolNames).toContain('subtract');
      expect(symbolNames).toContain('Calculator');
      
      // Verify imports were extracted from utils.ts
      const utilsChunks = dbInstance
        .prepare('SELECT * FROM code_chunks WHERE file_path = ?')
        .all(join('src', 'utils.ts'));
      
      expect(utilsChunks.length).toBeGreaterThan(0);
      
      const utilsChunk = utilsChunks[0] as any;
      if (utilsChunk.imports) {
        const imports = JSON.parse(utilsChunk.imports);
        expect(Array.isArray(imports)).toBe(true);
        expect(imports.length).toBeGreaterThan(0);
        
        // Check that the import from calculator was found
        const importSources = imports.map((i: any) => i.source);
        expect(importSources).toContain('./calculator');
      }
      
    } finally {
      engine.close();
    }
  });
  
  it('should handle re-indexing of the same repository', async () => {
    // Initialize database
    const db = await initializeDatabase({ path: dbPath });
    const engine = createMemoryEngine(db);
    
    try {
      // Index twice
      await engine.indexCodebase(testDir);
      await engine.indexCodebase(testDir);
      
      // Verify no duplicates
      const dbInstance = db.getDb();
      const files = dbInstance
        .prepare('SELECT COUNT(*) as count FROM code_files')
        .get() as { count: number };
      
      // Should have exactly 2 files (calculator.ts and utils.ts)
      expect(files.count).toBe(2);
      
    } finally {
      engine.close();
    }
  });
});
