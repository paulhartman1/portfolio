-- Engagement Session MVP: recording metadata + chunk uploads + timestamped notes

CREATE TABLE IF NOT EXISTS engagement_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_type TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'recording', -- recording, paused, finalized, failed
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  final_storage_path TEXT,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_recordings_project_id ON engagement_recordings(project_id);
CREATE INDEX IF NOT EXISTS idx_engagement_recordings_created_at ON engagement_recordings(created_at DESC);

CREATE TABLE IF NOT EXISTS engagement_recording_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES engagement_recordings(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recording_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_engagement_recording_chunks_recording_id ON engagement_recording_chunks(recording_id);

CREATE TABLE IF NOT EXISTS engagement_session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES engagement_recordings(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('observation', 'decision', 'action_item')),
  note_text TEXT NOT NULL,
  timestamp_seconds INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_session_notes_recording_id ON engagement_session_notes(recording_id);

ALTER TABLE engagement_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_recording_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_session_notes ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('engagement-recordings', 'engagement-recordings', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clients can view recordings on assigned projects"
  ON engagement_recordings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = engagement_recordings.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create recordings on assigned projects"
  ON engagement_recordings FOR INSERT
  TO authenticated
  WITH CHECK (
    consent_given = TRUE
    AND EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = engagement_recordings.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update recordings on assigned projects"
  ON engagement_recordings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = engagement_recordings.project_id
      AND project_clients.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = engagement_recordings.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view recording chunks on assigned projects"
  ON engagement_recording_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM engagement_recordings er
      JOIN project_clients pc ON pc.project_id = er.project_id
      WHERE er.id = engagement_recording_chunks.recording_id
      AND pc.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert recording chunks on assigned projects"
  ON engagement_recording_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM engagement_recordings er
      JOIN project_clients pc ON pc.project_id = er.project_id
      WHERE er.id = engagement_recording_chunks.recording_id
      AND pc.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view session notes on assigned projects"
  ON engagement_session_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM engagement_recordings er
      JOIN project_clients pc ON pc.project_id = er.project_id
      WHERE er.id = engagement_session_notes.recording_id
      AND pc.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert session notes on assigned projects"
  ON engagement_session_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM engagement_recordings er
      JOIN project_clients pc ON pc.project_id = er.project_id
      WHERE er.id = engagement_session_notes.recording_id
      AND pc.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all engagement_recordings"
  ON engagement_recordings FOR ALL
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

CREATE POLICY "Admins can manage all engagement_recording_chunks"
  ON engagement_recording_chunks FOR ALL
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

CREATE POLICY "Admins can manage all engagement_session_notes"
  ON engagement_session_notes FOR ALL
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
