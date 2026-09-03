-- Human review of AskCGT conclusions, as durable experiment findings.
--
-- The governing epistemic distinction this schema must enforce:
--
--   Source material remains evidence.
--   An AskCGT conclusion is a proposed interpretation.
--   Paul's acceptance makes it a REVIEWED FINDING linked to evidence —
--   it does not make it evidence.
--
-- experiment_findings already existed as CGT's "what did we learn" object, but
-- with only 9 columns it could not record who reviewed a claim, what the model
-- originally proposed before Paul edited it, which epistemic class the claim
-- belongs to, which model produced it, or what evidence supports it. It is
-- extended here rather than shadowed by a parallel "askcgt_findings" concept.
--
-- Existing manual findings are unaffected: origin defaults to 'manual' and
-- every new column is nullable or defaulted. The table is empty at migration
-- time, so the NOT NULL additions are safe.

-- =========================================================================
-- Tenancy anchor
-- =========================================================================
-- Every other reviewable object in CGT (work_items, decisions, proposals,
-- experiments) carries project_id as its authorization anchor. Findings
-- reached the project only transitively through experiment_id, which meant an
-- acceptance path could not cheaply verify that a finding, its experiment, and
-- its cited evidence all belong to the same project.
ALTER TABLE experiment_findings
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

UPDATE experiment_findings f
   SET project_id = e.project_id
  FROM experiments e
 WHERE e.id = f.experiment_id
   AND f.project_id IS NULL;

ALTER TABLE experiment_findings ALTER COLUMN project_id SET NOT NULL;

-- =========================================================================
-- Review lifecycle and model provenance
-- =========================================================================
ALTER TABLE experiment_findings
  -- Distinguishes a finding Paul wrote himself from a reviewed AskCGT
  -- conclusion. Defaults to 'manual' so the existing findings editor keeps
  -- working with no changes.
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual',

  -- The model's ORIGINAL wording, preserved verbatim and never overwritten.
  -- `statement` holds the wording Paul actually accepted; these two differ
  -- exactly when he edited it.
  ADD COLUMN IF NOT EXISTS proposed_statement TEXT,
  ADD COLUMN IF NOT EXISTS proposed_interpretation TEXT,

  -- AskCGT reports confidence as a 0-1 number. The pre-existing `confidence`
  -- column is a TEXT high/medium/low enum used by the manual editor, so the
  -- numeric value gets its own column rather than being coerced and losing
  -- precision.
  ADD COLUMN IF NOT EXISTS proposed_confidence NUMERIC(3, 2),

  -- Which epistemic class the model assigned. An accepted 'inference' is a
  -- reviewed interpretation, NOT a source fact; the UI and AskCGT retrieval
  -- both depend on this staying explicit.
  ADD COLUMN IF NOT EXISTS epistemic_type TEXT,

  -- Only two committed states exist in this version. Uncommitted model output
  -- is never written here at all, so there is no 'proposed' row state.
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'accepted',

  -- Auditable reviewer identity. Acceptance is always a deliberate human act;
  -- AskCGT can never accept its own conclusion.
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,

  -- Which model produced the proposal, for later recalibration of trust.
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,

  -- Accepting an internal interpretation must not silently publish it to the
  -- client portal. The pre-existing client policy on this table had no
  -- visibility flag, so any accepted finding on a non-draft experiment would
  -- have become immediately visible to the client. Findings are now private by
  -- default and must be shared deliberately.
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================================
-- Integrity
-- =========================================================================
ALTER TABLE experiment_findings
  DROP CONSTRAINT IF EXISTS experiment_findings_origin_check;
ALTER TABLE experiment_findings
  ADD CONSTRAINT experiment_findings_origin_check
  CHECK (origin IN ('manual', 'askcgt'));

ALTER TABLE experiment_findings
  DROP CONSTRAINT IF EXISTS experiment_findings_review_status_check;
ALTER TABLE experiment_findings
  ADD CONSTRAINT experiment_findings_review_status_check
  CHECK (review_status IN ('accepted', 'accepted_edited'));

ALTER TABLE experiment_findings
  DROP CONSTRAINT IF EXISTS experiment_findings_epistemic_type_check;
ALTER TABLE experiment_findings
  ADD CONSTRAINT experiment_findings_epistemic_type_check
  CHECK (epistemic_type IS NULL OR epistemic_type IN ('evidence', 'inference', 'unknown'));

ALTER TABLE experiment_findings
  DROP CONSTRAINT IF EXISTS experiment_findings_proposed_confidence_check;
ALTER TABLE experiment_findings
  ADD CONSTRAINT experiment_findings_proposed_confidence_check
  CHECK (proposed_confidence IS NULL OR (proposed_confidence >= 0 AND proposed_confidence <= 1));

-- A reviewed AskCGT finding is only meaningful with its full provenance. This
-- makes it impossible to write a half-attributed finding that later reads as
-- if a human had vouched for it.
ALTER TABLE experiment_findings
  DROP CONSTRAINT IF EXISTS experiment_findings_askcgt_provenance;
ALTER TABLE experiment_findings
  ADD CONSTRAINT experiment_findings_askcgt_provenance
  CHECK (
    origin <> 'askcgt'
    OR (
      proposed_statement IS NOT NULL
      AND epistemic_type IS NOT NULL
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
  );

-- The edited flag cannot lie in either direction: 'accepted_edited' requires
-- the accepted wording to actually differ from the proposal, and a plain
-- 'accepted' requires them to match.
ALTER TABLE experiment_findings
  DROP CONSTRAINT IF EXISTS experiment_findings_edit_flag_honest;
ALTER TABLE experiment_findings
  ADD CONSTRAINT experiment_findings_edit_flag_honest
  CHECK (
    origin <> 'askcgt'
    OR (
      (review_status = 'accepted_edited' AND statement IS DISTINCT FROM proposed_statement)
      OR (review_status = 'accepted' AND statement = proposed_statement)
    )
  );

-- =========================================================================
-- Idempotency
-- =========================================================================
-- Double-clicking "Accept as finding" must not create two findings. The
-- conclusion itself is never persisted before acceptance, so there is no
-- server-side id to deduplicate on; the model's proposed wording within one
-- experiment is the stable natural key.
--
-- md5 is used purely as a length-bounded equality key for the index, not as a
-- security primitive.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_experiment_findings_askcgt_proposal
  ON experiment_findings (experiment_id, md5(proposed_statement))
  WHERE origin = 'askcgt';

CREATE INDEX IF NOT EXISTS idx_experiment_findings_project_id ON experiment_findings(project_id);
CREATE INDEX IF NOT EXISTS idx_experiment_findings_reviewed_by ON experiment_findings(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_experiment_findings_origin ON experiment_findings(experiment_id, origin);

-- =========================================================================
-- RLS
-- =========================================================================
-- Admin access is unchanged apart from wrapping auth.uid() in a scalar
-- subquery (advisor: auth_rls_initplan).
DROP POLICY IF EXISTS "Admins can manage all experiment_findings" ON experiment_findings;
CREATE POLICY "Admins can manage all experiment_findings"
  ON experiment_findings FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

-- Clients additionally require client_visible. Without this, accepting an
-- internal interpretation would publish it to the client portal as a side
-- effect of an internal review action.
DROP POLICY IF EXISTS "Clients can view findings for visible experiments" ON experiment_findings;
CREATE POLICY "Clients can view shared findings for visible experiments"
  ON experiment_findings FOR SELECT TO authenticated
  USING (
    client_visible = TRUE
    AND experiment_visible_to_client(experiment_id, (SELECT auth.uid()))
  );

COMMENT ON COLUMN experiment_findings.origin IS
  '''manual'' = written by a person directly. ''askcgt'' = an AskCGT conclusion a human reviewed and accepted.';
COMMENT ON COLUMN experiment_findings.proposed_statement IS
  'The model''s original wording, never overwritten. `statement` is the wording the reviewer accepted.';
COMMENT ON COLUMN experiment_findings.epistemic_type IS
  'The model''s epistemic class for the claim. An accepted ''inference'' is a reviewed interpretation, not a source fact.';
COMMENT ON COLUMN experiment_findings.review_status IS
  '''accepted'' = committed unchanged. ''accepted_edited'' = the reviewer rewrote the claim before committing it.';
COMMENT ON COLUMN experiment_findings.client_visible IS
  'Findings are internal by default. Accepting an interpretation must not publish it to the client portal implicitly.';
