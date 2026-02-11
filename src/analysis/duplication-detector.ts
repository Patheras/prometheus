/**
 * Code Duplication Detector
 * 
 * Detects duplicate code blocks across files using content hashing.
 * 
 * Task 26.2: Implement code duplication detection
 */

import { createHash } from 'crypto';
import { DuplicationResult } from './types';

/**
 * Code block for duplication detection
 */
type CodeBlock = {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  hash: string;
};

/**
 * Duplication Detector
 * 
 * Finds duplicate code blocks across multiple files.
 */
export class DuplicationDetector {
  private codeBlocks: CodeBlock[] = [];
  private minLines: number;

  constructor(minLines: number = 5) {
    this.minLines = minLines;
  }

  /**
   * Add a file for duplication analysis
   * 
   * @param filePath - Path to the file
   * @param sourceCode - Source code content
   */
  addFile(filePath: string, sourceCode: string): void {
    const lines = sourceCode.split('\n');

    // Extract code blocks of minimum size
    for (let i = 0; i <= lines.length - this.minLines; i++) {
      for (let j = i + this.minLines; j <= lines.length; j++) {
        const blockLines = lines.slice(i, j);
        const content = blockLines.join('\n').trim();

        // Skip empty or whitespace-only blocks
        if (content.length === 0) continue;

        // Normalize content (remove extra whitespace)
        const normalized = this.normalizeContent(content);

        // Hash the normalized content
        const hash = this.hashContent(normalized);

        this.codeBlocks.push({
          filePath,
          startLine: i + 1,
          endLine: j,
          content,
          hash,
        });
      }
    }
  }

  /**
   * Detect duplications
   * 
   * @returns Array of duplication results
   */
  detectDuplications(): DuplicationResult[] {
    const duplications: DuplicationResult[] = [];
    const hashMap = new Map<string, CodeBlock[]>();

    // Group blocks by hash
    for (const block of this.codeBlocks) {
      if (!hashMap.has(block.hash)) {
        hashMap.set(block.hash, []);
      }
      hashMap.get(block.hash)!.push(block);
    }

    // Find duplicates (hash appears in multiple locations)
    for (const [hash, blocks] of hashMap.entries()) {
      if (blocks.length > 1) {
        // Check if blocks are from different files or different locations
        const uniqueLocations = this.getUniqueLocations(blocks);

        if (uniqueLocations.length > 1) {
          const lineCount = blocks[0].endLine - blocks[0].startLine + 1;

          // Calculate duplication percentage (simplified)
          const totalLines = this.getTotalLines();
          const percentage = (lineCount * uniqueLocations.length) / totalLines * 100;

          duplications.push({
            hash,
            files: uniqueLocations.map((block) => ({
              filePath: block.filePath,
              startLine: block.startLine,
              endLine: block.endLine,
            })),
            lineCount,
            percentage: Math.min(100, percentage),
          });
        }
      }
    }

    // Sort by line count (largest duplications first)
    duplications.sort((a, b) => b.lineCount - a.lineCount);

    return duplications;
  }

  /**
   * Clear all stored code blocks
   */
  clear(): void {
    this.codeBlocks = [];
  }

  /**
   * Normalize content for comparison
   * 
   * Removes extra whitespace and normalizes formatting.
   */
  private normalizeContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\s*([{}();,])\s*/g, '$1') // Remove spaces around punctuation
      .trim();
  }

  /**
   * Hash content using SHA-256
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get unique locations (filter overlapping blocks)
   */
  private getUniqueLocations(blocks: CodeBlock[]): CodeBlock[] {
    const unique: CodeBlock[] = [];

    for (const block of blocks) {
      // Check if this block overlaps with any existing unique block
      const overlaps = unique.some(
        (u) =>
          u.filePath === block.filePath &&
          !(block.endLine < u.startLine || block.startLine > u.endLine)
      );

      if (!overlaps) {
        unique.push(block);
      }
    }

    return unique;
  }

  /**
   * Get total lines across all files
   */
  private getTotalLines(): number {
    const fileLines = new Map<string, number>();

    for (const block of this.codeBlocks) {
      if (!fileLines.has(block.filePath)) {
        fileLines.set(block.filePath, block.endLine);
      } else {
        fileLines.set(
          block.filePath,
          Math.max(fileLines.get(block.filePath)!, block.endLine)
        );
      }
    }

    let total = 0;
    for (const lines of fileLines.values()) {
      total += lines;
    }

    return total;
  }
}

/**
 * Create a duplication detector instance
 * 
 * @param minLines - Minimum number of lines to consider as duplication
 * @returns Duplication detector instance
 */
export function createDuplicationDetector(minLines: number = 5): DuplicationDetector {
  return new DuplicationDetector(minLines);
}
