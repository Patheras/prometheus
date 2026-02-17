-- Migration 004: Gemini Tabs for Hermes
-- Creates tables for managing Gemini conversation tabs

-- Gemini tabs table
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

-- Conversation history (for context estimation)
CREATE TABLE IF NOT EXISTS gemini_messages (
  id TEXT PRIMARY KEY,
  tab_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'model')),
  content TEXT NOT NULL,
  tokens_estimate INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tab_id) REFERENCES gemini_tabs(id) ON DELETE CASCADE
);

-- Gemini Gems (persistent memory)
CREATE TABLE IF NOT EXISTS gemini_gems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  knowledge TEXT,  -- JSON array of persistent facts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gem-Tab associations
CREATE TABLE IF NOT EXISTS gem_tab_associations (
  gem_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gem_id, tab_id),
  FOREIGN KEY (gem_id) REFERENCES gemini_gems(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES gemini_tabs(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gemini_tabs_category ON gemini_tabs(category);
CREATE INDEX IF NOT EXISTS idx_gemini_tabs_last_used ON gemini_tabs(last_used);
CREATE INDEX IF NOT EXISTS idx_gemini_tabs_status ON gemini_tabs(status);

CREATE INDEX IF NOT EXISTS idx_gemini_messages_tab_id ON gemini_messages(tab_id);
CREATE INDEX IF NOT EXISTS idx_gemini_messages_timestamp ON gemini_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_gemini_messages_role ON gemini_messages(role);

CREATE INDEX IF NOT EXISTS idx_gemini_gems_name ON gemini_gems(name);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_gemini_tabs_timestamp
AFTER UPDATE ON gemini_tabs
FOR EACH ROW
BEGIN
  UPDATE gemini_tabs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default categories (20 tabs)
INSERT OR IGNORE INTO gemini_tabs (id, category, url, status) VALUES
  ('tab-coding', 'Coding', '', 'idle'),
  ('tab-design', 'Design', '', 'idle'),
  ('tab-social-media', 'Social Media', '', 'idle'),
  ('tab-content-creation', 'Content Creation', '', 'idle'),
  ('tab-research', 'Research', '', 'idle'),
  ('tab-seo', 'SEO', '', 'idle'),
  ('tab-video-generation', 'Video Generation', '', 'idle'),
  ('tab-image-generation', 'Image Generation', '', 'idle'),
  ('tab-data-analysis', 'Data Analysis', '', 'idle'),
  ('tab-marketing', 'Marketing', '', 'idle'),
  ('tab-documentation', 'Documentation', '', 'idle'),
  ('tab-testing', 'Testing', '', 'idle'),
  ('tab-devops', 'DevOps', '', 'idle'),
  ('tab-security', 'Security', '', 'idle'),
  ('tab-performance', 'Performance', '', 'idle'),
  ('tab-architecture', 'Architecture', '', 'idle'),
  ('tab-ui-ux', 'UI/UX', '', 'idle'),
  ('tab-api-design', 'API Design', '', 'idle'),
  ('tab-database', 'Database', '', 'idle'),
  ('tab-general', 'General', '', 'idle');
