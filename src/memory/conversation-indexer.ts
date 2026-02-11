/**
 * Conversation Indexer
 * 
 * Indexes conversation JSONL files into SQLite following OpenClaw pattern:
 * - Scans conversation directory for JSONL files
 * - Reads and parses messages
 * - Indexes into SQLite with chunking
 * - Tracks file changes with hash-based detection
 * 
 * This enables:
 * - Automatic re-indexing when files change
 * - Hybrid search (vector + FTS5) over conversations
 * - Efficient retrieval of conversation context
 */

import { PrometheusDatabase } from './database';
import {
  listConversationFiles,
  buildConversationEntry,
  readConversationFile,
  type ConversationFileEntry,
  type JSONLMessage,
} from './conversation-files';
import { indexConversationForSearch } from './conversation-search';

/**
 * Conversation indexing statistics
 */
export interface ConversationIndexStats {
  totalFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  totalMessages: number;
}

/**
 * Index all conversation files into SQLite
 * 
 * This function:
 * 1. Lists all JSONL files in conversations directory
 * 2. Checks which files need indexing (new or modified)
 * 3. Reads and parses messages from JSONL files
 * 4. Inserts conversations and messages into SQLite
 * 
 * @param db Database connection
 * @param dataPath Database file path
 * @param force Force re-index all files (ignore hash check)
 * @returns Indexing statistics
 */
export async function indexConversationFiles(
  db: PrometheusDatabase,
  dataPath: string,
  force: boolean = false
): Promise<ConversationIndexStats> {
  const stats: ConversationIndexStats = {
    totalFiles: 0,
    indexedFiles: 0,
    skippedFiles: 0,
    errorFiles: 0,
    totalMessages: 0,
  };
  
  // List all conversation JSONL files
  const files = await listConversationFiles(dataPath);
  stats.totalFiles = files.length;
  
  if (files.length === 0) {
    return stats;
  }
  
  const dbInstance = db.getDb();
  
  // Create a tracking table for indexed files
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS conversation_files (
      path TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      mtime_ms REAL NOT NULL,
      size INTEGER NOT NULL,
      indexed_at INTEGER NOT NULL
    );
  `);
  
  // Process each file
  for (const absPath of files) {
    try {
      // Build file entry
      const entry = await buildConversationEntry(absPath);
      if (!entry) {
        stats.errorFiles++;
        continue;
      }
      
      // Check if file needs indexing
      if (!force) {
        const existing = dbInstance
          .prepare('SELECT hash FROM conversation_files WHERE path = ?')
          .get(entry.path) as { hash: string } | undefined;
        
        if (existing && existing.hash === entry.hash) {
          // File hasn't changed, skip
          stats.skippedFiles++;
          continue;
        }
      }
      
      // Read messages from file
      const messages = await readConversationFile(absPath);
      if (messages.length === 0) {
        stats.skippedFiles++;
        continue;
      }
      
      // Extract conversation ID from filename
      const conversationId = absPath
        .split(/[/\\]/)
        .pop()!
        .replace('.jsonl', '');
      
      // Index conversation and messages
      await indexConversation(db, conversationId, messages, entry);
      
      // Index for search (FTS5)
      await indexConversationForSearch(db, conversationId);
      
      stats.indexedFiles++;
      stats.totalMessages += messages.length;
      
    } catch (error) {
      console.error(`Error indexing conversation file ${absPath}:`, error);
      stats.errorFiles++;
    }
  }
  
  return stats;
}

/**
 * Index a single conversation into SQLite
 * 
 * @param db Database connection
 * @param conversationId Conversation ID
 * @param messages Array of messages
 * @param fileEntry File entry metadata
 */
async function indexConversation(
  db: PrometheusDatabase,
  conversationId: string,
  messages: JSONLMessage[],
  fileEntry: ConversationFileEntry
): Promise<void> {
  const dbInstance = db.getDb();
  
  db.transaction(() => {
    // 1. Ensure conversation exists
    const existing = dbInstance
      .prepare('SELECT id FROM conversations WHERE id = ?')
      .get(conversationId);
    
    if (!existing) {
      // Create conversation
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];
      
      dbInstance
        .prepare(`
          INSERT INTO conversations (id, title, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(
          conversationId,
          null, // Title can be set later
          firstMessage?.timestamp || Date.now(),
          lastMessage?.timestamp || Date.now()
        );
    }
    
    // 2. Delete existing messages for this conversation
    dbInstance
      .prepare('DELETE FROM conversation_messages WHERE conversation_id = ?')
      .run(conversationId);
    
    // 3. Insert messages
    const insertStmt = dbInstance.prepare(`
      INSERT INTO conversation_messages (id, conversation_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!;
      const messageId = `msg_${conversationId}_${i}`;
      
      insertStmt.run(
        messageId,
        conversationId,
        message.role,
        message.content,
        message.timestamp,
        message.metadata ? JSON.stringify(message.metadata) : null
      );
    }
    
    // 4. Update file tracking
    dbInstance
      .prepare(`
        INSERT OR REPLACE INTO conversation_files (path, hash, mtime_ms, size, indexed_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        fileEntry.path,
        fileEntry.hash,
        fileEntry.mtimeMs,
        fileEntry.size,
        Date.now()
      );
  });
}

/**
 * Re-index a specific conversation file
 * 
 * Useful for incremental updates when a file changes.
 * 
 * @param db Database connection
 * @param dataPath Database file path
 * @param conversationId Conversation ID
 * @returns True if indexed successfully
 */
export async function reindexConversation(
  db: PrometheusDatabase,
  dataPath: string,
  conversationId: string
): Promise<boolean> {
  try {
    const { getConversationFilePath } = await import('./conversation-files');
    const absPath = getConversationFilePath(dataPath, conversationId);
    
    const entry = await buildConversationEntry(absPath);
    if (!entry) {
      return false;
    }
    
    const messages = await readConversationFile(absPath);
    if (messages.length === 0) {
      return false;
    }
    
    await indexConversation(db, conversationId, messages, entry);
    
    // Index for search (FTS5)
    await indexConversationForSearch(db, conversationId);
    
    return true;
    
  } catch (error) {
    console.error(`Error re-indexing conversation ${conversationId}:`, error);
    return false;
  }
}

/**
 * Get indexing status for all conversation files
 * 
 * @param db Database connection
 * @returns Array of file tracking records
 */
export function getConversationIndexStatus(db: PrometheusDatabase): Array<{
  path: string;
  hash: string;
  mtimeMs: number;
  size: number;
  indexedAt: number;
}> {
  const dbInstance = db.getDb();
  
  return dbInstance
    .prepare('SELECT * FROM conversation_files ORDER BY indexed_at DESC')
    .all() as Array<{
      path: string;
      hash: string;
      mtime_ms: number;
      size: number;
      indexed_at: number;
    }>;
}
