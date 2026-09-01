'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type RecordingStatus = 'recording' | 'paused' | 'finalized' | 'failed'

type Marker = {
  id: string
  note_type: 'question' | 'friction' | 'decision' | 'observation' | 'action'
  note_text: string | null
  timestamp_seconds: number
  created_at: string
}

type NoteType = Marker['note_type']

type Recording = {
  id: string
  project_id: string
  project_name: string | null
  title: string
  session_type: string
  status: RecordingStatus
  consent_given: boolean
  started_at: string
  stopped_at: string | null
  duration_seconds: number | null
  total_chunks: number
  final_storage_path: string | null
  source_type: string
  mime_type: string | null
  container: string | null
  markers: Marker[]
  transcript: Transcript | null
  observations: TranscriptObservation[]
  // Canonical-timeline sync fields (screen video vs. phone-mic audio).
  // See attach-video/route.ts for how these are computed -- estimates
  // based on server-receipt timestamps, not exact media-start instants.
  video_started_at: string | null
  timeline_started_at: string | null
  video_offset_ms: number | null
}

type Utterance = {
  id: string
  start: number
  end: number
  speaker: number
  transcript: string
}

type Transcript = {
  id: string
  status: 'processing' | 'complete' | 'failed'
  full_text: string
  utterances: Utterance[]
  speaker_count: number | null
  error_details: string | null
  processing_mode: 'assembled' | 'chunked'
  total_parts: number | null
  processed_parts: number
  clusters: SpeakerCluster[]
  // Canonical-timeline seconds = utterance.start/.end + timeline_offset_ms / 1000.
  // 0 when there's no phone-mic pairing to correlate against.
  timeline_offset_ms: number | null
}

type SpeakerPerson = { id: string; display_name: string; company: string | null; title: string | null }
type SpeakerCluster = {
  id: string
  provider_speaker_key: string
  display_label: string
  utterance_count: number
  total_speaking_duration: number
  engagement_speaker_identity_assignments: Array<{ person_id: string; persons: SpeakerPerson }>
}

type ObservationEvidence = {
  id: string
  start_utterance_id: string
  start_char_offset: number
  end_utterance_id: string
  end_char_offset: number
  start_seconds: number
  end_seconds: number
  excerpt_text: string
  speaker_labels: string[]
  state: 'attached' | 'changed' | 'detached'
}

type TranscriptObservation = {
  id: string
  transcript_id: string
  statement: string
  confidence: 'high' | 'medium' | 'low'
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  evidence: ObservationEvidence[]
}

type IntelligenceCandidate = {
  id: string
  project_id: string
  transcript_id: string
  type: 'follow_up_question' | 'observation' | 'contradiction' | 'knowledge_gap' | 'knowledge_transfer_risk' | 'action_item'
  content: string
  reasoning_summary: string | null
  confidence: number | null
  provider: string
  model: string
  status: 'candidate' | 'accepted' | 'rejected'
  accepted_observation_id: string | null
  created_at: string
  evidence: Array<{ id: string; transcript_id: string; utterance_ids: string[]; role: string }>
}

const intelligenceTypeStyles: Record<IntelligenceCandidate['type'], { badge: string; label: string }> = {
  follow_up_question: { badge: 'bg-blue-100 text-blue-800', label: 'Follow-up question' },
  observation: { badge: 'bg-purple-100 text-purple-800', label: 'Observation' },
  contradiction: { badge: 'bg-red-100 text-red-800', label: 'Contradiction' },
  knowledge_gap: { badge: 'bg-amber-100 text-amber-800', label: 'Knowledge gap' },
  knowledge_transfer_risk: { badge: 'bg-slate-700 text-white', label: 'Knowledge-transfer risk' },
  action_item: { badge: 'bg-green-100 text-green-800', label: 'Action item' },
}

type Playback = {
  urls: string[]
  index: number
}

const markerStyles: Record<Marker['note_type'], { badge: string; icon: string }> = {
  question: { badge: 'bg-blue-500', icon: '❓' },
  friction: { badge: 'bg-amber-500', icon: '⚠️' },
  decision: { badge: 'bg-green-500', icon: '✅' },
  observation: { badge: 'bg-purple-500', icon: '👁' },
  action: { badge: 'bg-sky-500', icon: '➜' },
}

const statusStyles: Record<RecordingStatus, string> = {
  recording: 'bg-red-100 text-red-700 border-red-200',
  paused: 'bg-amber-100 text-amber-700 border-amber-200',
  finalized: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
}

function formatDuration(totalSeconds: number | null) {
  if (totalSeconds === null || totalSeconds <= 0) return '—'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function formatTimestamp(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

// video_offset_ms is always >= 0 by construction (timeline zero = whichever
// of video/audio started first). A positive value means the phone's audio
// started first and the video began that many ms into the audio track.
function formatSyncOffset(videoOffsetMs: number | null) {
  if (videoOffsetMs === null) return null
  if (videoOffsetMs === 0) return 'Phone audio and screen recording started together'
  const seconds = (videoOffsetMs / 1000).toFixed(1)
  return `Phone audio started ${seconds}s before screen recording (est.)`
}

function getSelectionRange(
  utterances: Utterance[],
  selection: Selection
): { startUtteranceId: string; startOffset: number; endUtteranceId: string; endOffset: number; startSeconds: number; endSeconds: number; text: string; speakerLabels: string[] } | null {
  if (!selection.rangeCount) return null

  const range = selection.getRangeAt(0)
  if (range.collapsed) return null

  const startNode = range.startContainer
  const endNode = range.endContainer

  const startUttElement = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode as HTMLElement
  const endUttElement = endNode.nodeType === Node.TEXT_NODE ? endNode.parentElement : endNode as HTMLElement

  const startUttEl = startUttElement?.closest('[data-utterance-id]') as HTMLElement | null
  const endUttEl = endUttElement?.closest('[data-utterance-id]') as HTMLElement | null

  if (!startUttEl || !endUttEl) return null

  const startUtteranceId = startUttEl.dataset.utteranceId!
  const endUtteranceId = endUttEl.dataset.utteranceId!

  const startIdx = utterances.findIndex((u) => u.id === startUtteranceId)
  const endIdx = utterances.findIndex((u) => u.id === endUtteranceId)

  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return null

  const startUtt = utterances[startIdx]
  const endUtt = utterances[endIdx]

  const startText = startUtt.transcript || ''
  const endText = endUtt.transcript || ''

  let startOffset = range.startOffset
  let endOffset = range.endOffset

  if (startNode.nodeType !== Node.TEXT_NODE) {
    const textBefore = startUttEl.textContent?.slice(0, range.startOffset) || ''
    startOffset = textBefore.length
  }
  if (endNode.nodeType !== Node.TEXT_NODE) {
    const textBefore = endUttEl.textContent?.slice(0, range.endOffset) || ''
    endOffset = textBefore.length
  }

  startOffset = Math.max(0, Math.min(startOffset, startText.length))
  endOffset = Math.max(0, Math.min(endOffset, endText.length))

  if (startUtteranceId === endUtteranceId && startOffset >= endOffset) return null

  const parts: string[] = []
  const speakerLabelsSet = new Set<string>()
  for (let i = startIdx; i <= endIdx; i++) {
    const utt = utterances[i]
    const cluster = `speaker-${utt.speaker}`
    speakerLabelsSet.add(cluster)
    const text = utt.transcript || ''
    if (i === startIdx && i === endIdx) {
      parts.push(text.slice(startOffset, endOffset))
    } else if (i === startIdx) {
      parts.push(text.slice(startOffset))
    } else if (i === endIdx) {
      parts.push(text.slice(0, endOffset))
    } else {
      parts.push(text)
    }
  }
  const fullText = parts.join(' ')
  if (!fullText.trim()) return null

  return {
    startUtteranceId,
    startOffset,
    endUtteranceId,
    endOffset,
    startSeconds: startUtt.start,
    endSeconds: endUtt.end,
    text: fullText,
    speakerLabels: Array.from(speakerLabelsSet),
  }
}

interface TranscriptViewProps {
  utterances: Utterance[]
  clusters: SpeakerCluster[]
  observations: TranscriptObservation[]
  markers: Marker[]
  formatTimestamp: (seconds: number) => string
  onSelection: (range: { startUtteranceId: string; startOffset: number; endUtteranceId: string; endOffset: number; startSeconds: number; endSeconds: number; text: string; speakerLabels: string[] } | null) => void
  onEvidenceClick: (observation: TranscriptObservation, evidence: ObservationEvidence) => void
  focusUtteranceIds: Set<string>
}

function TranscriptView({ utterances, clusters, observations, markers, formatTimestamp, onSelection, onEvidenceClick, focusUtteranceIds }: TranscriptViewProps) {
  const utteranceRefs = useRef<Map<string, HTMLSpanElement>>(new Map())
  const [highlightRanges, setHighlightRanges] = useState<Record<string, { startIdx: number; endIdx: number; startOffset: number; endOffset: number }>>({})

  useEffect(() => {
    if (!utterances.length) return

    const ranges: Record<string, { startIdx: number; endIdx: number; startOffset: number; endOffset: number }> = {}

    for (const obs of observations) {
      for (const ev of obs.evidence) {
        if (ev.state !== 'attached') continue
        const startIdx = utterances.findIndex((u) => u.id === ev.start_utterance_id)
        const endIdx = utterances.findIndex((u) => u.id === ev.end_utterance_id)
        if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) continue
        ranges[ev.id] = { startIdx, endIdx, startOffset: ev.start_char_offset, endOffset: ev.end_char_offset }
      }
    }
    setHighlightRanges(ranges)
  }, [utterances, observations])

  function handleMouseUp() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = getSelectionRange(utterances, selection)
    onSelection(range)
    if (range) {
    }
  }

  useEffect(() => {
    if (focusUtteranceIds.size === 0) return
    const first = utterances.find((u) => focusUtteranceIds.has(u.id))
    if (!first) return
    const el = utteranceRefs.current.get(first.id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusUtteranceIds, utterances])

  function getSpeakerName(speaker: number): string {
    const cluster = clusters.find((c) => c.provider_speaker_key === `speaker-${speaker}`)
    const person = cluster?.engagement_speaker_identity_assignments?.[0]?.persons
    return person?.display_name || `Speaker ${speaker + 1}`
  }

  function markerTarget(marker: Marker) {
    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY
    utterances.forEach((utterance, index) => {
      const distance = marker.timestamp_seconds >= utterance.start && marker.timestamp_seconds <= utterance.end
        ? 0
        : Math.min(Math.abs(marker.timestamp_seconds - utterance.start), Math.abs(marker.timestamp_seconds - utterance.end))
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    return { index: bestIndex, approximate: bestIndex >= 0 && !(marker.timestamp_seconds >= utterances[bestIndex].start && marker.timestamp_seconds <= utterances[bestIndex].end) }
  }

  function renderUtteranceWithHighlights(utterance: Utterance, index: number) {
    const utteranceId = utterance.id
    const text = utterance.transcript || ''
    const evRanges = Object.values(highlightRanges).filter((r) => r.startIdx <= index && r.endIdx >= index)

    if (evRanges.length === 0) {
      const utteranceMarkers = markers.map((marker) => ({ marker, target: markerTarget(marker) })).filter(({ target }) => target.index === index)
      return (
        <span key={utteranceId} data-utterance-id={utteranceId} ref={(el) => { if (el) utteranceRefs.current.set(utteranceId, el) }}>
          {text}
          {utteranceMarkers.map(({ marker, target }) => {
            const style = markerStyles[marker.note_type]
            return <button key={marker.id} type="button" title={`${target.approximate ? 'Approximate location. ' : ''}${marker.note_type}: ${marker.note_text || 'No context'}`} className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs text-white ${style.badge} ${target.approximate ? 'border border-dashed border-[#1A0F2E]' : ''}`} onClick={(event) => event.stopPropagation()}>{target.approximate ? '~' : ''}{style.icon}</button>
          })}
        </span>
      )
    }

    const segments: React.ReactNode[] = []
    let lastPos = 0

    evRanges.forEach((r, rangeIdx) => {
      const isStart = r.startIdx === index
      const isEnd = r.endIdx === index
      const segStart = isStart ? r.startOffset : 0
      const segEnd = isEnd ? r.endOffset : text.length

      if (segStart > lastPos) {
        segments.push(<span key={`plain-${index}-${rangeIdx}-${lastPos}`}>{text.slice(lastPos, segStart)}</span>)
      }
      if (segStart < segEnd) {
        segments.push(
          <mark
            key={`highlight-${index}-${rangeIdx}-${r.startIdx}-${r.endIdx}`}
            className="bg-yellow-100 border-b-2 border-yellow-400 cursor-pointer"
            title="Click to view observation"
            onClick={(e) => {
              e.stopPropagation()
              const ev = Object.entries(highlightRanges).find((entry) => entry[1] === r)
              if (ev) {
                const evidence = observations.flatMap((o) => o.evidence).find((e) => e.id === ev[0])
                const obs = observations.find((o) => o.evidence.some((e) => e.id === ev[0]))
                if (obs && evidence) onEvidenceClick(obs, evidence)
              }
            }}
          >
            {text.slice(segStart, segEnd)}
          </mark>
        )
      }
      lastPos = segEnd
    })

    if (lastPos < text.length) {
      segments.push(<span key={`plain-end-${index}`}>{text.slice(lastPos)}</span>)
    }

    const utteranceMarkers = markers.map((marker) => ({ marker, target: markerTarget(marker) })).filter(({ target }) => target.index === index)

    return (
      <span key={utteranceId} data-utterance-id={utteranceId} ref={(el) => { if (el) utteranceRefs.current.set(utteranceId, el) }}>
        {segments}
        {utteranceMarkers.map(({ marker, target }) => {
          const style = markerStyles[marker.note_type]
          return <button key={marker.id} type="button" title={`${target.approximate ? 'Approximate location. ' : ''}${marker.note_type}: ${marker.note_text || 'No context'}`} className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs text-white ${style.badge} ${target.approximate ? 'border border-dashed border-[#1A0F2E]' : ''}`} onClick={(event) => event.stopPropagation()}>{target.approximate ? '~' : ''}{style.icon}</button>
        })}
      </span>
    )
  }

  return (
    <div className="space-y-2 border-t border-[#E8E4EF] pt-3" onMouseUp={handleMouseUp}>
      {utterances.map((utterance, index) => {
        const isFocused = focusUtteranceIds.has(utterance.id)
        return (
          <div key={utterance.id} className={`flex gap-3 text-sm ${isFocused ? 'rounded-lg bg-cyan-50 py-1 ring-2 ring-cyan-300' : ''}`}>
            <span className="shrink-0 font-mono text-xs text-[#6B6785]">{formatTimestamp(Math.floor(utterance.start))}</span>
            <p className="text-[#1A0F2E]">
              <span className="font-semibold">{getSpeakerName(utterance.speaker)} <span className="text-xs font-normal text-[#6B6785]">(Speaker {utterance.speaker + 1})</span>:</span>{' '}
              {renderUtteranceWithHighlights(utterance, index)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

type EngagementRecordingsProps = {
  projectId?: string
  clientId?: string
}

export default function EngagementRecordings({ projectId, clientId }: EngagementRecordingsProps) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedMarkers, setExpandedMarkers] = useState<string | null>(null)
  const [playback, setPlayback] = useState<Record<string, Playback>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [transcribingId, setTranscribingId] = useState<string | null>(null)
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null)
  const [projectPeople, setProjectPeople] = useState<Record<string, SpeakerPerson[]>>({})
  const [selection, setSelection] = useState<{
    recordingId: string
    transcriptId: string
    startUtteranceId: string
    startOffset: number
    endUtteranceId: string
    endOffset: number
    startSeconds: number
    endSeconds: number
    text: string
    speakerLabels: string[]
  } | null>(null)
  const [observationModal, setObservationModal] = useState<{
    mode: 'create' | 'edit'
    transcriptId: string
    observationId?: string
    initialStatement: string
    evidenceText: string
    startUtteranceId: string
    startOffset: number
    endUtteranceId: string
    endOffset: number
    startSeconds: number
    endSeconds: number
    speakerLabels: string[]
  } | null>(null)
  const [savingObservation, setSavingObservation] = useState(false)
  const [observationConfidence, setObservationConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [observationNotes, setObservationNotes] = useState('')
  const [markerDraft, setMarkerDraft] = useState<{ recordingId: string; noteText: string; timestampSeconds: number } | null>(null)
  const [markerType, setMarkerType] = useState<NoteType>('observation')
  const [savingMarker, setSavingMarker] = useState(false)
  const [intelligenceByTranscript, setIntelligenceByTranscript] = useState<Record<string, IntelligenceCandidate[]>>({})
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null)
  const [focusedEvidence, setFocusedEvidence] = useState<{ transcriptId: string; utteranceIds: string[] } | null>(null)
  const [reviewStatus, setReviewStatus] = useState<Record<string, 'accepting' | 'rejecting'>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<string>('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scopeKey = useMemo(() => (clientId ? `client:${clientId}` : `project:${projectId}`), [clientId, projectId])

  useEffect(() => {
    console.log('[EngagementRecordings] useEffect fired', { projectId, clientId, scopeKey })
    // Don't load if neither projectId nor clientId is available
    if (!projectId && !clientId) {
      console.log('[EngagementRecordings] No projectId or clientId, skipping load')
      setLoading(false)
      return
    }
    console.log('[EngagementRecordings] Calling loadRecordings...')
    void loadRecordings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey])

  async function loadRecordings() {
    console.log('[EngagementRecordings] loadRecordings called', { projectId, clientId })
    // Guard against missing IDs
    if (!projectId && !clientId) {
      console.log('[EngagementRecordings] Missing IDs in loadRecordings')
      setLoading(false)
      setError('No project or client ID provided')
      return
    }

    setLoading(true)
    setError('')

    try {
      const param = clientId
        ? `client_id=${encodeURIComponent(clientId)}`
        : `project_id=${encodeURIComponent(projectId as string)}`
      const url = `/api/admin/recordings?${param}`
      console.log('[EngagementRecordings] Fetching:', url)
      const response = await fetch(url)
      console.log('[EngagementRecordings] Response:', response.status, response.ok)
      if (!response.ok) {
        const body = await response.json()
        console.log('[EngagementRecordings] Error response:', body)
        throw new Error(body.error || 'Failed to load recordings')
      }
      const payload = await response.json()
      console.log('[EngagementRecordings] Success:', payload)
      setRecordings(payload.recordings || [])
    } catch (err) {
      console.error('[EngagementRecordings] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load recordings')
    } finally {
      setLoading(false)
    }
  }

  async function loadPlayback(recordingId: string) {
    const response = await fetch(`/api/admin/recordings/${recordingId}/signed-url`)
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    const urls = Array.isArray(payload.signed_urls)
      ? payload.signed_urls
      : payload.signed_url
        ? [payload.signed_url]
        : []
    if (urls.length > 0) {
      setPlayback((prev) => ({ ...prev, [recordingId]: { urls, index: 0 } }))
    }
  }

  async function loadObservations(transcriptId: string, recordingId: string) {
    try {
      const response = await fetch(`/api/admin/transcripts/${transcriptId}/observations`)
      if (!response.ok) return
      const payload = await response.json()
      setRecordings((prev) =>
        prev.map((rec) =>
          rec.id === recordingId
            ? { ...rec, observations: payload.observations || [] }
            : rec
        )
      )
    } catch (err) {
      console.error('[EngagementRecordings] Failed to load observations:', err)
    }
  }

  function handleTranscriptSelection(recordingId: string, transcriptId: string, range: {
    startUtteranceId: string
    startOffset: number
    endUtteranceId: string
    endOffset: number
    startSeconds: number
    endSeconds: number
    text: string
    speakerLabels: string[]
  } | null) {
    if (!range || !range.text.trim()) {
      setSelection(null)
      return
    }
    setSelection({
      recordingId,
      transcriptId,
      ...range,
    })
  }

  function handleEvidenceClick(observation: TranscriptObservation, evidence: ObservationEvidence) {
    setObservationModal({
      mode: 'edit',
      transcriptId: expandedTranscript!,
      observationId: observation.id,
      initialStatement: observation.statement,
      evidenceText: evidence.excerpt_text,
      startUtteranceId: evidence.start_utterance_id,
      startOffset: evidence.start_char_offset,
      endUtteranceId: evidence.end_utterance_id,
      endOffset: evidence.end_char_offset,
      startSeconds: evidence.start_seconds,
      endSeconds: evidence.end_seconds,
      speakerLabels: evidence.speaker_labels,
    })
    setObservationConfidence(observation.confidence)
    setObservationNotes(observation.notes || '')
  }

  async function handleSaveObservation() {
    if (!observationModal || !observationModal.initialStatement.trim()) return
    setSavingObservation(true)
    try {
      const isEdit = observationModal.mode === 'edit'
      const url = isEdit
        ? `/api/admin/transcripts/${observationModal.transcriptId}/observations/${observationModal.observationId}`
        : `/api/admin/transcripts/${observationModal.transcriptId}/observations`
      const body = isEdit
        ? { statement: observationModal.initialStatement, confidence: observationConfidence, notes: observationNotes }
        : {
            statement: observationModal.initialStatement,
            confidence: observationConfidence,
            notes: observationNotes,
            start_utterance_id: observationModal.startUtteranceId,
            start_char_offset: observationModal.startOffset,
            end_utterance_id: observationModal.endUtteranceId,
            end_char_offset: observationModal.endOffset,
            start_seconds: observationModal.startSeconds,
            end_seconds: observationModal.endSeconds,
          }
      const response = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to save observation')
      setObservationModal(null)
      setSelection(null)
      await loadRecordings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save observation')
    } finally {
      setSavingObservation(false)
    }
  }

  async function handleSaveMarker() {
    if (!markerDraft) return
    setSavingMarker(true)
    try {
      const response = await fetch(`/api/admin/recordings/${markerDraft.recordingId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_type: markerType, note_text: markerDraft.noteText.trim() || null, timestamp_seconds: markerDraft.timestampSeconds }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to add marker')
      setMarkerDraft(null)
      await loadRecordings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add marker')
    } finally {
      setSavingMarker(false)
    }
  }

  function handlePlaybackEnded(recordingId: string) {
    setPlayback((prev) => {
      const current = prev[recordingId]
      if (!current || current.index + 1 >= current.urls.length) {
        return prev
      }
      return { ...prev, [recordingId]: { ...current, index: current.index + 1 } }
    })
  }

  async function deleteRecording(recordingId: string) {
    if (!confirm('Delete this recording and all of its markers?')) return
    setDeletingId(recordingId)

    try {
      const response = await fetch(`/api/admin/recordings/${recordingId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || 'Failed to delete recording')
      }
      setRecordings((prev) => prev.filter((recording) => recording.id !== recordingId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete recording')
    } finally {
      setDeletingId(null)
    }
  }

  const handleFileSelect = async (file: File | null) => {
    if (!file) return

    if (!projectId) {
      alert('Upload requires a project context.')
      return
    }

    const validTypes = ['video/mkv', 'video/mp4', 'video/webm', 'video/quicktime']
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().match(/\.(mkv|mp4|webm|mov)$/)) {
      alert('Unsupported file type. Please upload .mkv, .mp4, or .webm files.')
      return
    }

    if (file.size === 0) {
      alert('File is empty (zero bytes). Please choose a valid recording.')
      return
    }

    if (file.size > 500 * 1024 * 1024) {
      alert('File is too large. Maximum size is 500MB.')
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadPhase('Creating recording record…')

    let recordingId: string | null = null

    try {
      const extMatch = file.name.toLowerCase().match(/\.([^.]+)$/)
      const container = extMatch ? extMatch[1] : ''

      // Step 1: Create recording row + get signed upload URL
      const createRes = await fetch('/api/admin/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title: file.name.replace(/\.[^.]*$/, '') || 'Uploaded Recording',
          session_type: 'uploaded_video',
          consent_given: true,
          source_type: 'uploaded_video',
          mime_type: file.type,
          container,
        }),
      })

      const createPayload = await createRes.json()
      if (!createRes.ok) throw new Error(createPayload.error || 'Failed to create recording')

      recordingId = createPayload.recording.id

      // Step 2: Compute SHA-256 checksum in browser
      setUploadPhase('Computing file checksum…')
      const checksum = await computeFileChecksum(file)

      // Step 3: Upload directly to Supabase Storage via signed URL
      // storage-js wraps Blob/File bodies in FormData with an empty field name
      setUploadPhase('Uploading to storage…')
      const uploadFormData = new FormData()
      uploadFormData.append('cacheControl', '3600')
      uploadFormData.append('', file)

      const uploadRes = await fetch(createPayload.signed_upload_url, {
        method: 'PUT',
        body: uploadFormData,
      })

      if (!uploadRes.ok) {
        const text = await uploadRes.text()
        throw new Error(`Storage upload failed (${uploadRes.status}): ${text}`)
      }

      // Step 4: Finalize — confirm upload, set path + checksum
      setUploadPhase('Finalizing…')
      const finalizeRes = await fetch(`/api/admin/recordings/${recordingId}/finalize-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size_bytes: file.size,
          checksum,
          mime_type: file.type,
        }),
      })

      const finalizePayload = await finalizeRes.json()
      if (!finalizeRes.ok) throw new Error(finalizePayload.error || 'Failed to finalize upload')

      setUploadPhase('')
      await loadRecordings()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setUploadError(message)
      setUploadPhase('')

      // Rollback: cancel the recording row + any orphaned storage file
      if (recordingId) {
        try {
          await fetch(`/api/admin/recordings/${recordingId}/cancel-upload`, { method: 'POST' })
        } catch {
          // Best-effort cleanup — don't mask the original error
        }
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function computeFileChecksum(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  async function transcribeRecording(recordingId: string) {
    setTranscribingId(recordingId)
    try {
      const response = await fetch(`/api/admin/recordings/${recordingId}/transcribe`, { method: 'POST' })
      const body = await response.json()
      if (!response.ok || !body.ok) throw new Error(body.error || 'Transcription failed')
      await loadRecordings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setTranscribingId(null)
    }
  }

  async function assignSpeaker(recordingId: string, transcriptId: string, clusterId: string, personId: string) {
    if (!personId) {
      await fetch(`/api/admin/transcripts/${transcriptId}/speakers/${clusterId}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/admin/transcripts/${transcriptId}/speakers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cluster_id: clusterId, person_id: personId }) })
    }
    await loadRecordings()
  }

  async function loadProjectPeople(projectId: string) {
    if (projectPeople[projectId]) return
    const response = await fetch(`/api/admin/projects/${projectId}/people`)
    if (response.ok) {
      const body = await response.json()
      setProjectPeople((current) => ({ ...current, [projectId]: body.people || [] }))
    }
  }

  async function loadCandidates(transcriptId: string) {
    try {
      const response = await fetch(`/api/admin/transcripts/${transcriptId}/candidates`)
      if (!response.ok) return
      const payload = await response.json()
      console.log('[EngagementRecordings] loadCandidates', { transcriptId, candidates: payload?.candidates?.length ?? 0 })
      setIntelligenceByTranscript((current) => ({ ...current, [transcriptId]: payload.candidates || [] }))
    } catch (err) {
      console.error('[EngagementRecordings] Failed to load candidates:', err)
    }
  }

  async function analyzeRecording(recording: Recording) {
    const transcriptId = recording.transcript?.id
    if (!transcriptId) return
    setAnalyzingId(recording.id)
    const startedAt = Date.now()
    console.log('[EngagementRecordings] analyze:start', { transcriptId, projectId: recording.project_id })
    try {
      const response = await fetch(`/api/admin/transcripts/${transcriptId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: recording.project_id }),
      })
      const payload = await response.json()
      console.log('[EngagementRecordings] analyze:response', {
        status: response.status,
        ok: response.ok,
        elapsedMs: Date.now() - startedAt,
        candidates: payload?.candidates?.length,
        error: payload?.error,
      })
      if (!response.ok) throw new Error(payload.error || 'Analysis failed')
      await loadCandidates(transcriptId)
    } catch (err) {
      console.error('[EngagementRecordings] analyze:error', err)
      alert(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzingId(null)
    }
  }

  async function acceptCandidate(candidate: IntelligenceCandidate) {
    setReviewStatus((current) => ({ ...current, [candidate.id]: 'accepting' }))
    try {
      const response = await fetch(`/api/admin/transcripts/${candidate.transcript_id}/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Accept failed')
      await loadCandidates(candidate.transcript_id)
      const recording = recordings.find((r) => r.transcript?.id === candidate.transcript_id)
      if (recording && payload.acceptedObservationId) {
        await loadObservations(candidate.transcript_id, recording.id)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Accept failed')
    } finally {
      setReviewStatus((current) => {
        const next = { ...current }
        delete next[candidate.id]
        return next
      })
    }
  }

  async function rejectCandidate(candidate: IntelligenceCandidate) {
    setReviewStatus((current) => ({ ...current, [candidate.id]: 'rejecting' }))
    try {
      const response = await fetch(`/api/admin/transcripts/${candidate.transcript_id}/candidates/${candidate.id}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Reject failed')
      await loadCandidates(candidate.transcript_id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setReviewStatus((current) => {
        const next = { ...current }
        delete next[candidate.id]
        return next
      })
    }
  }

  function toggleEvidenceFocus(candidate: IntelligenceCandidate) {
    const evidence = candidate.evidence || []
    const utteranceIds = evidence.flatMap((e) => e.utterance_ids)
    if (focusedEvidence?.transcriptId === candidate.transcript_id && utteranceIds.length > 0 && focusedEvidence.utteranceIds.join(',') === utteranceIds.join(',')) {
      setFocusedEvidence(null)
      return
    }
    setFocusedEvidence(utteranceIds.length > 0 ? { transcriptId: candidate.transcript_id, utteranceIds } : null)
  }

  function renderCandidateList(transcriptId: string) {
    const candidates = intelligenceByTranscript[transcriptId] || []
    if (candidates.length === 0) {
      return (
        <p className="text-sm text-[#6B6785]">
          No candidate insights yet. Use “Analyze interview” to get project-aware suggestions.
        </p>
      )
    }
    return (
      <div className="space-y-2">
        {candidates.map((candidate) => {
          const style = intelligenceTypeStyles[candidate.type]
          const isAccepting = reviewStatus[candidate.id] === 'accepting'
          const isRejecting = reviewStatus[candidate.id] === 'rejecting'
          const isAccepted = candidate.status === 'accepted'
          const evidence = candidate.evidence || []
          const evidenceCount = evidence.reduce((sum, e) => sum + e.utterance_ids.length, 0)
          return (
            <div key={candidate.id} className={`rounded-lg border p-3 ${isAccepted ? 'border-green-200 bg-green-50/50' : 'border-[#E8E4EF] bg-[#F8F7F5]'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs uppercase font-semibold ${style.badge}`}>{style.label}</span>
                <span className="text-xs text-[#6B6785]">
                  {candidate.confidence != null ? `confidence ${candidate.confidence.toFixed(2)}` : ''}
                  {evidenceCount > 0 ? ` · ${evidenceCount} evidence utterances` : ' · no evidence cited'}
                </span>
                {isAccepted && <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs uppercase font-semibold">Accepted</span>}
                {candidate.status === 'candidate' && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs uppercase font-semibold">Candidate</span>}
              </div>
              <p className="mt-2 text-sm text-[#1A0F2E]">{candidate.content}</p>
              {candidate.reasoning_summary && (
                <p className="mt-1 text-xs text-[#6B6785] whitespace-pre-wrap">{candidate.reasoning_summary}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {evidence.length > 0 && (
                  <button type="button" onClick={() => toggleEvidenceFocus(candidate)} className="text-xs font-semibold text-[#290D47] hover:opacity-80">
                    {focusedEvidence?.transcriptId === candidate.transcript_id ? 'Clear highlight' : 'Highlight evidence'}
                  </button>
                )}
                {candidate.status === 'candidate' && (
                  <>
                    <button type="button" onClick={() => void acceptCandidate(candidate)} disabled={isAccepting || isRejecting} className="px-3 py-1 rounded bg-[#290D47] text-white text-xs font-semibold disabled:opacity-50">
                      {isAccepting ? 'Accepting...' : 'Accept'}
                    </button>
                    <button type="button" onClick={() => void rejectCandidate(candidate)} disabled={isAccepting || isRejecting} className="px-3 py-1 rounded bg-gray-200 text-[#1A0F2E] text-xs font-semibold disabled:opacity-50">
                      {isRejecting ? 'Rejecting...' : 'Reject'}
                    </button>
                    <button type="button" onClick={() => setExpandedCandidate(expandedCandidate === candidate.id ? null : candidate.id)} className="text-xs font-semibold text-[#290D47] hover:opacity-80">
                      {expandedCandidate === candidate.id ? 'Less' : 'Details'}
                    </button>
                  </>
                )}
                <span className="ml-auto text-xs text-[#6B6785]">{candidate.provider}/{candidate.model}</span>
              </div>
              {expandedCandidate === candidate.id && (
                <div className="mt-2 rounded bg-white border border-[#E8E4EF] p-2 space-y-1">
                  {evidence.length === 0
                    ? <p className="text-xs text-[#6B6785] italic">No transcript evidence cited by the model.</p>
                    : evidence.map((evidenceItem) => (
                      <p key={evidenceItem.id} className="text-xs text-[#6B6785]">
                        Transcript {evidenceItem.transcript_id.slice(0, 8)} · {evidenceItem.role} · {evidenceItem.utterance_ids.slice(0, 6).join(', ')}{evidenceItem.utterance_ids.length > 6 ? ` +${evidenceItem.utterance_ids.length - 6}` : ''}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <section
      className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1A0F2E]">Engagement Recordings</h2>
          <p className="text-[#6B6785] text-sm">Recorded discovery sessions and their markers.</p>
        </div>
        <div className="flex items-center gap-3">
          {recordings.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-[#F8F7F5] border border-[#E8E4EF] text-[#6B6785] text-xs">
              {recordings.length} total
            </span>
          )}
          <Link
            href={projectId ? `/admin/record?project_id=${projectId}` : '/admin/record'}
            className="px-4 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] font-semibold hover:opacity-90 text-sm"
          >
            + New Recording
          </Link>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (!uploading) fileInputRef.current?.click() }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); fileInputRef.current?.click() } }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
          if (uploading) return
          const file = e.dataTransfer.files?.[0] ?? null
          void handleFileSelect(file)
        }}
        className={`mt-4 p-6 rounded-lg border border-dashed transition-colors ${uploading ? 'cursor-wait opacity-70' : 'cursor-pointer'} ${isDragging ? 'border-[#00F5E4] bg-[#00F5E4]/5' : 'border-[#6B6785]/50 hover:border-[#6B6785]'}`}
      >
        <svg className="w-6 h-6 text-[#6B6785] mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        <p className="text-center text-sm text-[#6B6785]">
          {uploading ? 'Uploading…' : isDragging ? 'Drop to upload' : 'Upload a recording'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mkv,video/mp4,video/webm,audio/*,video/*"
          className="hidden"
          onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
        />
        <p className="text-center text-xs text-[#6B6785] mt-2">.mkv, .mp4, .webm · max 500MB · or drag &amp; drop here</p>
      </div>

      {uploading && (
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-[#6B6785]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#6B6785]/30 border-t-[#290D47]" />
          {uploadPhase || 'Uploading…'}
        </div>
      )}
      {uploadError && (
        <p className="mt-2 text-center text-sm text-red-600">{uploadError}</p>
      )}

      {loading ? (
        <p className="text-[#6B6785] text-center py-8">Loading recordings...</p>
      ) : error ? (
        <p className="text-red-600 text-center py-8">{error}</p>
      ) : recordings.length === 0 ? (
        <p className="text-[#6B6785] text-center py-8">
          No engagement sessions recorded yet. Start one in the Recorder.
        </p>
      ) : (
        <div className="space-y-3">
          {recordings.map((recording) => {
            const activePlayback = playback[recording.id]
            return (
              <div key={recording.id} className="bg-[#F8F7F5] border border-[#E8E4EF] rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-[#1A0F2E] truncate">{recording.title}</h3>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded uppercase font-semibold">
                        {recording.session_type}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded uppercase font-semibold border ${statusStyles[recording.status]}`}>
                        {recording.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B6785]">
                      {recording.project_name && <span className="font-medium">{recording.project_name}</span>}
                      <span>{formatDate(recording.started_at)}</span>
                      <span>Duration: {formatDuration(recording.duration_seconds)}</span>
                      <span>Chunks: {recording.total_chunks}</span>
                      <span>{recording.consent_given ? '✓ Consent' : 'No consent'}</span>
                      {recording.source_type && <span className="ml-2 text-xs font-medium text-[#6B6785]">Source: {recording.source_type}</span>}
                    </div>
                    {formatSyncOffset(recording.video_offset_ms) && (
                      <p className="mt-1 text-xs text-[#6B6785] italic">{formatSyncOffset(recording.video_offset_ms)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!activePlayback && (
                      <button
                        onClick={() => void loadPlayback(recording.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#290D47] text-white hover:opacity-90 text-sm font-semibold"
                      >
                        Play
                      </button>
                    )}
                    <button
                      onClick={() => void transcribeRecording(recording.id)}
                      disabled={transcribingId === recording.id || !recording.final_storage_path && recording.total_chunks === 0}
                      className="px-3 py-1.5 rounded-lg bg-[#00F5E4] text-[#1A0F2E] hover:opacity-90 text-sm font-semibold disabled:opacity-50"
                    >
                      {transcribingId === recording.id ? 'Transcribing...' : recording.transcript?.status === 'complete' ? 'Retranscribe' : recording.transcript?.status === 'failed' ? 'Retry transcription' : 'Transcribe'}
                    </button>
                    <button
                      onClick={() => void deleteRecording(recording.id)}
                      disabled={deletingId === recording.id}
                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200 text-sm font-semibold disabled:opacity-50"
                    >
                      {deletingId === recording.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 border-t border-[#E8E4EF] pt-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded border font-semibold ${recording.transcript?.status === 'complete' ? 'bg-green-100 text-green-700 border-green-200' : recording.transcript?.status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' : recording.transcript?.status === 'processing' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {recording.transcript?.status === 'complete' ? 'Transcript ready' : recording.transcript?.status === 'processing' ? recording.transcript.processing_mode === 'chunked' && recording.transcript.total_parts ? `Transcribing ${recording.transcript.processed_parts} / ${recording.transcript.total_parts} chunks` : 'Transcribing' : recording.transcript?.status === 'failed' ? 'Transcription failed' : 'Not transcribed'}
                    </span>
                    {recording.transcript?.status === 'complete' && (
                      <>
                        <button onClick={() => { const next = expandedTranscript === recording.id ? null : recording.id; setExpandedTranscript(next); if (next) { void loadProjectPeople(recording.project_id); if (recording.transcript) { void loadObservations(recording.transcript.id, recording.id); void loadCandidates(recording.transcript.id); } } }} className="font-semibold text-[#290D47]">
                          {expandedTranscript === recording.id ? 'Hide transcript' : 'Show transcript'}
                        </button>
                        <button
                          onClick={() => void analyzeRecording(recording)}
                          disabled={analyzingId === recording.id}
                          className="px-2 py-0.5 rounded bg-[#00F5E4] text-[#1A0F2E] font-semibold disabled:opacity-50"
                        >
                          {analyzingId === recording.id ? 'Analyzing...' : 'Analyze interview'}
                        </button>
                      </>
                    )}
                  </div>
                  {recording.transcript?.status === 'failed' && recording.transcript.error_details && (
                    <p className="mt-2 text-xs text-red-700">{recording.transcript.error_details}</p>
                  )}
                  {expandedTranscript === recording.id && recording.transcript?.status === 'complete' && (
                    <div className="mt-3 space-y-3">
                      {recording.transcript.clusters.length > 0 && (
                        <div className="rounded-lg border border-[#E8E4EF] bg-white p-3 space-y-2">
                          <h4 className="text-sm font-semibold text-[#1A0F2E]">Speakers</h4>
                          {recording.transcript.clusters.map((cluster) => {
                            const assignment = cluster.engagement_speaker_identity_assignments?.[0]
                            return <label key={cluster.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-semibold text-[#1A0F2E]">{cluster.display_label}</span>
                              <span className="text-xs text-[#6B6785]">{cluster.utterance_count} utterances</span>
                              <select value={assignment?.person_id || ''} onChange={(event) => void assignSpeaker(recording.id, recording.transcript!.id, cluster.id, event.target.value)} className="rounded border border-[#E8E4EF] bg-white px-2 py-1 text-sm text-[#1A0F2E]">
                                <option value="">Leave unidentified</option>
                                {(projectPeople[recording.project_id] || []).map((person) => <option key={person.id} value={person.id}>{person.display_name}{person.title ? ` — ${person.title}` : person.company ? ` — ${person.company}` : ''}</option>)}
                              </select>
                            </label>
                          })}
                        </div>
                      )}
                      {recording.transcript!.utterances.length > 0 && (
                        <TranscriptView
                          utterances={recording.transcript!.utterances}
                          clusters={recording.transcript!.clusters}
                          observations={recording.observations}
                          markers={recording.markers}
                          formatTimestamp={formatTimestamp}
                          onSelection={(range) => handleTranscriptSelection(recording.id, recording.transcript!.id, range)}
                          onEvidenceClick={handleEvidenceClick}
                          focusUtteranceIds={focusedEvidence?.transcriptId === recording.transcript!.id ? new Set(focusedEvidence.utteranceIds) : new Set()}
                        />
                      )}
                      {recording.transcript!.utterances.length === 0 && <p className="text-sm text-[#6B6785]">No diarized transcript segments returned.</p>}
                      <div className="rounded-lg border border-[#E8E4EF] bg-white p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-[#1A0F2E]">Project Intelligence</h4>
                          <span className="text-xs text-[#6B6785]">AI candidates · human review required</span>
                        </div>
                        {renderCandidateList(recording.transcript!.id)}
                      </div>
                    </div>
                  )}
                </div>

                {activePlayback && activePlayback.urls.length > 0 && (
                  <div className="mt-3">
                    <audio
                      key={activePlayback.urls[activePlayback.index]}
                      controls
                      autoPlay
                      src={activePlayback.urls[activePlayback.index]}
                      className="w-full"
                      onEnded={() => handlePlaybackEnded(recording.id)}
                    />
                    {activePlayback.urls.length > 1 && (
                      <p className="text-xs text-[#6B6785] mt-1">
                        Chunk {activePlayback.index + 1} / {activePlayback.urls.length}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3">
                  <button
                    onClick={() => setExpandedMarkers(expandedMarkers === recording.id ? null : recording.id)}
                    className="text-sm font-semibold text-[#290D47] hover:opacity-80"
                  >
                    Markers ({recording.markers.length}) {expandedMarkers === recording.id ? '−' : '+'}
                  </button>

                  {expandedMarkers === recording.id && (
                    <div className="mt-2 space-y-2">
                      {recording.markers.length === 0 ? (
                        <p className="text-[#6B6785] text-sm">No markers on this recording.</p>
                      ) : (
                        recording.markers.map((marker) => {
                          const style = markerStyles[marker.note_type]
                          return (
                            <div key={marker.id} className="flex items-start gap-3 p-2 rounded-lg bg-white border border-[#E8E4EF]">
                              <span className={`inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded text-white text-xs font-medium ${style.badge}`}>
                                {style.icon} {marker.note_type}
                              </span>
                              <span className="text-xs text-[#6B6785] font-mono shrink-0 pt-0.5">
                                {formatTimestamp(marker.timestamp_seconds)}
                              </span>
                              <p className="text-sm text-[#1A0F2E] whitespace-pre-wrap">
                                {marker.note_text || <span className="text-[#6B6785]/70 italic">No context</span>}
                              </p>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selection && !observationModal && (
        <div className="fixed bottom-6 right-6 z-40 flex gap-2 rounded-lg bg-white p-2 shadow-lg">
          <button type="button" className="rounded bg-[#290D47] px-4 py-2 text-sm font-semibold text-white" onClick={() => { setObservationConfidence('medium'); setObservationNotes(''); setObservationModal({ mode: 'create', transcriptId: selection.transcriptId, initialStatement: selection.text, evidenceText: selection.text, startUtteranceId: selection.startUtteranceId, startOffset: selection.startOffset, endUtteranceId: selection.endUtteranceId, endOffset: selection.endOffset, startSeconds: selection.startSeconds, endSeconds: selection.endSeconds, speakerLabels: selection.speakerLabels }) }}>Create observation</button>
          <button type="button" className="rounded bg-[#00F5E4] px-4 py-2 text-sm font-semibold text-[#1A0F2E]" onClick={() => { setMarkerType('observation'); setMarkerDraft({ recordingId: selection.recordingId, noteText: selection.text, timestampSeconds: Math.floor(selection.startSeconds) }) }}>Add marker</button>
        </div>
      )}

      {observationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A0F2E]/50 p-4" onClick={() => setObservationModal(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-sm" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-6 text-xl font-semibold text-[#1A0F2E]">{observationModal.mode === 'create' ? 'Create observation' : 'Edit observation'}</h2>
            <label className="mb-4 block text-sm text-[#6B6785]">Statement *<textarea value={observationModal.initialStatement} onChange={(event) => setObservationModal({ ...observationModal, initialStatement: event.target.value })} rows={3} className="mt-2 w-full rounded-lg border border-[#E8E4EF] p-3 text-[#1A0F2E]" /></label>
            <div className="mb-4 rounded-lg border border-[#E8E4EF] bg-[#F8F7F5] p-4 text-sm text-[#1A0F2E]"><strong>Evidence excerpt</strong><p className="mt-2 whitespace-pre-wrap">{observationModal.evidenceText}</p><p className="mt-2 text-xs text-[#6B6785]">{formatTimestamp(observationModal.startSeconds)} to {formatTimestamp(observationModal.endSeconds)} · {observationModal.speakerLabels.join(', ')}</p></div>
            <label className="mb-4 block text-sm text-[#6B6785]">Confidence<select value={observationConfidence} onChange={(event) => setObservationConfidence(event.target.value as 'high' | 'medium' | 'low')} className="mt-2 w-full rounded-lg border border-[#E8E4EF] p-3 text-[#1A0F2E]"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label className="mb-4 block text-sm text-[#6B6785]">Notes<textarea value={observationNotes} onChange={(event) => setObservationNotes(event.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-[#E8E4EF] p-3 text-[#1A0F2E]" /></label>
            <div className="flex gap-3"><button type="button" onClick={() => setObservationModal(null)} className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-semibold text-[#1A0F2E]">Cancel</button><button type="button" onClick={() => void handleSaveObservation()} disabled={savingObservation} className="flex-1 rounded-lg bg-[#290D47] px-4 py-3 font-semibold text-white disabled:opacity-50">{savingObservation ? 'Saving...' : 'Save observation'}</button></div>
          </div>
        </div>
      )}

      {markerDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A0F2E]/50 p-4" onClick={() => setMarkerDraft(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-4 text-xl font-semibold text-[#1A0F2E]">Add marker</h2>
            <p className="mb-3 text-xs text-[#6B6785]">Timestamp: {formatTimestamp(markerDraft.timestampSeconds)}</p>
            <div className="mb-4 flex flex-wrap gap-2">{(Object.keys(markerStyles) as NoteType[]).map((type) => <button key={type} type="button" onClick={() => setMarkerType(type)} className={`rounded px-3 py-2 text-sm font-semibold text-white ${markerStyles[type].badge} ${markerType === type ? 'ring-2 ring-[#1A0F2E] ring-offset-2' : ''}`}>{markerStyles[type].icon} {type}</button>)}</div>
            <textarea value={markerDraft.noteText} onChange={(event) => setMarkerDraft({ ...markerDraft, noteText: event.target.value })} rows={4} className="mb-4 w-full rounded-lg border border-[#E8E4EF] p-3 text-sm text-[#1A0F2E]" placeholder="Optional marker context" />
            <div className="flex gap-3"><button type="button" onClick={() => setMarkerDraft(null)} className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-semibold text-[#1A0F2E]">Cancel</button><button type="button" onClick={() => void handleSaveMarker()} disabled={savingMarker} className="flex-1 rounded-lg bg-[#290D47] px-4 py-3 font-semibold text-white disabled:opacity-50">{savingMarker ? 'Saving...' : 'Save marker'}</button></div>
          </div>
        </div>
      )}
    </section>
  )
}
