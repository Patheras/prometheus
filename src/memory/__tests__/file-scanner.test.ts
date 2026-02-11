/**
 * Tests for File Scanner and Metadata Extractor
 * 
 * These tests verify:
 * - Directory scanning functionality
 * - File metadata extraction
 * - Symbol and import extraction
 * - Code chunk creation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import {
  scanDirectory,
  extractFileMetadata,
  extractSymbolsAndImports,
} from '../file-scanner';
import { createCodeChunks } from '../chunker';

describe('File Scanner', () => {
  const testDir = join(__dirname, 'test-repo');
  
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'src'), { recursive: true });
    mkdirSync(join(testDir, 'node_modules'), { recursive: true });
    
    // Create test files
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `import { foo } from './foo';

export function main() {
  console.log('Hello, world!');
}

export class MyClass {
  constructor() {}
}

export interface MyInterface {
  name: string;
}
`
    );
    
    writeFileSync(
      join(testDir, 'src', 'foo.ts'),
      `export const foo = 'bar';

export type FooType = string;
`
    );
    
    // Create file in node_modules (should be ignored)
    writeFileSync(
      join(testDir, 'node_modules', 'package.js'),
      'module.exports = {};'
    );
  });
  
  afterAll(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });
  
  describe('scanDirectory', () => {
    it('should scan directory and find TypeScript files', () => {
      const result = scanDirectory(testDir);
      
      expect(result.files.length).toBe(2);
      expect(result.stats.totalFiles).toBe(2);
      expect(result.stats.skippedFiles).toBeGreaterThanOrEqual(0);
      
      const paths = result.files.map(f => f.path);
      expect(paths).toContain(join('src', 'index.ts'));
      expect(paths).toContain(join('src', 'foo.ts'));
    });
    
    it('should ignore node_modules directory', () => {
      const result = scanDirectory(testDir);
      
      const paths = result.files.map(f => f.path);
      expect(paths.some(p => p.includes('node_modules'))).toBe(false);
    });
    
    it('should extract correct file metadata', () => {
      const result = scanDirectory(testDir);
      
      const indexFile = result.files.find(f => f.path.endsWith('index.ts'));
      expect(indexFile).toBeDefined();
      expect(indexFile!.language).toBe('typescript');
      expect(indexFile!.size).toBeGreaterThan(0);
      expect(indexFile!.hash).toBeTruthy();
      expect(indexFile!.hash.length).toBe(64); // SHA-256 hash length
    });
  });
  
  describe('extractFileMetadata', () => {
    it('should extract metadata for a TypeScript file', () => {
      const filePath = join(testDir, 'src', 'index.ts');
      const metadata = extractFileMetadata(filePath, testDir);
      
      expect(metadata.path).toBe(join('src', 'index.ts'));
      expect(metadata.language).toBe('typescript');
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.hash).toBeTruthy();
      expect(metadata.last_modified).toBeGreaterThan(0);
    });
  });
  
  describe('extractSymbolsAndImports', () => {
    it('should extract TypeScript symbols', () => {
      const content = `import { foo } from './foo';

export function main() {
  console.log('Hello');
}

export class MyClass {
  constructor() {}
}

export interface MyInterface {
  name: string;
}

export type MyType = string;

export enum MyEnum {
  A, B, C
}
`;
      
      const { symbols, imports } = extractSymbolsAndImports(content, 'typescript');
      
      // Check imports
      expect(imports.length).toBe(1);
      expect(imports[0].source).toBe('./foo');
      expect(imports[0].imports).toContain('foo');
      
      // Check symbols
      expect(symbols.length).toBeGreaterThanOrEqual(5);
      
      const symbolNames = symbols.map(s => s.name);
      expect(symbolNames).toContain('main');
      expect(symbolNames).toContain('MyClass');
      expect(symbolNames).toContain('MyInterface');
      expect(symbolNames).toContain('MyType');
      expect(symbolNames).toContain('MyEnum');
      
      // Check symbol types
      const mainSymbol = symbols.find(s => s.name === 'main');
      expect(mainSymbol?.type).toBe('function');
      
      const classSymbol = symbols.find(s => s.name === 'MyClass');
      expect(classSymbol?.type).toBe('class');
      
      const interfaceSymbol = symbols.find(s => s.name === 'MyInterface');
      expect(interfaceSymbol?.type).toBe('interface');
    });
    
    it('should extract Python symbols', () => {
      const content = `import os
from typing import List

def my_function():
    pass

class MyClass:
    def __init__(self):
        pass
`;
      
      const { symbols, imports } = extractSymbolsAndImports(content, 'python');
      
      // Check imports
      expect(imports.length).toBe(2);
      expect(imports[0].source).toBe('os');
      expect(imports[1].source).toBe('typing');
      expect(imports[1].imports).toContain('List');
      
      // Check symbols
      expect(symbols.length).toBeGreaterThanOrEqual(2);
      
      const symbolNames = symbols.map(s => s.name);
      expect(symbolNames).toContain('my_function');
      expect(symbolNames).toContain('MyClass');
    });
    
    it('should return empty arrays for unsupported languages', () => {
      const content = 'Some random text';
      const { symbols, imports } = extractSymbolsAndImports(content, 'unknown');
      
      expect(symbols).toEqual([]);
      expect(imports).toEqual([]);
    });
  });
  
  describe('createCodeChunks', () => {
    it('should create code chunks with symbols and imports', () => {
      const fileMetadata = {
        path: 'test.ts',
        repo: 'test-repo',
        hash: 'abc123',
        language: 'typescript',
        size: 100,
        last_modified: Date.now(),
      };
      
      const content = `import { foo } from './foo';

export function main() {
  console.log('Hello');
}
`;
      
      const chunks = createCodeChunks(fileMetadata, content);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      const chunk = chunks[0];
      expect(chunk.file_path).toBe('test.ts');
      expect(chunk.text).toBe(content);
      expect(chunk.start_line).toBe(1);
      expect(chunk.hash).toBeTruthy();
      
      // Check that symbols and imports are stored as JSON
      if (chunk.symbols) {
        const symbols = JSON.parse(chunk.symbols);
        expect(Array.isArray(symbols)).toBe(true);
      }
      
      if (chunk.imports) {
        const imports = JSON.parse(chunk.imports);
        expect(Array.isArray(imports)).toBe(true);
      }
    });
  });
});
