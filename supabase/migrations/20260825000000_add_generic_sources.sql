-- Generic external ingestion boundary: SOURCE -> SOURCE REPRESENTATION.
--
-- A `source` is CGT's durable, immutable, provenance-complete record of one
-- arrival event from the outside world (an email, eventually a Slack
-- message, an uploaded document, etc). It captures WHAT ARRIVED, WHEN, and
-- THROUGH WHAT TRANSPORT -- never an interpretation of the content.
--
-- A `source_representation` is a derived, evidence-anchorable text form of a
-- source (e.g. the extracted plain-text body of an email). Representations
-- are intentionally shape-agnostic: a plain-text email does not need to
-- pretend it has utterances, speakers, or a duration the way an
-- engagement_transcript does.
--
-- This migration is purely additive. It does not touch engagement_recordings
-- behavior, engagement_transcripts, transcript_observations, or any existing
-- pipeline. Nothing here creates organizational knowledge -- there is no
-- observation/evidence linkage yet by design.

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resolved CGT context. Nullable: a source can arrive before CGT knows
  -- which project/engagement it belongs to.
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- What kind of thing arrived, and how it got here. `source_kind` is the
  -- content/domain type (email, slack_message, document, ...). `transport`
  -- is the specific delivery mechanism (cloudflare-email, ...). Kept as free
  -- TEXT with a narrow CHECK on source_kind rather than an enum so new
  -- transports don't require a type migration.
  source_kind TEXT NOT NULL CHECK (source_kind IN ('email')),
  transport TEXT NOT NULL,

  -- Idempotency. Scoped to (transport, external_id) rather than a bare
  -- global unique external_id: identifiers are only guaranteed unique within
  -- the transport that issued them (an email Message-ID and a future Slack
  -- message ts are not comparable namespaces).
  external_id TEXT NOT NULL,

  -- Provenance timestamps and endpoints.
  received_at TIMESTAMPTZ NOT NULL,
  sender TEXT,
  recipient TEXT,

  -- Immutable raw payload location. CGT owns this storage; the transport
  -- never writes directly to it.
  raw_storage_bucket TEXT NOT NULL,
  raw_storage_path TEXT NOT NULL,

  -- WHAT ARRIVED vs HOW CGT RESOLVED IT. `claimed_context` is the sender's
  -- unverified assertion (e.g. "alpine"). `context_resolution` records the
  -- method used to arrive at `project_id` (or that it remains unresolved).
  -- Explicit context always outranks inference; there is no inference in
  -- this version.
  claimed_context TEXT,
  context_resolution TEXT NOT NULL DEFAULT 'unresolved'
    CHECK (context_resolution IN ('unresolved', 'explicit_slug', 'explicit_project_id')),

  -- Transport-specific provenance metadata that doesn't warrant its own
  -- column (subject line, worker version, header excerpts, etc).
  transport_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (transport, external_id)
);

CREATE INDEX IF NOT EXISTS idx_sources_project_id ON sources(project_id);
CREATE INDEX IF NOT EXISTS idx_sources_source_kind ON sources(source_kind);
CREATE INDEX IF NOT EXISTS idx_sources_received_at ON sources(received_at DESC);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Ingestion happens server-side via the service role client (verified by
-- HMAC, not Supabase auth), so it bypasses RLS entirely. These policies only
-- govern authenticated human/admin access to already-ingested sources.
CREATE POLICY "Admins can manage all sources"
  ON sources FOR ALL
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

CREATE TABLE IF NOT EXISTS source_representations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

  -- 'plain_text' and 'document_text' are flat strings anchored by character
  -- offset (future evidence work). 'conversation' and 'diarized_transcript'
  -- are turn/utterance-shaped and are expected to use structured_content
  -- instead of (or in addition to) text_content. No representation kind is
  -- required to fake fields it doesn't have.
  representation_kind TEXT NOT NULL
    CHECK (representation_kind IN ('plain_text', 'conversation', 'diarized_transcript', 'document_text')),

  text_content TEXT NOT NULL DEFAULT '',
  structured_content JSONB,

  language TEXT NOT NULL DEFAULT 'en',
  extraction_method TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('processing', 'complete', 'failed')),
  error_details TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_representations_source_id ON source_representations(source_id);

ALTER TABLE source_representations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all source_representations"
  ON source_representations FOR ALL
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

-- Private storage for immutable raw source payloads (raw MIME emails, and
-- later other transports' raw payloads). 25MB is comfortably within the
-- default project-wide limit (no Pro-plan override needed, unlike the
-- 500MB engagement-recordings bucket).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('external-sources', 'external-sources', FALSE, 26214400)
ON CONFLICT (id) DO NOTHING;

-- Additive, optional link from the existing recording pipeline to the
-- generic source model. Nullable, unused by current recording/transcription
-- code paths. This establishes that engagement_recordings can eventually
-- become a recording-specific subtype of a generic source (a strangler
-- migration), without requiring any change to existing recording behavior.
ALTER TABLE engagement_recordings
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_engagement_recordings_source_id ON engagement_recordings(source_id);
