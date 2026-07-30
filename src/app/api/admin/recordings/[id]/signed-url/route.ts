
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '../../_lib'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return admin.error
  }

  const { id } = await params
  const { data: recording, error: recordingError } = await admin.supabase
    .from('engagement_recordings')
    .select('final_storage_path')
    .eq('id', id)
    .single()

  if (recordingError) {
    return NextResponse.json({ error: recordingError.message }, { status: 500 })
  }

  if (recording?.final_storage_path) {
    const serviceRole = createServiceRoleClient()
    const { data: signed, error: signedError } = await serviceRole
      .storage
      .from('engagement-recordings')
      .createSignedUrl(recording.final_storage_path, 60 * 15)

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message || 'Could not create final signed URL' }, { status: 500 })
    }

    return NextResponse.json({
      signed_url: signed.signedUrl,
      chunk_count: 1,
      combined: true,
    })
  }

  const { data: chunks, error } = await admin.supabase
    .from('engagement_recording_chunks')
    .select('storage_path, chunk_index')
    .eq('recording_id', id)
    .order('chunk_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ error: 'No chunks uploaded yet' }, { status: 404 })
  }

  const serviceRole = createServiceRoleClient()
  const signedUrls: string[] = []

  for (const chunk of chunks) {
    const { data: signed, error: signedError } = await serviceRole
      .storage
      .from('engagement-recordings')
      .createSignedUrl(chunk.storage_path, 60 * 15)

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message || 'Could not create signed URL' }, { status: 500 })
    }

    signedUrls.push(signed.signedUrl)
  }

  return NextResponse.json({
    signed_urls: signedUrls,
    chunk_count: chunks.length,
  })
}
