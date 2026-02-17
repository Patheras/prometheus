-- Migration: Hermes - Gemini Tabs
-- Description: Create tables for Gemini tab management
-- Date: 2026-02-17

-- Gemini Tabs table
CREATE TABLE IF NOT EXISTS gemini_tabs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  context_estimate INTEGER DEFAULT 0,
  gem_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'idle', 'error')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for gemini_tabs
CREATE INDEX IF NOT EXISTS idx_gemini_tabs_category ON gemini_tabs(category);
CREATE INDEX IF NOT EXISTS idx_gemini_tabs_last_used ON gemini_tabs(last_used);
CREATE INDEX IF NOT EXISTS idx_gemini_tabs_status ON gemini_tabs(status);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS update_gemini_tabs_timestamp 
AFTER UPDATE ON gemini_tabs
BEGIN
  UPDATE gemini_tabs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
