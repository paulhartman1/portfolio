import { createHash } from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
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

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

// Check if ffmpeg is available in the environment
let ffmpegAvailable = false
try {
  execSync('ffmpeg -version', { stdio: 'pipe' })
  ffmpegAvailable = true
} catch {
  ffmpegAvailable = false
}

async function extractAudioFromVideo(
  serviceRole: ReturnType<typeof createServiceRoleClient>,
  recordingId: string,
  videoStoragePath: string
): Promise<string | null> {
  // Check if ffmpeg is available
  if (!ffmpegAvailable) {
    console.error('[transcription] ffmpeg is not available in this environment', { videoStoragePath })
    throw new Error('ffmpeg is required for audio extraction from video. Please ensure ffmpeg is installed on the server, or extract audio manually and upload it as a derived revision.')
  }

  const { data: videoBlob, error: downloadError } = await serviceRole
    .storage
    .from('engagement-recordings')
    .download(videoStoragePath)

  if (downloadError || !videoBlob) {
    console.error('[transcription] Could not download video for audio extraction', { videoStoragePath, error: downloadError?.message })
    return null
  }

  const buffer = Buffer.from(await videoBlob.arrayBuffer())
  const extractedAudioPath = `${videoStoragePath}/extracted-audio-${Date.now()}.wav`

  // Try to extract audio using ffmpeg
  let audioBuffer: Buffer
  let tmpVideoPath = ''
  let tmpAudioPath = ''
  try {
    tmpVideoPath = `/tmp/opencode/video_${Date.now()}_${Math.random().toString(36).slice(2)}.mkv`
    tmpAudioPath = `/tmp/opencode/audio_${Date.now()}.wav`

    fs.writeFileSync(tmpVideoPath, buffer)

    execSync(
      `ffmpeg -y -i "${tmpVideoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -f wav "${tmpAudioPath}"`,
      { stdio: 'pipe' }
    )

    audioBuffer = Buffer.from(fs.readFileSync(tmpAudioPath))

    const { error: readError } = await serviceRole
      .storage
      .from('engagement-recordings')
      .upload(
        extractedAudioPath,
        audioBuffer,
        { contentType: 'audio/wav' }
      )
    if (readError) throw readError

    fs.unlinkSync(tmpVideoPath)
    fs.unlinkSync(tmpAudioPath)
  } catch (extractionError) {
    console.error('[transcription] Audio extraction failed', { error: extractionError })
    try { fs.unlinkSync(tmpVideoPath) } catch {}
    try { fs.unlinkSync(tmpAudioPath) } catch {}
    return null
  }

  // Store extracted audio as a new revision
  const { error: revisionError } = await serviceRole
    .from('engagement_recording_revisions')
    .insert({
      recording_id: recordingId,
      revision_number: 1,
      storage_path: extractedAudioPath,
      format: 'audio/webm',
      duration_ms: audioBuffer ? audioBuffer.length : 0,
      checksum: audioBuffer ? computeChecksum(audioBuffer) : '',
      source_manifest: {
        originalVideoPath: videoStoragePath,
        extractionMethod: 'ffmpeg',
      },
    })

  if (revisionError) {
    console.error('[transcription] Could not store extracted audio revision', { error: revisionError })
    return null
  }

  return extractedAudioPath
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

async function transcribeAudio(audio: Blob, apiKey: string, contentType: string) {
  const startedAt = Date.now()
  console.info('[transcription] Deepgram request started', {
    bytes: audio.size,
    mimeType: contentType,
  })
  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&language=en&smart_format=true&punctuate=true&diarize=true&utterances=true', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': contentType,
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

  const combined = Buffer.concat(buffers)
  console.info('[transcription] Chunk concatenation complete', {
    recordingId,
    chunkCount: chunks.length,
    totalBytes: combined.byteLength,
  })
  const payload = await transcribeAudio(new Blob([combined], { type: 'audio/webm' }), apiKey, 'audio/webm')
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
      .select('id, final_storage_path, source_type, mime_type')
      .eq('id', recordingId)
      .single()
    if (recordingError || !recording) throw new Error(recordingError?.message || 'Recording not found')

    // Check for existing extracted audio revision (for uploaded video path)
    const { data: audioRevision } = await serviceRole
      .from('engagement_recording_revisions')
      .select('id, storage_path, format')
      .eq('recording_id', recordingId)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sourceType = recording.source_type

    // Resolve source path based on source type
    let sourcePath: string | null = null

    if (sourceType === 'uploaded_video') {
      // For uploaded videos: check for extracted audio revision first
      if (audioRevision && audioRevision.format && audioRevision.format.startsWith('audio/')) {
        sourcePath = audioRevision.storage_path
        console.info('[transcription] Using existing extracted audio revision', { recordingId, sourcePath })
      } else {
        // No extracted audio yet; extract from video
        console.info('[transcription] Extracting audio from video', { recordingId })
        const extractedPath = await extractAudioFromVideo(serviceRole, recordingId, recording.final_storage_path!)
        if (!extractedPath) throw new Error('Audio extraction from video failed')
        sourcePath = extractedPath
      }
    } else {
      // Browser/chunked path (existing behavior)
      sourcePath = audioRevision?.storage_path || recording.final_storage_path
    }

    console.info('[transcription] Source resolved', {
      recordingId,
      sourceType,
      sourcePath: sourcePath || null,
      hasAudioRevision: !!audioRevision,
    })

    const { data: transcript, error: transcriptError } = await serviceRole
      .from('engagement_transcripts')
      .upsert({
        recording_id: recordingId,
        revision_id: audioRevision?.id || null,
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
      const { data: audio, error: audioError } = await serviceRole.storage.from('engagement-recordings').download(sourcePath!)
      if (audioError || !audio) throw new Error(audioError?.message || 'Could not download recording audio')
      const audioContentType = recording.source_type === 'uploaded_video' ? 'audio/wav' : 'audio/webm'
      const payload = await transcribeAudio(audio, apiKey, audioContentType)
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
    const message = error instanceof Error ? error.message : 'Transcription failed'
    console.error('[transcription] Job failed', { recordingId, transcriptId, error: message })
    if (transcriptId) await serviceRole.from('engagement_transcripts').update({ status: 'failed', error_details: message }).eq('id', transcriptId)
    await serviceRole.from('engagement_recordings').update({ pipeline_status: 'failed', error_details: message }).eq('id', recordingId)
    return { ok: false, error: message }
  }
}