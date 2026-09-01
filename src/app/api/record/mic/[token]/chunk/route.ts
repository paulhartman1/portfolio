import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { validateMicPairingToken } from '@/lib/recordings/mic-pairing'
import { writeRecordingChunk } from '@/lib/recordings/chunk-writer'

// Progressive chunk upload from the phone -- the exact same storage/DB
// write path the admin recorder's own mic chunks use (writeRecordingChunk),
// just tagged media_source: 'phone_mic' and authorized by pairing token
// instead of an admin session. A 1-2 hour phone recording never needs to be
// held in memory beyond one chunk at a time.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const serviceRole = createServiceRoleClient()
  const result = await validateMicPairingToken(serviceRole, token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const formData = await request.formData()
  const chunk = formData.get('chunk')
  const chunkIndexRaw = formData.get('chunk_index')
  const durationMsRaw = formData.get('duration_ms')
  const offsetMsRaw = formData.get('offset_ms')

  if (!(chunk instanceof File) || chunkIndexRaw === null) {
    return NextResponse.json({ error: 'chunk file and chunk_index are required' }, { status: 400 })
  }

  const chunkIndex = Number(chunkIndexRaw.toString())
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: 'chunk_index must be a non-negative integer' }, { status: 400 })
  }

  const buffer = Buffer.from(await chunk.arrayBuffer())

  const writeResult = await writeRecordingChunk({
    serviceRole,
    recordingId: result.recording.id,
    chunkIndex,
    buffer,
    mimeType: chunk.type || 'audio/webm',
    mediaSource: 'phone_mic',
    durationMs: durationMsRaw ? Number(durationMsRaw) : null,
    offsetMs: offsetMsRaw ? Number(offsetMsRaw) : null,
  })

  if (!writeResult.ok) {
    return NextResponse.json({ error: writeResult.error }, { status: writeResult.status })
  }

  // A successful chunk upload is itself proof of life.
  await serviceRole
    .from('engagement_mic_pairings')
    .update({ last_seen_at: new Date().toISOString(), status: 'active' })
    .eq('id', result.pairing.id)

  return NextResponse.json({ ok: true, chunk_index: chunkIndex, status: writeResult.status })
}
