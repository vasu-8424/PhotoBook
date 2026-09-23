-- ====================================================================
-- Part 7 — Design AI Schema & Row-Level Security (RLS)
-- ====================================================================

-- 1. Designs Table
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  design_json JSONB NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_designs_book_id ON designs(book_id);
CREATE INDEX IF NOT EXISTS idx_designs_user_id ON designs(user_id);
CREATE INDEX IF NOT EXISTS idx_designs_input_hash ON designs(input_hash);

-- 2. Row Level Security Policies
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own book designs"
  ON designs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own book designs"
  ON designs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own book designs"
  ON designs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own book designs"
  ON designs FOR DELETE
  USING (auth.uid() = user_id);
