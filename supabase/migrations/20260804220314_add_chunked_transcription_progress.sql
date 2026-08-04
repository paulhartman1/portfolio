ALTER TABLE engagement_transcripts
  ADD COLUMN IF NOT EXISTS processing_mode TEXT NOT NULL DEFAULT 'assembled'
    CHECK (processing_mode IN ('assembled', 'chunked')),
  ADD COLUMN IF NOT EXISTS total_parts INTEGER,
  ADD COLUMN IF NOT EXISTS processed_parts INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS engagement_transcript_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES engagement_transcripts(id) ON DELETE CASCADE,
  recording_chunk_id UUID NOT NULL REFERENCES engagement_recording_chunks(id) ON DELETE CASCADE,
  part_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  offset_seconds NUMERIC NOT NULL DEFAULT 0,
  duration_seconds NUMERIC,
  utterances JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_json JSONB,
  error_details TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transcript_id, recording_chunk_id),
  UNIQUE(transcript_id, part_index)
);

CREATE INDEX IF NOT EXISTS idx_engagement_transcript_parts_transcript_id
  ON engagement_transcript_parts(transcript_id, part_index);

ALTER TABLE engagement_transcript_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all engagement_transcript_parts"
  ON engagement_transcript_parts FOR ALL
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

CREATE POLICY "Clients can view transcript parts on assigned projects"
  ON engagement_transcript_parts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM engagement_transcripts et
      JOIN engagement_recordings er ON er.id = et.recording_id
      JOIN project_clients pc ON pc.project_id = er.project_id
      WHERE et.id = engagement_transcript_parts.transcript_id
        AND pc.client_id = auth.uid()
    )
  );
