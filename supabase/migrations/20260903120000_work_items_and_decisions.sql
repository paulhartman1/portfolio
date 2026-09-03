-- Durable capture for the artifacts an experiment produces.
--
-- Motivation (Alpine EXP-003 "Make the work visible"): the experiment's own
-- recorded method and evidence_requirements demand artifacts CGT could not
-- store. Its method says "Combine the findings into one work inventory,
-- PRESERVING THE SOURCE OF EACH ITEM", "Have Christie review and CORRECT the
-- inventory", "Record meaningful work that occurs but was MISSING from the
-- inventory, including HOW AND WHEN it was discovered", and "Have Christie use
-- the inventory during actual prioritization, sequencing, deferral, and WIP
-- decisions". None of that had a home: there was no work-item concept, no
-- correction log, and no decision record anywhere in the schema.
--
-- Architectural stance, mirroring experiments_first_class:
--   * project_id is the required tenancy/authorization anchor.
--   * experiment_id is a NULLABLE pointer back to the experiment that gave the
--     artifact meaning. The inventory must outlive EXP-003 if it succeeds, so
--     the experiment does not own the work.
--   * Evidence provenance uses REAL foreign keys wherever the target is a
--     table, and a TEXT[] only for transcript utterances, which live inside
--     engagement_transcripts.utterances JSONB and therefore cannot be
--     referenced (same constraint already documented on
--     project_intelligence_candidate_evidence).
--
-- This is deliberately NOT a general task tracker. There are no assignments,
-- notifications, sprints, estimates, or automation. It records what work
-- exists, where CGT learned of it, who validated it, and what was decided.

-- =========================================================================
-- work_items — the inventory
-- =========================================================================
CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Required tenancy / authorization anchor.
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- The experiment that produced or maintains this item. Nullable so the
  -- inventory survives the experiment.
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,

  -- Per-project human identity, assigned by trigger (WORK-001).
  item_number INTEGER NOT NULL,
  code TEXT NOT NULL,

  title TEXT NOT NULL,
  description TEXT,

  -- The states EXP-003 names: "all requested, active, waiting, blocked,
  -- committed, and planned work", plus terminal states so the inventory can
  -- be maintained rather than only grown.
  state TEXT NOT NULL DEFAULT 'requested'
    CHECK (state IN ('requested', 'planned', 'committed', 'active', 'waiting', 'blocked', 'done', 'dropped')),

  -- Who owns and who asked. Concentration of ownership is itself a finding:
  -- EXP-003's problem statement is that Christie is intake point, evaluator,
  -- product manager, developer and conduit simultaneously.
  owner_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  requested_by_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,

  -- Fragmented intake is part of the observed problem ("requests and updates
  -- arrive through multiple channels"), so the channel is recorded per item.
  intake_channel TEXT
    CHECK (intake_channel IS NULL OR intake_channel IN (
      'email', 'verbal', 'phone', 'teams', 'chat', 'meeting', 'clickup',
      'ticket', 'spreadsheet', 'document', 'self_initiated', 'unknown', 'other'
    )),

  -- Success criterion: "Every inventory item has, where applicable, a
  -- recognizable description, current state, owner, and next action or
  -- dependency."
  next_action TEXT,
  blocked_reason TEXT,

  -- Work that exists but lives in no system at all.
  is_informal BOOLEAN NOT NULL DEFAULT FALSE,

  -- When the work itself began existing, per evidence (may be unknown).
  first_seen_at TIMESTAMPTZ,

  -- When CGT learned of it, and how. These two power the measure "number of
  -- items discovered after the initial interview".
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discovery_method TEXT NOT NULL DEFAULT 'christie_interview'
    CHECK (discovery_method IN (
      'christie_interview', 'follow_up_interview', 'transcript', 'session_marker',
      'email', 'spreadsheet', 'document', 'clickup', 'outlook',
      'observed_during_pilot', 'reported_by_team_member', 'other'
    )),

  -- FALSE means the item was found AFTER the initial inventory was agreed —
  -- the failure criterion "more than 10% of meaningful work identified during
  -- reviews was not already represented" is computed from this.
  in_initial_inventory BOOLEAN NOT NULL DEFAULT TRUE,

  -- Christie's review state. 'corrected' records that she changed it;
  -- 'disputed' that she disagreed; 'removed' that it was not real work.
  validation_state TEXT NOT NULL DEFAULT 'unvalidated'
    CHECK (validation_state IN ('unvalidated', 'confirmed', 'corrected', 'disputed', 'removed')),
  validated_at TIMESTAMPTZ,
  validated_by_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,

  -- A shared view is the entire point of the experiment, so items default to
  -- client-visible. Set FALSE for anything CGT must hold back.
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, item_number),

  -- Any claim that a human reviewed this item must carry the date it happened.
  -- A validation with no timestamp is not auditable evidence.
  --
  -- Note: a blocked/waiting item with no blocked_reason is deliberately
  -- ALLOWED. That is exactly the "status lives only in someone's head"
  -- condition EXP-003 is testing, so it must be recordable as a visible gap
  -- rather than rejected at write time.
  CONSTRAINT work_items_validated_fields CHECK (
    validation_state = 'unvalidated' OR validated_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_work_items_project_id ON work_items(project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_experiment_id ON work_items(experiment_id);
CREATE INDEX IF NOT EXISTS idx_work_items_owner_person_id ON work_items(owner_person_id);
CREATE INDEX IF NOT EXISTS idx_work_items_requested_by_person_id ON work_items(requested_by_person_id);
CREATE INDEX IF NOT EXISTS idx_work_items_validated_by_person_id ON work_items(validated_by_person_id);
CREATE INDEX IF NOT EXISTS idx_work_items_created_by ON work_items(created_by);
CREATE INDEX IF NOT EXISTS idx_work_items_state ON work_items(project_id, state);

-- Per-project work-item numbering (WORK-001), advisory-locked per project.
CREATE OR REPLACE FUNCTION assign_work_item_number()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('work_items:' || NEW.project_id::text));

  IF NEW.item_number IS NULL OR NEW.item_number = 0 THEN
    SELECT COALESCE(MAX(item_number), 0) + 1
      INTO next_num
      FROM work_items
     WHERE project_id = NEW.project_id;
    NEW.item_number := next_num;
  END IF;

  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'WORK-' || lpad(NEW.item_number::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_work_items_assign_number
  BEFORE INSERT ON work_items
  FOR EACH ROW EXECUTE FUNCTION assign_work_item_number();

CREATE TRIGGER trg_work_items_updated_at
  BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- decisions — what was decided, why, and whether it still holds
-- =========================================================================
-- CGT previously had no durable decision record. experiments.resulting_decision
-- is a single free-text column on the experiment, which cannot represent
-- multiple decisions, their rationale, what was rejected, or supersession.
-- Without this, a fresh AskCGT session cannot answer "why did we decide that?"
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,

  decision_number INTEGER NOT NULL,
  code TEXT NOT NULL,

  statement TEXT NOT NULL,
  rationale TEXT,

  -- EXP-003's success criterion requires "at least one real prioritization,
  -- sequencing, deferral, or WIP decision", so those are first-class values
  -- rather than free text.
  decision_type TEXT NOT NULL DEFAULT 'other'
    CHECK (decision_type IN (
      'prioritization', 'sequencing', 'deferral', 'wip_limit', 'scope',
      'tool_selection', 'process', 'commercial', 'experiment_direction', 'other'
    )),

  -- Continuity: which conclusions remain active, which were only tentative,
  -- and which were replaced.
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('tentative', 'active', 'superseded', 'reversed')),
  supersedes_decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,

  -- What was considered and NOT chosen. Rejected options were previously
  -- unrepresentable, so a later reader could not tell a considered tradeoff
  -- from an unexamined default.
  alternatives_considered TEXT,

  -- The measure "decisions the view helps Christie make". TRUE only when the
  -- shared inventory actually informed the decision.
  informed_by_view BOOLEAN NOT NULL DEFAULT FALSE,

  decided_by_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Decisions may contain internal CGT reasoning, so they are hidden from the
  -- client unless explicitly shared.
  client_visible BOOLEAN NOT NULL DEFAULT FALSE,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, decision_number),
  CONSTRAINT decisions_no_self_supersede CHECK (supersedes_decision_id IS NULL OR supersedes_decision_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_decisions_project_id ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_experiment_id ON decisions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_decisions_supersedes ON decisions(supersedes_decision_id);
CREATE INDEX IF NOT EXISTS idx_decisions_decided_by_person_id ON decisions(decided_by_person_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created_by ON decisions(created_by);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(project_id, status);

CREATE OR REPLACE FUNCTION assign_decision_number()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('decisions:' || NEW.project_id::text));

  IF NEW.decision_number IS NULL OR NEW.decision_number = 0 THEN
    SELECT COALESCE(MAX(decision_number), 0) + 1
      INTO next_num
      FROM decisions
     WHERE project_id = NEW.project_id;
    NEW.decision_number := next_num;
  END IF;

  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'DEC-' || lpad(NEW.decision_number::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_decisions_assign_number
  BEFORE INSERT ON decisions
  FOR EACH ROW EXECUTE FUNCTION assign_decision_number();

CREATE TRIGGER trg_decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- work_item_events — append-only maintenance, correction and validation log
-- =========================================================================
-- EXP-003 needs three things this table provides and nothing else does:
--   * Christie's corrections, preserved rather than overwritten;
--   * how and when late-discovered work was found;
--   * "time required to maintain the view" (effort_minutes).
-- work_item_id is NULLABLE so effort spent on the inventory as a whole — not
-- attributable to one item — is still measurable.
CREATE TABLE IF NOT EXISTS work_item_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'discovered', 'state_changed', 'corrected', 'confirmed', 'disputed',
      'owner_changed', 'next_action_changed', 'removed', 'note',
      'inventory_maintained', 'inventory_reviewed'
    )),

  -- Who did it. Attribution matters: a correction by Christie is client
  -- validation; the same edit by Paul is a CGT interpretation.
  actor_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  from_state TEXT,
  to_state TEXT,
  field_changed TEXT,
  previous_value TEXT,
  note TEXT,

  -- Deliberate administrative effort, excluding doing the work itself.
  effort_minutes NUMERIC(6, 2) CHECK (effort_minutes IS NULL OR effort_minutes >= 0),

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- An item-scoped event must name its item; inventory-wide events must not.
  CONSTRAINT work_item_events_scope CHECK (
    (event_type IN ('inventory_maintained', 'inventory_reviewed'))
    OR work_item_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_work_item_events_project_id ON work_item_events(project_id);
CREATE INDEX IF NOT EXISTS idx_work_item_events_experiment_id ON work_item_events(experiment_id);
CREATE INDEX IF NOT EXISTS idx_work_item_events_work_item_id ON work_item_events(work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_events_actor_person_id ON work_item_events(actor_person_id);
CREATE INDEX IF NOT EXISTS idx_work_item_events_actor_profile_id ON work_item_events(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_work_item_events_created_by ON work_item_events(created_by);
CREATE INDEX IF NOT EXISTS idx_work_item_events_occurred_at ON work_item_events(project_id, occurred_at DESC);

-- =========================================================================
-- evidence_links — provenance for work items and decisions
-- =========================================================================
-- "Preserving the source of each item" and "the resulting work inventory with
-- links to source evidence where available" are explicit EXP-003 requirements.
--
-- One table serves both subjects rather than duplicating a near-identical
-- table per subject (the repo already has two such near-copies for
-- observations and candidates). Sources use real FKs where the target is a
-- table; utterance_ids is TEXT[] because transcript utterances live inside
-- JSONB and cannot be referenced.
CREATE TABLE IF NOT EXISTS evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Exactly one subject.
  subject_work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  subject_decision_id UUID REFERENCES decisions(id) ON DELETE CASCADE,

  source_kind TEXT NOT NULL
    CHECK (source_kind IN (
      'transcript_utterance', 'observation', 'session_marker',
      'intelligence_candidate', 'email_source', 'project_file',
      'work_item', 'decision', 'stated_by_person', 'external'
    )),

  -- Typed source pointers. Real referential integrity where possible.
  source_transcript_id UUID REFERENCES engagement_transcripts(id) ON DELETE SET NULL,
  source_utterance_ids TEXT[],
  source_observation_id UUID REFERENCES transcript_observations(id) ON DELETE SET NULL,
  source_marker_id UUID REFERENCES engagement_session_notes(id) ON DELETE SET NULL,
  source_candidate_id UUID REFERENCES project_intelligence_candidates(id) ON DELETE SET NULL,
  source_email_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  source_file_id UUID REFERENCES project_files(id) ON DELETE SET NULL,
  source_work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  source_decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
  source_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,

  -- For 'external' sources CGT cannot reference (a spreadsheet on a share, a
  -- verbal report), and for quoting the supporting text.
  source_label TEXT,
  excerpt_text TEXT,
  note TEXT,

  -- 'supporting' | 'contradicting' | 'context' mirrors
  -- project_intelligence_candidate_evidence.role, so contradicting evidence is
  -- representable rather than only confirmation.
  role TEXT NOT NULL DEFAULT 'supporting'
    CHECK (role IN ('supporting', 'contradicting', 'context')),

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT evidence_links_one_subject CHECK (
    (subject_work_item_id IS NOT NULL)::int + (subject_decision_id IS NOT NULL)::int = 1
  ),

  -- A link must actually point at something or say why it cannot.
  CONSTRAINT evidence_links_has_source CHECK (
    source_transcript_id IS NOT NULL
    OR source_observation_id IS NOT NULL
    OR source_marker_id IS NOT NULL
    OR source_candidate_id IS NOT NULL
    OR source_email_id IS NOT NULL
    OR source_file_id IS NOT NULL
    OR source_work_item_id IS NOT NULL
    OR source_decision_id IS NOT NULL
    OR source_person_id IS NOT NULL
    OR source_label IS NOT NULL
    OR note IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_evidence_links_subject_work_item ON evidence_links(subject_work_item_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_subject_decision ON evidence_links(subject_decision_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_transcript ON evidence_links(source_transcript_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_observation ON evidence_links(source_observation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_marker ON evidence_links(source_marker_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_candidate ON evidence_links(source_candidate_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_email ON evidence_links(source_email_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_file ON evidence_links(source_file_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_work_item ON evidence_links(source_work_item_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_decision ON evidence_links(source_decision_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_person ON evidence_links(source_person_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_created_by ON evidence_links(created_by);

-- =========================================================================
-- RLS
-- =========================================================================
-- auth.uid() is wrapped in a scalar subquery throughout. Postgres then
-- evaluates it once per query rather than once per row, which the Supabase
-- advisor flags as `auth_rls_initplan`. Semantics are unchanged.
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_links ENABLE ROW LEVEL SECURITY;

-- Admins manage everything (mirrors the experiments/proposals model).
CREATE POLICY "Admins can manage all work_items"
  ON work_items FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can manage all decisions"
  ON decisions FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can manage all work_item_events"
  ON work_item_events FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can manage all evidence_links"
  ON evidence_links FOR ALL TO authenticated
  USING (is_admin((SELECT auth.uid()))) WITH CHECK (is_admin((SELECT auth.uid())));

-- Clients may READ the work inventory for their own projects. A shared view is
-- the point of the experiment, so withholding it by default would make CGT
-- itself the thing preventing work from being visible. Write access stays with
-- CGT: corrections are captured in session and attributed via
-- work_item_events.actor_person_id.
CREATE POLICY "Clients can view visible work_items for their projects"
  ON work_items FOR SELECT TO authenticated
  USING (
    client_visible = TRUE
    AND project_id IN (
      SELECT project_clients.project_id FROM project_clients
      WHERE project_clients.client_id = (SELECT auth.uid())
    )
  );

-- Decisions are internal unless explicitly shared.
CREATE POLICY "Clients can view shared decisions for their projects"
  ON decisions FOR SELECT TO authenticated
  USING (
    client_visible = TRUE
    AND project_id IN (
      SELECT project_clients.project_id FROM project_clients
      WHERE project_clients.client_id = (SELECT auth.uid())
    )
  );

-- Evidence links follow the visibility of their subject.
CREATE POLICY "Clients can view evidence_links for visible subjects"
  ON evidence_links FOR SELECT TO authenticated
  USING (
    (
      subject_work_item_id IS NOT NULL
      AND subject_work_item_id IN (
        SELECT wi.id FROM work_items wi
        WHERE wi.client_visible = TRUE
          AND wi.project_id IN (
            SELECT project_clients.project_id FROM project_clients
            WHERE project_clients.client_id = (SELECT auth.uid())
          )
      )
    )
    OR (
      subject_decision_id IS NOT NULL
      AND subject_decision_id IN (
        SELECT d.id FROM decisions d
        WHERE d.client_visible = TRUE
          AND d.project_id IN (
            SELECT project_clients.project_id FROM project_clients
            WHERE project_clients.client_id = (SELECT auth.uid())
          )
      )
    )
  );

-- work_item_events is CGT's internal maintenance and effort log (it measures
-- Paul's administrative cost, not the client's work), so it has no client
-- policy. Deliberate: clients see the inventory, not CGT's bookkeeping.

COMMENT ON TABLE work_items IS
  'Inventory of a project''s requested/planned/committed/active/waiting/blocked work. Produced by an experiment but outlives it (experiment_id is nullable).';
COMMENT ON TABLE decisions IS
  'Durable decision records with rationale, rejected alternatives, and supersession. The substrate for answering "why did we decide that?" in a fresh session.';
COMMENT ON TABLE work_item_events IS
  'Append-only log of discovery, correction, validation and maintenance effort for the work inventory. Internal to CGT.';
COMMENT ON TABLE evidence_links IS
  'Provenance for work items and decisions. Real FKs where the source is a table; source_utterance_ids is TEXT[] because utterances live in engagement_transcripts.utterances JSONB.';
COMMENT ON COLUMN work_items.in_initial_inventory IS
  'FALSE = discovered after the initial inventory was agreed. Powers the EXP-003 measure "items discovered after the initial interview".';
COMMENT ON COLUMN work_item_events.effort_minutes IS
  'Deliberate administrative effort, excluding time doing the work itself. Powers the EXP-003 constraint of <=15 min/working day.';
COMMENT ON COLUMN decisions.informed_by_view IS
  'TRUE only when the shared work inventory actually informed this decision. Powers the EXP-003 measure "decisions the view helps Christie make".';
