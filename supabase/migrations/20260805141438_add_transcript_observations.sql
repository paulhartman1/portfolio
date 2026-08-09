-- Transcript Observations: evidence-backed observations anchored to transcript utterances
-- Part 1: Backfill utterance IDs on existing transcripts (only rows with ≥1 id-less utterance)

UPDATE engagement_transcripts et
SET utterances = (
  SELECT jsonb_agg(
    CASE WHEN elem ? 'id' THEN elem ELSE elem || jsonb_build_object('id', gen_random_uuid()::text) END
    ORDER BY ord
  )
  FROM jsonb_array_elements(et.utterances) WITH ORDINALITY AS t(elem, ord)
)
WHERE jsonb_typeof(et.utterances) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(et.utterances) e WHERE NOT (e ? 'id')
  );

-- Part 2: transcript_observations table

CREATE TABLE IF NOT EXISTS transcript_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES engagement_transcripts(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_observations_transcript_id
  ON transcript_observations(transcript_id);

ALTER TABLE transcript_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all transcript_observations"
  ON transcript_observations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Part 3: transcript_observation_evidence table

CREATE TABLE IF NOT EXISTS transcript_observation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES transcript_observations(id) ON DELETE CASCADE,
  start_utterance_id UUID NOT NULL,
  start_char_offset INTEGER NOT NULL CHECK (start_char_offset >= 0),
  end_utterance_id UUID NOT NULL,
  end_char_offset INTEGER NOT NULL CHECK (end_char_offset >= 0),
  start_seconds NUMERIC NOT NULL,
  end_seconds NUMERIC NOT NULL,
  excerpt_text TEXT NOT NULL,
  speaker_labels TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_observation_evidence_observation_id
  ON transcript_observation_evidence(observation_id);

ALTER TABLE transcript_observation_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all transcript_observation_evidence"
  ON transcript_observation_evidence FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );