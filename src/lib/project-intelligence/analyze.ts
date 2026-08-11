import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { buildSystemPrompt, buildUserPrompt, ProjectContextInput } from './context'
import { generateStructuredJson, mapProviderError, preflight, resolveProvider } from './provider'
import { AllowedIds, parseModelResponse } from './validation'
import { AiCandidateInput, CandidateRow } from './types'

/**
 * projectIntelligence.analyze(...)
 *
 * The capability boundary. Callers care about "analyze this interview in
 * project context", not about Ollama HTTP details.
 */

export class AnalyzeError extends Error {
  readonly code: 'transcript_not_found' | 'project_mismatch' | 'model_unavailable' | 'provider_failure' | 'invalid_model_output'
  constructor(code: AnalyzeError['code'], message: string) {
    super(message)
    this.name = 'AnalyzeError'
    this.code = code
  }
}

const MAX_PRIOR_TRANSCRIPTS = 5
const PRIOR_TRANSCRIPT_UTTERANCE_CAP = 240

type TranscriptRow = {
  id: string
  recording_id: string
  status: string
  full_text: string
  utterances: Array<{
    id?: string
    start?: number
    end?: number
    speaker?: number
    transcript?: string
    provider_speaker_key?: string
  }>
  completed_at: string | null
}

type RecordingRow = { id: string; project_id: string; title: string; session_type: string; started_at: string }

function capUtterances(
  utterances: TranscriptRow['utterances'],
  cap: number
): TranscriptRow['utterances'] {
  if (utterances.length <= cap) return utterances
  const head = utterances.slice(0, Math.ceil(cap / 2))
  const tail = utterances.slice(-Math.floor(cap / 2))
  return [...head, ...tail]
}

export async function analyzeTranscriptForProject(params: {
  projectId: string
  transcriptId: string
}): Promise<CandidateRow[]> {
  const { projectId, transcriptId } = params
  const log = (message: string, extra?: Record<string, unknown>) =>
    console.log(`[project-intelligence] ${message}`, extra ? JSON.stringify(extra) : '')
  const startedAt = Date.now()
  log('analyze:start', { projectId, transcriptId })
  const supabase = createServiceRoleClient()

  const { data: transcriptData } = await supabase
    .from('engagement_transcripts')
    .select('*')
    .eq('id', transcriptId)
    .maybeSingle()
  const transcript = transcriptData as TranscriptRow | null
  if (!transcript) {
    throw new AnalyzeError('transcript_not_found', 'Transcript not found')
  }

  const { data: recordingData } = await supabase
    .from('engagement_recordings')
    .select('id, project_id, title, session_type, started_at')
    .eq('id', transcript.recording_id)
    .maybeSingle()
  const recording = recordingData as RecordingRow | null
  if (!recording) throw new AnalyzeError('transcript_not_found', 'Recording not found')
  if (recording.project_id !== projectId) {
    throw new AnalyzeError('project_mismatch', 'This transcript does not belong to the requested project')
  }
  log('analyze:transcript-resolved', {
    recordingId: recording.id,
    status: transcript.status,
    utterances: transcript.utterances?.length ?? 0,
  })

  // ---- Project-scoped context assembly (project isolation from here on) ----

  const { data: projectData } = await supabase
    .from('projects')
    .select('id, name, description, status')
    .eq('id', projectId)
    .maybeSingle()
  const project = projectData as { id: string; name: string; description: string | null; status: string }

  // Every transcript belonging to this project (current one plus prior ones).
  const { data: projectRecordingRows } = await supabase
    .from('engagement_recordings')
    .select('id, project_id, title, session_type, started_at')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
  const projectRecordings = (projectRecordingRows || []) as RecordingRow[]
  const recordingIds = projectRecordings.map((r) => r.id)

  const { data: transcriptRows } = await supabase
    .from('engagement_transcripts')
    .select('id, recording_id, status, full_text, utterances, completed_at')
    .in('recording_id', recordingIds)
  const projectTranscripts = (transcriptRows || []) as TranscriptRow[]

  const titleByRecording = new Map(projectRecordings.map((r) => [r.id, r.title]))
  const recordingByTranscript = new Map(projectTranscripts.map((t) => [t.recording_id, t.id]))

  const ordered = projectTranscripts
    .slice()
    .sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''))
  const currentTranscript = ordered.find((t) => t.id === transcriptId)
  const priorTranscripts = ordered.filter((t) => t.id !== transcriptId)

  const transcriptsToInclude = [
    ...(currentTranscript ? [currentTranscript] : []),
    ...priorTranscripts.slice(0, MAX_PRIOR_TRANSCRIPTS),
  ]

  const includedTranscriptIds = new Set(transcriptsToInclude.map((t) => t.id))

  const contextTranscripts = transcriptsToInclude.map((t) => {
    const isCurrent = t.id === transcriptId
    const utterances = (isCurrent ? t.utterances : capUtterances(t.utterances, PRIOR_TRANSCRIPT_UTTERANCE_CAP) || []) || []
    return {
      id: t.id,
      title: titleByRecording.get(t.recording_id) || null,
      isCurrent,
      utterances: utterances.map((u) => ({
        id: u.id || '',
        speakerKey: u.provider_speaker_key || `speaker-${u.speaker ?? 0}`,
        text: u.transcript || '',
      })).filter((u) => u.id && u.text),
    }
  })

  // People + speaker identity (person names per speaker cluster).
  const [peopleResult, clustersResult, observationsResult, markersResult] = await Promise.all([
    supabase.from('project_persons').select('project_id, persons(id, display_name, company, title)').eq('project_id', projectId),
    supabase
      .from('engagement_transcript_speaker_clusters')
      .select('transcript_id, provider_speaker_key, engagement_speaker_identity_assignments(id, person_id, persons(display_name))')
      .in('transcript_id', [...includedTranscriptIds]),
    supabase
      .from('transcript_observations')
      .select('id, transcript_id, statement, confidence, notes')
      .in('transcript_id', [...includedTranscriptIds]),
    supabase
      .from('engagement_session_notes')
      .select('recording_id, note_type, note_text, timestamp_seconds')
      .in('recording_id', recordingIds),
  ])

  type PersonRow = { id: string; display_name: string; company: string | null; title: string | null }
  const people = ((peopleResult.data || []) as Array<{ persons: PersonRow | PersonRow[] | null }>).map((row) => {
    const person = Array.isArray(row.persons) ? row.persons[0] : row.persons
    return person ? { id: person.id, displayName: person.display_name, company: person.company, title: person.title } : null
  }).filter((person): person is { id: string; displayName: string; company: string | null; title: string | null } => Boolean(person))

  type PersonName = { display_name: string }
  type ClusterRow = {
    transcript_id: string
    provider_speaker_key: string
    engagement_speaker_identity_assignments: Array<{ persons: PersonName | PersonName[] | null }> | null
  }
  const speakerMaps = ((clustersResult.data || []) as ClusterRow[]).flatMap((cluster) => {
    const assignment = Array.isArray(cluster.engagement_speaker_identity_assignments)
      ? cluster.engagement_speaker_identity_assignments[0]
      : null
    const person = assignment?.persons
    const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name
    if (!personName) return []
    return [{ transcriptId: cluster.transcript_id, providerSpeakerKey: cluster.provider_speaker_key, personName: personName as string }]
  })

  const observations = (observationsResult.data || []).map((observation) => ({
    id: observation.id,
    transcriptId: observation.transcript_id,
    statement: observation.statement,
    confidence: observation.confidence,
    notes: observation.notes,
  }))

  const markers = (markersResult.data || []).map((marker) => ({
    transcriptId: recordingByTranscript.get(marker.recording_id) || null,
    recordingTitle: titleByRecording.get(marker.recording_id) || null,
    noteType: marker.note_type,
    noteText: marker.note_text,
  }))

  const context: ProjectContextInput = {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
    },
    people,
    speakerMaps,
    transcripts: contextTranscripts,
    observations,
    markers,
    inquiryFocus: process.env.CGT_INQUIRY_FOCUS || null,
  }

  // ---- Allowed IDs: project isolation is enforced at validation time ----
  const allowed: AllowedIds = {
    transcripts: new Set(includedTranscriptIds),
    utterancesByTranscript: new Map(
      contextTranscripts.map((t) => [t.id, new Set(t.utterances.map((u) => u.id))])
    ),
  }

  log('analyze:context-assembled', {
    contextTranscripts: contextTranscripts.length,
    currentUtterances: contextTranscripts.find((t) => t.isCurrent)?.utterances.length ?? 0,
    people: people.length,
    speakerMaps: speakerMaps.length,
    observations: observations.length,
    markers: markers.length,
  })

  const provider = resolveProvider()
  try {
    await preflight(provider)
  } catch (error) {
    if (error instanceof AnalyzeError) throw error
    const mapped = mapProviderError(provider, error)
    if (mapped.kind === 'unavailable' || mapped.kind === 'not_configured') {
      throw new AnalyzeError('model_unavailable', mapped.message)
    }
    throw new AnalyzeError('provider_failure', mapped.message)
  }

  const system = buildSystemPrompt()
  const user = buildUserPrompt(context)
  log('analyze:model-request', {
    provider,
    promptChars: system.length + user.length,
  })

  let raw: unknown
  const modelStartedAt = Date.now()
  try {
    raw = await generateStructuredJson([{ role: 'system', content: system }, { role: 'user', content: user }], provider)
  } catch (error) {
    const mapped = mapProviderError(provider, error)
    log('analyze:model-error', {
      elapsedMs: Date.now() - modelStartedAt,
      kind: mapped.kind,
      message: mapped.message,
    })
    if (mapped.kind === 'unavailable' || mapped.kind === 'not_configured') {
      throw new AnalyzeError('model_unavailable', mapped.message)
    }
    throw new AnalyzeError('provider_failure', mapped.message)
  }
  log('analyze:model-response', {
    elapsedMs: Date.now() - modelStartedAt,
    rawChars: JSON.stringify(raw ?? null).length,
  })

  const parsed = parseModelResponse(raw, allowed)
  if (!parsed.ok) {
    log('analyze:parse-rejected', { reason: parsed.reason })
    throw new AnalyzeError('invalid_model_output', `${provider} returned unusable output: ${parsed.reason}`)
  }
  log('analyze:parsed', { candidates: parsed.candidates.length })

  const persisted = await persistCandidates(supabase, {
    projectId,
    transcriptId,
    candidates: parsed.candidates,
    provider,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  })
  log('analyze:done', { candidates: persisted.length, totalMs: Date.now() - startedAt })
  return persisted
}

async function persistCandidates(
  supabase: ReturnType<typeof createServiceRoleClient>,
  params: {
    projectId: string
    transcriptId: string
    candidates: AiCandidateInput[]
    provider: string
    model: string
  }
): Promise<CandidateRow[]> {
  const { projectId, transcriptId, candidates, provider, model } = params
  const rows: CandidateRow[] = []

  for (const candidate of candidates) {
    const { data: inserted, error } = await supabase
      .from('project_intelligence_candidates')
      .insert({
        project_id: projectId,
        transcript_id: transcriptId,
        type: candidate.type,
        content: candidate.content,
        reasoning_summary: candidate.reasoningSummary || null,
        confidence: candidate.confidence,
        provider,
        model,
        status: 'candidate',
      })
      .select('id')
      .single()
    if (error) throw error

    if (candidate.evidence.length > 0) {
      const { error: evidenceError } = await supabase
        .from('project_intelligence_candidate_evidence')
        .insert(
          candidate.evidence.map((evidence) => ({
            candidate_id: inserted.id,
            transcript_id: evidence.transcriptId,
            utterance_ids: evidence.utteranceIds,
            role: evidence.role,
          }))
        )
      if (evidenceError) throw evidenceError
    }

    rows.push({
      id: inserted.id,
      project_id: projectId,
      transcript_id: transcriptId,
      type: candidate.type,
      content: candidate.content,
      reasoning_summary: candidate.reasoningSummary || null,
      confidence: candidate.confidence,
      provider,
      model,
      status: 'candidate',
      accepted_observation_id: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      evidence: candidate.evidence.map((evidence, index) => ({
        id: `pending-${inserted.id}-${index}`,
        candidate_id: inserted.id,
        transcript_id: evidence.transcriptId,
        utterance_ids: evidence.utteranceIds,
        role: evidence.role,
        created_at: new Date().toISOString(),
      })),
    })
  }

  return rows
}