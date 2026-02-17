/**
 * Migration: Add tool_calls and tool_results columns to conversation_messages
 * 
 * This migration adds support for storing function calling data in conversation messages.
 * Tool calls and results are stored as JSON arrays in TEXT columns.
 * 
 * Requirements: 4.1, 4.2
 */

import type { Database } from 'better-sqlite3';

export function up(db: Database): void {
  // Add tool_calls column for storing tool call requests from LLM
  db.exec(`
    ALTER TABLE conversation_messages 
    ADD COLUMN tool_calls TEXT;
  `);
  
  // Add tool_results column for storing tool execution results
  db.exec(`
    ALTER TABLE conversation_messages 
    ADD COLUMN tool_results TEXT;
  `);
  
  console.log('✅ Added tool_calls and tool_results columns to conversation_messages');
}

export function down(db: Database): void {
  // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
  db.exec(`
    -- Create temporary table without tool columns
    CREATE TABLE conversation_messages_backup (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    
    -- Copy data (excluding tool columns)
    INSERT INTO conversation_messages_backup 
    SELECT id, conversation_id, role, content, timestamp, metadata
    FROM conversation_messages;
    
    -- Drop original table
    DROP TABLE conversation_messages;
    
    -- Rename backup to original
    ALTER TABLE conversation_messages_backup RENAME TO conversation_messages;
    
    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON conversation_messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON conversation_messages(role);
  `);
  
  console.log('✅ Removed tool_calls and tool_results columns from conversation_messages');
}
