-- Mira initial + Phase 3/4 persistence. Safe to run against an existing database.

CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  role text NOT NULL,
  content text NOT NULL,
  emotion text NOT NULL DEFAULT 'happy',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY,
  user_name text NOT NULL DEFAULT 'Gökhan',
  outfit text NOT NULL DEFAULT 'sweater',
  voice_rate real NOT NULL DEFAULT 1,
  voice_pitch real NOT NULL DEFAULT 1.15,
  persona text NOT NULL DEFAULT 'flirty',
  glamour boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS custom_outfits (
  id serial PRIMARY KEY,
  label text NOT NULL,
  mime text NOT NULL,
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations (
  id serial PRIMARY KEY,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  summary text NOT NULL,
  platform text,
  external_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  due_at timestamptz,
  recurrence text,
  source text DEFAULT 'mira',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_items (
  id serial PRIMARY KEY,
  title text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  topic text,
  external_id text,
  url text,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trends (
  id serial PRIMARY KEY,
  topic text NOT NULL,
  platform text,
  source_url text,
  score real,
  status text NOT NULL DEFAULT 'new',
  notes text,
  found_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memories (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  importance integer NOT NULL DEFAULT 3,
  source text DEFAULT 'mira',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
