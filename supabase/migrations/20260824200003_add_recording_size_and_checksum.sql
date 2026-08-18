-- Add size_bytes and checksum_sha256 to engagement_recordings for uploaded video provenance.
ALTER TABLE engagement_recordings
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS checksum_sha256 text;
