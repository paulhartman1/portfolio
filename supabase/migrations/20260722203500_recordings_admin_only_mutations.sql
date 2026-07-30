-- Restrict engagement recording mutations to admins only.
-- Keep client read access for assigned projects.

DROP POLICY IF EXISTS "Clients can create recordings on assigned projects" ON engagement_recordings;
DROP POLICY IF EXISTS "Clients can update recordings on assigned projects" ON engagement_recordings;
DROP POLICY IF EXISTS "Clients can insert recording chunks on assigned projects" ON engagement_recording_chunks;
DROP POLICY IF EXISTS "Clients can insert session notes on assigned projects" ON engagement_session_notes;
