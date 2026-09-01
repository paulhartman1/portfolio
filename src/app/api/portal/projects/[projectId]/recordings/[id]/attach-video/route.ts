import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '../../../../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { assembleRecording } from '@/app/api/admin/recordings/_assembly'

// Called once the desktop has finished uploading the screen-video blob to
// project_files (unchanged, single-blob path). This links that file to the
// recording session, revokes the phone pairing (telling the phone the
// recording has ended), and assembles the phone's audio chunks into a
// revision -- reusing assembleRecording() exactly as the admin recorder
// does, since chunk validation/assembly doesn't care which device produced
// the chunks.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await params
  const access = await requireProjectAccess(projectId)
  if ('error' in access) {
    return access.error
  }

  const body = await request.json().catch(() => ({}))
  const projectFileId = body.project_file_id?.toString()

  if (!projectFileId) {
    return NextResponse.json({ error: 'project_file_id is required' }, { status: 400 })
  }

  const serviceRole = createServiceRoleClient()

  const { data: recording, error: recordingError } = await serviceRole
    .from('engagement_recordings')
    .select('id, project_id, pipeline_status, video_started_at')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (recordingError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  const { data: file, error: fileError } = await serviceRole
    .from('project_files')
    .select('id, project_id, uploader_id')
    .eq('id', projectFileId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (fileError || !file || file.uploader_id !== access.user.id) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  await serviceRole
    .from('project_files')
    .update({ recording_id: id })
    .eq('id', projectFileId)

  // Read the most recent mic pairing's authoritative start time *before*
  // revoking it below (revoke only touches status/revoked_at, but do this
  // first regardless so the two operations can't race against each other).
  const { data: pairing } = await serviceRole
    .from('engagement_mic_pairings')
    .select('server_started_at')
    .eq('recording_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // End the phone's ability to keep uploading/streaming, whether or not it
  // ever actually connected. Usually a no-op by now since the desktop's
  // /stop route already revoked this pairing the moment the user clicked
  // stop -- this is just a safety net for cases that bypassed /stop.
  await serviceRole
    .from('engagement_mic_pairings')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('recording_id', id)
    .in('status', ['pending', 'opened', 'permission_pending', 'active'])

  // Compute the canonical-timeline sync offset now that both legs (if any)
  // are done: timeline zero = whichever of video/audio started first
  // (server-clock timestamps only, comparing two devices' own clocks would
  // be unreliable). These are estimates -- each timestamp reflects roughly
  // when the server received the corresponding start POST, not the exact
  // instant capture began -- but they share one clock, which is what makes
  // the comparison meaningful.
  const videoStartedAt = recording.video_started_at ? new Date(recording.video_started_at).getTime() : null
  const audioStartedAt = pairing?.server_started_at ? new Date(pairing.server_started_at).getTime() : null

  let timelineStartedAt: number | null = null
  let videoOffsetMs: number | null = null
  if (videoStartedAt !== null) {
    timelineStartedAt = audioStartedAt !== null ? Math.min(videoStartedAt, audioStartedAt) : videoStartedAt
    videoOffsetMs = videoStartedAt - timelineStartedAt
  }
  const audioOffsetMs = timelineStartedAt !== null && audioStartedAt !== null
    ? audioStartedAt - timelineStartedAt
    : null

  await serviceRole
    .from('engagement_recordings')
    .update({
      pipeline_status: 'upload_complete',
      upload_completed_at: new Date().toISOString(),
      timeline_started_at: timelineStartedAt !== null ? new Date(timelineStartedAt).toISOString() : null,
      video_offset_ms: videoOffsetMs,
    })
    .eq('id', id)

  const { count: chunkCount } = await serviceRole
    .from('engagement_recording_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('recording_id', id)

  if (!chunkCount) {
    // Phone never connected / produced audio. The screen video is already
    // saved -- don't fail the whole request over a missing mic track.
    await serviceRole
      .from('engagement_recordings')
      .update({ status: 'finalized', pipeline_status: 'assembled', duration_seconds: null })
      .eq('id', id)

    return NextResponse.json({ ok: true, audio: 'none' })
  }

  const result = await assembleRecording(id, audioOffsetMs)

  if (!result.ok) {
    // Video is safe regardless; surface the audio-assembly problem without
    // failing the response the desktop is waiting on.
    return NextResponse.json({ ok: true, audio: 'failed', audio_error: result.error })
  }

  return NextResponse.json({ ok: true, audio: 'assembled', revision: result.revision })
}
