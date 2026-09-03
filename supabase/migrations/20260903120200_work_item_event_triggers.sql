-- Guarantee the work-item audit trail in the database.
--
-- EXP-003 requires Christie's corrections to be PRESERVED and late-discovered
-- work to record HOW AND WHEN it was found. If that log depends on the UI
-- remembering to write a second row, it will be incomplete exactly when it
-- matters — and an incomplete correction log silently understates how wrong
-- CGT's interpretation was.
--
-- So the log is produced by triggers, not by callers. Any write path (admin
-- UI, API route, SQL console, future import) produces the same trail.
--
-- Division of responsibility:
--   * Triggers own CHANGE events: discovered, state_changed, owner_changed,
--     next_action_changed, corrected, confirmed, disputed, removed.
--   * Callers own JUDGEMENT events the database cannot infer: 'note', and the
--     inventory-wide 'inventory_maintained' / 'inventory_reviewed' rows that
--     carry effort_minutes.
-- Callers must therefore NOT write change events, or the log would double-count.

CREATE OR REPLACE FUNCTION log_work_item_discovered()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  INSERT INTO work_item_events (
    project_id, experiment_id, work_item_id, event_type,
    actor_profile_id, to_state, note, occurred_at, created_by
  ) VALUES (
    NEW.project_id, NEW.experiment_id, NEW.id, 'discovered',
    auth.uid(), NEW.state,
    -- The discovery method and whether it was in the baseline are the two
    -- facts the "discovered late" measure depends on, so they are captured in
    -- the event itself and not only on the mutable row.
    format('discovery_method=%s; in_initial_inventory=%s', NEW.discovery_method, NEW.in_initial_inventory),
    NEW.discovered_at, auth.uid()
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_items_log_discovered ON work_items;
CREATE TRIGGER trg_work_items_log_discovered
  AFTER INSERT ON work_items
  FOR EACH ROW EXECUTE FUNCTION log_work_item_discovered();

CREATE OR REPLACE FUNCTION log_work_item_changes()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
  validation_event TEXT;
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO work_item_events (
      project_id, experiment_id, work_item_id, event_type,
      actor_profile_id, from_state, to_state, field_changed, created_by
    ) VALUES (
      NEW.project_id, NEW.experiment_id, NEW.id, 'state_changed',
      auth.uid(), OLD.state, NEW.state, 'state', auth.uid()
    );
  END IF;

  IF NEW.owner_person_id IS DISTINCT FROM OLD.owner_person_id THEN
    INSERT INTO work_item_events (
      project_id, experiment_id, work_item_id, event_type,
      actor_profile_id, field_changed, previous_value, created_by
    ) VALUES (
      NEW.project_id, NEW.experiment_id, NEW.id, 'owner_changed',
      auth.uid(), 'owner_person_id', OLD.owner_person_id::text, auth.uid()
    );
  END IF;

  IF NEW.next_action IS DISTINCT FROM OLD.next_action THEN
    INSERT INTO work_item_events (
      project_id, experiment_id, work_item_id, event_type,
      actor_profile_id, field_changed, previous_value, created_by
    ) VALUES (
      NEW.project_id, NEW.experiment_id, NEW.id, 'next_action_changed',
      auth.uid(), 'next_action', OLD.next_action, auth.uid()
    );
  END IF;

  -- Validation transitions. actor_person_id is copied from
  -- validated_by_person_id so a correction by Christie is attributable to
  -- Christie, not merely to whoever was typing.
  IF NEW.validation_state IS DISTINCT FROM OLD.validation_state
     AND NEW.validation_state <> 'unvalidated' THEN
    validation_event := CASE NEW.validation_state
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'corrected' THEN 'corrected'
      WHEN 'disputed'  THEN 'disputed'
      WHEN 'removed'   THEN 'removed'
    END;

    INSERT INTO work_item_events (
      project_id, experiment_id, work_item_id, event_type,
      actor_person_id, actor_profile_id, field_changed, previous_value,
      occurred_at, created_by
    ) VALUES (
      NEW.project_id, NEW.experiment_id, NEW.id, validation_event,
      NEW.validated_by_person_id, auth.uid(), 'validation_state', OLD.validation_state,
      COALESCE(NEW.validated_at, NOW()), auth.uid()
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_items_log_changes ON work_items;
CREATE TRIGGER trg_work_items_log_changes
  AFTER UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION log_work_item_changes();

COMMENT ON FUNCTION log_work_item_discovered() IS
  'Appends the "discovered" event for a new work item, capturing discovery_method and in_initial_inventory at insert time.';
COMMENT ON FUNCTION log_work_item_changes() IS
  'Appends state/owner/next_action/validation change events. Callers must not write these event types directly.';
