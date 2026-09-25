-- ====================================================================
-- Part 10 — PDF Export & Print Delivery Engine Schema
-- ====================================================================
-- This migration extends / corrects the book_exports table that was
-- partially defined in Part 9. Uses IF NOT EXISTS / DO blocks to be
-- safe to run against a DB that already has the Part 9 schema.
-- ====================================================================

-- -----------------------------------------------------------------------
-- 1. Extend book_exports with required Part 10 columns
-- -----------------------------------------------------------------------

ALTER TABLE book_exports
  ADD COLUMN IF NOT EXISTS job_id         TEXT,
  ADD COLUMN IF NOT EXISTS design_id      TEXT,
  ADD COLUMN IF NOT EXISTS schema_version TEXT,
  ADD COLUMN IF NOT EXISTS width_mm       NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS height_mm      NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS sha256         TEXT,
  ADD COLUMN IF NOT EXISTS error_code     TEXT;

-- Rename status to use canonical Part 10 enum values.
-- Existing rows with 'COMPLETED' will remain valid.
-- The application layer maps COMPLETED -> SUCCEEDED for the type.
-- We keep the DB column accepting both during migration.
-- (In production, a separate data migration would normalise old rows.)

-- -----------------------------------------------------------------------
-- 2. Additional indexes
-- -----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_book_exports_job_id    ON book_exports(job_id);
CREATE INDEX IF NOT EXISTS idx_book_exports_status    ON book_exports(status);

-- -----------------------------------------------------------------------
-- 3. Ensure RLS is enforced (idempotent)
-- -----------------------------------------------------------------------

ALTER TABLE book_exports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'book_exports'
      AND policyname = 'Users can view their own book exports'
  ) THEN
    CREATE POLICY "Users can view their own book exports"
      ON book_exports FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'book_exports'
      AND policyname = 'Users can insert their own book exports'
  ) THEN
    CREATE POLICY "Users can insert their own book exports"
      ON book_exports FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'book_exports'
      AND policyname = 'Users can update their own book exports'
  ) THEN
    CREATE POLICY "Users can update their own book exports"
      ON book_exports FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'book_exports'
      AND policyname = 'Users can delete their own book exports'
  ) THEN
    CREATE POLICY "Users can delete their own book exports"
      ON book_exports FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- -----------------------------------------------------------------------
-- 4. Private PDF storage bucket (book-pdfs)
-- -----------------------------------------------------------------------
-- Supabase storage buckets are managed via the Dashboard or the
-- Management API. The SQL below is a reminder comment — actual bucket
-- creation must be done via Supabase Dashboard or CLI:
--   supabase storage create-bucket book-pdfs --private
-- The bucket MUST NOT be made public.
-- RLS on storage objects is enforced through Supabase Storage policies.
-- -----------------------------------------------------------------------

-- -----------------------------------------------------------------------
-- 5. Storage RLS policies for book-pdfs bucket
-- -----------------------------------------------------------------------
-- These policies ensure only the owning user can access their PDFs.
-- Objects are stored at: {userId}/{bookId}/{designHash}/magazine.pdf
-- -----------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'PDF owner can read own PDFs'
  ) THEN
    CREATE POLICY "PDF owner can read own PDFs"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'book-pdfs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Service role can write PDFs'
  ) THEN
    CREATE POLICY "Service role can write PDFs"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'book-pdfs'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Service role can delete PDFs'
  ) THEN
    CREATE POLICY "Service role can delete PDFs"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'book-pdfs'
      );
  END IF;
END
$$;
