
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from './_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

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

  const { data: transcripts, error: transcriptsError } = await admin.supabase
    .from('engagement_transcripts')
    .select('id, recording_id, full_text, utterances, speaker_count, duration_seconds, status, error_details, completed_at, processing_mode, total_parts, processed_parts')
    .in('recording_id', recordingIds)

  if (transcriptsError) {
    return NextResponse.json({ error: transcriptsError.message }, { status: 500 })
  }

  const transcriptIds = (transcripts || []).map((transcript) => transcript.id)
  const { data: observations, error: observationsError } = transcriptIds.length
    ? await admin.supabase.from('transcript_observations').select('id, transcript_id, statement, confidence, notes, created_by, created_at, updated_at, transcript_observation_evidence(*)').in('transcript_id', transcriptIds)
    : { data: [], error: null }
  if (observationsError) return NextResponse.json({ error: observationsError.message }, { status: 500 })
  const { data: clusters, error: clustersError } = transcriptIds.length
    ? await admin.supabase
      .from('engagement_transcript_speaker_clusters')
      .select('id, transcript_id, provider_speaker_key, display_label, utterance_count, total_speaking_duration, engagement_speaker_identity_assignments(id, person_id, assignment_method, confirmation_state, assigned_at, persons(id, display_name, company, title))')
      .in('transcript_id', transcriptIds)
    : { data: [], error: null }
  if (clustersError) return NextResponse.json({ error: clustersError.message }, { status: 500 })

  const markersByRecording = new Map<string, typeof markers>()
  for (const marker of markers || []) {
    const group = markersByRecording.get(marker.recording_id) || []
    group.push(marker)
    markersByRecording.set(marker.recording_id, group)
  }

  const clustersByTranscript = new Map<string, typeof clusters>()
  for (const cluster of clusters || []) {
    const group = clustersByTranscript.get(cluster.transcript_id) || []
    group.push(cluster)
    clustersByTranscript.set(cluster.transcript_id, group)
  }
  const transcriptByRecording = new Map((transcripts || []).map((transcript) => [transcript.recording_id, { ...transcript, clusters: clustersByTranscript.get(transcript.id) || [] }]))
  const observationsByTranscript = new Map<string, typeof observations>()
  for (const observation of observations || []) {
    const group = observationsByTranscript.get(observation.transcript_id) || []
    group.push(observation)
    observationsByTranscript.set(observation.transcript_id, group)
  }

  const recordingsWithMarkers = list.map((recording) => ({
    ...recording,
    project_name: projectNameById.get(recording.project_id) || null,
    markers: markersByRecording.get(recording.id) || [],
    transcript: transcriptByRecording.get(recording.id) || null,
    observations: (observationsByTranscript.get(transcriptByRecording.get(recording.id)?.id || '') || []).map((observation) => ({
      ...observation,
      evidence: observation.transcript_observation_evidence || [],
    })),
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
  const sourceType = body.source_type?.toString() || 'uploaded_video'
  const mimeType = body.mime_type as string | null
  const container = body.container as string | null

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
      status: 'uploading',
      source_type: sourceType,
      mime_type: mimeType,
      container: container,
    })
    .select('id, project_id, title, session_type, status, started_at, source_type, mime_type, container')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ext = container || title.split('.').pop() || 'bin'
  const storagePath = `${data.id}/original.${ext}`

  const { error: updateError } = await admin.supabase
    .from('engagement_recordings')
    .update({ final_storage_path: storagePath })
    .eq('id', data.id)

  if (updateError) {
    await admin.supabase.from('engagement_recordings').delete().eq('id', data.id)
    return NextResponse.json({ error: `Failed to set storage path: ${updateError.message}` }, { status: 500 })
  }

  const serviceRole = createServiceRoleClient()
  const { data: signedUrlData, error: signedUrlError } = await serviceRole.storage
    .from('engagement-recordings')
    .createSignedUploadUrl(storagePath)

  if (signedUrlError) {
    await admin.supabase.from('engagement_recordings').delete().eq('id', data.id)
    return NextResponse.json({ error: `Failed to generate upload URL: ${signedUrlError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    recording: data,
    final_storage_path: storagePath,
    signed_upload_url: signedUrlData.signedUrl,
    token: signedUrlData.token,
  })
}
