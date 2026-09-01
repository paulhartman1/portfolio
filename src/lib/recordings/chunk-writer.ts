import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Shared chunk-upload logic used by BOTH the existing admin mic-chunk route
// and the new phone-mic-chunk route. There is exactly one chunk-upload /
// storage / DB-write mechanism in the app; the only thing that differs
// between "this computer" and "phone" audio is the `mediaSource` tag on the
// row, which downstream (assembly, playback) doesn't need to treat any
// differently -- both are just audio chunks belonging to the recording.

export type MediaSource = 'browser_mic' | 'phone_mic'

type WriteChunkParams = {
  serviceRole: SupabaseClient
  recordingId: string
  chunkIndex: number
  buffer: Buffer
  mimeType: string
  mediaSource: MediaSource
  durationMs: number | null
  offsetMs: number | null
}

type WriteChunkResult =
  | { ok: true; status: 'uploaded' | 'already_exists'; storagePath: string }
  | { ok: false; status: number; error: string }

export async function writeRecordingChunk({
  serviceRole,
  recordingId,
  chunkIndex,
  buffer,
  mimeType,
  mediaSource,
  durationMs,
  offsetMs,
}: WriteChunkParams): Promise<WriteChunkResult> {
  const checksum = createHash('sha256').update(buffer).digest('hex')

  const { data: existingChunk } = await serviceRole
    .from('engagement_recording_chunks')
    .select('checksum')
    .eq('recording_id', recordingId)
    .eq('chunk_index', chunkIndex)
    .maybeSingle()

  if (existingChunk) {
    if (existingChunk.checksum === checksum) {
      return { ok: true, status: 'already_exists', storagePath: '' }
    }
    return { ok: false, status: 409, error: 'Conflict: chunk index exists with different content' }
  }

  const extension = mimeType.includes('ogg') ? 'ogg' : 'webm'
  const prefix = mediaSource === 'phone_mic' ? 'phone-chunk' : 'chunk'
  const storagePath = `${recordingId}/${prefix}-${chunkIndex.toString().padStart(6, '0')}.${extension}`

  const { error: uploadError } = await serviceRole.storage
    .from('engagement-recordings')
    .upload(storagePath, buffer, {
      contentType: mimeType || 'audio/webm',
      upsert: true,
    })

  if (uploadError) {
    return { ok: false, status: 500, error: uploadError.message }
  }

  const { error: insertError } = await serviceRole
    .from('engagement_recording_chunks')
    .upsert(
      {
        recording_id: recordingId,
        chunk_index: chunkIndex,
        storage_path: storagePath,
        size_bytes: buffer.byteLength,
        checksum,
        mime_type: mimeType || 'audio/webm',
        duration_ms: durationMs,
        offset_ms: offsetMs,
        media_source: mediaSource,
        status: 'uploaded',
      },
      { onConflict: 'recording_id,chunk_index' }
    )

  if (insertError) {
    return { ok: false, status: 500, error: insertError.message }
  }

  return { ok: true, status: 'uploaded', storagePath }
}
