'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import { useEngagementSession } from '@/contexts/EngagementSessionContext'

type Project = {
  id: string
  name: string
}

type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopping'
type NoteType = 'question' | 'friction' | 'decision' | 'observation' | 'action'

const MARKER_TYPES: { type: NoteType; label: string; icon: string; className: string }[] = [
  { type: 'question', label: 'Question', icon: '❓', className: 'bg-blue-500 hover:bg-blue-600' },
  { type: 'friction', label: 'Friction', icon: '⚠️', className: 'bg-amber-500 hover:bg-amber-600' },
  { type: 'decision', label: 'Decision', icon: '✅', className: 'bg-green-500 hover:bg-green-600' },
  { type: 'observation', label: 'Observation', icon: '👁', className: 'bg-purple-500 hover:bg-purple-600' },
  { type: 'action', label: 'Action', icon: '➜', className: 'bg-sky-500 hover:bg-sky-600' },
]

function formatTime(total: number) {
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function MarkersPanel({ large = false }: { large?: boolean }) {
  const { addCapture, recentCaptures } = useEngagementSession()
  const [noteInput, setNoteInput] = useState('')
  const [markerNotice, setMarkerNotice] = useState('')

  async function handleAddMarker(noteType: NoteType) {
    try {
      await addCapture(noteType, noteInput.trim() || '')
      setNoteInput('')
      setMarkerNotice(`${noteType} marked`)
      setTimeout(() => setMarkerNotice(''), 1500)
    } catch (error) {
      setMarkerNotice(error instanceof Error ? error.message : 'Failed to save marker')
      setTimeout(() => setMarkerNotice(''), 3000)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {MARKER_TYPES.map((marker) => (
          <button
            key={marker.type}
            onClick={() => void handleAddMarker(marker.type)}
            className={`px-2 rounded-lg text-white font-medium active:scale-95 transition-transform ${marker.className} ${large ? 'py-4' : 'py-3'}`}
            title={marker.label}
          >
            <span className="block text-base leading-none mb-1">{marker.icon}</span>
            <span className={`block ${large ? 'text-xs' : 'text-[10px]'}`}>{marker.label}</span>
          </button>
        ))}
      </div>
      <textarea
        value={noteInput}
        onChange={(event) => setNoteInput(event.target.value)}
        className="w-full min-h-16 px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm resize-none placeholder:text-[#6B6785] focus:outline-none focus:ring-2 focus:ring-[#290D47]/20"
        placeholder="Optional: add context to your marker..."
      />
      {markerNotice && (
        <div className="px-3 py-2 rounded-lg bg-[#F0EDF6] text-[#1A0F2E] text-sm">{markerNotice}</div>
      )}
      {recentCaptures.length > 0 && (
        <div className="pt-2 border-t border-[#E8E4EF]">
          <h4 className="text-xs font-semibold text-[#6B6785] uppercase mb-2">Recent Captures</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentCaptures.map((capture) => {
              const marker = MARKER_TYPES.find((item) => item.type === capture.type)
              return (
                <div key={capture.id} className="p-2 rounded-lg bg-[#F8F7F5]">
                  <div className="flex items-center gap-2 mb-1">
                    {marker && (
                      <span className={`inline-block px-2 py-0.5 rounded text-white text-xs font-medium ${marker.className}`}>
                        {marker.icon} {capture.type}
                      </span>
                    )}
                    <span className="text-[#6B6785] font-mono text-xs">{formatTime(capture.timestamp)}</span>
                  </div>
                  <p className="text-[#1A0F2E] text-sm">{capture.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminRecordPage() {
  const { setActiveSession, setRecordingState } = useEngagementSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [sessionType, setSessionType] = useState('discovery')
  const [title, setTitle] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [chunkCount, setChunkCount] = useState(0)
  const [notice, setNotice] = useState('')
  const [playbackUrls, setPlaybackUrls] = useState<string[]>([])
  const [playbackIndex, setPlaybackIndex] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const chunkIndexRef = useRef(0)
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve())
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const canStart = useMemo(() => {
    return Boolean(projectId && sessionType && title.trim() && consentGiven && status === 'idle')
  }, [consentGiven, projectId, sessionType, status, title])

  useEffect(() => {
    void loadProjects()

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      void releaseWakeLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
      return
    }
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch {
      return
    }
  }

  async function releaseWakeLock() {
    try {
      await wakeLockRef.current?.release()
    } catch {
      return
    }
    wakeLockRef.current = null
  }

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state === 'recording') {
          recorder.pause()
          stopTimer()
          setStatus('paused')
          setNotice('Auto-paused: screen or tab hidden.')
        }
        return
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Sync elapsed time to provider
  useEffect(() => {
    if (status === 'recording' || status === 'paused') {
      setRecordingState({ 
        status: status === 'recording' ? 'recording' : 'paused', 
        elapsedSeconds 
      })
    }
  }, [elapsedSeconds, status, setRecordingState])

  async function loadProjects() {
    const { data, error } = await supabaseBrowser
      .from('projects')
      .select('id, name')
      .order('name')

    if (error) {
      setNotice(`Could not load projects: ${error.message}`)
      return
    }

    setProjects(data || [])

    const requestedId = new URLSearchParams(window.location.search).get('project_id')
    const requested = (data || []).find((project) => project.id === requestedId)
    if (requested) {
      setProjectId(requested.id)
    } else if (data && data.length > 0 && !projectId) {
      setProjectId(data[0].id)
    }
  }

  function handlePlaybackEnded() {
    setPlaybackIndex((current) => {
      if (current + 1 < playbackUrls.length) {
        return current + 1
      }
      return current
    })
  }

  function startTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
    }
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function startRecording() {
    if (!canStart) {
      return
    }

    setNotice('')
    setPlaybackUrls([])
    setPlaybackIndex(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const createResponse = await fetch('/api/admin/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title: title.trim(),
          session_type: sessionType,
          consent_given: consentGiven,
        }),
      })

      if (!createResponse.ok) {
        const errorBody = await createResponse.json()
        throw new Error(errorBody.error || 'Failed to create recording')
      }

      const createBody = await createResponse.json()
      const id = createBody.recording.id as string

      // Update provider with active session
      setActiveSession({
        id,
        projectId,
        title: title.trim(),
        status: 'recording'
      })

      const preferredMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : ''
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)

      chunkIndexRef.current = 0
      setChunkCount(0)
      uploadQueueRef.current = Promise.resolve()

      recorder.addEventListener('dataavailable', (event) => {
        if (!event.data || event.data.size === 0) {
          return
        }

        const nextIndex = chunkIndexRef.current
        chunkIndexRef.current += 1
        setChunkCount((value) => value + 1)
        queueChunkUpload(id, nextIndex, event.data)
      })

      recorder.addEventListener('stop', () => {
        void finalizeRecording(id)
      })

      mediaRecorderRef.current = recorder
      recorder.start(5000)
      setStatus('recording')
      setElapsedSeconds(0)
      startTimer()
      void requestWakeLock()
      setNotice('Recording started.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start recording')
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStatus('idle')
    }
  }

  function queueChunkUpload(id: string, chunkIndex: number, chunk: Blob) {
    uploadQueueRef.current = uploadQueueRef.current.then(async () => {
      const maxRetries = 3
      let attempt = 0

      while (attempt < maxRetries) {
        attempt += 1
        try {
          const formData = new FormData()
          formData.append('chunk', chunk, `chunk-${chunkIndex}.webm`)
          formData.append('chunk_index', String(chunkIndex))

          const response = await fetch(`/api/admin/recordings/${id}/chunk`, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const body = await response.json()
            throw new Error(body.error || 'Chunk upload failed')
          }

          return
        } catch (error) {
          if (attempt >= maxRetries) {
            throw error
          }
          await new Promise((resolve) => window.setTimeout(resolve, attempt * 750))
        }
      }
    }).catch((error) => {
      setNotice(error instanceof Error ? error.message : 'Chunk upload failed')
    })
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') {
      return
    }

    recorder.pause()
    stopTimer()
    setStatus('paused')
    setNotice('Recording paused.')
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'paused') {
      return
    }

    recorder.resume()
    startTimer()
    setStatus('recording')
    setNotice('Recording resumed.')
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || (recorder.state !== 'recording' && recorder.state !== 'paused')) {
      return
    }

    setStatus('stopping')
    stopTimer()
    recorder.stop()
  }

  async function finalizeRecording(id: string) {
    try {
      await uploadQueueRef.current

      await fetch(`/api/admin/recordings/${id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: elapsedSeconds }),
      })

      const signedResponse = await fetch(`/api/admin/recordings/${id}/signed-url`)
      if (signedResponse.ok) {
        const payload = await signedResponse.json()
        const urls = Array.isArray(payload.signed_urls)
          ? payload.signed_urls
          : payload.signed_url
            ? [payload.signed_url]
            : []
        setPlaybackUrls(urls)
        setPlaybackIndex(0)
      }

      setNotice('Recording finalized.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to finalize recording')
    } finally {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      mediaRecorderRef.current = null
      void releaseWakeLock()
      setStatus('idle')
      setActiveSession(null)
      setRecordingState({ status: 'idle', elapsedSeconds: 0 })
    }
  }


  function formatTime(total: number) {
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Engagement Recorder</h1>
        <p className="text-[#6B6785]">Create a project-linked session and stream audio in chunks.</p>
      </div>

      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-[#1A0F2E]">Session Setup</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-[#1A0F2E] text-sm">Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] [&>option]:bg-white [&>option]:text-[#1A0F2E]"
              disabled={status !== 'idle'}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[#1A0F2E] text-sm">Session type</span>
            <select
              value={sessionType}
              onChange={(event) => setSessionType(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] [&>option]:bg-white [&>option]:text-[#1A0F2E]"
              disabled={status !== 'idle'}
            >
              <option value="discovery">Discovery</option>
              <option value="review">Review</option>
              <option value="planning">Planning</option>
              <option value="retrospective">Retrospective</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[#1A0F2E] text-sm">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
            placeholder="Rush N Dush Engagement Session #001"
            disabled={status !== 'idle'}
          />
        </label>

        <label className="flex items-center gap-2 text-[#1A0F2E]">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(event) => setConsentGiven(event.target.checked)}
            disabled={status !== 'idle'}
          />
          Recording consent confirmed
        </label>
      </section>

      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-[#1A0F2E]">Recording</h2>
        <div className="text-5xl font-mono text-[#1A0F2E]">{formatTime(elapsedSeconds)}</div>
        <div className="text-[#6B6785] text-sm">Uploaded chunks: {chunkCount}</div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={startRecording}
            disabled={!canStart}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-40"
          >
            Start
          </button>
          <button
            onClick={pauseRecording}
            disabled={status !== 'recording'}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white disabled:opacity-40"
          >
            Pause
          </button>
          <button
            onClick={resumeRecording}
            disabled={status !== 'paused'}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-40"
          >
            Resume
          </button>
          <button
            onClick={stopRecording}
            disabled={status !== 'recording' && status !== 'paused'}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white disabled:opacity-40"
          >
            Stop
          </button>
        </div>

        {status !== 'idle' && (
          <div className="hidden md:block border-t border-[#E8E4EF] pt-4">
            <h3 className="text-sm font-semibold text-[#1A0F2E] mb-3">Markers</h3>
            <MarkersPanel />
          </div>
        )}

        {playbackUrls.length > 0 && (
          <div className="space-y-2">
            <audio
              key={playbackUrls[playbackIndex]}
              controls
              autoPlay
              src={playbackUrls[playbackIndex]}
              className="w-full"
              onEnded={handlePlaybackEnded}
            />
            <div className="flex items-center gap-2 text-[#6B6785] text-sm">
              <button
                onClick={() => setPlaybackIndex((value) => Math.max(0, value - 1))}
                disabled={playbackIndex === 0}
                className="px-2 py-1 rounded bg-[#F8F7F5] border border-[#E8E4EF] text-[#1A0F2E] hover:bg-[#290D47]/5 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPlaybackIndex((value) => Math.min(playbackUrls.length - 1, value + 1))}
                disabled={playbackIndex >= playbackUrls.length - 1}
                className="px-2 py-1 rounded bg-[#F8F7F5] border border-[#E8E4EF] text-[#1A0F2E] hover:bg-[#290D47]/5 disabled:opacity-40"
              >
                Next
              </button>
              <span>Chunk {playbackIndex + 1} / {playbackUrls.length}</span>
            </div>
          </div>
        )}
      </section>

      {status !== 'idle' && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#F8F7F5] md:hidden min-h-[100dvh] overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-[max(1.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2 text-sm text-[#1A0F2E]">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : status === 'paused' ? 'bg-amber-500' : 'bg-gray-400'}`} />
              <span className="capitalize font-medium">{status}</span>
            </div>
            <span className="text-xs text-[#6B6785]">Chunks: {chunkCount}</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pl-6 pr-6">
            <div className="min-h-full flex flex-col items-center justify-center gap-8 py-6">
              <div className="text-6xl font-mono text-[#1A0F2E] tabular-nums">{formatTime(elapsedSeconds)}</div>
              <div className="w-full">
                <h3 className="text-sm font-semibold text-[#1A0F2E] mb-3">Markers</h3>
                <MarkersPanel large />
              </div>
            </div>
          </div>

          <div className="w-full space-y-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-6 pr-6">
            {status === 'recording' && (
              <button
                onClick={pauseRecording}
                className="w-full py-4 rounded-2xl bg-amber-500 text-white font-semibold"
              >
                Pause
              </button>
            )}
            {status === 'paused' && (
              <button
                onClick={resumeRecording}
                className="w-full py-4 rounded-2xl bg-blue-500 text-white font-semibold"
              >
                Resume
              </button>
            )}
            <button
              onClick={stopRecording}
              disabled={status === 'stopping'}
              className="w-full py-5 rounded-2xl bg-rose-600 text-white text-lg font-bold disabled:opacity-40"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="bg-white border border-[#290D47]/15 rounded-lg px-4 py-3 text-[#1A0F2E] shadow-sm">
          {notice}
        </div>
      )}
    </div>
  )
}
