-- ====================================================================
-- Part 6 — Editorial Plans Schema & Row-Level Security (RLS)
-- ====================================================================

-- 1. Editorial Plans Table
CREATE TABLE IF NOT EXISTS editorial_plans (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  plan_json JSONB NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_editorial_plans_book_id ON editorial_plans(book_id);
CREATE INDEX IF NOT EXISTS idx_editorial_plans_user_id ON editorial_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_editorial_plans_input_hash ON editorial_plans(input_hash);

-- 2. Row Level Security Policies
ALTER TABLE editorial_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own editorial plans"
  ON editorial_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own editorial plans"
  ON editorial_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own editorial plans"
  ON editorial_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own editorial plans"
  ON editorial_plans FOR DELETE
  USING (auth.uid() = user_id);
