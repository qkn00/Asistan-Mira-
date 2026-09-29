-- Mira Phase 3/4 schema alignment for existing databases.
-- Safe to run more than once.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS sol_mode text NOT NULL DEFAULT 'close';
CREATE UNIQUE INDEX IF NOT EXISTS memories_key_unique ON memories (key);
