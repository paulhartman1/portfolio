-- Allow clients on assigned projects to update review comment status
-- This enables team members to mark comments as in-progress or resolved

CREATE POLICY "Clients can update comments on assigned projects"
  ON review_comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = review_comments.project_id
      AND project_clients.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = review_comments.project_id
      AND project_clients.client_id = auth.uid()
    )
  );