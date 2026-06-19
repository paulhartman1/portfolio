-- Client messaging system for direct admin-client communication

CREATE TABLE IF NOT EXISTS client_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_messages_client_id ON client_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_created_at ON client_messages(created_at DESC);

ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;

-- Clients can view messages where they are the client
CREATE POLICY "Clients can view their own messages"
  ON client_messages FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
  );

-- Clients can send messages (they are the sender and the client)
CREATE POLICY "Clients can send messages"
  ON client_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND sender_id = auth.uid()
  );

-- Clients can update read status on their own messages
CREATE POLICY "Clients can mark their messages as read"
  ON client_messages FOR UPDATE
  TO authenticated
  USING (
    client_id = auth.uid()
  )
  WITH CHECK (
    client_id = auth.uid()
  );

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON client_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Admins can send messages to any client
CREATE POLICY "Admins can send messages to clients"
  ON client_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Admins can update messages (e.g., mark as read)
CREATE POLICY "Admins can update messages"
  ON client_messages FOR UPDATE
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