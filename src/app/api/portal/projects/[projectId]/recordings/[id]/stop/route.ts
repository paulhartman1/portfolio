import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '../../../../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

// Desktop tapped "Stop Recording" (or the display track ended on its own).
// Revokes any active phone pairing immediately, rather than waiting for the
// video blob to finish uploading (attach-video, which runs much later and
// already does this same revoke as a no-op safety net). This is what lets
// the phone detect "the desktop stopped" quickly via its next heartbeat or
// chunk upload getting rejected as revoked, instead of only finding out
// once the whole recording is finalized.
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

  const { data: recording, error: recordingError } = await serviceRole
    .from('engagement_recordings')
    .select('id')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (recordingError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  await serviceRole
    .from('engagement_mic_pairings')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('recording_id', id)
    .in('status', ['pending', 'opened', 'permission_pending', 'active'])

  return NextResponse.json({ ok: true })
}
