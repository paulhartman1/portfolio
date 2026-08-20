-- Project Intelligence: add the action_item candidate type.
-- Accepted action items surface as session markers (note_type='action').

ALTER TABLE project_intelligence_candidates
DROP CONSTRAINT IF EXISTS project_intelligence_candidates_type_check;

ALTER TABLE project_intelligence_candidates
ADD CONSTRAINT project_intelligence_candidates_type_check
CHECK (type IN (
  'follow_up_question',
  'observation',
  'contradiction',
  'knowledge_gap',
  'knowledge_transfer_risk',
  'action_item'
));