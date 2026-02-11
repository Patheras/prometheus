/**
 * Example: Using the Chunking System
 * 
 * This example demonstrates how to use the chunking system to split
 * large files into manageable chunks with overlap.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  extractFileMetadata,
  createCodeChunks,
  getChunkStats,
  validateChunkOverlap,
  ChunkConfig,
} from '../index';

async function main() {
  console.log('='.repeat(80));
  console.log('Chunking System Example');
  console.log('='.repeat(80));
  console.log();
  
  // Example 1: Chunk a TypeScript file
  console.log('Example 1: Chunking a TypeScript file');
  console.log('-'.repeat(80));
  
  const tsFilePath = join(__dirname, '../file-scanner.ts');
  const tsContent = readFileSync(tsFilePath, 'utf-8');
  const tsMetadata = extractFileMetadata(tsFilePath, join(__dirname, '..'));
  
  const tsConfig: ChunkConfig = {
    maxTokensPerChunk: 500,
    overlapLines: 20,
    minChunkLines: 10,
    respectCodeBoundaries: true,
  };
  
  const tsChunks = createCodeChunks(tsMetadata, tsContent, tsConfig);
  const tsStats = getChunkStats(tsChunks);
  
  console.log(`File: ${tsMetadata.path}`);
  console.log(`Language: ${tsMetadata.language}`);
  console.log(`Size: ${tsMetadata.size} bytes`);
  console.log();
  console.log('Chunking Results:');
  console.log(`  Total chunks: ${tsStats.totalChunks}`);
  console.log(`  Avg tokens per chunk: ${tsStats.avgTokensPerChunk.toFixed(0)}`);
  console.log(`  Token range: ${tsStats.minTokens} - ${tsStats.maxTokens}`);
  console.log(`  Avg lines per chunk: ${tsStats.avgLinesPerChunk.toFixed(0)}`);
  console.log(`  Line range: ${tsStats.minLines} - ${tsStats.maxLines}`);
  console.log();
  
  // Show first few chunks
  console.log('First 3 chunks:');
  for (let i = 0; i < Math.min(3, tsChunks.length); i++) {
    const chunk = tsChunks[i];
    console.log(`  Chunk ${i + 1}:`);
    console.log(`    Lines: ${chunk.start_line} - ${chunk.end_line}`);
    console.log(`    Tokens: ${Math.ceil(chunk.text.length / 4)}`);
    console.log(`    Has symbols: ${chunk.symbols ? 'Yes' : 'No'}`);
    console.log(`    Has imports: ${chunk.imports ? 'Yes' : 'No'}`);
  }
  console.log();
  
  // Validate overlap
  const tsValidation = validateChunkOverlap(tsChunks, tsConfig.overlapLines!);
  console.log('Overlap Validation:');
  console.log(`  Valid: ${tsValidation.valid}`);
  if (!tsValidation.valid) {
    console.log('  Issues:');
    tsValidation.issues.forEach(issue => console.log(`    - ${issue}`));
  }
  console.log();
  
  // Example 2: Chunk a Markdown file
  console.log('Example 2: Chunking a Markdown file');
  console.log('-'.repeat(80));
  
  const mdFilePath = join(__dirname, '../README.md');
  const mdContent = readFileSync(mdFilePath, 'utf-8');
  const mdMetadata = extractFileMetadata(mdFilePath, join(__dirname, '..'));
  
  const mdConfig: ChunkConfig = {
    maxTokensPerChunk: 300,
    overlapLines: 10,
    minChunkLines: 5,
    respectCodeBoundaries: false, // Markdown doesn't need code boundary respect
  };
  
  const mdChunks = createCodeChunks(mdMetadata, mdContent, mdConfig);
  const mdStats = getChunkStats(mdChunks);
  
  console.log(`File: ${mdMetadata.path}`);
  console.log(`Language: ${mdMetadata.language}`);
  console.log(`Size: ${mdMetadata.size} bytes`);
  console.log();
  console.log('Chunking Results:');
  console.log(`  Total chunks: ${mdStats.totalChunks}`);
  console.log(`  Avg tokens per chunk: ${mdStats.avgTokensPerChunk.toFixed(0)}`);
  console.log(`  Token range: ${mdStats.minTokens} - ${mdStats.maxTokens}`);
  console.log(`  Avg lines per chunk: ${mdStats.avgLinesPerChunk.toFixed(0)}`);
  console.log(`  Line range: ${mdStats.minLines} - ${mdStats.maxLines}`);
  console.log();
  
  // Example 3: Compare different configurations
  console.log('Example 3: Comparing different chunk configurations');
  console.log('-'.repeat(80));
  
  const configs = [
    { name: 'Small chunks', config: { maxTokensPerChunk: 200, overlapLines: 10 } },
    { name: 'Medium chunks', config: { maxTokensPerChunk: 500, overlapLines: 20 } },
    { name: 'Large chunks', config: { maxTokensPerChunk: 1000, overlapLines: 50 } },
  ];
  
  console.log('Chunking the same file with different configurations:');
  console.log();
  
  for (const { name, config } of configs) {
    const chunks = createCodeChunks(tsMetadata, tsContent, config);
    const stats = getChunkStats(chunks);
    
    console.log(`${name}:`);
    console.log(`  Max tokens: ${config.maxTokensPerChunk}`);
    console.log(`  Overlap: ${config.overlapLines} lines`);
    console.log(`  Result: ${stats.totalChunks} chunks`);
    console.log(`  Avg tokens: ${stats.avgTokensPerChunk.toFixed(0)}`);
    console.log();
  }
  
  // Example 4: Demonstrate overlap preservation
  console.log('Example 4: Demonstrating overlap between chunks');
  console.log('-'.repeat(80));
  
  const smallConfig: ChunkConfig = {
    maxTokensPerChunk: 200,
    overlapLines: 15,
  };
  
  const smallChunks = createCodeChunks(tsMetadata, tsContent, smallConfig);
  
  if (smallChunks.length >= 2) {
    const chunk1 = smallChunks[0];
    const chunk2 = smallChunks[1];
    
    console.log('Chunk 1:');
    console.log(`  Lines: ${chunk1.start_line} - ${chunk1.end_line}`);
    console.log();
    console.log('Chunk 2:');
    console.log(`  Lines: ${chunk2.start_line} - ${chunk2.end_line}`);
    console.log();
    
    const overlap = chunk1.end_line - chunk2.start_line + 1;
    console.log(`Overlap: ${overlap} lines`);
    console.log(`Expected: ~${smallConfig.overlapLines} lines`);
    console.log();
    
    // Show the overlapping content
    const chunk1Lines = chunk1.text.split('\n');
    const chunk2Lines = chunk2.text.split('\n');
    
    console.log('Last 5 lines of Chunk 1:');
    chunk1Lines.slice(-5).forEach((line, i) => {
      console.log(`  ${chunk1.end_line - 4 + i}: ${line.substring(0, 60)}${line.length > 60 ? '...' : ''}`);
    });
    console.log();
    
    console.log('First 5 lines of Chunk 2:');
    chunk2Lines.slice(0, 5).forEach((line, i) => {
      console.log(`  ${chunk2.start_line + i}: ${line.substring(0, 60)}${line.length > 60 ? '...' : ''}`);
    });
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log('Example completed successfully!');
  console.log('='.repeat(80));
}

// Run the example
main().catch(console.error);
