-- Client portal MVP data model

-- Project approvals
CREATE TABLE IF NOT EXISTS project_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, changes_requested
  due_at TIMESTAMPTZ,
  response_note TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_approvals_project_id ON project_approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_approvals_status ON project_approvals(status);

ALTER TABLE project_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view approvals on own projects"
  ON project_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_approvals.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can respond to approvals on own projects"
  ON project_approvals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_approvals.project_id
      AND projects.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_approvals.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage approvals"
  ON project_approvals FOR ALL
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

-- Project updates
CREATE TABLE IF NOT EXISTS project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'studio', -- studio, client
  authored_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requires_client_action BOOLEAN NOT NULL DEFAULT FALSE,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_created_at ON project_updates(created_at DESC);

ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view non-internal updates on own projects"
  ON project_updates FOR SELECT
  TO authenticated
  USING (
    is_internal = FALSE
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_updates.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create own project notes"
  ON project_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    is_internal = FALSE
    AND author_role = 'client'
    AND authored_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_updates.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage updates"
  ON project_updates FOR ALL
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

-- Project files metadata
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  bucket_name TEXT NOT NULL DEFAULT 'client-files',
  category TEXT NOT NULL DEFAULT 'other', -- logos, photos, copy, brand, other
  mime_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_created_at ON project_files(created_at DESC);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view files on own projects"
  ON project_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can upload files to own projects"
  ON project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage project files metadata"
  ON project_files FOR ALL
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

-- Storage bucket and object access for client files
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clients can read storage objects for own projects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::TEXT = split_part(storage.objects.name, '/', 1)
        AND projects.client_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
      )
    )
  );

CREATE POLICY "Clients can upload storage objects for own projects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-files'
    AND (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::TEXT = split_part(storage.objects.name, '/', 1)
        AND projects.client_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
      )
    )
  );
