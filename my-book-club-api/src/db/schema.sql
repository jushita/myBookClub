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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT books_isbn_10_unique UNIQUE NULLS NOT DISTINCT (isbn_10),
  CONSTRAINT books_isbn_13_unique UNIQUE NULLS NOT DISTINCT (isbn_13)
);

CREATE INDEX IF NOT EXISTS books_title_idx ON books (title);
CREATE INDEX IF NOT EXISTS books_author_idx ON books (author);
CREATE INDEX IF NOT EXISTS books_genre_idx ON books (genre);

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
