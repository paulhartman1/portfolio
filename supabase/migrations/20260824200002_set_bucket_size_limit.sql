-- Set file_size_limit on engagement-recordings bucket to 500 MB
-- This overrides the project global limit for this specific bucket.
-- The project must be on a Pro plan (or higher) to support limits > 50 MB.
UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500 MB in bytes
WHERE id = 'engagement-recordings';
