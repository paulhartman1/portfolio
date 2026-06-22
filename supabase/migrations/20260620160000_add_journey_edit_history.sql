-- Add edit history tracking for journey maps

CREATE TABLE IF NOT EXISTS journey_map_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  snapshot JSONB NOT NULL, -- Stores notes and connectors at time of edit
  change_summary TEXT, -- Optional description of what changed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_map_history_map_id ON journey_map_history(map_id);
CREATE INDEX IF NOT EXISTS idx_journey_map_history_created_at ON journey_map_history(created_at DESC);

-- Enable RLS
ALTER TABLE journey_map_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view history
CREATE POLICY "Admins can view all journey map history"
  ON journey_map_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Admins can delete history entries
CREATE POLICY "Admins can manage journey map history"
  ON journey_map_history FOR ALL
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

-- Function to automatically create history snapshot before updates
CREATE OR REPLACE FUNCTION capture_journey_map_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  note_data JSONB;
  connector_data JSONB;
  editor_id UUID;
BEGIN
  -- Get current user (or use system if not available)
  editor_id := auth.uid();
  
  -- Get current notes
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'content', content,
      'color', color,
      'x', x_position,
      'y', y_position,
      'width', width,
      'height', height,
      'z_index', z_index
    ) ORDER BY z_index
  ) INTO note_data
  FROM journey_map_notes
  WHERE map_id = OLD.id;
  
  -- Get current connectors
  SELECT jsonb_agg(
    jsonb_build_object(
      'fromId', from_note_id,
      'toId', to_note_id
    )
  ) INTO connector_data
  FROM journey_map_connectors
  WHERE map_id = OLD.id;
  
  -- Insert history record
  IF note_data IS NOT NULL OR connector_data IS NOT NULL THEN
    INSERT INTO journey_map_history (map_id, edited_by, snapshot, change_summary)
    VALUES (
      OLD.id,
      COALESCE(editor_id, OLD.created_by),
      jsonb_build_object(
        'notes', COALESCE(note_data, '[]'::jsonb),
        'connectors', COALESCE(connector_data, '[]'::jsonb),
        'timestamp', NOW()
      ),
      'Snapshot before update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to capture snapshots (disabled by default - enable if you want automatic snapshots)
-- CREATE TRIGGER journey_map_snapshot_trigger
--   BEFORE UPDATE ON journey_maps
--   FOR EACH ROW
--   EXECUTE FUNCTION capture_journey_map_snapshot();
