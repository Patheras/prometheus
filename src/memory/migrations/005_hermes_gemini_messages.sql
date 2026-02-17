-- Migration: Hermes - Gemini Messages
-- Description: Create table for Gemini conversation messages
-- Date: 2026-02-17

-- Gemini Messages table
CREATE TABLE IF NOT EXISTS gemini_messages (
  id TEXT PRIMARY KEY,
  tab_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'model')),
  content TEXT NOT NULL,
  tokens_estimate INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tab_id) REFERENCES gemini_tabs(id) ON DELETE CASCADE
);

-- Indexes for gemini_messages
CREATE INDEX IF NOT EXISTS idx_gemini_messages_tab_id ON gemini_messages(tab_id);
CREATE INDEX IF NOT EXISTS idx_gemini_messages_timestamp ON gemini_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_gemini_messages_role ON gemini_messages(role);
