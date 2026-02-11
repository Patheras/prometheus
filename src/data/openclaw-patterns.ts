/**
 * OpenClaw Pattern Definitions
 * 
 * Pattern definitions extracted from openclaw-learning/patterns/pattern-catalog.md
 * 
 * These patterns are documented in the OpenClaw learning repository and represent
 * proven architectural patterns for memory systems, agent runtime, and concurrency.
 * 
 * Requirements: 4.4
 */

import { Pattern } from '../memory/types';

/**
 * OpenClaw pattern catalog
 * 
 * These patterns represent proven design patterns extracted from OpenClaw's
 * architecture, organized by category:
 * - Concurrency: Managing concurrent operations safely
 * - Architecture: System design and component organization
 * - Reliability: Fault tolerance and error recovery
 * - Performance: Optimization and efficiency
 * - Data: Storage and retrieval strategies
 */
export const OPENCLAW_PATTERNS: Omit<Pattern, 'id'>[] = [
  // Concurrency Patterns
  {
    name: 'Lane-Based Queue System',
    category: 'Concurrency',
    problem: 'Multiple concurrent operations on shared resources cause race conditions.',
    solution: 'Assign operations to lanes based on resource identity; serialize operations within each lane while allowing parallel execution across different lanes.',
    example_code: `
// Example: Lane-based queue implementation
type QueueEntry = {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const lanes = new Map<string, { queue: QueueEntry[]; active: number; maxConcurrent: number }>();

async function enqueue<T>(task: () => Promise<T>, lane: string): Promise<T> {
  const state = getLaneState(lane);
  return new Promise<T>((resolve, reject) => {
    state.queue.push({ task, resolve, reject });
    drainLane(lane);
  });
}
    `.trim(),
    applicability: 'Task queue management, file modification operations, database updates, API call coordination. Use when multiple operations target the same resource and need serialization.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Hierarchical Lane Composition',
    category: 'Concurrency',
    problem: 'Resources have parent-child relationships requiring coordinated access.',
    solution: 'Create lane hierarchies that mirror resource relationships. Operations acquire locks from parent to child, ensuring consistent ordering.',
    example_code: `
// Example: Hierarchical lane composition
async function modifyFile(repoPath: string, filePath: string, content: string): Promise<void> {
  const repoLane = \`repo:\${repoPath}\`;
  const fileLane = \`file:\${filePath}\`;
  
  // Outer lane: repository-level serialization
  await enqueue(async () => {
    // Inner lane: file-level serialization
    await enqueue(async () => {
      await fs.writeFile(filePath, content);
    }, fileLane);
  }, repoLane);
}
    `.trim(),
    applicability: 'Project → File → Function hierarchy, Organization → Team → User hierarchy, Decision → Task → Subtask hierarchy. Use when resources have clear parent-child relationships.',
    success_count: 0,
    failure_count: 0,
  },

  // Architecture Patterns
  {
    name: 'Channel Adapter Pattern',
    category: 'Architecture',
    problem: 'Multiple communication channels (Discord, Slack, etc.) have different APIs.',
    solution: 'Create adapters that translate channel-specific APIs to common interface. Each adapter implements the same interface but handles channel-specific details internally.',
    example_code: `
// Example: Channel adapter interface
interface ChannelAdapter {
  sendMessage(channelId: string, content: string): Promise<void>;
  receiveMessage(): AsyncIterator<Message>;
  getChannelInfo(channelId: string): Promise<ChannelInfo>;
}

class DiscordAdapter implements ChannelAdapter {
  async sendMessage(channelId: string, content: string): Promise<void> {
    // Discord-specific implementation
  }
}
    `.trim(),
    applicability: 'Multiple notification channels, different monitoring systems, various CI/CD platforms. Use when integrating with multiple external systems with similar functionality.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Gateway with Session Management',
    category: 'Architecture',
    problem: 'Managing multiple concurrent sessions across channels is complex.',
    solution: 'Gateway manages all connections; sessions track conversation state. Gateway routes messages to appropriate sessions based on context.',
    example_code: `
// Example: Gateway with session management
class Gateway {
  private sessions = new Map<string, Session>();
  
  async handleMessage(message: Message): Promise<void> {
    const sessionId = this.getSessionId(message);
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = new Session(sessionId);
      this.sessions.set(sessionId, session);
    }
    
    await session.processMessage(message);
  }
}
    `.trim(),
    applicability: 'User interaction sessions, analysis sessions, deployment sessions. Use when managing stateful conversations across multiple channels.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Hybrid Search (Vector + Keyword)',
    category: 'Architecture',
    problem: 'Vector search misses exact matches; keyword search misses semantic matches.',
    solution: 'Run both vector similarity search and keyword search in parallel, then merge results with weighted scoring. Typically 70% vector weight, 30% keyword weight.',
    example_code: `
// Example: Hybrid search implementation
async function hybridSearch(query: string): Promise<SearchResult[]> {
  // Parallel search
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query),
    keywordSearch(query)
  ]);
  
  // Merge with weighted scoring
  return mergeResults(vectorResults, keywordResults, {
    vectorWeight: 0.7,
    keywordWeight: 0.3
  });
}
    `.trim(),
    applicability: 'Code search, decision search, pattern search, documentation search. Use when search needs both semantic understanding and exact match capabilities.',
    success_count: 0,
    failure_count: 0,
  },

  // Reliability Patterns
  {
    name: 'Cascading Fallback with Auth Rotation',
    category: 'Reliability',
    problem: 'Single API key or model can fail; need automatic recovery.',
    solution: 'Try multiple models with multiple auth profiles; rotate on failure. Classify errors to determine if fallback is appropriate. Track success rates for optimization.',
    example_code: `
// Example: Cascading fallback implementation
async function executeWithFallback(request: Request): Promise<Response> {
  const fallbackChain = getFallbackChain(request.model);
  
  for (const model of fallbackChain) {
    try {
      const authProfile = getAuthProfile(model.provider);
      return await callLLM(request, model, authProfile);
    } catch (error) {
      if (shouldFallback(error)) {
        continue; // Try next in chain
      }
      throw error; // Non-recoverable error
    }
  }
  
  throw new Error('All fallback attempts exhausted');
}
    `.trim(),
    applicability: 'LLM API calls, external service calls, database connections. Use when reliability is critical and multiple providers/auth profiles are available.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Atomic Index Swap',
    category: 'Reliability',
    problem: 'Index rebuild takes time; cannot leave system in broken state.',
    solution: 'Build new index in temporary location, then swap atomically using file system rename. Old index remains available until swap completes.',
    example_code: `
// Example: Atomic index swap
async function atomicReindex(repoPath: string): Promise<void> {
  const tempDbPath = \`\${dbPath}.temp\`;
  
  // Build new index in temp location
  const tempDb = await openDatabase(tempDbPath);
  await buildIndex(tempDb, repoPath);
  await tempDb.close();
  
  // Atomic swap
  await db.close();
  await fs.rename(tempDbPath, dbPath);
  db = await openDatabase(dbPath);
}
    `.trim(),
    applicability: 'Codebase index updates, decision database updates, pattern library updates. Use when index rebuild is time-consuming and zero-downtime is required.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Failover Error Classification',
    category: 'Reliability',
    problem: 'Different errors need different handling (auth vs rate limit vs context).',
    solution: 'Classify errors by type; apply type-specific recovery. Auth errors trigger profile rotation, rate limits trigger backoff, context errors trigger truncation.',
    example_code: `
// Example: Error classification
type FailoverReason = 'auth' | 'billing' | 'context' | 'timeout' | 'rate_limit' | 'unavailable';

function classifyError(error: Error): FailoverReason {
  const message = error.message.toLowerCase();
  
  if (message.includes('unauthorized')) return 'auth';
  if (message.includes('quota')) return 'billing';
  if (message.includes('context')) return 'context';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('rate limit')) return 'rate_limit';
  
  return 'unavailable';
}
    `.trim(),
    applicability: 'API error handling, analysis error recovery, deployment error handling. Use when different error types require different recovery strategies.',
    success_count: 0,
    failure_count: 0,
  },

  // Performance Patterns
  {
    name: 'Embedding Cache with Content Hashing',
    category: 'Performance',
    problem: 'Embedding API calls are expensive and slow.',
    solution: 'Cache embeddings by content hash, not by location. When content is unchanged, reuse cached embedding. Use SHA-256 for content hashing.',
    example_code: `
// Example: Embedding cache with content hashing
async function getEmbedding(text: string, provider: string, model: string): Promise<number[]> {
  const hash = createHash('sha256').update(text).digest('hex');
  
  // Check cache
  const cached = await db.get(
    'SELECT embedding FROM embedding_cache WHERE provider = ? AND model = ? AND hash = ?',
    [provider, model, hash]
  );
  
  if (cached) {
    return JSON.parse(cached.embedding);
  }
  
  // Generate and cache
  const embedding = await callEmbeddingAPI(text, provider, model);
  await db.run(
    'INSERT INTO embedding_cache (provider, model, hash, embedding, dims, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [provider, model, hash, JSON.stringify(embedding), embedding.length, Date.now()]
  );
  
  return embedding;
}
    `.trim(),
    applicability: 'Code embeddings, documentation embeddings, decision embeddings. Use when embedding generation is expensive and content is frequently repeated.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Delta-Based Sync',
    category: 'Performance',
    problem: 'Full reindex is wasteful for incrementally growing data.',
    solution: 'Track deltas (added, modified, deleted files), sync only changes. Compare file hashes to detect modifications efficiently.',
    example_code: `
// Example: Delta-based sync
async function syncCodebase(repoPath: string): Promise<SyncResult> {
  const currentFiles = await scanRepository(repoPath);
  const indexedFiles = await db.all('SELECT path, hash FROM code_files WHERE repo = ?', [repoPath]);
  
  const changes = {
    added: [] as string[],
    modified: [] as string[],
    deleted: [] as string[]
  };
  
  // Detect changes by comparing hashes
  for (const file of currentFiles) {
    const indexed = indexedFiles.find(f => f.path === file.path);
    if (!indexed) {
      changes.added.push(file.path);
    } else if (indexed.hash !== file.hash) {
      changes.modified.push(file.path);
    }
  }
  
  // Apply changes incrementally
  await applyChanges(changes);
  
  return { changes, timestamp: Date.now() };
}
    `.trim(),
    applicability: 'Codebase monitoring, metric collection, log processing. Use when data grows incrementally and full reprocessing is expensive.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Batch Processing with Fallback',
    category: 'Performance',
    problem: 'Batch APIs are faster but less reliable.',
    solution: 'Try batch first, fall back to streaming on failure. Track batch success rates to optimize batch size.',
    example_code: `
// Example: Batch processing with fallback
async function processItems<T>(items: T[], processor: (item: T) => Promise<void>): Promise<void> {
  try {
    // Try batch processing
    await batchProcess(items);
  } catch (error) {
    console.warn('Batch processing failed, falling back to streaming:', error);
    
    // Fall back to streaming (one at a time)
    for (const item of items) {
      try {
        await processor(item);
      } catch (itemError) {
        console.error('Failed to process item:', itemError);
        // Continue with next item
      }
    }
  }
}
    `.trim(),
    applicability: 'Bulk code analysis, batch metric processing, mass decision updates. Use when batch operations provide significant performance benefits but may fail.',
    success_count: 0,
    failure_count: 0,
  },

  // Data Patterns
  {
    name: 'Multi-Source Memory System',
    category: 'Data',
    problem: 'Data scattered across files, sessions, databases.',
    solution: 'Abstract sources behind unified search interface. Each source implements common search interface, results are merged and ranked.',
    example_code: `
// Example: Multi-source memory system
interface MemorySource {
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
}

class UnifiedMemory {
  private sources: Map<string, MemorySource> = new Map();
  
  async search(query: string, sourceTypes?: string[]): Promise<SearchResult[]> {
    const targetSources = sourceTypes 
      ? Array.from(this.sources.entries()).filter(([type]) => sourceTypes.includes(type))
      : Array.from(this.sources.entries());
    
    // Search all sources in parallel
    const results = await Promise.all(
      targetSources.map(([type, source]) => source.search(query, {}))
    );
    
    // Merge and rank results
    return mergeAndRank(results.flat());
  }
}
    `.trim(),
    applicability: 'Codebase + metrics + decisions, documentation + history + patterns, logs + traces + events. Use when data is distributed across multiple storage systems.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Context Window Guard with Dynamic Adjustment',
    category: 'Data',
    problem: 'Models have different context windows; overflow causes failures.',
    solution: 'Resolve context window from multiple sources (config, model catalog, defaults), apply guards, compact if needed. Reject if below hard minimum.',
    example_code: `
// Example: Context window guard
function validateContextSize(request: Request): ContextValidation {
  const contextWindow = getContextWindow(request.model);
  const requiredTokens = estimateTokens(request.prompt + request.context);
  
  return {
    isValid: requiredTokens <= contextWindow && contextWindow >= HARD_MIN,
    shouldWarn: contextWindow < RECOMMENDED_MIN,
    available: contextWindow,
    required: requiredTokens
  };
}
    `.trim(),
    applicability: 'Large codebase analysis, long decision histories, extensive documentation. Use when working with variable-size context and multiple models.',
    success_count: 0,
    failure_count: 0,
  },
  {
    name: 'Streaming with Abort Support',
    category: 'Data',
    problem: 'Long operations need user cancellation support.',
    solution: 'Track active streams with AbortControllers. When abort signal received, cancel LLM request gracefully and clean up resources.',
    example_code: `
// Example: Streaming with abort support
async function* executeStreaming(request: Request): AsyncIterator<StreamChunk> {
  const abortController = new AbortController();
  
  try {
    const stream = await callLLMStreaming(request, {
      signal: abortController.signal
    });
    
    for await (const chunk of stream) {
      yield { type: 'content', content: chunk.text };
    }
    
    yield { type: 'done' };
  } catch (error) {
    if (isAbortError(error)) {
      yield { type: 'aborted' };
    } else {
      yield { type: 'error', error: error.message };
    }
  }
}
    `.trim(),
    applicability: 'Long analysis tasks, deployment operations, metric collection. Use when operations are long-running and users need cancellation capability.',
    success_count: 0,
    failure_count: 0,
  },
];
