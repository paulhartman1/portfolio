import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '../../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

// Creates the recording/session row *before* screen capture starts. This is
// what lets a phone pair to "this recording" via QR code while it's still
// running -- the id has to exist up front, not only after the user stops.
//
// The screen video itself is uploaded to project_files exactly as it always
// has been (single blob, on stop); this row exists purely so the phone
// microphone audio (which IS chunked/uploaded progressively) has a session
// to attach to, using the same engagement_recordings/chunks pipeline the
// admin recorder already uses.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const access = await requireProjectAccess(projectId)
  if ('error' in access) {
    return access.error
  }

  const body = await request.json().catch(() => ({}))
  const micSource = body.mic_source?.toString()

  if (micSource !== 'phone') {
    // Only the phone-mic flow needs a session row created ahead of capture.
    // "This computer" / "No microphone" keep the existing single-upload
    // behavior with no engagement_recordings row at all.
    return NextResponse.json({ error: 'mic_source must be "phone"' }, { status: 400 })
  }

  const serviceRole = createServiceRoleClient()

  const { data, error } = await serviceRole
    .from('engagement_recordings')
    .insert({
      project_id: projectId,
      title: `Screen recording — ${new Date().toISOString()}`,
      session_type: 'screen_capture',
      consent_given: true,
      created_by: access.user.id,
      status: 'recording',
      pipeline_status: 'recording',
      source_type: 'browser',
      mic_source: 'phone',
    })
    .select('id, project_id, title, started_at, mic_source')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ recording: data })
}
