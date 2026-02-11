/**
 * Conversation File Management
 * 
 * Handles JSONL file storage for conversations following OpenClaw pattern:
 * - Write messages to JSONL files (primary storage)
 * - Read and parse JSONL conversation files
 * - Extract conversation text for indexing
 * - Monitor file changes for automatic indexing
 * 
 * Pattern: JSONL files → File watcher → Memory system → SQLite index
 */

import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Conversation file entry for indexing
 */
export interface ConversationFileEntry {
  path: string;           // Relative path (e.g., "conversations/conv_123.jsonl")
  absPath: string;        // Absolute file path
  mtimeMs: number;        // Last modified timestamp
  size: number;           // File size in bytes
  hash: string;           // Content hash for change detection
  content: string;        // Extracted text content for indexing
}

/**
 * JSONL message format
 */
export interface JSONLMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Get the conversations directory path
 */
export function getConversationsDir(dataPath: string): string {
  const conversationsDir = path.join(path.dirname(dataPath), 'conversations');
  
  // Ensure directory exists
  if (!existsSync(conversationsDir)) {
    mkdirSync(conversationsDir, { recursive: true });
  }
  
  return conversationsDir;
}

/**
 * Get the JSONL file path for a conversation
 */
export function getConversationFilePath(dataPath: string, conversationId: string): string {
  const conversationsDir = getConversationsDir(dataPath);
  return path.join(conversationsDir, `${conversationId}.jsonl`);
}

/**
 * Append a message to a conversation JSONL file
 * 
 * This is the primary storage method - messages are written to JSONL first,
 * then indexed into SQLite by the memory system.
 * 
 * @param dataPath Database path (used to locate conversations directory)
 * @param conversationId Conversation ID
 * @param message Message to append
 */
export async function appendMessageToFile(
  dataPath: string,
  conversationId: string,
  message: JSONLMessage
): Promise<void> {
  const filePath = getConversationFilePath(dataPath, conversationId);
  
  // Ensure conversations directory exists
  const conversationsDir = path.dirname(filePath);
  if (!existsSync(conversationsDir)) {
    mkdirSync(conversationsDir, { recursive: true });
  }
  
  // Append message as JSONL line
  const line = JSON.stringify(message) + '\n';
  await fs.appendFile(filePath, line, 'utf-8');
}

/**
 * List all conversation JSONL files
 * 
 * @param dataPath Database path
 * @returns Array of absolute file paths
 */
export async function listConversationFiles(dataPath: string): Promise<string[]> {
  const conversationsDir = getConversationsDir(dataPath);
  
  try {
    const entries = await fs.readdir(conversationsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.endsWith('.jsonl'))
      .map((entry) => path.join(conversationsDir, entry.name));
  } catch {
    return [];
  }
}

/**
 * Get relative path for a conversation file
 * 
 * @param absPath Absolute file path
 * @returns Relative path (e.g., "conversations/conv_123.jsonl")
 */
export function conversationPathForFile(absPath: string): string {
  return path.join('conversations', path.basename(absPath)).replace(/\\/g, '/');
}

/**
 * Normalize message text for indexing
 * 
 * @param text Raw message text
 * @returns Normalized text
 */
function normalizeMessageText(text: string): string {
  return text
    .replace(/\s*\n+\s*/g, ' ')  // Replace newlines with spaces
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .trim();
}

/**
 * Extract text content from a message
 * 
 * Handles both string content and structured content blocks.
 * 
 * @param content Message content (string or array of blocks)
 * @returns Extracted text or null
 */
export function extractMessageText(content: unknown): string | null {
  // Simple string content
  if (typeof content === 'string') {
    const normalized = normalizeMessageText(content);
    return normalized || null;
  }
  
  // Structured content blocks (e.g., [{ type: 'text', text: '...' }])
  if (!Array.isArray(content)) {
    return null;
  }
  
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    
    const record = block as { type?: unknown; text?: unknown };
    if (record.type !== 'text' || typeof record.text !== 'string') {
      continue;
    }
    
    const normalized = normalizeMessageText(record.text);
    if (normalized) {
      parts.push(normalized);
    }
  }
  
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Hash text content for change detection
 * 
 * @param text Text to hash
 * @returns SHA-256 hash
 */
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Build a conversation file entry for indexing
 * 
 * Reads a JSONL conversation file and extracts:
 * - File metadata (path, size, mtime)
 * - Message content for indexing
 * - Content hash for change detection
 * 
 * @param absPath Absolute file path
 * @returns Conversation file entry or null if invalid
 */
export async function buildConversationEntry(absPath: string): Promise<ConversationFileEntry | null> {
  try {
    // Get file stats
    const stat = await fs.stat(absPath);
    
    // Read file content
    const raw = await fs.readFile(absPath, 'utf-8');
    const lines = raw.split('\n');
    
    // Parse JSONL messages
    const collected: string[] = [];
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        continue; // Skip invalid JSON lines
      }
      
      // Validate message structure
      if (!message || typeof message !== 'object') {
        continue;
      }
      
      const msg = message as JSONLMessage;
      if (!msg.role || !msg.content) {
        continue;
      }
      
      // Only index user and assistant messages
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        continue;
      }
      
      // Extract text content
      const text = extractMessageText(msg.content);
      if (!text) {
        continue;
      }
      
      // Format for indexing
      const label = msg.role === 'user' ? 'User' : 'Assistant';
      collected.push(`${label}: ${text}`);
    }
    
    // Build entry
    const content = collected.join('\n');
    
    return {
      path: conversationPathForFile(absPath),
      absPath,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      hash: hashText(content),
      content,
    };
  } catch (err) {
    console.error(`Failed reading conversation file ${absPath}:`, err);
    return null;
  }
}

/**
 * Read all messages from a conversation file
 * 
 * @param absPath Absolute file path
 * @returns Array of messages
 */
export async function readConversationFile(absPath: string): Promise<JSONLMessage[]> {
  try {
    const raw = await fs.readFile(absPath, 'utf-8');
    const lines = raw.split('\n');
    
    const messages: JSONLMessage[] = [];
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      
      try {
        const message = JSON.parse(line) as JSONLMessage;
        messages.push(message);
      } catch {
        continue; // Skip invalid lines
      }
    }
    
    return messages;
  } catch {
    return [];
  }
}

/**
 * Delete a conversation file
 * 
 * @param dataPath Database path
 * @param conversationId Conversation ID
 */
export async function deleteConversationFile(
  dataPath: string,
  conversationId: string
): Promise<void> {
  const filePath = getConversationFilePath(dataPath, conversationId);
  
  try {
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist or already deleted
  }
}
