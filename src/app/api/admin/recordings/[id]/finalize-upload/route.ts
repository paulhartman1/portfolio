import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

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
  const sizeBytes = body.size_bytes as number | null
  const checksum = body.checksum as string | null
  const mimeType = body.mime_type as string | null

  const { data: recording, error: findError } = await admin.supabase
    .from('engagement_recordings')
    .select('id, status, final_storage_path')
    .eq('id', id)
    .single()

  if (findError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (recording.status !== 'uploading') {
    return NextResponse.json({ error: `Cannot finalize recording in status '${recording.status}'` }, { status: 400 })
  }

  if (!recording.final_storage_path) {
    return NextResponse.json({ error: 'Recording has no final_storage_path set' }, { status: 400 })
  }

  const pathParts = recording.final_storage_path.split('/')
  const parentDir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : ''
  const fileName = pathParts.pop()!

  const serviceRole = createServiceRoleClient()
  const { data: files, error: listError } = await serviceRole.storage
    .from('engagement-recordings')
    .list(parentDir || undefined)

  if (listError) {
    return NextResponse.json({ error: `Failed to verify uploaded file: ${listError.message}` }, { status: 500 })
  }

  const fileExists = files?.some((f) => f.name === fileName)

  if (!fileExists) {
    return NextResponse.json({ error: 'Uploaded file not found in storage. Upload may have failed or been cancelled.' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    status: 'finalized',
    size_bytes: sizeBytes,
    mime_type: mimeType,
    checksum_sha256: checksum,
  }

  const { error: updateError } = await admin.supabase
    .from('engagement_recordings')
    .update(updates)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recording: { ...recording, ...updates } })
}
