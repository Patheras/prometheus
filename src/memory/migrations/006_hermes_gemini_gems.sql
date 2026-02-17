-- Migration: Hermes - Gemini Gems
-- Description: Create tables for Gemini Gems (persistent memory)
-- Date: 2026-02-17

-- Gemini Gems table
CREATE TABLE IF NOT EXISTS gemini_gems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  knowledge TEXT,  -- JSON array of persistent facts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gem-Tab associations table
CREATE TABLE IF NOT EXISTS gem_tab_associations (
  gem_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gem_id, tab_id),
  FOREIGN KEY (gem_id) REFERENCES gemini_gems(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES gemini_tabs(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gemini_gems_name ON gemini_gems(name);
CREATE INDEX IF NOT EXISTS idx_gem_tab_associations_gem_id ON gem_tab_associations(gem_id);
CREATE INDEX IF NOT EXISTS idx_gem_tab_associations_tab_id ON gem_tab_associations(tab_id);
