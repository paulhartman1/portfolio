
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '../../_lib'

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

  if (!(chunk instanceof File) || chunkIndexRaw === null) {
    return NextResponse.json({ error: 'chunk file and chunk_index are required' }, { status: 400 })
  }

  const chunkIndex = Number(chunkIndexRaw.toString())
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: 'chunk_index must be a non-negative integer' }, { status: 400 })
  }

  const { data: recording, error: recordingError } = await admin.supabase
    .from('engagement_recordings')
    .select('id')
    .eq('id', id)
    .single()

  if (recordingError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  const extension = chunk.type.includes('ogg') ? 'ogg' : 'webm'
  const storagePath = `${id}/chunk-${chunkIndex.toString().padStart(6, '0')}.${extension}`
  const buffer = Buffer.from(await chunk.arrayBuffer())

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
      },
      { onConflict: 'recording_id,chunk_index' }
    )

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, chunk_index: chunkIndex, storage_path: storagePath })
}
