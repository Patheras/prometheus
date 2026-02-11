# File Chunking System

## Overview

The chunking system splits large files into manageable chunks for efficient processing and embedding generation. It implements intelligent chunking strategies that:

1. **Estimate token counts** for each chunk
2. **Apply configurable overlap** between consecutive chunks
3. **Preserve line numbers** for accurate citations
4. **Handle different file types** (code, markdown, etc.)
5. **Respect code boundaries** to avoid splitting functions/classes

## Requirements

This implementation satisfies:
- **Requirement 1.1**: Index source code files with semantic embeddings
- **Requirement 8.3**: Support chunking with overlap for large files

## Architecture

### Token Estimation

The system uses a simple heuristic for token estimation:
- **~4 characters ≈ 1 token**

This approximation works reasonably well for both code and text. For more accurate estimation, consider integrating a tokenizer library like `tiktoken` or `gpt-tokenizer`.

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

### Chunking Strategies

The system uses different strategies based on file type:

#### Code Files (TypeScript, Python, Java, etc.)

For code files, the chunker:
1. Extracts symbols (functions, classes, interfaces) to identify code block boundaries
2. Tries to avoid splitting in the middle of functions or classes
3. Looks for closing braces (`}`) as natural split points
4. Falls back to line-based splitting if no good boundary is found

#### Text Files (Markdown, plain text, etc.)

For text files, the chunker:
1. Uses simple line-based chunking
2. Tries to split at paragraph boundaries (empty lines)
3. Respects the configured token limit

### Overlap Strategy

Consecutive chunks overlap by a configurable number of lines (default: 50 lines). This ensures:
- **Context preservation**: Important context from the previous chunk is available
- **Better embeddings**: Overlapping content helps with semantic search
- **Citation accuracy**: Line numbers remain accurate across chunks

```
Chunk 1: Lines 1-100
Chunk 2: Lines 51-150  (50 lines overlap with Chunk 1)
Chunk 3: Lines 101-200 (50 lines overlap with Chunk 2)
```

## Configuration

### ChunkConfig

```typescript
interface ChunkConfig {
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
```

### Default Configuration

```typescript
const DEFAULT_CONFIG = {
  maxTokensPerChunk: 1000,
  overlapLines: 50,
  minChunkLines: 10,
  respectCodeBoundaries: true,
};
```

## Usage

### Basic Usage

```typescript
import { createCodeChunks, extractFileMetadata } from './memory';
import { readFileSync } from 'fs';

// Extract file metadata
const filePath = 'src/example.ts';
const content = readFileSync(filePath, 'utf-8');
const metadata = extractFileMetadata(filePath, 'src');

// Create chunks with default configuration
const chunks = createCodeChunks(metadata, content);

console.log(`Created ${chunks.length} chunks`);
```

### Custom Configuration

```typescript
import { createCodeChunks, ChunkConfig } from './memory';

const config: ChunkConfig = {
  maxTokensPerChunk: 500,  // Smaller chunks
  overlapLines: 20,        // Less overlap
  minChunkLines: 5,        // Allow smaller chunks
  respectCodeBoundaries: true,
};

const chunks = createCodeChunks(metadata, content, config);
```

### Analyzing Chunks

```typescript
import { getChunkStats, validateChunkOverlap } from './memory';

// Get statistics
const stats = getChunkStats(chunks);
console.log(`Total chunks: ${stats.totalChunks}`);
console.log(`Avg tokens per chunk: ${stats.avgTokensPerChunk}`);
console.log(`Token range: ${stats.minTokens} - ${stats.maxTokens}`);

// Validate overlap
const validation = validateChunkOverlap(chunks, 50);
if (!validation.valid) {
  console.log('Overlap issues:', validation.issues);
}
```

## Data Structure

### CodeChunk

Each chunk contains:

```typescript
interface CodeChunk {
  id: string;              // Unique identifier: "{file_path}_{index}"
  file_path: string;       // Relative path to the file
  start_line: number;      // Starting line number (1-indexed)
  end_line: number;        // Ending line number (inclusive)
  text: string;            // Chunk content
  hash: string;            // SHA-256 hash of the chunk content
  symbols: string | null;  // JSON array of symbols (functions, classes, etc.)
  imports: string | null;  // JSON array of imports
}
```

### Example Chunk

```typescript
{
  id: "src/example.ts_0",
  file_path: "src/example.ts",
  start_line: 1,
  end_line: 50,
  text: "import { foo } from './foo';\n\nfunction hello() {\n  ...",
  hash: "a1b2c3d4...",
  symbols: "[{\"name\":\"hello\",\"type\":\"function\",\"line\":3}]",
  imports: "[{\"source\":\"./foo\",\"imports\":[\"foo\"],\"line\":1}]"
}
```

## Performance Considerations

### Token Estimation

The simple character-based estimation is fast but approximate. For production use with strict token limits, consider:
- Using a proper tokenizer library
- Caching token counts for unchanged content
- Adjusting the estimation ratio based on your specific use case

### Chunk Size

Choosing the right chunk size involves trade-offs:

| Chunk Size | Pros | Cons |
|------------|------|------|
| Small (200-500 tokens) | More precise retrieval, faster processing | More chunks, more overhead, less context |
| Medium (500-1000 tokens) | Good balance | Default choice |
| Large (1000-2000 tokens) | More context, fewer chunks | Slower processing, less precise retrieval |

### Overlap

Overlap size also involves trade-offs:

| Overlap | Pros | Cons |
|---------|------|------|
| Small (10-20 lines) | Less redundancy, faster indexing | May miss context at boundaries |
| Medium (30-50 lines) | Good context preservation | Default choice |
| Large (50-100 lines) | Maximum context | High redundancy, slower indexing |

## Testing

The chunking system includes comprehensive tests:

```bash
npm test -- chunker.test.ts
```

Tests cover:
- Token estimation accuracy
- Single chunk for small files
- Multiple chunks for large files
- Overlap between consecutive chunks
- Line number preservation
- Different file types (TypeScript, Python, Markdown)
- Configuration options
- Edge cases (empty files, single line files)

## Examples

See `examples/chunking-example.ts` for detailed usage examples:

```bash
npx ts-node src/memory/examples/chunking-example.ts
```

## Future Improvements

Potential enhancements:

1. **Semantic Chunking**: Use AST parsing to create semantically meaningful chunks (e.g., one function per chunk)
2. **Adaptive Chunking**: Adjust chunk size based on content complexity
3. **Language-Specific Strategies**: Implement specialized chunking for each language
4. **Token Caching**: Cache token counts for unchanged content
5. **Parallel Processing**: Chunk multiple files in parallel
6. **Compression**: Compress chunk text for storage efficiency

## Related Documentation

- [Memory Engine](./README.md) - Overview of the memory system
- [File Scanner](./file-scanner.ts) - File scanning and metadata extraction
- [Embedding Cache](./EMBEDDING_CACHE.md) - Caching embeddings for performance
