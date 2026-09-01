-- Phone-as-microphone pairing for the client-facing screen recorder.
-- Extends engagement_recordings/engagement_recording_chunks with a mic-source
-- concept and adds a narrowly-scoped, short-lived pairing table so a second
-- device (phone) can contribute microphone audio to an existing recording
-- without any new session/evidence architecture.

ALTER TABLE engagement_recordings
  ADD COLUMN IF NOT EXISTS mic_source TEXT NOT NULL DEFAULT 'browser'
    CHECK (mic_source IN ('browser', 'phone', 'none'));

ALTER TABLE engagement_recording_chunks
  ADD COLUMN IF NOT EXISTS media_source TEXT NOT NULL DEFAULT 'browser_mic'
    CHECK (media_source IN ('browser_mic', 'phone_mic'));

-- Link the (still single-blob) screen video upload to its recording session,
-- without altering how project_files itself is written.
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES engagement_recordings(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS engagement_mic_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES engagement_recordings(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'opened', 'permission_pending', 'active', 'disconnected', 'revoked', 'error')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  phone_started_at TIMESTAMPTZ,
  server_started_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_engagement_mic_pairings_recording_id ON engagement_mic_pairings(recording_id);

ALTER TABLE engagement_mic_pairings ENABLE ROW LEVEL SECURITY;

-- Only admins/service-role mutate pairings directly. The phone itself never
-- authenticates with Supabase; it only calls token-validated API routes that
-- use the service-role client internally (same trust boundary as the
-- existing chunk-upload route).
CREATE POLICY "Admins can manage all engagement_mic_pairings"
  ON engagement_mic_pairings FOR ALL
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

-- Clients watch pairing status for their own project's recording (used by
-- the portal's Record Screen panel to show "Waiting for phone..." etc).
-- This exposes only status/timestamps -- never the token itself, which is
-- never stored in this table (only its hash).
CREATE POLICY "Clients can view mic pairings on assigned projects"
  ON engagement_mic_pairings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM engagement_recordings er
      JOIN project_clients pc ON pc.project_id = er.project_id
      WHERE er.id = engagement_mic_pairings.recording_id
      AND pc.client_id = auth.uid()
    )
  );
