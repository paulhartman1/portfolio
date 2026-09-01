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
    .select('id, project_id, pipeline_status')
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

  // End the phone's ability to keep uploading/streaming, whether or not it
  // ever actually connected.
  await serviceRole
    .from('engagement_mic_pairings')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('recording_id', id)
    .in('status', ['pending', 'opened', 'permission_pending', 'active'])

  await serviceRole
    .from('engagement_recordings')
    .update({ pipeline_status: 'upload_complete', upload_completed_at: new Date().toISOString() })
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

  const result = await assembleRecording(id)

  if (!result.ok) {
    // Video is safe regardless; surface the audio-assembly problem without
    // failing the response the desktop is waiting on.
    return NextResponse.json({ ok: true, audio: 'failed', audio_error: result.error })
  }

  return NextResponse.json({ ok: true, audio: 'assembled', revision: result.revision })
}
