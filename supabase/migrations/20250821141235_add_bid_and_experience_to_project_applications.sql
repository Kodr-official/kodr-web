-- Migration: add bid_amount and experience_years to project_applications
-- Created at: 2025-08-21 14:12:35 IST

-- 1) Add columns (nullable)
alter table if exists public.project_applications
  add column if not exists bid_amount numeric,
  add column if not exists experience_years integer;

-- 2) Ensure RLS is enabled
alter table if exists public.project_applications enable row level security;

-- 3) Insert policy: authenticated users can insert an application for themselves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'project_applications' 
      AND policyname = 'coders_can_insert_applications'
  ) THEN
    CREATE POLICY "coders_can_insert_applications"
    ON public.project_applications
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = coder_id);
  END IF;
END $$;

-- 4) Select policy: allow coders to read their own applications; allow hirers to read applications for their projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'project_applications' 
      AND policyname = 'coders_read_own_applications'
  ) THEN
    CREATE POLICY "coders_read_own_applications"
    ON public.project_applications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = coder_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'project_applications' 
      AND policyname = 'hirers_read_project_applications'
  ) THEN
    CREATE POLICY "hirers_read_project_applications"
    ON public.project_applications
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = project_id
          AND p.hirer_id = auth.uid()
      )
      OR auth.uid() = coder_id
    );
  END IF;
END $$;

-- 5) Optional: unique constraint to prevent duplicate applications per coder per project
-- Uncomment if desired
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'project_applications_unique_project_coder'
--   ) THEN
--     ALTER TABLE public.project_applications
--     ADD CONSTRAINT project_applications_unique_project_coder
--     UNIQUE (project_id, coder_id);
--   END IF;
-- END $$;
