'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

type Props = {
  projectId: string
}

type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'uploading' | 'done' | 'error'

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }
  return ''
}

const PANEL_MARGIN = 16
const PANEL_WIDTH = 260

export default function RecordScreenButton({ projectId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamsToStopRef = useRef<MediaStream[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (open && position === null && typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - PANEL_WIDTH - PANEL_MARGIN, y: 72 })
    }
  }, [open, position])

  useEffect(() => {
    if (!dragging) return

    function handlePointerMove(event: PointerEvent) {
      if (typeof window === 'undefined') return
      const panelWidth = panelRef.current?.offsetWidth ?? PANEL_WIDTH
      const panelHeight = panelRef.current?.offsetHeight ?? 0
      const nextX = event.clientX - dragOffsetRef.current.x
      const nextY = event.clientY - dragOffsetRef.current.y
      const maxX = window.innerWidth - panelWidth - PANEL_MARGIN
      const maxY = window.innerHeight - panelHeight - PANEL_MARGIN
      setPosition({
        x: Math.min(Math.max(nextX, PANEL_MARGIN), Math.max(maxX, PANEL_MARGIN)),
        y: Math.min(Math.max(nextY, PANEL_MARGIN), Math.max(maxY, PANEL_MARGIN)),
      })
    }

    function handlePointerUp() {
      setDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragging])

  function handleHeaderPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    setDragging(true)
  }

  useEffect(() => {
    setSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
        typeof window !== 'undefined' &&
        typeof MediaRecorder !== 'undefined'
    )
  }, [])

  function cleanupStreams() {
    streamsToStopRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop())
    })
    streamsToStopRef.current = []

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    return () => cleanupStreams()
  }, [])

  async function startRecording() {
    setMessage(null)
    setStatus('requesting')
    chunksRef.current = []
    setElapsedSeconds(0)

    let displayStream: MediaStream
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
    } catch {
      setStatus('idle')
      setMessage('Screen sharing permission was denied or cancelled.')
      return
    }
    streamsToStopRef.current.push(displayStream)

    let micStream: MediaStream | null = null
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamsToStopRef.current.push(micStream)
    } catch {
      // Mic denied/unavailable - continue with display audio only, if any.
      micStream = null
    }

    const videoTrack = displayStream.getVideoTracks()[0]
    const displayAudioTracks = displayStream.getAudioTracks()
    const micAudioTracks = micStream?.getAudioTracks() ?? []

    let mixedAudioTrack: MediaStreamTrack | null = null

    if (displayAudioTracks.length > 0 || micAudioTracks.length > 0) {
      try {
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const destination = audioContext.createMediaStreamDestination()

        if (displayAudioTracks.length > 0) {
          const displayAudioSource = audioContext.createMediaStreamSource(
            new MediaStream(displayAudioTracks)
          )
          displayAudioSource.connect(destination)
        }

        if (micAudioTracks.length > 0) {
          const micAudioSource = audioContext.createMediaStreamSource(
            new MediaStream(micAudioTracks)
          )
          micAudioSource.connect(destination)
        }

        mixedAudioTrack = destination.stream.getAudioTracks()[0] ?? null
      } catch {
        // If mixing fails for any reason, fall back to whichever single track exists.
        mixedAudioTrack = micAudioTracks[0] ?? displayAudioTracks[0] ?? null
      }
    }

    const combinedStream = new MediaStream(
      [videoTrack, mixedAudioTrack].filter((track): track is MediaStreamTrack => Boolean(track))
    )

    const mimeType = pickMimeType()
    const recorder = mimeType
      ? new MediaRecorder(combinedStream, { mimeType })
      : new MediaRecorder(combinedStream)

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      void finishRecording(mimeType || 'video/webm')
    }

    // If the user stops sharing via the browser's own "Stop sharing" control.
    videoTrack.addEventListener('ended', () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    })

    mediaRecorderRef.current = recorder
    recorder.start(1000)
    setStatus('recording')

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  async function finishRecording(mimeType: string) {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    setStatus('uploading')

    try {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []

      if (blob.size === 0) {
        throw new Error('Recording was empty. Please try again.')
      }

      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser()

      if (!user) {
        throw new Error('You must be logged in to upload recordings.')
      }

      const extension = mimeType.includes('webm') ? 'webm' : 'mp4'
      const fileName = `screen-recording-${Date.now()}.${extension}`
      const objectPath = `${projectId}/${Date.now()}-${fileName}`

      const { error: uploadError } = await supabaseBrowser.storage
        .from('client-files')
        .upload(objectPath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: mimeType,
        })

      if (uploadError) {
        throw uploadError
      }

      const { error: insertError } = await supabaseBrowser.from('project_files').insert({
        project_id: projectId,
        uploader_id: user.id,
        file_name: fileName,
        file_path: objectPath,
        bucket_name: 'client-files',
        category: 'recording',
        mime_type: mimeType,
        file_size: blob.size,
      })

      if (insertError) {
        throw insertError
      }

      setStatus('done')
      setMessage('Recording uploaded to Documents.')
      router.refresh()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to upload recording.')
    } finally {
      cleanupStreams()
    }
  }

  function closePanel() {
    if (status === 'recording' || status === 'requesting') {
      stopRecording()
    }
    cleanupStreams()
    setOpen(false)
    setStatus('idle')
    setElapsedSeconds(0)
    setMessage(null)
    setPosition(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg border border-white/25 text-white text-sm hover:bg-white/10 flex items-center gap-2"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
        Record Screen
      </button>

      {open && position && (
        <div
          ref={panelRef}
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#290D47]/15 w-[260px] select-none"
          style={{ left: position.x, top: position.y }}
        >
          <div
            onPointerDown={handleHeaderPointerDown}
            className="flex items-center justify-between px-3 py-2 border-b border-[#E8E4EF] cursor-move touch-none"
          >
            <span className="text-sm font-semibold text-[#1A0F2E] flex items-center gap-1.5">
              <span aria-hidden className="text-[#6B6785]">⠿</span>
              Record screen
            </span>
            <button
              type="button"
              onClick={closePanel}
              className="text-[#6B6785] hover:text-[#1A0F2E] text-sm leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-3">
            {!supported && (
              <p className="text-xs text-[#6B6785]">
                Not supported in this browser. Try Chrome, Edge, or Firefox on desktop.
              </p>
            )}

            {supported && status === 'idle' && (
              <>
                <p className="text-xs text-[#6B6785]">
                  Shares a tab/window + mic. Uploads to Documents on stop.
                </p>
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#00F5E4] text-[#1A0F2E] text-sm font-medium hover:opacity-90"
                >
                  Start recording
                </button>
              </>
            )}

            {status === 'requesting' && (
              <p className="text-xs text-[#6B6785]">Waiting for permissions…</p>
            )}

            {status === 'recording' && (
              <>
                <div className="flex items-center gap-2 text-[#1A0F2E]">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono text-sm">{formatTime(elapsedSeconds)}</span>
                  <span className="text-xs text-[#6B6785]">Recording…</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-full px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                >
                  Stop &amp; upload
                </button>
              </>
            )}

            {status === 'uploading' && (
              <p className="text-xs text-[#6B6785]">Uploading recording…</p>
            )}

            {(status === 'done' || status === 'error') && (
              <>
                <p className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-[#1A0F2E]'}`}>
                  {message}
                </p>
                <button
                  type="button"
                  onClick={closePanel}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#290D47]/20 text-[#1A0F2E] text-sm font-medium hover:bg-[#F8F7F5]"
                >
                  Close
                </button>
              </>
            )}

            {message && status !== 'done' && status !== 'error' && (
              <p className="text-xs text-red-600">{message}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
