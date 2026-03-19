CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  provider TEXT NOT NULL,
  provider_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  vibe TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clubs_created_by_user_id_idx ON clubs (created_by_user_id);
CREATE INDEX IF NOT EXISTS clubs_name_idx ON clubs (name);

CREATE TABLE IF NOT EXISTS club_members (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_members_role_check CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT club_members_club_user_unique UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS club_members_club_id_idx ON club_members (club_id);
CREATE INDEX IF NOT EXISTS club_members_user_id_idx ON club_members (user_id);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  source TEXT NOT NULL DEFAULT 'local',
  work_key TEXT,
  author_keys TEXT[] NOT NULL DEFAULT '{}',
  subjects TEXT[] NOT NULL DEFAULT '{}',
  language TEXT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  isbn_10 TEXT,
  isbn_13 TEXT,
  cover_image_url TEXT,
  published_at TIMESTAMPTZ,
  page_count INTEGER,
  embedding DOUBLE PRECISION[],
  embedding_model TEXT,
  popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE books ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local';
ALTER TABLE books ADD COLUMN IF NOT EXISTS work_key TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS author_keys TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE books ADD COLUMN IF NOT EXISTS subjects TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE books ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE books DROP CONSTRAINT IF EXISTS books_isbn_10_unique;
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_isbn_13_unique;

CREATE INDEX IF NOT EXISTS books_title_idx ON books (title);
CREATE INDEX IF NOT EXISTS books_author_idx ON books (author);
CREATE INDEX IF NOT EXISTS books_genre_idx ON books (genre);
CREATE INDEX IF NOT EXISTS books_source_idx ON books (source);
CREATE INDEX IF NOT EXISTS books_work_key_idx ON books (work_key);
CREATE UNIQUE INDEX IF NOT EXISTS books_isbn_10_unique_idx ON books (isbn_10) WHERE isbn_10 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS books_isbn_13_unique_idx ON books (isbn_13) WHERE isbn_13 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS books_external_id_unique_idx ON books (external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS books_work_key_unique_idx ON books (work_key) WHERE work_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS books_subjects_gin_idx ON books USING GIN (subjects);
DROP INDEX IF EXISTS books_search_text_idx;

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pgvector extension is not installed; semantic vector column will be skipped for now.';
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'books' AND column_name = 'embedding_vector'
    ) THEN
      EXECUTE 'ALTER TABLE books ADD COLUMN embedding_vector vector(1024)';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE tablename = 'books' AND indexname = 'books_embedding_vector_idx'
    ) THEN
      EXECUTE 'CREATE INDEX books_embedding_vector_idx ON books USING hnsw (embedding_vector vector_cosine_ops)';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS club_books (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'saved',
  notes TEXT NOT NULL DEFAULT '',
  rating NUMERIC(2, 1),
  is_current_read BOOLEAN NOT NULL DEFAULT FALSE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_books_status_check CHECK (status IN ('saved', 'shortlisted', 'current', 'finished', 'removed')),
  CONSTRAINT club_books_rating_check CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT club_books_club_user_book_unique UNIQUE (club_id, user_id, book_id)
);

CREATE INDEX IF NOT EXISTS club_books_club_id_idx ON club_books (club_id);
CREATE INDEX IF NOT EXISTS club_books_user_id_idx ON club_books (user_id);
CREATE INDEX IF NOT EXISTS club_books_book_id_idx ON club_books (book_id);
CREATE INDEX IF NOT EXISTS club_books_club_user_idx ON club_books (club_id, user_id);

CREATE TABLE IF NOT EXISTS club_discussion_questions (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  questions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_discussion_questions_club_book_unique UNIQUE (club_id, book_id)
);

CREATE INDEX IF NOT EXISTS club_discussion_questions_club_id_idx ON club_discussion_questions (club_id);
CREATE INDEX IF NOT EXISTS club_discussion_questions_book_id_idx ON club_discussion_questions (book_id);

CREATE TABLE IF NOT EXISTS club_insights (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  shelf_fingerprint TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  signals TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'fallback',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_insights_club_id_unique UNIQUE (club_id)
);

CREATE INDEX IF NOT EXISTS club_insights_club_id_idx ON club_insights (club_id);

CREATE TABLE IF NOT EXISTS recommendation_cache (
  id TEXT PRIMARY KEY,
  prompt_key TEXT NOT NULL UNIQUE,
  normalized_prompt TEXT NOT NULL,
  result_limit INTEGER NOT NULL,
  search_plan JSONB NOT NULL,
  books JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recommendation_cache_prompt_key_idx ON recommendation_cache (prompt_key);
