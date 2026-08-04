
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '../../_lib'
import { createHash } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return admin.error
  }

  const { id } = await params
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

  const { data: recording, error: recordingError } = await admin.supabase
    .from('engagement_recordings')
    .select('id, pipeline_status')
    .eq('id', id)
    .single()

  if (recordingError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (recording.pipeline_status !== 'recording') {
    return NextResponse.json({ error: `Cannot upload chunks to recording in state ${recording.pipeline_status}` }, { status: 400 })
  }

  const buffer = Buffer.from(await chunk.arrayBuffer())
  const checksum = createHash('sha256').update(buffer).digest('hex')

  // Check for existing chunk (Idempotency)
  const { data: existingChunk } = await admin.supabase
    .from('engagement_recording_chunks')
    .select('checksum')
    .eq('recording_id', id)
    .eq('chunk_index', chunkIndex)
    .maybeSingle()

  if (existingChunk) {
    if (existingChunk.checksum === checksum) {
      return NextResponse.json({ ok: true, chunk_index: chunkIndex, status: 'already_exists' })
    } else {
      return NextResponse.json({ error: 'Conflict: chunk index exists with different content' }, { status: 409 })
    }
  }

  const extension = chunk.type.includes('ogg') ? 'ogg' : 'webm'
  const storagePath = `${id}/chunk-${chunkIndex.toString().padStart(6, '0')}.${extension}`

  const serviceRole = createServiceRoleClient()
  const { error: uploadError } = await serviceRole
    .storage
    .from('engagement-recordings')
    .upload(storagePath, buffer, {
      contentType: chunk.type || 'audio/webm',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { error: insertError } = await admin.supabase
    .from('engagement_recording_chunks')
    .upsert(
      {
        recording_id: id,
        chunk_index: chunkIndex,
        storage_path: storagePath,
        size_bytes: buffer.byteLength,
        checksum,
        mime_type: chunk.type || 'audio/webm',
        duration_ms: durationMsRaw ? Number(durationMsRaw) : null,
        offset_ms: offsetMsRaw ? Number(offsetMsRaw) : null,
        status: 'uploaded'
      },
      { onConflict: 'recording_id,chunk_index' }
    )

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, chunk_index: chunkIndex, storage_path: storagePath })
}
