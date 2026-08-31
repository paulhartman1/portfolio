-- Proposals as first-class objects, on par with Experiments.
--
-- A Proposal authorizes work. It may authorize:
--   * execution  - agreed, known work (a build, retainer, fixed deliverables)
--                  with no open question to resolve (0 experiments)
--   * experiment - running a single inquiry (1 experiment)
--   * program    - a bundle of inquiries (N experiments)
--
-- The Proposal is NOT the Experiment: experiments endure; proposals record
-- what was presented and authorized. The relationship is many-to-many: a
-- proposal can bundle several experiments, and an experiment can be touched
-- by multiple proposals over time (re-proposal, follow-on, program bundle).
-- Revisions of the SAME proposal remain proposal_versions.

-- =========================================================================
-- Many-to-many: proposal <-> experiment
-- =========================================================================
CREATE TABLE IF NOT EXISTS proposal_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_experiments_proposal ON proposal_experiments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_experiments_experiment ON proposal_experiments(experiment_id);

-- Backfill from the single experiment_id introduced with experiments.
INSERT INTO proposal_experiments (proposal_id, experiment_id)
SELECT id, experiment_id FROM proposals WHERE experiment_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE proposals DROP COLUMN IF EXISTS experiment_id;

-- =========================================================================
-- Identity + classification + commercial terms on proposals
-- =========================================================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS proposal_number INTEGER,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'execution'
    CHECK (kind IN ('execution', 'experiment', 'program')),
  ADD COLUMN IF NOT EXISTS amount NUMERIC,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS timeline TEXT,
  ADD COLUMN IF NOT EXISTS terms TEXT;

-- Backfill per-project numbering + code + slug for existing proposals.
WITH numbered AS (
  SELECT id,
         row_number() OVER (PARTITION BY project_id ORDER BY created_at) AS rn
  FROM proposals
  WHERE proposal_number IS NULL
)
UPDATE proposals p
SET proposal_number = n.rn,
    code = 'PROP-' || lpad(n.rn::text, 3, '0')
FROM numbered n
WHERE p.id = n.id;

-- Backfill slug from title (fallback to code), unique within project by
-- appending the number when needed.
UPDATE proposals p
SET slug = COALESCE(
  NULLIF(
    regexp_replace(
      regexp_replace(lower(trim(p.title)), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ), ''
  ),
  lower(p.code)
)
WHERE p.slug IS NULL;

-- Ensure per-project slug uniqueness after backfill (append number on clash).
UPDATE proposals p
SET slug = p.slug || '-' || p.proposal_number
WHERE EXISTS (
  SELECT 1 FROM proposals q
  WHERE q.project_id = p.project_id AND q.slug = p.slug AND q.id <> p.id
);

-- Backfill owner from creator; classify kind from experiment links.
UPDATE proposals SET owner_id = created_by WHERE owner_id IS NULL;

UPDATE proposals p
SET kind = CASE
  WHEN cnt.n >= 2 THEN 'program'
  WHEN cnt.n = 1 THEN 'experiment'
  ELSE 'execution'
END
FROM (
  SELECT pr.id, COUNT(pe.id) AS n
  FROM proposals pr
  LEFT JOIN proposal_experiments pe ON pe.proposal_id = pr.id
  GROUP BY pr.id
) cnt
WHERE p.id = cnt.id;

-- Enforce identity constraints now that existing rows are populated.
ALTER TABLE proposals
  ALTER COLUMN proposal_number SET NOT NULL,
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_project_number_key'
  ) THEN
    ALTER TABLE proposals ADD CONSTRAINT proposals_project_number_key UNIQUE (project_id, proposal_number);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_project_slug_key'
  ) THEN
    ALTER TABLE proposals ADD CONSTRAINT proposals_project_slug_key UNIQUE (project_id, slug);
  END IF;
END $$;

-- Per-project proposal numbering (mirrors experiments).
CREATE OR REPLACE FUNCTION assign_proposal_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('proposals:' || NEW.project_id::text));
  IF NEW.proposal_number IS NULL OR NEW.proposal_number = 0 THEN
    SELECT COALESCE(MAX(proposal_number), 0) + 1
      INTO next_num FROM proposals WHERE project_id = NEW.project_id;
    NEW.proposal_number := next_num;
  END IF;
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'PROP-' || lpad(NEW.proposal_number::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposals_assign_number ON proposals;
CREATE TRIGGER trg_proposals_assign_number
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION assign_proposal_number();

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE proposal_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all proposal_experiments"
  ON proposal_experiments FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Clients can view proposal_experiments for visible proposals"
  ON proposal_experiments FOR SELECT TO authenticated
  USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      WHERE p.status IN ('sent', 'accepted', 'declined')
        AND p.project_id IN (
          SELECT project_clients.project_id FROM project_clients
          WHERE project_clients.client_id = auth.uid()
        )
    )
  );

-- Clients may respond to a sent proposal (accept / decline). Route logic
-- controls the target values; RLS gates who and when.
CREATE POLICY "Clients can respond to sent proposals on their projects"
  ON proposals FOR UPDATE TO authenticated
  USING (
    status = 'sent'
    AND project_id IN (
      SELECT project_clients.project_id FROM project_clients
      WHERE project_clients.client_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT project_clients.project_id FROM project_clients
      WHERE project_clients.client_id = auth.uid()
    )
  );
