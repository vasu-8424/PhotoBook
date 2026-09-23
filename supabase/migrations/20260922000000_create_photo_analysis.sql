-- ====================================================================
-- Part 5 — Photo Analysis Schema & Row-Level Security (RLS)
-- ====================================================================

-- 1. Photo Analysis Table
CREATE TABLE IF NOT EXISTS photo_analysis (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL UNIQUE,
  book_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  analysis_json JSONB NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_schema_version TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_photo_analysis_photo_id ON photo_analysis(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_analysis_book_id ON photo_analysis(book_id);
CREATE INDEX IF NOT EXISTS idx_photo_analysis_user_id ON photo_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_analysis_input_hash ON photo_analysis(input_hash);

-- 2. Photo Analysis Status Table (Independent of asset status)
CREATE TABLE IF NOT EXISTS photo_analysis_status (
  photo_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('NOT_ANALYZED', 'ANALYZING', 'ANALYZED', 'FAILED')),
  error_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Row Level Security Policies
ALTER TABLE photo_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_analysis_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own photo analysis"
  ON photo_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own photo analysis"
  ON photo_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photo analysis"
  ON photo_analysis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photo analysis"
  ON photo_analysis FOR DELETE
  USING (auth.uid() = user_id);
