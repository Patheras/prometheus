/**
 * Conversation Search
 * 
 * Implements hybrid search (vector + FTS5) for conversations following OpenClaw pattern.
 * 
 * Features:
 * - FTS5 keyword search for exact matches
 * - Vector similarity search for semantic matches (future)
 * - Weighted result merging
 * - Conversation context retrieval
 */

import { PrometheusDatabase } from './database';
import { SearchOptions, SearchResult } from './types';

/**
 * Search conversations using FTS5 keyword search
 * 
 * @param db Database connection
 * @param query Search query
 * @param options Search options
 * @returns Array of search results
 */
export async function searchConversationsKeyword(
  db: PrometheusDatabase,
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const dbInstance = db.getDb();
  const limit = options?.limit || 50;
  const minScore = options?.minScore || 0.0;
  
  // Build FTS5 query
  const ftsQuery = buildFTS5Query(query);
  
  // Search using FTS5
  const results = dbInstance
    .prepare(`
      SELECT 
        cm.id,
        cm.conversation_id,
        cm.role,
        cm.content,
        cm.timestamp,
        c.title,
        fts.rank as score
      FROM conversation_chunks_fts fts
      JOIN conversation_chunks cc ON fts.id = cc.id
      JOIN conversation_messages cm ON cc.conversation_id = cm.conversation_id
      JOIN conversations c ON cm.conversation_id = c.id
      WHERE fts.text MATCH ?
      ORDER BY fts.rank DESC
      LIMIT ?
    `)
    .all(ftsQuery, limit) as Array<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      timestamp: number;
      title: string | null;
      score: number;
    }>;
  
  // Convert to SearchResult format
  return results
    .filter((r) => Math.abs(r.score) >= minScore)
    .map((r) => ({
      id: r.id,
      source: 'conversations' as const,
      score: Math.abs(r.score), // FTS5 rank is negative
      content: r.content,
      metadata: {
        conversation_id: r.conversation_id,
        role: r.role,
        timestamp: r.timestamp,
        title: r.title,
      },
    }));
}

/**
 * Build FTS5 query from user query
 * 
 * Handles:
 * - Phrase queries ("exact match")
 * - Boolean operators (AND, OR, NOT)
 * - Wildcards (prefix*)
 * 
 * @param query User query
 * @returns FTS5 query string
 */
function buildFTS5Query(query: string): string {
  // If query is already quoted, use as-is
  if (query.startsWith('"') && query.endsWith('"')) {
    return query;
  }
  
  // Split into words and join with OR for broad matching
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => {
      // Escape special FTS5 characters
      const escaped = w.replace(/[:"*]/g, '');
      // Add prefix wildcard for partial matching
      return `${escaped}*`;
    });
  
  return words.join(' OR ');
}

/**
 * Get conversation context for a message
 * 
 * Returns surrounding messages for context.
 * 
 * @param db Database connection
 * @param conversationId Conversation ID
 * @param messageTimestamp Message timestamp
 * @param contextSize Number of messages before/after (default: 2)
 * @returns Array of context messages
 */
export async function getConversationContext(
  db: PrometheusDatabase,
  conversationId: string,
  messageTimestamp: number,
  contextSize: number = 2
): Promise<Array<{
  id: string;
  role: string;
  content: string;
  timestamp: number;
}>> {
  const dbInstance = db.getDb();
  
  // Get messages before and after the target message
  const results = dbInstance
    .prepare(`
      SELECT id, role, content, timestamp
      FROM conversation_messages
      WHERE conversation_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp ASC
    `)
    .all(
      conversationId,
      messageTimestamp - contextSize * 60000, // Assume ~1 min per message
      messageTimestamp + contextSize * 60000
    ) as Array<{
      id: string;
      role: string;
      content: string;
      timestamp: number;
    }>;
  
  return results;
}

/**
 * Search conversations with context
 * 
 * Returns search results with surrounding message context.
 * 
 * @param db Database connection
 * @param query Search query
 * @param options Search options
 * @returns Array of search results with context
 */
export async function searchConversationsWithContext(
  db: PrometheusDatabase,
  query: string,
  options?: SearchOptions & { contextSize?: number }
): Promise<Array<SearchResult & { context: Array<{ role: string; content: string }> }>> {
  // Get base search results
  const results = await searchConversationsKeyword(db, query, options);
  
  // Add context to each result
  const resultsWithContext = await Promise.all(
    results.map(async (result) => {
      const context = await getConversationContext(
        db,
        result.metadata.conversation_id as string,
        result.metadata.timestamp as number,
        options?.contextSize || 2
      );
      
      return {
        ...result,
        context: context.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };
    })
  );
  
  return resultsWithContext;
}

/**
 * Index conversation messages into chunks for FTS5 search
 * 
 * This should be called after indexing conversations from JSONL files.
 * 
 * @param db Database connection
 * @param conversationId Conversation ID
 */
export async function indexConversationForSearch(
  db: PrometheusDatabase,
  conversationId: string
): Promise<void> {
  const dbInstance = db.getDb();
  
  // Get all messages for this conversation
  const messages = dbInstance
    .prepare(`
      SELECT id, role, content, timestamp
      FROM conversation_messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `)
    .all(conversationId) as Array<{
      id: string;
      role: string;
      content: string;
      timestamp: number;
    }>;
  
  if (messages.length === 0) {
    return;
  }
  
  db.transaction(() => {
    // Delete existing chunks for this conversation
    dbInstance
      .prepare('DELETE FROM conversation_chunks WHERE conversation_id = ?')
      .run(conversationId);
    
    // Create chunks (one per message for now)
    const insertChunk = dbInstance.prepare(`
      INSERT INTO conversation_chunks (id, conversation_id, message_index, text, hash)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertFTS = dbInstance.prepare(`
      INSERT INTO conversation_chunks_fts (id, conversation_id, text)
      VALUES (?, ?, ?)
    `);
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!;
      const chunkId = `chunk_${conversationId}_${i}`;
      const text = `${message.role}: ${message.content}`;
      const hash = require('crypto')
        .createHash('sha256')
        .update(text)
        .digest('hex');
      
      // Insert into chunks table
      insertChunk.run(chunkId, conversationId, i, text, hash);
      
      // Insert into FTS5 table
      insertFTS.run(chunkId, conversationId, text);
    }
  });
}

/**
 * Re-index all conversations for search
 * 
 * @param db Database connection
 */
export async function reindexAllConversationsForSearch(
  db: PrometheusDatabase
): Promise<void> {
  const dbInstance = db.getDb();
  
  // Get all conversation IDs
  const conversations = dbInstance
    .prepare('SELECT id FROM conversations')
    .all() as Array<{ id: string }>;
  
  console.log(`Re-indexing ${conversations.length} conversations for search`);
  
  for (const conv of conversations) {
    await indexConversationForSearch(db, conv.id);
  }
  
  console.log('Re-indexing complete');
}
