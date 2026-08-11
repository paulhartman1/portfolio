-- Project Intelligence: reviewable AI-generated candidate insights.
--
-- The model creates candidates. The human reviews, rejects, or accepts them.
-- An accepted observation candidate may become a real transcript_observations
-- row (with anchored utterance evidence). Nothing here silently becomes
-- organizational knowledge.

CREATE TABLE IF NOT EXISTS project_intelligence_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Mandatory explicit project scope. No global client-context blob.
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  transcript_id UUID NOT NULL REFERENCES engagement_transcripts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'follow_up_question',
    'observation',
    'contradiction',
    'knowledge_gap',
    'knowledge_transfer_risk'
  )),
  content TEXT NOT NULL,
  reasoning_summary TEXT,
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  provider TEXT NOT NULL DEFAULT 'ollama',
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'accepted', 'rejected')),
  -- When accepted as an observation, points at the resulting CGT knowledge row.
  accepted_observation_id UUID REFERENCES transcript_observations(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_candidates_project ON project_intelligence_candidates(project_id);
CREATE INDEX IF NOT EXISTS idx_pi_candidates_transcript ON project_intelligence_candidates(transcript_id);
CREATE INDEX IF NOT EXISTS idx_pi_candidates_open
  ON project_intelligence_candidates(status)
  WHERE status = 'candidate';

-- Evidence points at transcript utterance IDs (never copied transcript blobs).
-- Utterance IDs live inside engagement_transcripts.utterances JSONB, so they
-- cannot be foreign keys; the transcript linkage keeps them project-scoped.
CREATE TABLE IF NOT EXISTS project_intelligence_candidate_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES project_intelligence_candidates(id) ON DELETE CASCADE,
  transcript_id UUID NOT NULL REFERENCES engagement_transcripts(id) ON DELETE CASCADE,
  utterance_ids TEXT[] NOT NULL,
  role TEXT NOT NULL DEFAULT 'context' CHECK (role IN ('context', 'supporting', 'contradicting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_candidate_evidence_candidate
  ON project_intelligence_candidate_evidence(candidate_id);

ALTER TABLE project_intelligence_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_intelligence_candidate_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage project_intelligence_candidates"
  ON project_intelligence_candidates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Admins can manage project_intelligence_candidate_evidence"
  ON project_intelligence_candidate_evidence FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));