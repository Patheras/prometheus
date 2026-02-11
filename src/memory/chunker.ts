/**
 * File Chunking System
 * 
 * This module provides functionality for:
 * - Splitting large files into manageable chunks
 * - Estimating token counts for each chunk
 * - Applying configurable overlap between consecutive chunks
 * - Preserving line numbers for accurate citations
 * - Handling different file types (code, markdown, etc.)
 * 
 * Requirements: 1.1, 8.3
 */

import { createHash } from 'crypto';
import { CodeChunk, CodeFile } from './types';
import { extractSymbolsAndImports, SymbolInfo, ImportInfo } from './file-scanner';

// ============================================================================
// Configuration
// ============================================================================

export interface ChunkConfig {
  /**
   * Maximum tokens per chunk
   * Default: 1000 tokens (~4000 characters)
   */
  maxTokensPerChunk?: number;
  
  /**
   * Number of lines to overlap between consecutive chunks
   * Default: 50 lines
   */
  overlapLines?: number;
  
  /**
   * Minimum chunk size in lines
   * Chunks smaller than this will be merged with adjacent chunks
   * Default: 10 lines
   */
  minChunkLines?: number;
  
  /**
   * Whether to respect code boundaries (functions, classes)
   * When true, tries to avoid splitting in the middle of code blocks
   * Default: true
   */
  respectCodeBoundaries?: boolean;
}

const DEFAULT_CONFIG: Required<ChunkConfig> = {
  maxTokensPerChunk: 1000,
  overlapLines: 50,
  minChunkLines: 10,
  respectCodeBoundaries: true,
};

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate the number of tokens in a text string
 * 
 * Uses a simple heuristic: ~4 characters per token
 * This is a rough approximation that works reasonably well for code and text.
 * 
 * For more accurate estimation, consider using a tokenizer library like
 * tiktoken or gpt-tokenizer.
 * 
 * @param text Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Simple heuristic: 4 characters ≈ 1 token
  // This accounts for:
  // - Average word length (~5 chars)
  // - Spaces and punctuation
  // - Code syntax (operators, brackets, etc.)
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for an array of lines
 * 
 * @param lines Array of text lines
 * @returns Estimated token count
 */
export function estimateTokensForLines(lines: string[]): number {
  const text = lines.join('\n');
  return estimateTokens(text);
}

// ============================================================================
// Chunking Strategy
// ============================================================================

/**
 * Determine chunk boundaries based on file type and content
 * 
 * @param lines Array of file lines
 * @param language Programming language or file type
 * @param config Chunking configuration
 * @returns Array of chunk boundaries (start and end line numbers)
 */
function determineChunkBoundaries(
  lines: string[],
  language: string | null,
  config: Required<ChunkConfig>
): Array<{ start: number; end: number }> {
  const boundaries: Array<{ start: number; end: number }> = [];
  
  // If file is small enough, return single chunk
  const totalTokens = estimateTokensForLines(lines);
  if (totalTokens <= config.maxTokensPerChunk) {
    return [{ start: 1, end: lines.length }];
  }
  
  // For code files, try to respect code boundaries
  if (config.respectCodeBoundaries && language && isCodeLanguage(language)) {
    return determineCodeChunkBoundaries(lines, language, config);
  }
  
  // For other files (markdown, text, etc.), use simple line-based chunking
  return determineLineBasedChunkBoundaries(lines, config);
}

/**
 * Check if a language is a code language (vs. markup/text)
 */
function isCodeLanguage(language: string): boolean {
  const codeLanguages = new Set([
    'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
    'csharp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
    'scala', 'shell', 'sql',
  ]);
  return codeLanguages.has(language);
}

/**
 * Determine chunk boundaries for code files
 * Tries to avoid splitting in the middle of functions/classes
 */
function determineCodeChunkBoundaries(
  lines: string[],
  language: string,
  config: Required<ChunkConfig>
): Array<{ start: number; end: number }> {
  const boundaries: Array<{ start: number; end: number }> = [];
  
  // Extract symbols to identify code block boundaries
  const content = lines.join('\n');
  const { symbols } = extractSymbolsAndImports(content, language);
  
  // Sort symbols by line number
  symbols.sort((a, b) => a.line - b.line);
  
  let currentStart = 1;
  let currentEnd = 1;
  let currentTokens = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const lineTokens = estimateTokens(line);
    
    // Check if adding this line would exceed the token limit
    if (currentTokens + lineTokens > config.maxTokensPerChunk && currentEnd > currentStart) {
      // Try to find a good boundary (end of a function/class)
      const boundaryLine = findNearestCodeBoundary(lineNum, symbols, lines);
      
      // Make sure we don't create a chunk that's too large
      if (boundaryLine > currentStart && boundaryLine - currentStart < lines.length / 2) {
        currentEnd = boundaryLine;
      } else {
        // Force split at current line to respect token limit
        currentEnd = lineNum - 1;
      }
      
      // Only create chunk if it has content
      if (currentEnd >= currentStart) {
        boundaries.push({ start: currentStart, end: currentEnd });
        
        // Start next chunk with overlap
        currentStart = Math.max(1, currentEnd - config.overlapLines + 1);
        currentEnd = currentStart;
        currentTokens = estimateTokensForLines(lines.slice(currentStart - 1, currentEnd));
      }
    } else {
      currentEnd = lineNum;
      currentTokens += lineTokens;
    }
  }
  
  // Add final chunk if there are remaining lines
  if (currentEnd >= currentStart) {
    boundaries.push({ start: currentStart, end: currentEnd });
  }
  
  return boundaries;
}

/**
 * Find the nearest code boundary (end of function/class) near a line number
 */
function findNearestCodeBoundary(
  targetLine: number,
  symbols: SymbolInfo[],
  lines: string[]
): number {
  // Look for closing braces near the target line
  const searchRange = 20; // Look within 20 lines
  
  for (let i = targetLine - 1; i >= Math.max(0, targetLine - searchRange); i--) {
    const line = lines[i].trim();
    
    // Check for closing brace at the start of the line (end of function/class)
    if (line === '}' || line.startsWith('}')) {
      return i + 1; // Return 1-indexed line number
    }
  }
  
  // If no boundary found, return the target line
  return targetLine;
}

/**
 * Determine chunk boundaries using simple line-based approach
 * Used for markdown, text, and other non-code files
 */
function determineLineBasedChunkBoundaries(
  lines: string[],
  config: Required<ChunkConfig>
): Array<{ start: number; end: number }> {
  const boundaries: Array<{ start: number; end: number }> = [];
  
  let currentStart = 1;
  let currentEnd = 1;
  let currentTokens = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const lineTokens = estimateTokens(line);
    
    // Check if adding this line would exceed the token limit
    if (currentTokens + lineTokens > config.maxTokensPerChunk && currentEnd > currentStart) {
      // For markdown, try to split at paragraph boundaries
      const boundaryLine = findNearestParagraphBoundary(lineNum, lines);
      
      currentEnd = boundaryLine;
      boundaries.push({ start: currentStart, end: currentEnd });
      
      // Start next chunk with overlap
      currentStart = Math.max(1, currentEnd - config.overlapLines + 1);
      currentEnd = currentStart;
      currentTokens = estimateTokensForLines(lines.slice(currentStart - 1, currentEnd));
    } else {
      currentEnd = lineNum;
      currentTokens += lineTokens;
    }
  }
  
  // Add final chunk if there are remaining lines
  if (currentEnd >= currentStart) {
    boundaries.push({ start: currentStart, end: currentEnd });
  }
  
  return boundaries;
}

/**
 * Find the nearest paragraph boundary (empty line) near a line number
 */
function findNearestParagraphBoundary(targetLine: number, lines: string[]): number {
  const searchRange = 10; // Look within 10 lines
  
  // Look backwards for an empty line
  for (let i = targetLine - 1; i >= Math.max(0, targetLine - searchRange); i--) {
    if (lines[i].trim() === '') {
      return i + 1; // Return 1-indexed line number
    }
  }
  
  // If no boundary found, return the target line
  return targetLine;
}

// ============================================================================
// Chunk Creation
// ============================================================================

/**
 * Create code chunks from file content with proper chunking and overlap
 * 
 * This function:
 * 1. Splits large files into manageable chunks
 * 2. Estimates token counts for each chunk
 * 3. Applies configurable overlap between consecutive chunks
 * 4. Preserves line numbers for accurate citations
 * 5. Handles different file types (code, markdown, etc.)
 * 
 * @param fileMetadata File metadata
 * @param content File content
 * @param config Chunking configuration
 * @returns Array of code chunks
 */
export function createCodeChunks(
  fileMetadata: CodeFile,
  content: string,
  config: ChunkConfig = {}
): CodeChunk[] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const lines = content.split('\n');
  
  // Determine chunk boundaries
  const boundaries = determineChunkBoundaries(
    lines,
    fileMetadata.language,
    fullConfig
  );
  
  // Create chunks from boundaries
  const chunks: CodeChunk[] = [];
  
  for (let i = 0; i < boundaries.length; i++) {
    const { start, end } = boundaries[i];
    
    // Extract chunk text
    const chunkLines = lines.slice(start - 1, end);
    const chunkText = chunkLines.join('\n');
    
    // Calculate hash for this chunk
    const hash = createHash('sha256').update(chunkText).digest('hex');
    
    // Extract symbols and imports for this chunk
    const { symbols, imports } = extractSymbolsAndImports(
      chunkText,
      fileMetadata.language
    );
    
    // Adjust symbol and import line numbers to be relative to chunk start
    const adjustedSymbols = symbols.map(s => ({
      ...s,
      line: s.line, // Keep original line number for global reference
    }));
    
    const adjustedImports = imports.map(imp => ({
      ...imp,
      line: imp.line, // Keep original line number for global reference
    }));
    
    // Create chunk
    const chunk: CodeChunk = {
      id: `${fileMetadata.path}_${i}`,
      file_path: fileMetadata.path,
      start_line: start,
      end_line: end,
      text: chunkText,
      hash,
      symbols: adjustedSymbols.length > 0 ? JSON.stringify(adjustedSymbols) : null,
      imports: adjustedImports.length > 0 ? JSON.stringify(adjustedImports) : null,
    };
    
    chunks.push(chunk);
  }
  
  // Merge small chunks if needed
  return mergeSmallChunks(chunks, fullConfig);
}

/**
 * Merge chunks that are smaller than the minimum chunk size
 */
function mergeSmallChunks(
  chunks: CodeChunk[],
  config: Required<ChunkConfig>
): CodeChunk[] {
  if (chunks.length <= 1) {
    return chunks;
  }
  
  const merged: CodeChunk[] = [];
  let i = 0;
  
  while (i < chunks.length) {
    const chunk = chunks[i];
    const chunkLines = chunk.end_line - chunk.start_line + 1;
    
    // If chunk is too small and not the last chunk, try to merge with next
    if (chunkLines < config.minChunkLines && i < chunks.length - 1) {
      const nextChunk = chunks[i + 1];
      const mergedText = chunk.text + '\n' + nextChunk.text;
      const mergedHash = createHash('sha256').update(mergedText).digest('hex');
      
      // Merge symbols and imports
      const symbols1 = chunk.symbols ? JSON.parse(chunk.symbols) : [];
      const symbols2 = nextChunk.symbols ? JSON.parse(nextChunk.symbols) : [];
      const mergedSymbols = [...symbols1, ...symbols2];
      
      const imports1 = chunk.imports ? JSON.parse(chunk.imports) : [];
      const imports2 = nextChunk.imports ? JSON.parse(nextChunk.imports) : [];
      const mergedImports = [...imports1, ...imports2];
      
      const mergedChunk: CodeChunk = {
        id: chunk.id, // Keep the first chunk's ID
        file_path: chunk.file_path,
        start_line: chunk.start_line,
        end_line: nextChunk.end_line,
        text: mergedText,
        hash: mergedHash,
        symbols: mergedSymbols.length > 0 ? JSON.stringify(mergedSymbols) : null,
        imports: mergedImports.length > 0 ? JSON.stringify(mergedImports) : null,
      };
      
      merged.push(mergedChunk);
      i += 2; // Skip both chunks
    } else {
      merged.push(chunk);
      i += 1;
    }
  }
  
  return merged;
}

// ============================================================================
// Chunk Validation
// ============================================================================

/**
 * Validate that chunks have proper overlap
 * 
 * @param chunks Array of chunks to validate
 * @param expectedOverlap Expected overlap in lines
 * @returns Validation result
 */
export function validateChunkOverlap(
  chunks: CodeChunk[],
  expectedOverlap: number
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  for (let i = 0; i < chunks.length - 1; i++) {
    const current = chunks[i];
    const next = chunks[i + 1];
    
    // Check if chunks are from the same file
    if (current.file_path !== next.file_path) {
      continue;
    }
    
    // Calculate actual overlap
    const actualOverlap = current.end_line - next.start_line + 1;
    
    // Check if overlap is within acceptable range
    // Allow some flexibility (±10 lines)
    const minOverlap = Math.max(0, expectedOverlap - 10);
    const maxOverlap = expectedOverlap + 10;
    
    if (actualOverlap < minOverlap) {
      issues.push(
        `Insufficient overlap between chunks ${i} and ${i + 1}: ` +
        `expected ~${expectedOverlap} lines, got ${actualOverlap} lines`
      );
    } else if (actualOverlap > maxOverlap) {
      issues.push(
        `Excessive overlap between chunks ${i} and ${i + 1}: ` +
        `expected ~${expectedOverlap} lines, got ${actualOverlap} lines`
      );
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get statistics about chunks
 * 
 * @param chunks Array of chunks
 * @returns Statistics object
 */
export function getChunkStats(chunks: CodeChunk[]): {
  totalChunks: number;
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
  avgLinesPerChunk: number;
  minLines: number;
  maxLines: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgTokensPerChunk: 0,
      minTokens: 0,
      maxTokens: 0,
      avgLinesPerChunk: 0,
      minLines: 0,
      maxLines: 0,
    };
  }
  
  const tokenCounts = chunks.map(c => estimateTokens(c.text));
  const lineCounts = chunks.map(c => c.end_line - c.start_line + 1);
  
  return {
    totalChunks: chunks.length,
    avgTokensPerChunk: tokenCounts.reduce((a, b) => a + b, 0) / chunks.length,
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    avgLinesPerChunk: lineCounts.reduce((a, b) => a + b, 0) / chunks.length,
    minLines: Math.min(...lineCounts),
    maxLines: Math.max(...lineCounts),
  };
}
