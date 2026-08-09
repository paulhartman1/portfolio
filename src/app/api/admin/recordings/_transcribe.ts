import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { reconcileUtteranceIds, RawUtterance, Utterance } from './_utterance-ids'

type DeepgramPayload = {
  metadata?: { duration?: number }
  results?: {
    channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>
    utterances?: Array<{
      start: number
      end: number
      speaker: number
      transcript: string
      confidence?: number
    }>
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Transcription failed'
}

async function ensureSpeakerClusters(serviceRole: ReturnType<typeof createServiceRoleClient>, transcriptId: string) {
  const { data: transcript, error } = await serviceRole.from('engagement_transcripts').select('utterances').eq('id', transcriptId).single()
  if (error || !transcript) throw new Error(error?.message || 'Transcript not found while creating speaker clusters')

  const aggregates = new Map<string, { first: number; last: number; count: number; duration: number; label: string }>()
  for (const utterance of (transcript.utterances || []) as Utterance[]) {
    const key = utterance.provider_speaker_key || `speaker-${utterance.speaker}`
    const current = aggregates.get(key)
    const start = Number(utterance.start) || 0
    const end = Number(utterance.end) || start
    if (current) {
      current.first = Math.min(current.first, start)
      current.last = Math.max(current.last, end)
      current.count += 1
      current.duration += Math.max(0, end - start)
    } else {
      const speakerNumber = Number.isInteger(utterance.speaker) ? utterance.speaker + 1 : key
      aggregates.set(key, { first: start, last: end, count: 1, duration: Math.max(0, end - start), label: `Speaker ${speakerNumber}` })
    }
  }

  for (const [providerSpeakerKey, aggregate] of aggregates) {
    await serviceRole.from('engagement_transcript_speaker_clusters').upsert({
      transcript_id: transcriptId,
      provider_speaker_key: providerSpeakerKey,
      display_label: aggregate.label,
      first_appearance_seconds: aggregate.first,
      last_appearance_seconds: aggregate.last,
      utterance_count: aggregate.count,
      total_speaking_duration: aggregate.duration,
    }, { onConflict: 'transcript_id,provider_speaker_key' })
  }
}

async function transcribeAudio(audio: Blob, apiKey: string) {
  const startedAt = Date.now()
  console.info('[transcription] Deepgram request started', {
    bytes: audio.size,
    mimeType: audio.type || 'audio/webm',
  })
  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&language=en&smart_format=true&punctuate=true&diarize=true&utterances=true', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': audio.type || 'audio/webm',
    },
    body: await audio.arrayBuffer(),
  })

  const payload = await response.json() as DeepgramPayload & { err_msg?: string }
  console.info('[transcription] Deepgram response received', {
    status: response.status,
    ok: response.ok,
    elapsedMs: Date.now() - startedAt,
    durationSeconds: payload.metadata?.duration || null,
    utteranceCount: payload.results?.utterances?.length || 0,
    error: payload.err_msg || null,
  })
  if (!response.ok) throw new Error(payload.err_msg || `Deepgram request failed with status ${response.status}`)
  return payload
}

async function transcribeChunks(
  serviceRole: ReturnType<typeof createServiceRoleClient>,
  recordingId: string,
  transcriptId: string,
  apiKey: string,
) {
  const { data: chunks, error: chunksError } = await serviceRole
    .from('engagement_recording_chunks')
    .select('id, chunk_index, storage_path')
    .eq('recording_id', recordingId)
    .order('chunk_index', { ascending: true })

  if (chunksError || !chunks?.length) throw new Error(chunksError?.message || 'Recording has no uploaded chunks')

  console.info('[transcription] Chunked transcription started', {
    recordingId,
    transcriptId,
    chunkCount: chunks.length,
  })

  await serviceRole.from('engagement_transcripts').update({
    processing_mode: 'chunked',
    source_storage_path: 'chunked-recording',
    total_parts: chunks.length,
    processed_parts: 0,
  }).eq('id', transcriptId)

  const buffers: Buffer[] = []
  for (const [partIndex, chunk] of chunks.entries()) {
    const chunkStartedAt = Date.now()
    const { data: audio, error: downloadError } = await serviceRole.storage
      .from('engagement-recordings')
      .download(chunk.storage_path)
    if (downloadError || !audio) throw new Error(`Could not download chunk ${partIndex + 1}: ${downloadError?.message || 'audio unavailable'}`)
    const buffer = Buffer.from(await audio.arrayBuffer())
    buffers.push(buffer)
    if (partIndex === 0 || (partIndex + 1) % 25 === 0 || partIndex + 1 === chunks.length) {
      console.info('[transcription] Chunk downloaded', {
        recordingId,
        part: partIndex + 1,
        totalParts: chunks.length,
        bytes: buffer.byteLength,
        elapsedMs: Date.now() - chunkStartedAt,
      })
    }
    await serviceRole.from('engagement_transcripts').update({ processed_parts: partIndex + 1 }).eq('id', transcriptId)
  }

  // MediaRecorder timeslices are WebM fragments, not independent audio files.
  // Keeping the first fragment's container header makes the concatenated stream
  // valid without uploading an oversized assembled object to Storage.
  const combined = Buffer.concat(buffers)
  console.info('[transcription] Chunk concatenation complete', {
    recordingId,
    chunkCount: chunks.length,
    totalBytes: combined.byteLength,
    firstBytes: combined.subarray(0, 16).toString('hex'),
    lastBytes: combined.subarray(-16).toString('hex'),
  })
  const payload = await transcribeAudio(new Blob([combined], { type: 'audio/webm' }), apiKey)
  const utterances = payload.results?.utterances || []
  const alternative = payload.results?.channels?.[0]?.alternatives?.[0]
  return {
    durationSeconds: payload.metadata?.duration || null,
    utterances,
    fullText: alternative?.transcript || utterances.map((utterance) => utterance.transcript).join(' '),
    rawParts: [payload],
  }
}

export async function transcribeRecording(recordingId: string) {
  const serviceRole = createServiceRoleClient()
  let transcriptId: string | null = null

  try {
    console.info('[transcription] Job started', { recordingId })
    const apiKey = process.env.DEEPGRAM_API_KEY
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not configured')

    const { data: recording, error: recordingError } = await serviceRole
      .from('engagement_recordings')
      .select('id, final_storage_path')
      .eq('id', recordingId)
      .single()
    if (recordingError || !recording) throw new Error(recordingError?.message || 'Recording not found')

    const { data: revision } = await serviceRole
      .from('engagement_recording_revisions')
      .select('id, storage_path')
      .eq('recording_id', recordingId)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sourcePath = revision?.storage_path || recording.final_storage_path
    console.info('[transcription] Source resolved', {
      recordingId,
      sourceType: sourcePath ? 'assembled' : 'raw_chunks',
      sourcePath: sourcePath || null,
      revisionId: revision?.id || null,
    })
    const { data: transcript, error: transcriptError } = await serviceRole
      .from('engagement_transcripts')
      .upsert({
        recording_id: recordingId,
        revision_id: revision?.id || null,
        source_storage_path: sourcePath || 'chunked-recording',
        diarization_enabled: true,
        status: 'processing',
        error_details: null,
        requested_at: new Date().toISOString(),
        completed_at: null,
      }, { onConflict: 'recording_id' })
      .select('id')
      .single()
    if (transcriptError || !transcript) throw new Error(transcriptError?.message || 'Could not create transcript job')
    transcriptId = transcript.id
    const jobId = transcript.id

    // Fetch existing utterances for ID reconciliation (preserve IDs on retranscription)
    const { data: existingTranscript } = await serviceRole
      .from('engagement_transcripts')
      .select('utterances')
      .eq('id', transcriptId)
      .single()
    const previousUtterances = (existingTranscript?.utterances as Utterance[]) || null

    await serviceRole.from('engagement_recordings').update({ pipeline_status: 'transcribing', error_details: null }).eq('id', recordingId)

    if (!sourcePath) {
      const result = await transcribeChunks(serviceRole, recordingId, jobId, apiKey)
      const reconciledUtterances = reconcileUtteranceIds(result.utterances as RawUtterance[], previousUtterances)
      await serviceRole.from('engagement_transcripts').update({
        status: 'complete',
        duration_seconds: result.durationSeconds,
        full_text: result.fullText,
        utterances: reconciledUtterances,
        raw_json: { mode: 'chunked', parts: result.rawParts },
        completed_at: new Date().toISOString(),
      }).eq('id', transcriptId)
    } else {
      const { data: audio, error: audioError } = await serviceRole.storage.from('engagement-recordings').download(sourcePath)
      if (audioError || !audio) throw new Error(audioError?.message || 'Could not download recording audio')
      const payload = await transcribeAudio(audio, apiKey)
      const utterances = payload.results?.utterances || []
      const alternative = payload.results?.channels?.[0]?.alternatives?.[0]
      const reconciledUtterances = reconcileUtteranceIds(utterances as RawUtterance[], previousUtterances)
      await serviceRole.from('engagement_transcripts').update({
        processing_mode: 'assembled',
        full_text: alternative?.transcript || utterances.map((utterance) => utterance.transcript).join(' '),
        utterances: reconciledUtterances,
        raw_json: payload,
        speaker_count: new Set(utterances.map((utterance) => utterance.speaker)).size || null,
        duration_seconds: payload.metadata?.duration || null,
        status: 'complete',
        completed_at: new Date().toISOString(),
      }).eq('id', transcriptId)
    }

    await ensureSpeakerClusters(serviceRole, transcriptId as string)

    await serviceRole.from('engagement_recordings').update({ pipeline_status: 'transcript_ready', error_details: null }).eq('id', recordingId)
    console.info('[transcription] Job completed', { recordingId, transcriptId })
    return { ok: true }
  } catch (error) {
    const message = errorMessage(error)
    console.error('[transcription] Job failed', { recordingId, transcriptId, error: message })
    if (transcriptId) await serviceRole.from('engagement_transcripts').update({ status: 'failed', error_details: message }).eq('id', transcriptId)
    await serviceRole.from('engagement_recordings').update({ pipeline_status: 'failed', error_details: message }).eq('id', recordingId)
    return { ok: false, error: message }
  }
}
