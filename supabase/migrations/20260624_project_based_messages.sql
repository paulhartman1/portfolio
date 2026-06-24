-- Convert client_messages from client-to-client to project-based messaging
-- Messages are now scoped to projects, visible to all clients associated with the project

-- Add project_id column to client_messages
ALTER TABLE client_messages
ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Create index for project_id lookups
CREATE INDEX IF NOT EXISTS idx_client_messages_project_id ON client_messages(project_id);

-- Backfill existing messages with project_id from the client's first project
-- (This is a best-effort migration for existing data)
UPDATE client_messages cm
SET project_id = (
  SELECT pc.project_id
  FROM project_clients pc
  WHERE pc.client_id = cm.client_id
  LIMIT 1
)
WHERE cm.project_id IS NULL;

-- Make project_id NOT NULL after backfill
ALTER TABLE client_messages
ALTER COLUMN project_id SET NOT NULL;

-- Drop old client-specific RLS policies
DROP POLICY IF EXISTS "Clients can view their own messages" ON client_messages;
DROP POLICY IF EXISTS "Clients can send messages" ON client_messages;
DROP POLICY IF EXISTS "Clients can mark their messages as read" ON client_messages;

-- Create new project-based RLS policies for clients
CREATE POLICY "Clients can view messages on assigned projects"
  ON client_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = client_messages.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can send messages on assigned projects"
  ON client_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = client_messages.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can mark messages as read on assigned projects"
  ON client_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = client_messages.project_id
      AND project_clients.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = client_messages.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

-- Admin policies remain the same (no changes needed)
-- "Admins can view all messages"
-- "Admins can send messages to clients"
-- "Admins can update messages"

-- Note: client_id is now deprecated but kept for backward compatibility
-- Messages are scoped by project_id, not client_id
-- All clients associated with a project can see all messages for that project
