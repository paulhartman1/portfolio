import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Project-scoped evidence retrieval for AskCGT.
 *
 * Everything is queried through the caller's RLS-enforced Supabase client.
 * Retrieval NEVER bypasses RLS (no service role here) and every query is
 * scoped by project_id so an authenticated user can only ever retrieve
 * evidence their own policies permit. AskCGT never assembles a cross-project
 * blob.
 *
 * The returned context plus the AllowedIds sets feed both prompt construction
 * and output validation: the model may only cite what was actually retrieved.
 */

export type AskCgtTranscript = {
  id: string
  recordingId: string
  title: string
  status: string
  completedAt: string | null
  utterances: Array<{ id: string; start: number; end: number; speakerKey: string; text: string }>
}

export type AskCgtObservation = {
  id: string
  transcriptId: string
  recordingTitle: string | null
  statement: string
  confidence: string
  notes: string | null
  created_at: string
}

export type AskCgtMarker = {
  id: string
  recordingId: string
  recordingTitle: string | null
  noteType: string
  noteText: string | null
  timestampSeconds: number
}

export type AskCgtCandidate = {
  id: string
  transcriptId: string
  recordingTitle: string | null
  type: string
  content: string
  reasoningSummary: string | null
  confidence: number | null
  status: string
  provider: string
  model: string
  evidence: Array<{ transcript_id: string; utterance_ids: string[]; role: string }>
}

export type AskCgtPerson = {
  id: string
  displayName: string
  company: string | null
  title: string | null
}

export type AskCgtSpeakerMap = {
  transcriptId: string
  providerSpeakerKey: string
  personName: string | null
}

export type AskCgtProject = {
  id: string
  name: string
  description: string | null
  status: string
}

export type AskCgtContext = {
  project: AskCgtProject
  people: AskCgtPerson[]
  speakerMaps: AskCgtSpeakerMap[]
  transcripts: AskCgtTranscript[]
  observations: AskCgtObservation[]
  markers: AskCgtMarker[]
  candidates: AskCgtCandidate[]
}

/** The IDs the model is allowed to cite. Built from the retrieved context. */
export type AskCgtAllowedIds = {
  transcripts: Set<string>
  utterancesByTranscript: Map<string, Set<string>>
  observations: Set<string>
  markers: Set<string>
  candidates: Set<string>
}

export type RetrieveResult = {
  context: AskCgtContext
  allowed: AskCgtAllowedIds
  evidenceItemsRetrieved: number
}

type Supabase = SupabaseClient

/** Head+tail cap so a huge organization never sends its whole history. */
function capUtterances<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items
  const head = items.slice(0, Math.ceil(cap / 2))
  const tail = items.slice(-Math.floor(cap / 2))
  return [...head, ...tail]
}

function resolveUtteranceCap(): number {
  const parsed = Number(process.env.ASK_CGT_MAX_UTTERANCES_PER_TRANSCRIPT)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500
}

export async function retrieveProjectEvidence(
  supabase: Supabase,
  projectId: string
): Promise<RetrieveResult> {
  // Project itself. If the caller cannot read this project, the query returns
  // nothing and AskCGT stops here — authorization happens before any evidence
  // is assembled.
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('id, name, description, status')
    .eq('id', projectId)
    .maybeSingle()
  if (projectError) {
    throw new Error(`Failed to load project: ${projectError.message}`)
  }
  if (!projectData) {
    throw new Error('Project not found')
  }
  const project: AskCgtProject = projectData as AskCgtProject

  const [peopleResult, recordingsResult, observationsResult, markersResult, candidatesResult] =
    await Promise.all([
      supabase
        .from('project_persons')
        .select('persons(id, display_name, company, title)')
        .eq('project_id', projectId),
      supabase
        .from('engagement_recordings')
        .select('id, project_id, title, session_type, started_at, source_type, status')
        .eq('project_id', projectId)
        .order('started_at', { ascending: false }),
      supabase
        .from('transcript_observations')
        .select('id, transcript_id, statement, confidence, notes, created_at'),
      supabase
        .from('engagement_session_notes')
        .select('id, recording_id, note_type, note_text, timestamp_seconds'),
      supabase
        .from('project_intelligence_candidates')
        .select('id, transcript_id, type, content, reasoning_summary, confidence, status, provider, model, project_intelligence_candidate_evidence(transcript_id, utterance_ids, role)')
        .eq('project_id', projectId),
    ])

  // Observations are project-scoped via their transcript -> recording -> project.
  // Only keep observations that belong to this project's recordings.
  const recordings = (recordingsResult.data || []) as Array<{
    id: string
    project_id: string
    title: string
  }>
  const recordingIds = recordings.map((r) => r.id)
  const recordingTitleById = new Map(recordings.map((r) => [r.id, r.title]))

  const transcriptsResult = await supabase
    .from('engagement_transcripts')
    .select('id, recording_id, status, completed_at, utterances')
    .in('recording_id', recordingIds)

  const transcripts = (transcriptsResult.data || []) as Array<{
    id: string
    recording_id: string
    status: string
    completed_at: string | null
    utterances: Array<{ id?: string; start?: number; end?: number; speaker?: number; provider_speaker_key?: string; transcript?: string }>
  }>
  const transcriptIds = transcripts.map((t) => t.id)
  const recordingByTranscript = new Map(transcripts.map((t) => [t.id, t.recording_id]))

  // Filter observations/candidates/markers to the project's transcripts/recordings.
  type ObservationRow = {
    id: string
    transcript_id: string
    statement: string
    confidence: string
    notes: string | null
    created_at: string
  }
  const observations: AskCgtObservation[] = ((observationsResult.data || []) as ObservationRow[])
    .filter((o) => transcriptIds.includes(o.transcript_id))
    .map((o) => ({
      id: o.id,
      transcriptId: o.transcript_id,
      recordingTitle: recordingTitleById.get(recordingByTranscript.get(o.transcript_id) || '') || null,
      statement: o.statement,
      confidence: o.confidence,
      notes: o.notes,
      created_at: o.created_at,
    }))

  type MarkerRow = {
    id: string
    recording_id: string
    note_type: string
    note_text: string | null
    timestamp_seconds: number
  }
  const markers: AskCgtMarker[] = ((markersResult.data || []) as MarkerRow[])
    .filter((m) => recordingIds.includes(m.recording_id))
    .map((m) => ({
      id: m.id,
      recordingId: m.recording_id,
      recordingTitle: recordingTitleById.get(m.recording_id) || null,
      noteType: m.note_type,
      noteText: m.note_text,
      timestampSeconds: m.timestamp_seconds,
    }))

  type CandidateEvidenceRow = { transcript_id: string; utterance_ids: string[]; role: string }
  type CandidateRow = {
    id: string
    transcript_id: string
    type: string
    content: string
    reasoning_summary: string | null
    confidence: number | null
    status: string
    provider: string
    model: string
    project_intelligence_candidate_evidence: CandidateEvidenceRow[]
  }
  const candidates: AskCgtCandidate[] = ((candidatesResult.data || []) as CandidateRow[])
    .filter((c) => transcriptIds.includes(c.transcript_id))
    .map((c) => ({
      id: c.id,
      transcriptId: c.transcript_id,
      recordingTitle: recordingTitleById.get(recordingByTranscript.get(c.transcript_id) || '') || null,
      type: c.type,
      content: c.content,
      reasoningSummary: c.reasoning_summary,
      confidence: c.confidence,
      status: c.status,
      provider: c.provider,
      model: c.model,
      evidence: (c.project_intelligence_candidate_evidence || []).map((evidence) => ({
        transcript_id: evidence.transcript_id,
        utterance_ids: evidence.utterance_ids,
        role: evidence.role,
      })),
    }))

  // People + speaker identity.
  type PersonRow = { id: string; display_name: string; company: string | null; title: string | null }
  const people = ((peopleResult.data || []) as Array<{ persons: PersonRow | PersonRow[] | null }>)
    .map((row) => {
      const person = Array.isArray(row.persons) ? row.persons[0] : row.persons
      return person
        ? { id: person.id, displayName: person.display_name, company: person.company, title: person.title }
        : null
    })
    .filter((person): person is AskCgtPerson => Boolean(person))

  const clustersResult = await supabase
    .from('engagement_transcript_speaker_clusters')
    .select('transcript_id, provider_speaker_key, engagement_speaker_identity_assignments(id, person_id, persons(display_name))')
    .in('transcript_id', transcriptIds)

  type PersonName = { display_name: string }
  type ClusterRow = {
    transcript_id: string
    provider_speaker_key: string
    engagement_speaker_identity_assignments: Array<{ persons: PersonName | PersonName[] | null }> | null
  }
  const speakerMaps: AskCgtSpeakerMap[] = ((clustersResult.data || []) as ClusterRow[]).flatMap((cluster) => {
    const assignment = Array.isArray(cluster.engagement_speaker_identity_assignments)
      ? cluster.engagement_speaker_identity_assignments[0]
      : null
    const person = assignment?.persons
    const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name
    if (!personName) return []
    return [{
      transcriptId: cluster.transcript_id,
      providerSpeakerKey: cluster.provider_speaker_key,
      personName: personName as string,
    }]
  })

  const contextTranscripts: AskCgtTranscript[] = transcripts.map((t) => {
    const cap = resolveUtteranceCap()
    return {
      id: t.id,
      recordingId: t.recording_id,
      title: recordingTitleById.get(t.recording_id) || 'Untitled recording',
      status: t.status,
      completedAt: t.completed_at,
      utterances: capUtterances(
        (t.utterances || [])
          .filter((u) => u.id && u.transcript)
          .map((u) => ({
            id: u.id as string,
            start: u.start ?? 0,
            end: u.end ?? 0,
            speakerKey: u.provider_speaker_key || `speaker-${u.speaker ?? 0}`,
            text: (u.transcript as string).trim(),
          }))
          .filter((u) => u.text),
        cap
      ),
    }
  })

  const context: AskCgtContext = {
    project,
    people,
    speakerMaps,
    transcripts: contextTranscripts,
    observations,
    markers,
    candidates,
  }

  const allowed: AskCgtAllowedIds = {
    transcripts: new Set(contextTranscripts.map((t) => t.id)),
    utterancesByTranscript: new Map(
      contextTranscripts.map((t) => [t.id, new Set(t.utterances.map((u) => u.id))])
    ),
    observations: new Set(observations.map((o) => o.id)),
    markers: new Set(markers.map((m) => m.id)),
    candidates: new Set(candidates.map((c) => c.id)),
  }

  const evidenceItemsRetrieved =
    contextTranscripts.length +
    observations.length +
    markers.length +
    candidates.length +
    contextTranscripts.reduce((sum, t) => sum + t.utterances.length, 0)

  return { context, allowed, evidenceItemsRetrieved }
}