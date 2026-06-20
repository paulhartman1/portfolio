-- Seed data for LoveOnDev demo journey map
-- This creates a public demo journey map showing the LoveOnDev client experience

-- Insert the journey map
INSERT INTO journey_maps (id, title, slug, description, is_public, project_id)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'LoveOnDev Client Journey',
  'loveondev',
  'A visual representation of the complete LoveOnDev client experience, from initial discovery through ongoing collaboration.',
  TRUE,
  NULL
) ON CONFLICT (slug) DO NOTHING;

-- Insert journey map notes
INSERT INTO journey_map_notes (map_id, content, color, x_position, y_position, width, height, z_index)
VALUES
  -- Discovery phase
  (
    'a0000000-0000-0000-0000-000000000001',
    'Small Business Owner
Needs modern web presence
Limited technical knowledge',
    'blue',
    50,
    100,
    220,
    180,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'Discovery Call
Initial conversation about goals, timeline, and budget',
    'green',
    320,
    100,
    220,
    150,
    2
  ),
  -- Journey mapping session
  (
    'a0000000-0000-0000-0000-000000000001',
    'Journey Mapping Session
Collaborative workshop to understand user needs',
    'green',
    590,
    100,
    220,
    150,
    3
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'Clarity on User Experience
Client gains deep insight into their customers',
    'yellow',
    590,
    280,
    220,
    140,
    4
  ),
  -- Proposal phase
  (
    'a0000000-0000-0000-0000-000000000001',
    'Proposal & Approval
Custom proposal with timeline and pricing',
    'green',
    860,
    100,
    220,
    150,
    5
  ),
  -- Portal access
  (
    'a0000000-0000-0000-0000-000000000001',
    'Portal Access
Client receives personalized project portal',
    'green',
    1130,
    100,
    220,
    150,
    6
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'Real-Time Visibility
See progress, leave feedback, track approvals',
    'yellow',
    1130,
    280,
    220,
    160,
    7
  ),
  -- Development cycles
  (
    'a0000000-0000-0000-0000-000000000001',
    'Development Cycles
Iterative building with regular check-ins',
    'green',
    50,
    500,
    220,
    150,
    8
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'Uncertainty During Dev
"When will I see it? What if I don''t like it?"',
    'red',
    50,
    680,
    220,
    160,
    9
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'Portal Eliminates Waiting
Preview site updates, provide feedback anytime',
    'yellow',
    320,
    680,
    220,
    160,
    10
  ),
  -- Launch
  (
    'a0000000-0000-0000-0000-000000000001',
    'Launch
Site goes live with full training and documentation',
    'green',
    590,
    500,
    220,
    150,
    11
  ),
  -- Retainer
  (
    'a0000000-0000-0000-0000-000000000001',
    'Ongoing Retainer
Monthly support, updates, and new features',
    'green',
    860,
    500,
    220,
    150,
    12
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'Long-Term Partnership
Continuous improvement based on real user data',
    'yellow',
    860,
    680,
    220,
    140,
    13
  )
ON CONFLICT DO NOTHING;
