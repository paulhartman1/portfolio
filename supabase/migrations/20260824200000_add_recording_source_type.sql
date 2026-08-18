-- Add source type and media metadata to engagement_recordings for video support
ALTER TABLE engagement_recordings
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'browser'
    CHECK (source_type IN ('browser', 'uploaded', 'uploaded_video')),
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS container TEXT;