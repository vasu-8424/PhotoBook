-- ====================================================================
-- Part 9 — Production Orchestration & Book Generation Workflow Schema
-- ====================================================================

-- 1. Books Table
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  occasion TEXT NOT NULL,
  style TEXT NOT NULL,
  size TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  photo_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own books"
  ON books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books"
  ON books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
  ON books FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
  ON books FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Jobs Table (Orchestration & Workflow State)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  progress NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  current_step TEXT,
  step_details JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  error_code TEXT,
  error_message TEXT,
  error_retryable BOOLEAN DEFAULT FALSE,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_book_id ON jobs(book_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON jobs(idempotency_key);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
  ON jobs FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Book Exports Table (Authoritative Vector PDF Exports)
CREATE TABLE IF NOT EXISTS book_exports (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  design_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  storage_path TEXT,
  file_size_bytes BIGINT,
  page_count INTEGER,
  download_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_book_exports_book_id ON book_exports(book_id);
CREATE INDEX IF NOT EXISTS idx_book_exports_user_id ON book_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_book_exports_design_hash ON book_exports(design_hash);

ALTER TABLE book_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own book exports"
  ON book_exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own book exports"
  ON book_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own book exports"
  ON book_exports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own book exports"
  ON book_exports FOR DELETE
  USING (auth.uid() = user_id);
