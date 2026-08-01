
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from './_lib'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return admin.error
  }

  const projectId = request.nextUrl.searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id query parameter is required' },
      { status: 400 }
    )
  }

  const { data: recordings, error: recordingsError } = await admin.supabase
    .from('engagement_recordings')
    .select('*')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })

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
