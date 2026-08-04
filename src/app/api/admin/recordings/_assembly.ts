import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { createHash } from 'crypto'

type RecordingChunk = {
  id: string
  recording_id: string
  chunk_index: number
  storage_path: string
  checksum: string | null
  duration_ms: number | null
  created_at: string
}

export type ValidationResult = {
  valid: boolean
  expectedIndexes: number[]
  missingIndexes: number[]
  duplicateIndexes: number[]
  invalidChecksums: string[]
  missingStorageObjects: string[]
  chunks: RecordingChunk[]
}

export async function validateRecordingChunks(recordingId: string): Promise<ValidationResult> {
  const serviceRole = createServiceRoleClient()

  const { data: chunks, error: chunksError } = await serviceRole
    .from('engagement_recording_chunks')
    .select('*')
    .eq('recording_id', recordingId)
    .order('chunk_index', { ascending: true })

  if (chunksError) throw chunksError


  const result: ValidationResult = {
    valid: true,
    expectedIndexes: [],
    missingIndexes: [],
    duplicateIndexes: [],
    invalidChecksums: [],
    missingStorageObjects: [],
    chunks: chunks || []
  }

  if (!chunks || chunks.length === 0) {
    result.valid = false
    return result
  }

  const maxIndex = chunks[chunks.length - 1].chunk_index
  const foundIndexes = new Set(chunks.map(c => c.chunk_index))

  for (let i = 0; i <= maxIndex; i++) {
    result.expectedIndexes.push(i)
    if (!foundIndexes.has(i)) {
      result.missingIndexes.push(i)
      result.valid = false
    }
  }

  // Check for storage objects and checksums (optional/thorough)
  // For now, we trust the DB and check existence during download in assembly
  
  return result
}

export async function assembleRecording(recordingId: string) {
  const serviceRole = createServiceRoleClient()

  // 1. Transition to validating
  await serviceRole
    .from('engagement_recordings')
    .update({ pipeline_status: 'validating' })
    .eq('id', recordingId)

  const validation = await validateRecordingChunks(recordingId)
  if (!validation.valid) {
    await serviceRole
      .from('engagement_recordings')
      .update({ 
        pipeline_status: 'incomplete',
        error_details: `Missing chunks: ${validation.missingIndexes.join(', ')}`
      })
      .eq('id', recordingId)
    return { ok: false, error: 'Incomplete recording' }
  }

  // 2. Transition to assembling
  await serviceRole
    .from('engagement_recordings')
    .update({ pipeline_status: 'assembling' })
    .eq('id', recordingId)

  try {
    const buffers: Buffer[] = []
    let totalDurationMs = 0

    for (const chunk of validation.chunks) {
      const { data: blob, error: downloadError } = await serviceRole
        .storage
        .from('engagement-recordings')
        .download(chunk.storage_path)

      if (downloadError || !blob) {
        throw new Error(`Failed to download chunk ${chunk.chunk_index}: ${downloadError?.message}`)
      }

      const buffer = Buffer.from(await blob.arrayBuffer())
      
      // Verify checksum
      if (chunk.checksum) {
        const actualChecksum = createHash('sha256').update(buffer).digest('hex')
        if (actualChecksum !== chunk.checksum) {
          throw new Error(`Checksum mismatch for chunk ${chunk.chunk_index}`)
        }
      }

      buffers.push(buffer)
      if (chunk.duration_ms) totalDurationMs += chunk.duration_ms
    }

    const combinedBuffer = Buffer.concat(buffers)
    const combinedChecksum = createHash('sha256').update(combinedBuffer).digest('hex')

    // Get next revision number
    const { data: latestRevision } = await serviceRole
      .from('engagement_recording_revisions')
      .select('revision_number')
      .eq('recording_id', recordingId)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextRevision = (latestRevision?.revision_number ?? 0) + 1
    const storagePath = `${recordingId}/revisions/${nextRevision}/audio.webm`

    const { error: uploadError } = await serviceRole
      .storage
      .from('engagement-recordings')
      .upload(storagePath, combinedBuffer, {
        contentType: 'audio/webm',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: revision, error: revisionError } = await serviceRole
      .from('engagement_recording_revisions')
      .insert({
        recording_id: recordingId,
        revision_number: nextRevision,
        storage_path: storagePath,
        format: 'audio/webm',
        duration_ms: totalDurationMs,
        checksum: combinedChecksum,
        source_manifest: {
          chunk_count: validation.chunks.length,
          chunks: validation.chunks.map(c => ({ id: c.id, index: c.chunk_index, checksum: c.checksum }))
        }
      })
      .select()
      .single()

    if (revisionError) throw revisionError

    // 3. Transition to assembled
    await serviceRole
      .from('engagement_recordings')
      .update({ 
        pipeline_status: 'assembled',
        final_storage_path: storagePath, // Backwards compatibility for now
        duration_seconds: Math.floor(totalDurationMs / 1000)
      })
      .eq('id', recordingId)

    return { ok: true, revision }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assembly failed'
    await serviceRole
      .from('engagement_recordings')
      .update({ 
        pipeline_status: 'failed',
        error_details: message
      })
      .eq('id', recordingId)
    return { ok: false, error: message }
  }
}
