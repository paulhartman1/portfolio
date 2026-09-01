import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '../../../../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

// Cleans up a recording row created for the phone-pairing setup screen if
// the user backs out before ever starting screen capture (closes the panel,
// switches mic mode, etc). Mirrors the admin cancel-upload route's intent:
// don't leave orphaned "recording" rows with no media behind.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await params
  const access = await requireProjectAccess(projectId)
  if ('error' in access) {
    return access.error
  }

  const serviceRole = createServiceRoleClient()

  const { data: recording, error: findError } = await serviceRole
    .from('engagement_recordings')
    .select('id, project_id, pipeline_status')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (findError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  const { count: chunkCount } = await serviceRole
    .from('engagement_recording_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('recording_id', id)

  if ((chunkCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot cancel a recording that already has audio chunks' },
      { status: 400 }
    )
  }

  const { error: deleteError } = await serviceRole
    .from('engagement_recordings')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
