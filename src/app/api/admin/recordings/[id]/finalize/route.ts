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
  const body = await request.json().catch(() => ({}))
  const durationSeconds = Number(body.duration_seconds)

  const { data: chunks, error: chunksError } = await admin.supabase
    .from('engagement_recording_chunks')
    .select('storage_path, chunk_index')
    .eq('recording_id', id)
    .order('chunk_index', { ascending: true })

  if (chunksError) {
    return NextResponse.json({ error: chunksError.message }, { status: 500 })
  }

  let finalStoragePath: string | null = null
  let combineErrorMessage: string | null = null

  if (chunks && chunks.length > 0) {
    try {
      const serviceRole = createServiceRoleClient()
      const buffers: Buffer[] = []

      for (const chunk of chunks) {
        const { data: blob, error: downloadError } = await serviceRole
          .storage
          .from('engagement-recordings')
          .download(chunk.storage_path)

        if (downloadError || !blob) {
          throw new Error(downloadError?.message || `Could not download ${chunk.storage_path}`)
        }

        buffers.push(Buffer.from(await blob.arrayBuffer()))
      }

      const destination = `${id}/final.webm`
      const { error: uploadError } = await serviceRole
        .storage
        .from('engagement-recordings')
        .upload(destination, Buffer.concat(buffers), {
          contentType: 'audio/webm',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      finalStoragePath = destination
    } catch (error) {
      combineErrorMessage = error instanceof Error ? error.message : 'combine failed'
    }
  }

  const updates: {
    status: string
    stopped_at: string
    total_chunks: number
    duration_seconds?: number
    final_storage_path?: string
  } = {
    status: 'finalized',
    stopped_at: new Date().toISOString(),
    total_chunks: chunks?.length ?? 0,
  }

  if (Number.isFinite(durationSeconds) && durationSeconds >= 0) {
    updates.duration_seconds = Math.floor(durationSeconds)
  }
  if (finalStoragePath) {
    updates.final_storage_path = finalStoragePath
  }

  const { error: updateError } = await admin.supabase
    .from('engagement_recordings')
    .update(updates)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    total_chunks: chunks?.length ?? 0,
    combined: Boolean(finalStoragePath),
    combine_error: combineErrorMessage,
  })
}
