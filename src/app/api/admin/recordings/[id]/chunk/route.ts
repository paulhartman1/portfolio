
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '../../_lib'
import { writeRecordingChunk } from '@/lib/recordings/chunk-writer'

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
  const serviceRole = createServiceRoleClient()

  const result = await writeRecordingChunk({
    serviceRole,
    recordingId: id,
    chunkIndex,
    buffer,
    mimeType: chunk.type || 'audio/webm',
    mediaSource: 'browser_mic',
    durationMs: durationMsRaw ? Number(durationMsRaw) : null,
    offsetMs: offsetMsRaw ? Number(offsetMsRaw) : null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, chunk_index: chunkIndex, status: result.status, storage_path: result.storagePath })
}
