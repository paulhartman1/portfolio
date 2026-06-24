-- Add many-to-many relationship between projects and clients
-- A project can have multiple clients logging into it

-- Create junction table for project-client relationships
CREATE TABLE IF NOT EXISTS project_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_project_clients_project_id ON project_clients(project_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_client_id ON project_clients(client_id);

ALTER TABLE project_clients ENABLE ROW LEVEL SECURITY;

-- Clients can view their project relationships
CREATE POLICY "Clients can view own project relationships"
  ON project_clients FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Admins can manage project-client relationships
CREATE POLICY "Admins can manage project relationships"
  ON project_clients FOR ALL
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

-- Migrate existing project.client_id relationships to project_clients table
INSERT INTO project_clients (project_id, client_id)
SELECT id, client_id
FROM projects
WHERE client_id IS NOT NULL
ON CONFLICT (project_id, client_id) DO NOTHING;

-- Update project RLS policies to use the junction table
-- Drop old policy that checks client_id directly
DROP POLICY IF EXISTS "Clients can view their own projects" ON projects;

-- Create new policy that checks project_clients junction table
CREATE POLICY "Clients can view projects they are assigned to"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = projects.id
      AND project_clients.client_id = auth.uid()
    )
  );

-- Update review_comments policies to use junction table
DROP POLICY IF EXISTS "Clients can view comments on their projects" ON review_comments;
DROP POLICY IF EXISTS "Clients can create comments on their projects" ON review_comments;

CREATE POLICY "Clients can view comments on assigned projects"
  ON review_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = review_comments.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create comments on assigned projects"
  ON review_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = review_comments.project_id
      AND project_clients.client_id = auth.uid()
    )
  );

-- Update project_approvals policies to use junction table (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_approvals') THEN
    DROP POLICY IF EXISTS "Clients can view approvals on own projects" ON project_approvals;
    DROP POLICY IF EXISTS "Clients can respond to approvals on own projects" ON project_approvals;

    CREATE POLICY "Clients can view approvals on assigned projects"
      ON project_approvals FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = project_approvals.project_id
          AND project_clients.client_id = auth.uid()
        )
      );

    CREATE POLICY "Clients can respond to approvals on assigned projects"
      ON project_approvals FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = project_approvals.project_id
          AND project_clients.client_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = project_approvals.project_id
          AND project_clients.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Update project_updates policies to use junction table (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_updates') THEN
    DROP POLICY IF EXISTS "Clients can view non-internal updates on own projects" ON project_updates;
    DROP POLICY IF EXISTS "Clients can create own project notes" ON project_updates;

    CREATE POLICY "Clients can view non-internal updates on assigned projects"
      ON project_updates FOR SELECT
      TO authenticated
      USING (
        is_internal = FALSE
        AND EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = project_updates.project_id
          AND project_clients.client_id = auth.uid()
        )
      );

    CREATE POLICY "Clients can create notes on assigned projects"
      ON project_updates FOR INSERT
      TO authenticated
      WITH CHECK (
        is_internal = FALSE
        AND author_role = 'client'
        AND authored_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = project_updates.project_id
          AND project_clients.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Update project_files policies to use junction table (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_files') THEN
    DROP POLICY IF EXISTS "Clients can view files on own projects" ON project_files;
    DROP POLICY IF EXISTS "Clients can upload files to own projects" ON project_files;

    CREATE POLICY "Clients can view files on assigned projects"
      ON project_files FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = project_files.project_id
          AND project_clients.client_id = auth.uid()
        )
      );

    CREATE POLICY "Clients can upload files to assigned projects"
      ON project_files FOR INSERT
      TO authenticated
      WITH CHECK (
        uploader_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = project_files.project_id
          AND project_clients.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Update storage policies to use junction table (storage.objects always exists)
DROP POLICY IF EXISTS "Clients can read storage objects for own projects" ON storage.objects;
DROP POLICY IF EXISTS "Clients can upload storage objects for own projects" ON storage.objects;

CREATE POLICY "Clients can read storage objects for assigned projects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      EXISTS (
        SELECT 1 FROM project_clients
        WHERE project_clients.project_id::TEXT = split_part(storage.objects.name, '/', 1)
        AND project_clients.client_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
      )
    )
  );

CREATE POLICY "Clients can upload storage objects for assigned projects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-files'
    AND (
      EXISTS (
        SELECT 1 FROM project_clients
        WHERE project_clients.project_id::TEXT = split_part(storage.objects.name, '/', 1)
        AND project_clients.client_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
      )
    )
  );

-- Note: client_messages was originally direct client-admin messaging.
-- It was later migrated to project-based messaging in 20260624_project_based_messages.sql

-- Update journey_maps policies to use junction table (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journey_maps') THEN
    DROP POLICY IF EXISTS "Clients can view journey maps on own projects" ON journey_maps;
    DROP POLICY IF EXISTS "Clients can update journey maps on own projects" ON journey_maps;

    CREATE POLICY "Clients can view journey maps on assigned projects"
      ON journey_maps FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = journey_maps.project_id
          AND project_clients.client_id = auth.uid()
        )
      );

    CREATE POLICY "Clients can update journey maps on assigned projects"
      ON journey_maps FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = journey_maps.project_id
          AND project_clients.client_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM project_clients
          WHERE project_clients.project_id = journey_maps.project_id
          AND project_clients.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Update journey_map_notes policies to use junction table (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journey_map_notes') THEN
    DROP POLICY IF EXISTS "Clients can view notes on own project journey maps" ON journey_map_notes;
    DROP POLICY IF EXISTS "Clients can manage notes on own project journey maps" ON journey_map_notes;

    CREATE POLICY "Clients can view notes on assigned project journey maps"
      ON journey_map_notes FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journey_maps
          JOIN project_clients ON project_clients.project_id = journey_maps.project_id
          WHERE journey_maps.id = journey_map_notes.map_id
          AND project_clients.client_id = auth.uid()
        )
      );

    CREATE POLICY "Clients can manage notes on assigned project journey maps"
      ON journey_map_notes FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journey_maps
          JOIN project_clients ON project_clients.project_id = journey_maps.project_id
          WHERE journey_maps.id = journey_map_notes.map_id
          AND project_clients.client_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journey_maps
          JOIN project_clients ON project_clients.project_id = journey_maps.project_id
          WHERE journey_maps.id = journey_map_notes.map_id
          AND project_clients.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Note: projects.client_id column is kept for backward compatibility
-- and can be used as the "primary" client if needed in the UI
-- It is no longer used in RLS policies
