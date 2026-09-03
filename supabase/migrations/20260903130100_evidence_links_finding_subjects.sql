-- Let evidence_links carry the citations of a reviewed experiment finding.
--
-- An AskCGT conclusion can cite eight evidence types. Neither pre-existing
-- evidence table can hold that:
--   * project_intelligence_candidate_evidence requires transcript_id NOT NULL
--     and utterance_ids NOT NULL — transcript utterances only;
--   * transcript_observation_evidence additionally requires char offsets and
--     second offsets, all NOT NULL — a transcript span only.
--
-- evidence_links is already CGT's canonical typed-reference pattern: one real
-- foreign key per source type, plus a TEXT[] for transcript utterances (which
-- live inside engagement_transcripts.utterances JSONB and therefore cannot be
-- referenced). Extending it keeps citations as typed references with full
-- canonical identifiers, rather than storing them as formatted display
-- strings, and avoids a third near-copy of the same table shape.

-- =========================================================================
-- New subject: a reviewed finding
-- =========================================================================
ALTER TABLE evidence_links
  ADD COLUMN IF NOT EXISTS subject_finding_id UUID
    REFERENCES experiment_findings(id) ON DELETE CASCADE;

-- =========================================================================
-- New sources: the experiment record and its proposal
-- =========================================================================
-- AskCGT can already cite an experiment or a connected proposal, and those are
-- often the ONLY support for a claim about scope, approval, or decision
-- criteria — exactly the claims most worth reviewing. Without these columns
-- such a citation could not be preserved on acceptance.
ALTER TABLE evidence_links
  ADD COLUMN IF NOT EXISTS source_experiment_id UUID
    REFERENCES experiments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_proposal_id UUID
    REFERENCES proposals(id) ON DELETE SET NULL;

-- =========================================================================
-- Constraints
-- =========================================================================
-- Exactly one subject, now across three possibilities.
ALTER TABLE evidence_links DROP CONSTRAINT IF EXISTS evidence_links_one_subject;
ALTER TABLE evidence_links
  ADD CONSTRAINT evidence_links_one_subject CHECK (
    (subject_work_item_id IS NOT NULL)::int
    + (subject_decision_id IS NOT NULL)::int
    + (subject_finding_id IS NOT NULL)::int
    = 1
  );

-- source_kind must cover the two new source types.
ALTER TABLE evidence_links DROP CONSTRAINT IF EXISTS evidence_links_source_kind_check;
ALTER TABLE evidence_links
  ADD CONSTRAINT evidence_links_source_kind_check CHECK (
    source_kind IN (
      'transcript_utterance', 'observation', 'session_marker',
      'intelligence_candidate', 'email_source', 'project_file',
      'work_item', 'decision', 'experiment', 'proposal',
      'stated_by_person', 'external'
    )
  );

-- A link must still point at something or say why it cannot.
ALTER TABLE evidence_links DROP CONSTRAINT IF EXISTS evidence_links_has_source;
ALTER TABLE evidence_links
  ADD CONSTRAINT evidence_links_has_source CHECK (
    source_transcript_id IS NOT NULL
    OR source_observation_id IS NOT NULL
    OR source_marker_id IS NOT NULL
    OR source_candidate_id IS NOT NULL
    OR source_email_id IS NOT NULL
    OR source_file_id IS NOT NULL
    OR source_work_item_id IS NOT NULL
    OR source_decision_id IS NOT NULL
    OR source_experiment_id IS NOT NULL
    OR source_proposal_id IS NOT NULL
    OR source_person_id IS NOT NULL
    OR source_label IS NOT NULL
    OR note IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_evidence_links_subject_finding ON evidence_links(subject_finding_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_experiment ON evidence_links(source_experiment_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source_proposal ON evidence_links(source_proposal_id);

-- =========================================================================
-- RLS
-- =========================================================================
-- Links follow the visibility of their subject. Finding-subject links are
-- visible to a client only when the finding itself has been shared.
DROP POLICY IF EXISTS "Clients can view evidence_links for visible subjects" ON evidence_links;
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
    OR (
      subject_finding_id IS NOT NULL
      AND subject_finding_id IN (
        SELECT f.id FROM experiment_findings f
        WHERE f.client_visible = TRUE
          AND f.project_id IN (
            SELECT project_clients.project_id FROM project_clients
            WHERE project_clients.client_id = (SELECT auth.uid())
          )
      )
    )
  );

COMMENT ON COLUMN evidence_links.subject_finding_id IS
  'The reviewed experiment finding this citation supports. Preserves the finding''s canonical typed evidence references.';
