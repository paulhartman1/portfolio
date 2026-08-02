
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from './_lib'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return admin.error
  }

  const projectId = request.nextUrl.searchParams.get('project_id')
  const clientId = request.nextUrl.searchParams.get('client_id')

  if (!projectId && !clientId) {
    return NextResponse.json(
      { error: 'project_id or client_id query parameter is required' },
      { status: 400 }
    )
  }

  // Resolve the project scope. When querying by client, expand through the
  // project_clients junction table so we pick up every project the client is
  // assigned to, and remember each project's name for display.
  let projectIds: string[]
  let projectNameById = new Map<string, string>()

  if (clientId) {
    const { data: projectClients, error: projectClientsError } = await admin.supabase
      .from('project_clients')
      .select('project_id')
      .eq('client_id', clientId)

    if (projectClientsError) {
      return NextResponse.json({ error: projectClientsError.message }, { status: 500 })
    }

    projectIds = (projectClients || []).map((row) => row.project_id)

    if (projectIds.length === 0) {
      return NextResponse.json({ recordings: [] })
    }

    const { data: projects, error: projectsError } = await admin.supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds)

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 })
    }

    projectNameById = new Map((projects || []).map((project) => [project.id, project.name]))
  } else {
    projectIds = [projectId as string]
  }

  const recordingsQuery = admin.supabase
    .from('engagement_recordings')
    .select('*')
    .order('started_at', { ascending: false })

  const query = projectIds.length === 1
    ? recordingsQuery.eq('project_id', projectIds[0])
    : recordingsQuery.in('project_id', projectIds)

  const { data: recordings, error: recordingsError } = await query

  if (recordingsError) {
    return NextResponse.json({ error: recordingsError.message }, { status: 500 })
  }

  const list = recordings || []

  if (list.length === 0) {
    return NextResponse.json({ recordings: [] })
  }

  const recordingIds = list.map((recording) => recording.id)

  const { data: markers, error: markersError } = await admin.supabase
    .from('engagement_session_notes')
    .select('id, recording_id, note_type, note_text, timestamp_seconds, created_at')
    .in('recording_id', recordingIds)
    .order('timestamp_seconds', { ascending: true })

  if (markersError) {
    return NextResponse.json({ error: markersError.message }, { status: 500 })
  }

  const markersByRecording = new Map<string, typeof markers>()
  for (const marker of markers || []) {
    const group = markersByRecording.get(marker.recording_id) || []
    group.push(marker)
    markersByRecording.set(marker.recording_id, group)
  }

  const recordingsWithMarkers = list.map((recording) => ({
    ...recording,
    project_name: projectNameById.get(recording.project_id) || null,
    markers: markersByRecording.get(recording.id) || [],
  }))

  return NextResponse.json({ recordings: recordingsWithMarkers })
}

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
