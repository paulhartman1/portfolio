
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from './_lib'

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return admin.error
  }

  const body = await request.json()
  const projectId = body.project_id?.toString()
  const title = body.title?.toString()?.trim()
  const sessionType = body.session_type?.toString()?.trim()
  const consentGiven = Boolean(body.consent_given)

  if (!projectId || !title || !sessionType || !consentGiven) {
    return NextResponse.json(
      { error: 'project_id, title, session_type, and consent_given=true are required' },
      { status: 400 }
    )
  }

  const { data, error } = await admin.supabase
    .from('engagement_recordings')
    .insert({
      project_id: projectId,
      title,
      session_type: sessionType,
      consent_given: true,
      created_by: admin.user.id,
      status: 'recording',
    })
    .select('id, project_id, title, session_type, status, started_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ recording: data })
}
