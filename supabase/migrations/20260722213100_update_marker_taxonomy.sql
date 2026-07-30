-- Update marker taxonomy to five discovery-focused types
-- Replace: observation, decision, action_item
-- With: question, friction, decision, observation, action

-- Drop the old constraint
ALTER TABLE engagement_session_notes 
DROP CONSTRAINT IF EXISTS engagement_session_notes_note_type_check;

-- Add the new constraint with updated taxonomy
ALTER TABLE engagement_session_notes 
ADD CONSTRAINT engagement_session_notes_note_type_check 
CHECK (note_type IN ('question', 'friction', 'decision', 'observation', 'action'));

-- Migrate existing data
-- 'observation' stays as 'observation'
-- 'decision' stays as 'decision'  
-- 'action_item' becomes 'action'
UPDATE engagement_session_notes
SET note_type = 'action'
WHERE note_type = 'action_item';

-- Make note_text optional for one-click marker captures
ALTER TABLE engagement_session_notes 
ALTER COLUMN note_text DROP NOT NULL;
