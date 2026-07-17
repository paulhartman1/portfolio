-- Fix journey_map_connectors RLS policies to use project_clients junction table
-- The original policies incorrectly referenced projects.client_id which doesn't exist

DROP POLICY IF EXISTS "Clients can view connectors on own project journey maps" ON journey_map_connectors;
DROP POLICY IF EXISTS "Clients can manage connectors on own project journey maps" ON journey_map_connectors;

-- Clients can view connectors via project_clients junction
CREATE POLICY "Clients can view connectors on own project journey maps"
  ON journey_map_connectors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN project_clients ON project_clients.project_id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_connectors.map_id
      AND project_clients.client_id = auth.uid()
    )
  );

-- Clients can manage connectors via project_clients junction
CREATE POLICY "Clients can manage connectors on own project journey maps"
  ON journey_map_connectors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN project_clients ON project_clients.project_id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_connectors.map_id
      AND project_clients.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journey_maps
      JOIN project_clients ON project_clients.project_id = journey_maps.project_id
      WHERE journey_maps.id = journey_map_connectors.map_id
      AND project_clients.client_id = auth.uid()
    )
  );