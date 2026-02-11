/**
 * Memory Engine Module
 * 
 * This module provides the database layer for Prometheus Memory Engine,
 * including schema initialization, migrations, and connection management.
 * 
 * Requirements: 1.7, 2.1, 3.1, 4.1
 */

export {
  PrometheusDatabase,
  initializeDatabase,
  getSchemaVersion,
  validateSchema,
} from './database';

export {
  MigrationManager,
  createMigration,
  getAllMigrations,
} from './migrations';

export type { IMemoryEngine } from './engine';
export {
  MemoryEngine,
  createMemoryEngine,
} from './engine';

export {
  EmbeddingCache,
  createEmbeddingCache,
} from './embedding-cache';

export type {
  EmbeddingCacheConfig,
  CacheStats,
} from './embedding-cache';

export * from './types';

export {
  scanDirectory,
  extractFileMetadata,
  extractSymbolsAndImports,
} from './file-scanner';

export type {
  ScanOptions,
  ScanResult,
  SymbolInfo,
  ImportInfo,
} from './file-scanner';

export {
  createCodeChunks,
  estimateTokens,
  estimateTokensForLines,
  validateChunkOverlap,
  getChunkStats,
} from './chunker';

export type {
  ChunkConfig,
} from './chunker';

export {
  appendMessageToFile,
  listConversationFiles,
  buildConversationEntry,
  readConversationFile,
  deleteConversationFile,
  getConversationsDir,
  getConversationFilePath,
  extractMessageText,
  conversationPathForFile,
} from './conversation-files';

export type {
  ConversationFileEntry,
  JSONLMessage,
} from './conversation-files';

export {
  indexConversationFiles,
  reindexConversation,
  getConversationIndexStatus,
} from './conversation-indexer';

export type {
  ConversationIndexStats,
} from './conversation-indexer';

export {
  ConversationWatcher,
  createConversationWatcher,
} from './conversation-watcher';

export type {
  ConversationWatcherConfig,
} from './conversation-watcher';

export {
  searchConversationsKeyword,
  searchConversationsWithContext,
  getConversationContext,
  indexConversationForSearch,
  reindexAllConversationsForSearch,
} from './conversation-search';
