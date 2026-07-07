export const DB_NAME = 'knowledge_mesh.db';

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- Categories for knowledge classification
CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#4A90D9',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core knowledge items
CREATE TABLE IF NOT EXISTS knowledge_items (
  id                    TEXT PRIMARY KEY NOT NULL,
  category_id           TEXT NOT NULL,
  title                 TEXT NOT NULL,
  content               TEXT NOT NULL,
  content_preview       TEXT NOT NULL,
  source_url            TEXT,
  source_type           TEXT NOT NULL DEFAULT 'text',
  tags_json             TEXT NOT NULL DEFAULT '[]',
  embedding_pq_json     TEXT,
  ai_summary            TEXT,
  ai_classification_score REAL,
  ai_verification_json  TEXT,
  status                TEXT NOT NULL DEFAULT 'draft',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_items(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_items(created_at);

-- Expression training records
CREATE TABLE IF NOT EXISTS training_records (
  id                TEXT PRIMARY KEY NOT NULL,
  knowledge_item_id TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'pending_retell',
  current_score     REAL,
  best_score        REAL,
  priority          REAL NOT NULL DEFAULT 0.0,
  next_review_at    TEXT NOT NULL,
  attempts_json     TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id)
);

CREATE INDEX IF NOT EXISTS idx_training_state ON training_records(state);
CREATE INDEX IF NOT EXISTS idx_training_priority ON training_records(priority DESC);
CREATE INDEX IF NOT EXISTS idx_training_next_review ON training_records(next_review_at);
CREATE INDEX IF NOT EXISTS idx_training_item ON training_records(knowledge_item_id);

-- Input drafts
CREATE TABLE IF NOT EXISTS input_drafts (
  id                    TEXT PRIMARY KEY NOT NULL,
  input_type            TEXT NOT NULL,
  raw_input             TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'parsing',
  parse_result_json     TEXT,
  confirmed_item_id     TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_draft_status ON input_drafts(status);
CREATE INDEX IF NOT EXISTS idx_draft_created ON input_drafts(created_at);

-- Cached graph edges
CREATE TABLE IF NOT EXISTS graph_edges (
  source_id    TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  strength     REAL NOT NULL DEFAULT 0.0,
  PRIMARY KEY (source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edge_target ON graph_edges(target_id);

-- App settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('daily_reminder_enabled', 'false'),
  ('daily_reminder_time', '09:00'),
  ('pass_threshold', '90');

-- Default categories
INSERT OR IGNORE INTO categories (id, name, color, sort_order) VALUES
  ('cat_tech', '科技', '#4A90D9', 0),
  ('cat_history', '历史', '#FF9500', 1),
  ('cat_philosophy', '哲学', '#AF52DE', 2),
  ('cat_science', '科学', '#34C759', 3),
  ('cat_literature', '文学', '#FF2D55', 4),
  ('cat_business', '商业', '#5856D6', 5),
  ('cat_other', '其他', '#6B7280', 99);
`;
