
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_lib'

const VALID_TYPES = new Set(['question', 'friction', 'decision', 'observation', 'action'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return admin.error
  }

  const { id } = await params
  const body = await request.json()
  const noteType = body.note_type?.toString()
  const noteText = body.note_text?.toString()?.trim() || null
  const timestampSeconds = Number(body.timestamp_seconds)

  if (!noteType || !VALID_TYPES.has(noteType) || !Number.isFinite(timestampSeconds) || timestampSeconds < 0) {
    return NextResponse.json(
      { error: 'note_type and timestamp_seconds are required' },
      { status: 400 }
    )
  }

  const { error } = await admin.supabase
    .from('engagement_session_notes')
    .insert({
      recording_id: id,
      note_type: noteType,
      note_text: noteText,
      timestamp_seconds: Math.floor(timestampSeconds),
      created_by: admin.user.id,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
