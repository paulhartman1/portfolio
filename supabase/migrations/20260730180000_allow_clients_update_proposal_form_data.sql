-- Allow clients to update proposal_form_data on their assigned projects
CREATE POLICY "Clients can update proposal form data on their projects"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = projects.id
      AND project_clients.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = projects.id
      AND project_clients.client_id = auth.uid()
    )
  );
