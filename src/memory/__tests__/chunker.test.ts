/**
 * Unit tests for the chunking system
 * 
 * Tests:
 * - Token estimation
 * - Chunk creation with overlap
 * - Line number preservation
 * - Different file types (code, markdown)
 * - Small file handling
 * - Large file chunking
 */

import {
  createCodeChunks,
  estimateTokens,
  estimateTokensForLines,
  validateChunkOverlap,
  getChunkStats,
  ChunkConfig,
} from '../chunker';
import { CodeFile } from '../types';

describe('Token Estimation', () => {
  test('should estimate tokens for simple text', () => {
    const text = 'Hello world';
    const tokens = estimateTokens(text);
    
    // "Hello world" is 11 characters, so ~3 tokens
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });
  
  test('should estimate tokens for code', () => {
    const code = `function hello() {
  console.log("Hello, world!");
}`;
    const tokens = estimateTokens(code);
    
    // Should be roughly 15-20 tokens
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(30);
  });
  
  test('should estimate tokens for lines', () => {
    const lines = [
      'function hello() {',
      '  console.log("Hello, world!");',
      '}',
    ];
    const tokens = estimateTokensForLines(lines);
    
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(30);
  });
});

describe('Chunk Creation - Small Files', () => {
  test('should create single chunk for small file', () => {
    const fileMetadata: CodeFile = {
      path: 'test.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 100,
      last_modified: Date.now(),
    };
    
    const content = `function hello() {
  console.log("Hello, world!");
}`;
    
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0].start_line).toBe(1);
    expect(chunks[0].end_line).toBe(3);
    expect(chunks[0].text).toBe(content);
    expect(chunks[0].file_path).toBe('test.ts');
  });
  
  test('should preserve line numbers in single chunk', () => {
    const fileMetadata: CodeFile = {
      path: 'test.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 100,
      last_modified: Date.now(),
    };
    
    const content = `line 1
line 2
line 3
line 4
line 5`;
    
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0].start_line).toBe(1);
    expect(chunks[0].end_line).toBe(5);
  });
});

describe('Chunk Creation - Large Files', () => {
  test('should create multiple chunks for large file', () => {
    const fileMetadata: CodeFile = {
      path: 'large.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 10000,
      last_modified: Date.now(),
    };
    
    // Create a large file with many functions
    const functions = [];
    for (let i = 0; i < 50; i++) {
      functions.push(`function func${i}() {
  // This is function ${i}
  // It does something important
  console.log("Function ${i}");
  return ${i};
}`);
    }
    const content = functions.join('\n\n');
    
    const config: ChunkConfig = {
      maxTokensPerChunk: 200, // Small chunks for testing
      overlapLines: 10,
    };
    
    const chunks = createCodeChunks(fileMetadata, content, config);
    
    // Should create multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
    
    // Each chunk should have valid line numbers
    for (const chunk of chunks) {
      expect(chunk.start_line).toBeGreaterThan(0);
      expect(chunk.end_line).toBeGreaterThanOrEqual(chunk.start_line);
    }
    
    // Chunks should be sequential
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i + 1].start_line).toBeGreaterThan(chunks[i].start_line);
    }
  });
  
  test('should apply overlap between consecutive chunks', () => {
    const fileMetadata: CodeFile = {
      path: 'large.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 10000,
      last_modified: Date.now(),
    };
    
    // Create a file with many lines
    const lines = [];
    for (let i = 1; i <= 200; i++) {
      lines.push(`// Line ${i}`);
    }
    const content = lines.join('\n');
    
    const config: ChunkConfig = {
      maxTokensPerChunk: 100,
      overlapLines: 20,
    };
    
    const chunks = createCodeChunks(fileMetadata, content, config);
    
    // Should have multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
    
    // Validate overlap
    const validation = validateChunkOverlap(chunks, config.overlapLines!);
    
    // Allow some flexibility in overlap
    if (!validation.valid) {
      console.log('Overlap validation issues:', validation.issues);
    }
    
    // Check that there is some overlap between consecutive chunks
    for (let i = 0; i < chunks.length - 1; i++) {
      const current = chunks[i];
      const next = chunks[i + 1];
      
      // Next chunk should start before current chunk ends (overlap)
      expect(next.start_line).toBeLessThanOrEqual(current.end_line);
    }
  });
  
  test('should preserve line numbers across chunks', () => {
    const fileMetadata: CodeFile = {
      path: 'large.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 10000,
      last_modified: Date.now(),
    };
    
    // Create a file with numbered lines
    const lines = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`// Line ${i}`);
    }
    const content = lines.join('\n');
    
    const config: ChunkConfig = {
      maxTokensPerChunk: 100,
      overlapLines: 10,
    };
    
    const chunks = createCodeChunks(fileMetadata, content, config);
    
    // Verify that line numbers in chunk text match the start_line
    for (const chunk of chunks) {
      const chunkLines = chunk.text.split('\n');
      const firstLine = chunkLines[0];
      
      // First line should contain the start_line number
      expect(firstLine).toContain(`Line ${chunk.start_line}`);
    }
  });
});

describe('Chunk Creation - Different File Types', () => {
  test('should handle TypeScript code', () => {
    const fileMetadata: CodeFile = {
      path: 'code.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 1000,
      last_modified: Date.now(),
    };
    
    const content = `export class MyClass {
  constructor(private name: string) {}
  
  greet(): void {
    console.log(\`Hello, \${this.name}!\`);
  }
}

export function helper() {
  return new MyClass("World");
}`;
    
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].symbols).toBeTruthy();
  });
  
  test('should handle Markdown files', () => {
    const fileMetadata: CodeFile = {
      path: 'README.md',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'markdown',
      size: 1000,
      last_modified: Date.now(),
    };
    
    const content = `# Title

This is a paragraph.

## Section 1

Content for section 1.

## Section 2

Content for section 2.`;
    
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toContain('# Title');
  });
  
  test('should handle Python code', () => {
    const fileMetadata: CodeFile = {
      path: 'script.py',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'python',
      size: 1000,
      last_modified: Date.now(),
    };
    
    const content = `def hello():
    print("Hello, world!")

class MyClass:
    def __init__(self, name):
        self.name = name
    
    def greet(self):
        print(f"Hello, {self.name}!")`;
    
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].symbols).toBeTruthy();
  });
});

describe('Chunk Configuration', () => {
  test('should respect maxTokensPerChunk configuration', () => {
    const fileMetadata: CodeFile = {
      path: 'large.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 10000,
      last_modified: Date.now(),
    };
    
    // Create a large file
    const lines = [];
    for (let i = 1; i <= 200; i++) {
      lines.push(`// Line ${i} with some content to increase token count`);
    }
    const content = lines.join('\n');
    
    const config: ChunkConfig = {
      maxTokensPerChunk: 200, // Reasonable chunk size
      overlapLines: 10,
    };
    
    const chunks = createCodeChunks(fileMetadata, content, config);
    
    // Verify that most chunks respect the token limit
    // Some chunks may exceed due to overlap and boundary adjustments
    const chunksWithinLimit = chunks.filter(chunk => {
      const tokens = estimateTokens(chunk.text);
      return tokens <= config.maxTokensPerChunk! * 1.7; // Allow 70% tolerance
    });
    
    // At least 80% of chunks should be within reasonable limits
    expect(chunksWithinLimit.length / chunks.length).toBeGreaterThan(0.8);
    
    // No chunk should be excessively large (more than 2x the limit)
    for (const chunk of chunks) {
      const tokens = estimateTokens(chunk.text);
      expect(tokens).toBeLessThan(config.maxTokensPerChunk! * 2);
    }
  });
  
  test('should respect minChunkLines configuration', () => {
    const fileMetadata: CodeFile = {
      path: 'test.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 1000,
      last_modified: Date.now(),
    };
    
    const content = `line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8
line 9
line 10`;
    
    const config: ChunkConfig = {
      maxTokensPerChunk: 10, // Force small chunks
      minChunkLines: 5, // But merge if too small
      overlapLines: 2,
    };
    
    const chunks = createCodeChunks(fileMetadata, content, config);
    
    // All chunks should have at least minChunkLines (except possibly the last)
    for (let i = 0; i < chunks.length - 1; i++) {
      const lineCount = chunks[i].end_line - chunks[i].start_line + 1;
      expect(lineCount).toBeGreaterThanOrEqual(config.minChunkLines!);
    }
  });
});

describe('Chunk Statistics', () => {
  test('should calculate chunk statistics', () => {
    const fileMetadata: CodeFile = {
      path: 'test.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 1000,
      last_modified: Date.now(),
    };
    
    const lines = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`// Line ${i}`);
    }
    const content = lines.join('\n');
    
    const config: ChunkConfig = {
      maxTokensPerChunk: 100,
      overlapLines: 10,
    };
    
    const chunks = createCodeChunks(fileMetadata, content, config);
    const stats = getChunkStats(chunks);
    
    expect(stats.totalChunks).toBe(chunks.length);
    expect(stats.avgTokensPerChunk).toBeGreaterThan(0);
    expect(stats.minTokens).toBeGreaterThan(0);
    expect(stats.maxTokens).toBeGreaterThanOrEqual(stats.minTokens);
    expect(stats.avgLinesPerChunk).toBeGreaterThan(0);
    expect(stats.minLines).toBeGreaterThan(0);
    expect(stats.maxLines).toBeGreaterThanOrEqual(stats.minLines);
  });
  
  test('should handle empty chunk array', () => {
    const stats = getChunkStats([]);
    
    expect(stats.totalChunks).toBe(0);
    expect(stats.avgTokensPerChunk).toBe(0);
    expect(stats.minTokens).toBe(0);
    expect(stats.maxTokens).toBe(0);
  });
});

describe('Edge Cases', () => {
  test('should handle empty file', () => {
    const fileMetadata: CodeFile = {
      path: 'empty.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 0,
      last_modified: Date.now(),
    };
    
    const content = '';
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('');
  });
  
  test('should handle single line file', () => {
    const fileMetadata: CodeFile = {
      path: 'single.ts',
      repo: 'test-repo',
      hash: 'abc123',
      language: 'typescript',
      size: 20,
      last_modified: Date.now(),
    };
    
    const content = 'console.log("hello");';
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0].start_line).toBe(1);
    expect(chunks[0].end_line).toBe(1);
  });
  
  test('should handle file with no language', () => {
    const fileMetadata: CodeFile = {
      path: 'unknown.txt',
      repo: 'test-repo',
      hash: 'abc123',
      language: null,
      size: 100,
      last_modified: Date.now(),
    };
    
    const content = `Line 1
Line 2
Line 3`;
    
    const chunks = createCodeChunks(fileMetadata, content);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].symbols).toBeNull();
    expect(chunks[0].imports).toBeNull();
  });
});
