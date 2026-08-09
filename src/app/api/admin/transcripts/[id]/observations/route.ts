import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'
import type { Utterance } from '@/app/api/admin/recordings/_utterance-ids'

interface Evidence {
  id: string
  start_utterance_id: string
  start_char_offset: number
  end_utterance_id: string
  end_char_offset: number
  excerpt_text: string
  [key: string]: unknown
}

function findUtterance(utterances: Utterance[], id: string): Utterance | undefined {
  return utterances.find((u) => u.id === id)
}

function buildExcerpt(utterances: Utterance[], startId: string, startOffset: number, endId: string, endOffset: number): string {
  const startIdx = utterances.findIndex((u) => u.id === startId)
  const endIdx = utterances.findIndex((u) => u.id === endId)
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return ''
  const parts: string[] = []
  for (let i = startIdx; i <= endIdx; i++) {
    const text = utterances[i].transcript || ''
    if (i === startIdx && i === endIdx) {
      parts.push(text.slice(startOffset, endOffset))
    } else if (i === startIdx) {
      parts.push(text.slice(startOffset))
    } else if (i === endIdx) {
      parts.push(text.slice(0, endOffset))
    } else {
      parts.push(text)
    }
  }
  return parts.join(' ')
}

function computeEvidenceState(
  transcriptUtterances: Utterance[],
  evidence: Evidence
): 'attached' | 'changed' | 'detached' {
  const startUtt = findUtterance(transcriptUtterances, evidence.start_utterance_id)
  const endUtt = findUtterance(transcriptUtterances, evidence.end_utterance_id)
  if (!startUtt || !endUtt) return 'detached'
  const startLen = (startUtt.transcript || '').length
  const endLen = (endUtt.transcript || '').length
  if (evidence.start_char_offset < 0 || evidence.start_char_offset > startLen) return 'detached'
  if (evidence.end_char_offset < 0 || evidence.end_char_offset > endLen) return 'detached'
  if (transcriptUtterances.findIndex((u) => u.id === evidence.start_utterance_id) > transcriptUtterances.findIndex((u) => u.id === evidence.end_utterance_id)) return 'detached'
  const reconstructed = buildExcerpt(transcriptUtterances, evidence.start_utterance_id, evidence.start_char_offset, evidence.end_utterance_id, evidence.end_char_offset)
  return reconstructed === evidence.excerpt_text ? 'attached' : 'changed'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id } = await params

  const { data: transcript, error: transcriptError } = await admin.supabase
    .from('engagement_transcripts')
    .select('id, recording_id, utterances')
    .eq('id', id)
    .single()
  if (transcriptError || !transcript) {
    return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
  }

  const { data: observations, error: obsError } = await admin.supabase
    .from('transcript_observations')
    .select('*, transcript_observation_evidence(*)')
    .eq('transcript_id', id)
    .order('created_at', { ascending: false })

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 })
  }

  const utteranceList = (transcript.utterances || []) as Utterance[]
  const enriched = (observations || []).map((obs) => ({
    ...obs,
    evidence: (obs.transcript_observation_evidence || []).map((ev: Evidence) => ({
      ...ev,
      state: computeEvidenceState(utteranceList, ev)
    }))
  }))

  return NextResponse.json({ observations: enriched })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id } = await params
  const body = await request.json()

  const statement = body.statement?.toString()?.trim()
  const confidence = body.confidence?.toString()
  const notes = body.notes?.toString()?.trim() || null
  const startUtteranceId = body.start_utterance_id?.toString()
  const startCharOffset = Number(body.start_char_offset)
  const endUtteranceId = body.end_utterance_id?.toString()
  const endCharOffset = Number(body.end_char_offset)
  const startSeconds = Number(body.start_seconds)
  const endSeconds = Number(body.end_seconds)

  if (!statement) {
    return NextResponse.json({ error: 'statement is required' }, { status: 400 })
  }
  if (!confidence || !['high', 'medium', 'low'].includes(confidence)) {
    return NextResponse.json({ error: 'confidence must be high, medium, or low' }, { status: 400 })
  }
  if (!startUtteranceId || !endUtteranceId || !Number.isFinite(startCharOffset) || !Number.isFinite(endCharOffset)) {
    return NextResponse.json({ error: 'start_utterance_id, end_utterance_id, start_char_offset, end_char_offset are required' }, { status: 400 })
  }
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || endSeconds < startSeconds) {
    return NextResponse.json({ error: 'valid start_seconds and end_seconds required' }, { status: 400 })
  }

  const { data: transcript, error: transcriptError } = await admin.supabase
    .from('engagement_transcripts')
    .select('id, utterances')
    .eq('id', id)
    .single()
  if (transcriptError || !transcript) {
    return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
  }

  const utterances = (transcript.utterances || []) as Utterance[]
  const startUtt = findUtterance(utterances, startUtteranceId)
  const endUtt = findUtterance(utterances, endUtteranceId)
  if (!startUtt || !endUtt) {
    return NextResponse.json({ error: 'Utterance IDs not found in this transcript' }, { status: 400 })
  }
  const startIdx = utterances.findIndex((u) => u.id === startUtteranceId)
  const endIdx = utterances.findIndex((u) => u.id === endUtteranceId)
  if (startIdx > endIdx) {
    return NextResponse.json({ error: 'start_utterance must not be after end_utterance in transcript order' }, { status: 400 })
  }
  const startText = startUtt.transcript || ''
  const endText = endUtt.transcript || ''
  if (startCharOffset < 0 || startCharOffset > startText.length) {
    return NextResponse.json({ error: 'start_char_offset out of bounds' }, { status: 400 })
  }
  if (endCharOffset < 0 || endCharOffset > endText.length) {
    return NextResponse.json({ error: 'end_char_offset out of bounds' }, { status: 400 })
  }
  if (startUtteranceId === endUtteranceId && startCharOffset >= endCharOffset) {
    return NextResponse.json({ error: 'for same utterance, start_char_offset must be < end_char_offset' }, { status: 400 })
  }

  const excerpt = buildExcerpt(utterances, startUtteranceId, startCharOffset, endUtteranceId, endCharOffset)
  if (!excerpt.trim()) {
    return NextResponse.json({ error: 'selection must contain non-whitespace text' }, { status: 400 })
  }

  const speakerLabels = Array.from(new Set(
    utterances.slice(startIdx, endIdx + 1).map((u) => {
      const cluster = u.provider_speaker_key || `speaker-${u.speaker}`
      return cluster
    })
  ))

  const { data: observation, error: obsError } = await admin.supabase
    .from('transcript_observations')
    .insert({
      transcript_id: id,
      statement,
      confidence,
      notes,
      created_by: admin.user.id,
    })
    .select('id')
    .single()

  if (obsError || !observation) {
    return NextResponse.json({ error: obsError?.message || 'Failed to create observation' }, { status: 500 })
  }

  const { error: evError } = await admin.supabase
    .from('transcript_observation_evidence')
    .insert({
      observation_id: observation.id,
      start_utterance_id: startUtteranceId,
      start_char_offset: startCharOffset,
      end_utterance_id: endUtteranceId,
      end_char_offset: endCharOffset,
      start_seconds: startSeconds,
      end_seconds: endSeconds,
      excerpt_text: excerpt,
      speaker_labels: speakerLabels,
    })

  if (evError) {
    await admin.supabase.from('transcript_observations').delete().eq('id', observation.id)
    return NextResponse.json({ error: evError.message }, { status: 500 })
  }

  return NextResponse.json({ observation: { ...observation, evidence: [{ state: 'attached' as const }] } })
}
