-- Make client_id nullable since messages are now project-based
-- client_id is deprecated but kept for backward compatibility with existing data

ALTER TABLE client_messages
ALTER COLUMN client_id DROP NOT NULL;

-- Add comment to clarify the column is deprecated
COMMENT ON COLUMN client_messages.client_id IS 'DEPRECATED: Messages are now scoped by project_id. This column is nullable and kept only for backward compatibility with existing data.';
