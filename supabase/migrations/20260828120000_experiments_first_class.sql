-- Experiments as first-class CGT objects.
--
-- An Experiment is the enduring operational object that answers:
--   What are we trying to learn, how will we test it, what evidence will
--   count, and what decision follows?
--
-- Architectural principle: an Experiment does NOT contain the work. It gives
-- the work meaning. Sessions, evidence, observations, and proposals remain
-- their own objects; they gain a nullable pointer back to the experiment they
-- contributed to. The Proposal is NOT the Experiment: proposing an experiment
-- generates a Proposal (existing infra) authorizing it, while the Experiment
-- endures as the context for execution, evidence, findings, and decisions.
--
-- Tenancy: project_id is the required authorization/scope anchor (projects are
-- CGT's tenant unit, driving RLS and the client portal), mirroring the
-- proposals model ("current authorization scope, not permanent ownership").

-- =========================================================================
-- experiments
-- =========================================================================
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Required tenancy / authorization anchor.
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Per-project human identity. experiment_number is assigned by trigger;
  -- code is the display form (EXP-002). slug is URL-safe, unique per project.
  experiment_number INTEGER NOT NULL,
  code TEXT NOT NULL,
  slug TEXT NOT NULL,

  title TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'proposed', 'approved', 'active', 'completed',
    'rejected', 'paused', 'cancelled'
  )),

  -- Inquiry spine (always-present, singular narrative fields).
  primary_question TEXT,          -- What are we trying to learn?
  problem TEXT,                   -- Observed condition / friction.
  hypothesis TEXT,               -- What we currently believe.
  rationale TEXT,                -- Why we are asking.
  method TEXT,                   -- Proposed method / protocol.
  success_criteria TEXT,
  failure_criteria TEXT,
  stop_conditions TEXT,
  scope TEXT,
  decision_rule TEXT,            -- What decision follows the evidence.

  -- Outcome (populated as the experiment concludes).
  conclusion TEXT,
  recommendation TEXT,
  resulting_decision TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),

  -- Loose / list-shaped design fields kept as structured JSON until a real
  -- experiment needs them queryable (measures, evidence_requirements,
  -- assumptions, unknowns, risks, constraints, security_constraints,
  -- out_of_scope). Favor composition over premature columns.
  design JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- People. Owner is a CGT operator (profile); client stakeholder reuses the
  -- shared persons directory rather than duplicating identity.
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  client_stakeholder_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,

  -- Lifecycle timestamps.
  proposed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, experiment_number),
  UNIQUE (project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_experiments_project_id ON experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_owner_id ON experiments(owner_id);

-- Per-project experiment numbering. Assigns the next number within the
-- project and derives the EXP-XXX code. Advisory-locked per project to avoid
-- races on concurrent inserts.
CREATE OR REPLACE FUNCTION assign_experiment_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('experiments:' || NEW.project_id::text));

  IF NEW.experiment_number IS NULL OR NEW.experiment_number = 0 THEN
    SELECT COALESCE(MAX(experiment_number), 0) + 1
      INTO next_num
      FROM experiments
     WHERE project_id = NEW.project_id;
    NEW.experiment_number := next_num;
  END IF;

  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'EXP-' || lpad(NEW.experiment_number::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_experiments_assign_number
  BEFORE INSERT ON experiments
  FOR EACH ROW EXECUTE FUNCTION assign_experiment_number();

CREATE TRIGGER trg_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- experiment_conditions
-- =========================================================================
CREATE TABLE IF NOT EXISTS experiment_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,            -- e.g. 'A', 'B', 'C'
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (experiment_id, label)
);

CREATE INDEX IF NOT EXISTS idx_experiment_conditions_experiment_id
  ON experiment_conditions(experiment_id);

CREATE TRIGGER trg_experiment_conditions_updated_at
  BEFORE UPDATE ON experiment_conditions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- experiment_links (the smallest useful typed lineage graph)
-- =========================================================================
-- A directed, typed edge from an experiment (subject) to another CGT object
-- OR a free-text target. This is intentionally NOT a universal graph engine:
-- relation and target_type are constrained, target_id is nullable, and we do
-- not store reverse edges. Free-text targets (note) capture things not yet
-- modeled as rows, e.g. "Observation: Christie manually supplies context".
CREATE TABLE IF NOT EXISTS experiment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,

  relation TEXT NOT NULL CHECK (relation IN (
    'derived_from', 'tests', 'enables', 'depends_on',
    'informed_by', 'resulted_in', 'supersedes', 'may_create'
  )),

  target_type TEXT NOT NULL CHECK (target_type IN (
    'experiment', 'condition', 'observation', 'proposal',
    'session', 'project', 'finding', 'external'
  )),
  target_id UUID,                       -- FK-by-convention (polymorphic), nullable
  target_condition_id UUID REFERENCES experiment_conditions(id) ON DELETE SET NULL,

  note TEXT,                            -- required when target_id is null
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (target_id IS NOT NULL OR target_condition_id IS NOT NULL OR note IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_experiment_links_experiment_id
  ON experiment_links(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_links_target
  ON experiment_links(target_type, target_id);

-- =========================================================================
-- experiment_findings (closes the learn -> decide loop)
-- =========================================================================
-- Distinct from a raw observation: a finding is an experiment-level
-- conclusion about the hypothesis. Supporting evidence is expressed via
-- experiment_links (relation informed_by, target_type observation).
CREATE TABLE IF NOT EXISTS experiment_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  interpretation TEXT,
  supports_hypothesis TEXT NOT NULL DEFAULT 'inconclusive'
    CHECK (supports_hypothesis IN ('supports', 'refutes', 'inconclusive')),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_findings_experiment_id
  ON experiment_findings(experiment_id);

CREATE TRIGGER trg_experiment_findings_updated_at
  BEFORE UPDATE ON experiment_findings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- Compose existing objects: nullable pointers back to the experiment.
-- Experiments give meaning; they do not own. ON DELETE SET NULL.
-- =========================================================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_experiment_id ON proposals(experiment_id);

ALTER TABLE engagement_recordings
  ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_engagement_recordings_experiment_id
  ON engagement_recordings(experiment_id);

ALTER TABLE transcript_observations
  ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transcript_observations_experiment_id
  ON transcript_observations(experiment_id);

-- =========================================================================
-- RLS (mirrors the proposals model)
-- =========================================================================
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_findings ENABLE ROW LEVEL SECURITY;

-- Admins manage everything.
CREATE POLICY "Admins can manage all experiments"
  ON experiments FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all experiment_conditions"
  ON experiment_conditions FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all experiment_links"
  ON experiment_links FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all experiment_findings"
  ON experiment_findings FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Clients see experiments on their projects once they leave draft. Drafts are
-- internal to CGT until proposed.
CREATE POLICY "Clients can view non-draft experiments for their projects"
  ON experiments FOR SELECT TO authenticated
  USING (
    status IN ('proposed', 'approved', 'active', 'completed')
    AND project_id IN (
      SELECT project_clients.project_id FROM project_clients
      WHERE project_clients.client_id = auth.uid()
    )
  );

-- Child rows follow parent experiment visibility.
CREATE POLICY "Clients can view conditions for visible experiments"
  ON experiment_conditions FOR SELECT TO authenticated
  USING (
    experiment_id IN (
      SELECT e.id FROM experiments e
      WHERE e.status IN ('proposed', 'approved', 'active', 'completed')
        AND e.project_id IN (
          SELECT project_clients.project_id FROM project_clients
          WHERE project_clients.client_id = auth.uid()
        )
    )
  );

CREATE POLICY "Clients can view links for visible experiments"
  ON experiment_links FOR SELECT TO authenticated
  USING (
    experiment_id IN (
      SELECT e.id FROM experiments e
      WHERE e.status IN ('proposed', 'approved', 'active', 'completed')
        AND e.project_id IN (
          SELECT project_clients.project_id FROM project_clients
          WHERE project_clients.client_id = auth.uid()
        )
    )
  );

CREATE POLICY "Clients can view findings for visible experiments"
  ON experiment_findings FOR SELECT TO authenticated
  USING (
    experiment_id IN (
      SELECT e.id FROM experiments e
      WHERE e.status IN ('proposed', 'approved', 'active', 'completed')
        AND e.project_id IN (
          SELECT project_clients.project_id FROM project_clients
          WHERE project_clients.client_id = auth.uid()
        )
    )
  );
