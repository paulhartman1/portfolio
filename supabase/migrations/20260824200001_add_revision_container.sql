-- Add container field to engagement_recording_revisions for media format tracking
ALTER TABLE engagement_recording_revisions
  ADD COLUMN IF NOT EXISTS container TEXT;