-- Add connectors table for journey map flow lines

CREATE TABLE IF NOT EXISTS journey_map_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
  from_note_id UUID NOT NULL REFERENCES journey_map_notes(id) ON DELETE CASCADE,
  to_note_id UUID NOT NULL REFERENCES journey_map_notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(map_id, from_note_id, to_note_id)
);

CREATE INDEX IF NOT EXISTS idx_journey_map_connectors_map_id ON journey_map_connectors(map_id);

-- Enable RLS
ALTER TABLE journey_map_connectors ENABLE ROW LEVEL SECURITY;

-- Connectors follow the same access patterns as notes
CREATE POLICY "Anyone can view connectors on public journey maps"
  ON journey_map_connectors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      WHERE journey_maps.id = journey_map_connectors.map_id
      AND journey_maps.is_public = TRUE
    )
  );

CREATE POLICY "Clients can view connectors on own project journey maps"
  ON journey_map_connectors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN projects ON projects.id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_connectors.map_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can manage connectors on own project journey maps"
  ON journey_map_connectors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN projects ON projects.id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_connectors.map_id
      AND projects.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN projects ON projects.id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_connectors.map_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all journey map connectors"
  ON journey_map_connectors FOR ALL
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
