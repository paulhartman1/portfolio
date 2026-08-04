CREATE TABLE IF NOT EXISTS engagement_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL UNIQUE REFERENCES engagement_recordings(id) ON DELETE CASCADE,
  revision_id UUID REFERENCES engagement_recording_revisions(id) ON DELETE SET NULL,
  source_storage_path TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  diarization_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  speaker_count INTEGER,
  duration_seconds NUMERIC,
  full_text TEXT NOT NULL DEFAULT '',
  utterances JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_json JSONB,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
  error_details TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_transcripts_recording_id
  ON engagement_transcripts(recording_id);

ALTER TABLE engagement_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all engagement_transcripts"
  ON engagement_transcripts FOR ALL
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

CREATE POLICY "Clients can view transcripts on assigned projects"
  ON engagement_transcripts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM engagement_recordings er
      JOIN project_clients pc ON pc.project_id = er.project_id
      WHERE er.id = engagement_transcripts.recording_id
        AND pc.client_id = auth.uid()
    )
  );
