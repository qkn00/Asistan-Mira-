-- Üretim motoru + YouTube entegrasyonu için yeni tablolar.
-- İdempotent: tekrar çalıştırılabilir, mevcut tablolara zarar vermez.
-- Kullanım: Railway → Postgres servisi → "Query"/"Data" sekmesine bu SQL'i yapıştır.

CREATE TABLE IF NOT EXISTS content_assets (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  meta JSONB,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Hızlı kontrol sorgusu (istediğinde sil): iki satırla tabloların var olduğunu doğrular
-- SELECT 'content_assets' AS t, COUNT(*) FROM content_assets
-- UNION ALL SELECT 'integrations', COUNT(*) FROM integrations;
