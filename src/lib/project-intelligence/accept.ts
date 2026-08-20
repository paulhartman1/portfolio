import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * Human acceptance of a candidate.
 *
 * The model only creates candidates. Accepting one folds it into CGT's
 * existing knowledge model (transcript observations with anchored evidence)
 * and preserves provenance: the observation notes record that it came from an
 * AI candidate, and the candidate points back at the resulting observation.
 */

type CandidateEvidenceRow = {
  id: string
  candidate_id: string
  transcript_id: string
  utterance_ids: string[]
  role: string
}

type CandidateRecord = {
  id: string
  project_id: string
  transcript_id: string
  type: string
  content: string
  reasoning_summary: string | null
  confidence: number | null
  provider: string
  model: string
  status: 'candidate' | 'accepted' | 'rejected'
  project_intelligence_candidate_evidence: CandidateEvidenceRow[]
}

type Utterance = {
  id: string
  start: number
  end: number
  speaker: number
  provider_speaker_key?: string
  transcript?: string
}

export type AcceptCandidateResult =
  | { ok: true; acceptedObservationId: string | null }
  | { ok: false; code: 'not_found' | 'not_pending' | 'db_error'; reason: string }

function mapConfidence(value: number | null): 'high' | 'medium' | 'low' {
  if (value === null) return 'medium'
  if (value >= 0.72) return 'high'
  if (value <= 0.35) return 'low'
  return 'medium'
}

function buildProvenanceNotes(candidate: CandidateRecord): string | null {
  const parts: string[] = []
  parts.push(`AI-suggested. Candidate ${candidate.id} (${candidate.provider}/${candidate.model}).`)
  if (candidate.reasoning_summary) parts.push(candidate.reasoning_summary)
  const notes = parts.join('\n').trim()
  return notes || null
}

/** Splits an ordered slice of utterance indexes into contiguous runs. */
function groupRuns(indexes: number[]): Array<{ start: number; end: number }> {
  if (indexes.length === 0) return []
  const sorted = [...indexes].sort((a, b) => a - b)
  const runs: Array<{ start: number; end: number }> = []
  let current = { start: sorted[0], end: sorted[0] }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === current.end + 1) {
      current.end = sorted[i]
    } else {
      runs.push(current)
      current = { start: sorted[i], end: sorted[i] }
    }
  }
  runs.push(current)
  return runs
}

export async function acceptCandidate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  params: { candidateId: string; transcriptId: string; reviewedBy: string; statementOverride?: string | null }
): Promise<AcceptCandidateResult> {
  const { candidateId, transcriptId, reviewedBy, statementOverride } = params

  const { data: candidateData, error: candidateError } = await supabase
    .from('project_intelligence_candidates')
    .select('*, project_intelligence_candidate_evidence(*)')
    .eq('id', candidateId)
    .eq('transcript_id', transcriptId)
    .maybeSingle()
  if (candidateError) return { ok: false, code: 'db_error', reason: candidateError.message }
  const candidate = candidateData as CandidateRecord | null
  if (!candidate) return { ok: false, code: 'not_found', reason: 'Candidate not found for this transcript' }
  if (candidate.status !== 'candidate') {
    return { ok: false, code: 'not_pending', reason: 'Candidate has already been reviewed' }
  }

  let acceptedObservationId: string | null = null

  try {
    if (candidate.type === 'observation') {
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('engagement_transcripts')
        .select('utterances')
        .eq('id', transcriptId)
        .maybeSingle()
      if (transcriptError) throw transcriptError
      const utterances = ((transcriptData?.utterances as Utterance[]) || []) as Utterance[]

      const statement = (statementOverride && statementOverride.trim()) || candidate.content

      const { data: observation, error: observationError } = await supabase
        .from('transcript_observations')
        .insert({
          transcript_id: transcriptId,
          statement,
          confidence: mapConfidence(candidate.confidence),
          notes: buildProvenanceNotes(candidate),
          created_by: reviewedBy,
        })
        .select('id')
        .single()
      if (observationError) throw observationError
      acceptedObservationId = observation.id

      const indexById = new Map(utterances.map((utterance, index) => [utterance.id, index]))
      const relevantEvidence = (candidate.project_intelligence_candidate_evidence || [])
        .filter((evidence) => evidence.transcript_id === transcriptId)
        .flatMap((evidence) => evidence.utterance_ids.map((id) => indexById.get(id)).filter((index): index is number => typeof index === 'number'))

      for (const run of groupRuns(relevantEvidence)) {
        const startUtterance = utterances[run.start]
        const endUtterance = utterances[run.end]
        const speakerLabels = Array.from(new Set(
          utterances
            .slice(run.start, run.end + 1)
            .map((utterance) => utterance.provider_speaker_key || `speaker-${utterance.speaker}`)
        ))
        const excerpt = utterances
          .slice(run.start, run.end + 1)
          .map((utterance) => utterance.transcript || '')
          .filter(Boolean)
          .join(' ')

        const { error: evidenceError } = await supabase
          .from('transcript_observation_evidence')
          .insert({
            observation_id: observation.id,
            start_utterance_id: startUtterance.id,
            start_char_offset: 0,
            end_utterance_id: endUtterance.id,
            end_char_offset: (endUtterance.transcript || '').length,
            start_seconds: startUtterance.start,
            end_seconds: endUtterance.end,
            excerpt_text: excerpt,
            speaker_labels: speakerLabels,
          })
        if (evidenceError) throw evidenceError
      }

      const { error: updateError } = await supabase
        .from('project_intelligence_candidates')
        .update({
          status: 'accepted',
          accepted_observation_id: observation.id,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId)
      if (updateError) throw updateError
    } else if (candidate.type === 'action_item') {
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('engagement_transcripts')
        .select('recording_id, utterances')
        .eq('id', transcriptId)
        .maybeSingle()
      if (transcriptError) throw transcriptError
      const recordingId = ((transcriptData as { recording_id?: string } | null)?.recording_id) || null
      const utterances = (((transcriptData as { utterances?: Utterance[] } | null)?.utterances) || []) as Utterance[]

      const indexById = new Map(utterances.map((utterance, index) => [utterance.id, index]))
      const relevantEvidence = (candidate.project_intelligence_candidate_evidence || [])
        .filter((evidence) => evidence.transcript_id === transcriptId)
        .flatMap((evidence) => evidence.utterance_ids.map((id) => indexById.get(id)).filter((index): index is number => typeof index === 'number'))
      const firstIndex = relevantEvidence.length > 0 ? Math.min(...relevantEvidence) : -1
      const timestampSeconds = firstIndex >= 0 ? (utterances[firstIndex].start ?? 0) : 0

      if (recordingId) {
        const { error: markerError } = await supabase
          .from('engagement_session_notes')
          .insert({
            recording_id: recordingId,
            note_type: 'action',
            note_text: candidate.content,
            timestamp_seconds: timestampSeconds,
            created_by: reviewedBy,
          })
        if (markerError) throw markerError
      }

      const { error: updateError } = await supabase
        .from('project_intelligence_candidates')
        .update({
          status: 'accepted',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId)
      if (updateError) throw updateError
    } else {
      const { error: updateError } = await supabase
        .from('project_intelligence_candidates')
        .update({
          status: 'accepted',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId)
      if (updateError) throw updateError
    }

    return { ok: true, acceptedObservationId }
  } catch (error) {
    return { ok: false, code: 'db_error', reason: error instanceof Error ? error.message : 'Accept failed' }
  }
}

export async function rejectCandidate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  params: { candidateId: string; transcriptId: string; reviewedBy: string }
): Promise<{ ok: boolean; reason?: string }> {
  const { candidateId, transcriptId, reviewedBy } = params
  const { error } = await supabase
    .from('project_intelligence_candidates')
    .update({ status: 'rejected', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', candidateId)
    .eq('transcript_id', transcriptId)
    .eq('status', 'candidate')
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}