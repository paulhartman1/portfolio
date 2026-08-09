import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'
import type { Utterance } from '@/app/api/admin/recordings/_utterance-ids'

interface Evidence {
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
  const reconstructed = buildExcerpt(transcriptUtterances, evidence.start_utterance_id, evidence.start_char_offset, evidence.end_utterance_id, evidence.end_char_offset)
  return reconstructed === evidence.excerpt_text ? 'attached' : 'changed'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; observationId: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id, observationId } = await params
  const body = await request.json()

  const { data: existingObs, error: existingError } = await admin.supabase
    .from('transcript_observations')
    .select('id, transcript_id')
    .eq('id', observationId)
    .eq('transcript_id', id)
    .single()
  if (existingError || !existingObs) {
    return NextResponse.json({ error: 'Observation not found' }, { status: 404 })
  }

  const statement = body.statement?.toString()?.trim()
  const confidence = body.confidence?.toString()
  const notes = body.notes?.toString()?.trim()

  const updates: Partial<{ statement: string; confidence: string; notes: string | null; updated_at: string }> = {}
  if (statement !== undefined) {
    if (!statement) return NextResponse.json({ error: 'statement cannot be empty' }, { status: 400 })
    updates.statement = statement
  }
  if (confidence !== undefined) {
    if (!['high', 'medium', 'low'].includes(confidence)) {
      return NextResponse.json({ error: 'confidence must be high, medium, or low' }, { status: 400 })
    }
    updates.confidence = confidence
  }
  if (notes !== undefined) {
    updates.notes = notes || null
  }
  updates.updated_at = new Date().toISOString()

  const { data: updated, error: updateError } = await admin.supabase
    .from('transcript_observations')
    .update(updates)
    .eq('id', observationId)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data: evidence, error: evError } = await admin.supabase
    .from('transcript_observation_evidence')
    .select('*')
    .eq('observation_id', observationId)

  if (evError) {
    return NextResponse.json({ error: evError.message }, { status: 500 })
  }

  const { data: transcript } = await admin.supabase
    .from('engagement_transcripts')
    .select('utterances')
    .eq('id', id)
    .single()

  const enrichedEvidence = (evidence || []).map((ev) => ({
    ...ev,
    state: computeEvidenceState((transcript?.utterances || []) as Utterance[], ev)
  }))

  return NextResponse.json({ observation: { ...updated, evidence: enrichedEvidence } })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; observationId: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id, observationId } = await params

  const { data: existingObs, error: existingError } = await admin.supabase
    .from('transcript_observations')
    .select('id')
    .eq('id', observationId)
    .eq('transcript_id', id)
    .single()
  if (existingError || !existingObs) {
    return NextResponse.json({ error: 'Observation not found' }, { status: 404 })
  }

  const { error: deleteError } = await admin.supabase
    .from('transcript_observations')
    .delete()
    .eq('id', observationId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
