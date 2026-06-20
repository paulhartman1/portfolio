-- User Journey Mapping Tool
-- Allows creating interactive journey maps with sticky notes

-- Journey maps table
CREATE TABLE IF NOT EXISTS journey_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_maps_project_id ON journey_maps(project_id);
CREATE INDEX IF NOT EXISTS idx_journey_maps_slug ON journey_maps(slug);
CREATE INDEX IF NOT EXISTS idx_journey_maps_is_public ON journey_maps(is_public);

-- Journey map notes (sticky notes)
CREATE TABLE IF NOT EXISTS journey_map_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue', -- blue (persona), green (touchpoint), red (pain), yellow (opportunity)
  x_position NUMERIC NOT NULL DEFAULT 0,
  y_position NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 200,
  height NUMERIC NOT NULL DEFAULT 200,
  z_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_map_notes_map_id ON journey_map_notes(map_id);

-- Enable RLS
ALTER TABLE journey_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_map_notes ENABLE ROW LEVEL SECURITY;

-- Journey maps policies
CREATE POLICY "Anyone can view public journey maps"
  ON journey_maps FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Clients can view journey maps on own projects"
  ON journey_maps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = journey_maps.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update journey maps on own projects"
  ON journey_maps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = journey_maps.project_id
      AND projects.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = journey_maps.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all journey maps"
  ON journey_maps FOR ALL
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

-- Journey map notes policies
CREATE POLICY "Anyone can view notes on public journey maps"
  ON journey_map_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      WHERE journey_maps.id = journey_map_notes.map_id
      AND journey_maps.is_public = TRUE
    )
  );

CREATE POLICY "Clients can view notes on own project journey maps"
  ON journey_map_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN projects ON projects.id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_notes.map_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can manage notes on own project journey maps"
  ON journey_map_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN projects ON projects.id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_notes.map_id
      AND projects.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN projects ON projects.id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_notes.map_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all journey map notes"
  ON journey_map_notes FOR ALL
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
