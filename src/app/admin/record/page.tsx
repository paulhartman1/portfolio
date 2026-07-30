'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import { useEngagementSession } from '@/contexts/EngagementSessionContext'

type Project = {
  id: string
  name: string
}

type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopping'

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
    }
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
    if (data && data.length > 0) {
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
      setRecordingId(id)

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
        <h1 className="text-4xl font-bold text-white mb-2">Engagement Recorder</h1>
        <p className="text-white/80">Create a project-linked session and stream audio in chunks.</p>
      </div>

      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 space-y-4">
        <h2 className="text-2xl font-semibold text-white">Session Setup</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-white text-sm">Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900"
              disabled={status !== 'idle'}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-white text-sm">Session type</span>
            <select
              value={sessionType}
              onChange={(event) => setSessionType(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900"
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
          <span className="text-white text-sm">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
            placeholder="Rush N Dush Engagement Session #001"
            disabled={status !== 'idle'}
          />
        </label>

        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(event) => setConsentGiven(event.target.checked)}
            disabled={status !== 'idle'}
          />
          Recording consent confirmed
        </label>
      </section>

      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 space-y-4">
        <h2 className="text-2xl font-semibold text-white">Recording</h2>
        <div className="text-5xl font-mono text-white">{formatTime(elapsedSeconds)}</div>
        <div className="text-white/80 text-sm">Uploaded chunks: {chunkCount}</div>

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
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <button
                onClick={() => setPlaybackIndex((value) => Math.max(0, value - 1))}
                disabled={playbackIndex === 0}
                className="px-2 py-1 rounded bg-white/10 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPlaybackIndex((value) => Math.min(playbackUrls.length - 1, value + 1))}
                disabled={playbackIndex >= playbackUrls.length - 1}
                className="px-2 py-1 rounded bg-white/10 disabled:opacity-40"
              >
                Next
              </button>
              <span>Chunk {playbackIndex + 1} / {playbackUrls.length}</span>
            </div>
          </div>
        )}
      </section>

      {notice && (
        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white">
          {notice}
        </div>
      )}
    </div>
  )
}
