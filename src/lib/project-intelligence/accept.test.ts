import { describe, expect, it } from 'vitest'

type Call = { op: string; table: string; values?: unknown; col?: string; val?: unknown }

function makeClient(options: { candidate: unknown; utterances: unknown[]; recordingId?: string }) {
  const calls: Call[] = []
  let table = ''

  const chain = {
    select(cols: string) {
      calls.push({ op: 'select', table, values: cols } as Call)
      return chain
    },
    eq(col: string, val: unknown) {
      calls.push({ op: 'eq', table, col, val } as Call)
      return chain
    },
    in(col: string, vals: unknown[]) {
      calls.push({ op: 'in', table, col, values: vals } as Call)
      return chain
    },
    maybeSingle() {
      if (table === 'project_intelligence_candidates') return Promise.resolve({ data: options.candidate, error: null })
      if (table === 'engagement_transcripts') return Promise.resolve({ data: { recording_id: options.recordingId ?? null, utterances: options.utterances }, error: null })
      return Promise.resolve({ data: null, error: null })
    },
    single() {
      if (table === 'transcript_observations') return Promise.resolve({ data: { id: 'obs-1' }, error: null })
      return Promise.resolve({ data: null, error: null })
    },
    insert(values: unknown) {
      calls.push({ op: 'insert', table, values })
      return chain
    },
    update(values: unknown) {
      calls.push({ op: 'update', table, values })
      return chain
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve({ data: null, error: null }).then(resolve)
    },
  }

  return {
    from: (t: string) => {
      table = t
      return chain
    },
    calls,
  }
}

function observationCandidate(evidence: Array<{ transcript_id: string; utterance_ids: string[]; role: string }>) {
  return {
    id: 'cand-1',
    project_id: 'proj-alpine',
    transcript_id: 't-current',
    type: 'observation',
    content: 'Locating affected code relies partially on tribal knowledge.',
    reasoning_summary: 'Rich described finding code by memory.',
    confidence: 0.9,
    provider: 'ollama',
    model: 'qwen3:8b',
    status: 'candidate',
    project_intelligence_candidate_evidence: evidence,
  }
}

const utterances = [
  { id: 'u1', start: 0, end: 3, speaker: 0, provider_speaker_key: 'speaker-0', transcript: 'I usually find it by memory.' },
  { id: 'u2', start: 3, end: 6, speaker: 0, provider_speaker_key: 'speaker-0', transcript: "Christie isn't always available." },
]

describe('acceptCandidate (observation)', () => {
  it('folds an observation candidate into transcript_observations with anchored evidence', async () => {
    const { acceptCandidate } = await import('./accept')
    const fake = makeClient({
      candidate: observationCandidate([{ transcript_id: 't-current', utterance_ids: ['u1', 'u2'], role: 'supporting' }]),
      utterances,
    })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.acceptedObservationId).toBe('obs-1')

    const obsInsert = fake.calls.find((call) => call.op === 'insert' && call.table === 'transcript_observations')
    const values = obsInsert?.values as Record<string, unknown>
    expect(values.statement).toBe('Locating affected code relies partially on tribal knowledge.')
    expect(values.transcript_id).toBe('t-current')
    expect(values.confidence).toBe('high')
    expect(values.created_by).toBe('admin-1')
    expect(values.notes).toContain('AI-suggested. Candidate cand-1 (ollama/qwen3:8b).')
    expect(values.notes).toContain('Rich described finding code by memory.')

    const evInsert = fake.calls.find((call) => call.op === 'insert' && call.table === 'transcript_observation_evidence')
    const ev = evInsert?.values as Record<string, unknown>
    expect(ev.start_utterance_id).toBe('u1')
    expect(ev.end_utterance_id).toBe('u2')
    expect(ev.start_char_offset).toBe(0)
    expect(ev.end_char_offset).toBe(utterances[1].transcript.length)
    expect(ev.start_seconds).toBe(0)
    expect(ev.end_seconds).toBe(6)
    expect(ev.excerpt_text).toContain('I usually find it by memory.')
    expect(ev.speaker_labels).toEqual(['speaker-0'])

    const candUpdate = fake.calls.find((call) => call.op === 'update' && call.table === 'project_intelligence_candidates')
    const update = candUpdate?.values as Record<string, unknown>
    expect(update.status).toBe('accepted')
    expect(update.accepted_observation_id).toBe('obs-1')
    expect(update.reviewed_by).toBe('admin-1')
  })

  it('creates one evidence row per contiguous run of utterance ids', async () => {
    const { acceptCandidate } = await import('./accept')
    const fake = makeClient({
      candidate: observationCandidate([{ transcript_id: 't-current', utterance_ids: ['u1', 'u4', 'u6', 'u7'], role: 'supporting' }]),
      utterances: [
        { id: 'u1', start: 0, end: 1, speaker: 0, transcript: 'a' },
        { id: 'u2', start: 1, end: 2, speaker: 0, transcript: 'b' },
        { id: 'u3', start: 2, end: 3, speaker: 0, transcript: 'c' },
        { id: 'u4', start: 3, end: 4, speaker: 0, transcript: 'd' },
        { id: 'u5', start: 4, end: 5, speaker: 0, transcript: 'e' },
        { id: 'u6', start: 5, end: 6, speaker: 0, transcript: 'f' },
        { id: 'u7', start: 6, end: 7, speaker: 0, transcript: 'g' },
        { id: 'u8', start: 7, end: 8, speaker: 0, transcript: 'h' },
      ],
    })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(true)
    const evInserts = fake.calls.filter((call) => call.op === 'insert' && call.table === 'transcript_observation_evidence')
    expect(evInserts).toHaveLength(3)
  })

  it('still accepts when the evidence has no anchored utterances', async () => {
    const { acceptCandidate } = await import('./accept')
    const fake = makeClient({ candidate: observationCandidate([]), utterances: [] })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(true)
  })
})

describe('acceptCandidate (other types + guardrails)', () => {
  it('accepts a follow_up_question without creating an observation', async () => {
    const { acceptCandidate } = await import('./accept')
    const candidate = { ...observationCandidate([]), type: 'follow_up_question' }
    const fake = makeClient({ candidate, utterances })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.acceptedObservationId).toBeNull()
    expect(fake.calls.some((call) => call.op === 'insert' && call.table === 'transcript_observations')).toBe(false)
    const candUpdate = fake.calls.find((call) => call.op === 'update' && call.table === 'project_intelligence_candidates')
    expect((candUpdate?.values as Record<string, unknown>).status).toBe('accepted')
  })

  it('accepts an action_item by creating a visible session marker anchored at the evidence', async () => {
    const { acceptCandidate } = await import('./accept')
    const candidate = {
      ...observationCandidate([{ transcript_id: 't-current', utterance_ids: ['u2'], role: 'supporting' }]),
      type: 'action_item',
      content: 'Document how affected code is located before Rich leaves.',
    }
    const fake = makeClient({ candidate, utterances, recordingId: 'rec-1' })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.acceptedObservationId).toBeNull()

    const markerInsert = fake.calls.find((call) => call.op === 'insert' && call.table === 'engagement_session_notes')
    const marker = markerInsert?.values as Record<string, unknown>
    expect(marker.recording_id).toBe('rec-1')
    expect(marker.note_type).toBe('action')
    expect(marker.note_text).toBe('Document how affected code is located before Rich leaves.')
    expect(marker.timestamp_seconds).toBe(3)
    expect(marker.created_by).toBe('admin-1')

    const candUpdate = fake.calls.find((call) => call.op === 'update' && call.table === 'project_intelligence_candidates')
    const update = candUpdate?.values as Record<string, unknown>
    expect(update.status).toBe('accepted')
    expect(update.reviewed_by).toBe('admin-1')
  })

  it('accepts an action_item anchored at 0 when evidence has no current-transcript utterances', async () => {
    const { acceptCandidate } = await import('./accept')
    const candidate = {
      ...observationCandidate([{ transcript_id: 't-other', utterance_ids: ['x1'], role: 'supporting' }]),
      type: 'action_item',
      content: 'Run a follow-up session on ownership.',
    }
    const fake = makeClient({ candidate, utterances, recordingId: 'rec-1' })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(true)
    const markerInsert = fake.calls.find((call) => call.op === 'insert' && call.table === 'engagement_session_notes')
    expect((markerInsert?.values as Record<string, unknown>).timestamp_seconds).toBe(0)
  })

  it('rejects a candidate that was already reviewed', async () => {
    const { acceptCandidate } = await import('./accept')
    const fake = makeClient({ candidate: { ...observationCandidate([]), status: 'accepted' }, utterances })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('not_pending')
  })

  it('returns not_found when the candidate does not exist', async () => {
    const { acceptCandidate } = await import('./accept')
    const fake = makeClient({ candidate: null, utterances })
    const result = await acceptCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('not_found')
  })
})

describe('rejectCandidate', () => {
  it('marks a candidate rejected and requires it to be currently pending', async () => {
    const { rejectCandidate } = await import('./accept')
    const fake = makeClient({ candidate: null, utterances })
    const result = await rejectCandidate(fake as never, { candidateId: 'cand-1', transcriptId: 't-current', reviewedBy: 'admin-1' })
    expect(result.ok).toBe(true)
    const update = fake.calls.find((call) => call.op === 'update')
    expect((update?.values as Record<string, unknown>).status).toBe('rejected')
  })
})