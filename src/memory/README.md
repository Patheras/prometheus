# Prometheus Memory Engine

The Memory Engine is the core data layer for the Prometheus meta-agent system. It provides multi-source memory storage with hybrid search capabilities for codebase indexing, decision tracking, metrics, and patterns.

## Overview

The Memory Engine implements patterns learned from OpenClaw for:
- **SQLite + sqlite-vec** for hybrid search (vector similarity + keyword matching)
- **Content-hash caching** for embedding reuse
- **Delta-based sync** for incremental updates
- **Atomic index swaps** for zero-downtime updates
- **Transaction support** for data consistency

## Architecture

```
memory/
├── database.ts       # Database initialization and connection management
├── engine.ts         # Main MemoryEngine interface and implementation
├── migrations.ts     # Database migration system
├── types.ts          # TypeScript type definitions
├── index.ts          # Module exports
├── examples/         # Usage examples
│   └── basic-usage.ts
└── __tests__/        # Test files
    └── engine.test.ts
```

## Features

### 1. Codebase Memory
- Index source code files with semantic embeddings
- Extract metadata (file path, language, symbols, imports)
- Hybrid search (vector similarity + keyword matching)
- Content-hash based embedding cache
- Delta sync for incremental updates

### 2. Decision Memory
- Store decisions with context, reasoning, and alternatives
- Track decision outcomes and lessons learned
- Link decisions to affected components
- Search for similar past decisions

### 3. Metric Memory
- Store performance, usage, and system metrics
- Time-range queries and aggregations
- Anomaly detection
- Trend analysis

### 4. Pattern Memory
- Store architectural patterns and best practices
- Track pattern application success/failure rates
- Search patterns by problem description
- Learn from pattern outcomes

### 5. Unified Search
- Search across all memory sources simultaneously
- Rank results by relevance across sources
- Filter by source type, time range, and relevance threshold

## Installation

The Memory Engine is part of the Prometheus project. No separate installation is required.

## Usage

### Basic Setup

```typescript
import { initializeDatabase, createMemoryEngine } from './memory';

// Initialize database
const db = await initializeDatabase({ 
  path: './data/prometheus.db' 
});

// Create Memory Engine instance
const engine = createMemoryEngine(db);
```

### Storing Decisions

```typescript
const decisionId = await engine.storeDecision({
  timestamp: Date.now(),
  context: 'Choosing database for Memory Engine',
  reasoning: 'SQLite provides excellent performance with zero configuration',
  alternatives: JSON.stringify([
    {
      option: 'SQLite',
      pros: ['Zero config', 'Fast', 'Embedded'],
      cons: ['Single writer'],
    },
    {
      option: 'PostgreSQL',
      pros: ['High concurrency'],
      cons: ['Requires server'],
    },
  ]),
  chosen_option: 'SQLite',
  outcome: null,
  lessons_learned: null,
  affected_components: JSON.stringify(['memory-engine']),
});

// Update outcome later
await engine.updateDecisionOutcome(
  decisionId,
  'Success - SQLite performs excellently',
  'Learned that WAL mode provides sufficient concurrency'
);
```

### Storing Metrics

```typescript
await engine.storeMetrics([
  {
    id: 'metric_1',
    timestamp: Date.now(),
    metric_type: 'performance',
    metric_name: 'db_query_time',
    value: 15.5,
    context: JSON.stringify({ operation: 'storeDecision' }),
  },
  {
    id: 'metric_2',
    timestamp: Date.now(),
    metric_type: 'usage',
    metric_name: 'active_users',
    value: 42,
    context: null,
  },
]);
```

### Storing Patterns

```typescript
const patternId = await engine.storePattern({
  name: 'Content-Hash Caching',
  category: 'Performance',
  problem: 'Avoid redundant API calls for identical content',
  solution: 'Hash content and cache results by hash',
  example_code: `
    const hash = createHash('sha256').update(content).digest('hex');
    const cached = await cache.get(hash);
    if (cached) return cached;
    const result = await expensiveOperation(content);
    await cache.set(hash, result);
    return result;
  `,
  applicability: 'When processing identical content multiple times',
  success_count: 0,
  failure_count: 0,
});

// Update pattern outcome
await engine.updatePatternOutcome(patternId, {
  success: true,
  context: 'Applied to embedding cache',
  notes: 'Reduced API calls by 80%',
});
```

### Using Transactions

```typescript
const result = engine.transaction(() => {
  // Multiple operations execute atomically
  // If any operation fails, all are rolled back
  return 'Transaction completed';
});
```

### Cleanup

```typescript
// Close database connection when done
engine.close();
```

## Database Schema

### Codebase Memory Tables

- **code_files**: File metadata (path, repo, hash, language, size)
- **code_chunks**: Code chunks for semantic search
- **code_chunks_fts**: Full-text search index (FTS5)
- **code_chunks_vec**: Vector embeddings (sqlite-vec)

### Decision Memory Tables

- **decisions**: Decision records with context, reasoning, outcomes

### Metric Memory Tables

- **metrics**: Time-series metrics with context

### Pattern Memory Tables

- **patterns**: Architectural patterns with success/failure tracking

### Shared Tables

- **embedding_cache**: Content-hash based embedding cache
- **migrations**: Database migration tracking

## Testing

Run the test suite:

```bash
npm test -- engine.test.ts
```

Run the example:

```bash
npx tsx src/memory/examples/basic-usage.ts
```

## Implementation Status

### ✅ Completed (Task 3.1)
- MemoryEngine interface definition
- Base class implementation
- Database connection management
- Transaction support
- Decision memory operations (store, update)
- Metric memory operations (store)
- Pattern memory operations (store, update outcome)
- File metadata retrieval

### 🚧 Pending (Future Tasks)
- Code indexing (Task 5)
- Hybrid search (Task 8)
- Decision search (Task 9)
- Metric queries and aggregations (Task 10)
- Pattern search (Task 11)
- Unified search across sources (Task 8)

## Requirements Mapping

This module implements the following requirements:

- **1.1**: Index source code files with semantic embeddings
- **1.2**: Extract metadata (file path, language, symbols, imports)
- **1.3**: Hybrid search (vector + keyword)
- **2.1**: Store decisions with context and reasoning
- **3.1**: Store metrics with timestamps and context
- **4.1**: Store patterns with examples and applicability
- **1.7**: SQLite with sqlite-vec extension

## Design Patterns

The Memory Engine follows these patterns from OpenClaw:

1. **Content-Hash Caching**: Reuse embeddings for identical content
2. **Delta Sync**: Update only changed files
3. **Atomic Swaps**: Zero-downtime index updates
4. **Transaction Support**: ACID guarantees for data consistency

## Contributing

When adding new features to the Memory Engine:

1. Update the interface in `engine.ts`
2. Implement the method in the `MemoryEngine` class
3. Add tests in `__tests__/engine.test.ts`
4. Update this README
5. Update the task list in `.kiro/specs/prometheus/tasks.md`

## License

Part of the Prometheus Meta-Agent System.
