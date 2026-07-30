import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '../_lib'

export async function DELETE(
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
    .select('id')
    .eq('id', id)
    .single()

  if (recordingError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  const serviceRole = createServiceRoleClient()
  const { data: objects, error: listError } = await serviceRole
    .storage
    .from('engagement-recordings')
    .list(id, { limit: 1000, offset: 0 })

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  if (objects && objects.length > 0) {
    const paths = objects.map((obj) => `${id}/${obj.name}`)
    const { error: removeError } = await serviceRole
      .storage
      .from('engagement-recordings')
      .remove(paths)

    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 })
    }
  }

  const { error: deleteError } = await admin.supabase
    .from('engagement_recordings')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted_recording_id: id })
}
