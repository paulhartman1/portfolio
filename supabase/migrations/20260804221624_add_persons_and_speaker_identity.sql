CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  email TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_persons (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, person_id)
);

CREATE TABLE IF NOT EXISTS engagement_transcript_speaker_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES engagement_transcripts(id) ON DELETE CASCADE,
  provider_speaker_key TEXT NOT NULL,
  display_label TEXT NOT NULL,
  first_appearance_seconds NUMERIC,
  last_appearance_seconds NUMERIC,
  utterance_count INTEGER NOT NULL DEFAULT 0,
  total_speaking_duration NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transcript_id, provider_speaker_key)
);

CREATE TABLE IF NOT EXISTS engagement_speaker_identity_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_cluster_id UUID NOT NULL REFERENCES engagement_transcript_speaker_clusters(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  assignment_method TEXT NOT NULL CHECK (assignment_method IN ('manual_confirmation', 'session_participant_selection', 'contextual_inference')),
  confirmation_state TEXT NOT NULL DEFAULT 'confirmed' CHECK (confirmation_state IN ('confirmed', 'uncertain')),
  confidence NUMERIC,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  superseded_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES engagement_speaker_identity_assignments(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_speaker_identity
  ON engagement_speaker_identity_assignments(speaker_cluster_id)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_persons_project_id ON project_persons(project_id);
CREATE INDEX IF NOT EXISTS idx_speaker_clusters_transcript_id ON engagement_transcript_speaker_clusters(transcript_id);

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_transcript_speaker_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_speaker_identity_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage persons" ON persons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage project persons" ON project_persons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage speaker clusters" ON engagement_transcript_speaker_clusters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage speaker assignments" ON engagement_speaker_identity_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Existing authenticated project clients become reusable persons.
INSERT INTO persons (profile_id, display_name, first_name, last_name, company, email)
SELECT p.id, COALESCE(NULLIF(p.display_name, ''), NULLIF(concat_ws(' ', p.first_name, p.last_name), ''), p.email),
       p.first_name, p.last_name, p.company, p.email
FROM profiles p
JOIN project_clients pc ON pc.client_id = p.id
ON CONFLICT (profile_id) DO NOTHING;

INSERT INTO project_persons (project_id, person_id, source)
SELECT pc.project_id, pe.id, 'project_client'
FROM project_clients pc
JOIN persons pe ON pe.profile_id = pc.client_id
ON CONFLICT DO NOTHING;

-- Create transcript-scoped machine clusters without assigning people.
INSERT INTO engagement_transcript_speaker_clusters (transcript_id, provider_speaker_key, display_label, first_appearance_seconds, last_appearance_seconds, utterance_count, total_speaking_duration)
SELECT et.id, concat('speaker-', u.value->>'speaker'), concat('Speaker ', ((u.value->>'speaker')::integer + 1)),
       min((u.value->>'start')::numeric), max((u.value->>'end')::numeric), count(*), coalesce(sum((u.value->>'end')::numeric - (u.value->>'start')::numeric), 0)
FROM engagement_transcripts et
CROSS JOIN LATERAL jsonb_array_elements(et.utterances) u
WHERE jsonb_typeof(et.utterances) = 'array'
GROUP BY et.id, u.value->>'speaker'
ON CONFLICT (transcript_id, provider_speaker_key) DO NOTHING;
