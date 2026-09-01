import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '../../../../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

// Desktop calls this the instant its MediaRecorder.start() fires (same tick
// as the local startedRef.current = Date.now()). Mirrors the phone's own
// /start route, which stamps server_started_at on the mic pairing. Neither
// timestamp is an exact media-start instant -- both are "server received a
// POST around now" and are subject to normal network latency -- but they
// share the same server clock, so comparing the two is far more reliable
// than comparing two different devices' local Date.now() values, and is
// good enough to align the two tracks to roughly a second of precision.
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

  const { error } = await serviceRole
    .from('engagement_recordings')
    .update({ video_started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', projectId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
