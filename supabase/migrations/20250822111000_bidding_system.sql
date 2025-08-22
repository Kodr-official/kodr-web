-- Bidding system migration
-- 1) Extend project_status enum with 'active' and 'closed' (keep existing values for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'project_status' AND e.enumlabel = 'active'
  ) THEN
    ALTER TYPE project_status ADD VALUE 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'project_status' AND e.enumlabel = 'closed'
  ) THEN
    ALTER TYPE project_status ADD VALUE 'closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'project_status' AND e.enumlabel = 'draft'
  ) THEN
    ALTER TYPE project_status ADD VALUE 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'project_status' AND e.enumlabel = 'in_progress'
  ) THEN
    ALTER TYPE project_status ADD VALUE 'in_progress';
  END IF;
END$$;

-- 2) Add new columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bidding_end_time timestamptz NULL,
  ADD COLUMN IF NOT EXISTS budget numeric NULL,
  ADD COLUMN IF NOT EXISTS skills_required text[] NULL,
  ADD COLUMN IF NOT EXISTS timeline_date date NULL;

-- 3) Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  coder_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text,
  proposed_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Row Level Security
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Policies for bids
-- Insert: a coder can create a bid for an active project before bidding_end_time
CREATE POLICY IF NOT EXISTS bids_insert_own
  ON bids FOR INSERT
  WITH CHECK (
    auth.uid() = coder_id AND
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
        AND p.status = 'active'
        AND (p.bidding_end_time IS NULL OR now() < p.bidding_end_time)
    )
  );

-- Select: bidder can read their own bids
CREATE POLICY IF NOT EXISTS bids_select_own
  ON bids FOR SELECT
  USING (auth.uid() = coder_id);

-- Select: hirer of the project can read bids on their project
CREATE POLICY IF NOT EXISTS bids_select_hirer
  ON bids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND p.hirer_id = auth.uid()
    )
  );

-- 5) Optional: allow project owners to update paid/status/bidding_end_time
-- (Assumes RLS is ON for projects already)
-- Update permissions for project owners
CREATE POLICY IF NOT EXISTS projects_update_owner_bidding
  ON projects FOR UPDATE
  USING (auth.uid() = hirer_id)
  WITH CHECK (auth.uid() = hirer_id);

-- 6) Helper index for bids lookups
CREATE INDEX IF NOT EXISTS idx_bids_project_id_created_at ON bids(project_id, created_at DESC);
