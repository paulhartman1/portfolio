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

  const { data: recording, error: findError } = await admin.supabase
    .from('engagement_recordings')
    .select('id, status, final_storage_path')
    .eq('id', id)
    .single()

  if (findError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (recording.status !== 'uploading') {
    return NextResponse.json({ error: `Cannot cancel recording in status '${recording.status}'` }, { status: 400 })
  }

  if (recording.final_storage_path) {
    const serviceRole = createServiceRoleClient()
    await serviceRole.storage
      .from('engagement-recordings')
      .remove([recording.final_storage_path])
  }

  const { error: deleteError } = await admin.supabase
    .from('engagement_recordings')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
