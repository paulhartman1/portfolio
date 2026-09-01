'use client'

import { useEffect, useRef, useState } from 'react'

type Props = { token: string }
type State = 'loading' | 'ready' | 'permission' | 'recording' | 'stopped' | 'error'

export default function MicRecorderClient({ token }: Props) {
  const [state, setState] = useState<State>('loading')
  const [title, setTitle] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const queueRef = useRef(Promise.resolve())
  const indexRef = useRef(0)
  const startedAtRef = useRef(0)
  const stoppedRemotelyRef = useRef(false)

  useEffect(() => {
    fetch(`/api/record/mic/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'This link is unavailable.')
        setTitle(body.recording_title)
        setState('ready')
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'This link is unavailable.')
        setState('error')
      })
  }, [token])

  useEffect(() => {
    if (state !== 'recording') return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000)
    // Shortened from 10s so a desktop-initiated stop is detected reasonably
    // quickly -- this is also how the phone finds out the screen recording
    // ended: the desktop revokes this pairing immediately on stop, and the
    // very next heartbeat comes back 410 ("This link has been revoked."),
    // which stopRemotely() below treats as "the other side stopped."
    const heartbeat = window.setInterval(async () => {
      const response = await fetch(`/api/record/mic/${encodeURIComponent(token)}/heartbeat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) }).catch(() => null)
      if (response && response.status === 410) {
        void stopRemotely('Screen recording ended — microphone stopped too.')
      }
    }, 5000)
    return () => { window.clearInterval(timer); window.clearInterval(heartbeat) }
  }, [state, token])

  // The desktop stopped (or the pairing was otherwise revoked) -- stop
  // locally too instead of leaving the phone recording into the void.
  // Deliberately does NOT call the phone's own /stop route: the pairing is
  // already 'revoked' server-side, and /stop only transitions from
  // pending/opened/permission_pending/active, so it would be a no-op --
  // this just mirrors that state locally.
  async function stopRemotely(message: string) {
    if (stoppedRemotelyRef.current) return
    stoppedRemotelyRef.current = true
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
        recorder.stop()
      })
    }
    await queueRef.current.catch(() => {})
    streamRef.current?.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
    setMessage(message)
    setState('stopped')
  }

  async function start() {
    stoppedRemotelyRef.current = false
    setState('permission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const response = await fetch(`/api/record/mic/${encodeURIComponent(token)}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_started_at_ms: Date.now() }) })
      if (!response.ok) throw new Error((await response.json()).error || 'Could not start microphone.')
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.addEventListener('dataavailable', (event) => {
        if (!event.data.size) return
        const index = indexRef.current++
        queueRef.current = queueRef.current.then(async () => {
          const form = new FormData()
          form.append('chunk', event.data, `chunk-${index}.webm`)
          form.append('chunk_index', String(index))
          form.append('duration_ms', '5000')
          form.append('offset_ms', String(Math.max(0, Date.now() - startedAtRef.current - 5000)))
          for (let attempt = 0; attempt < 3; attempt++) {
            const result = await fetch(`/api/record/mic/${encodeURIComponent(token)}/chunk`, { method: 'POST', body: form })
            if (result.ok) return
            if (result.status === 410) { void stopRemotely('Screen recording ended — microphone stopped too.'); return }
            if (attempt === 2) throw new Error('A microphone chunk could not be uploaded.')
            await new Promise((resolve) => window.setTimeout(resolve, 750 * (attempt + 1)))
          }
        }).catch((error) => setMessage(error instanceof Error ? error.message : 'Upload failed.'))
      })
      recorder.start(5000)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setState('recording')
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      await fetch(`/api/record/mic/${encodeURIComponent(token)}/heartbeat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'error', error_message: error instanceof Error ? error.message : 'Microphone permission was denied.' }) }).catch(() => {})
      setMessage('Microphone permission was denied or unavailable.')
      setState('ready')
    }
  }

  async function stop() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
        recorder.stop()
      })
    }
    await queueRef.current
    await fetch(`/api/record/mic/${encodeURIComponent(token)}/stop`, { method: 'POST' })
    streamRef.current?.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
    setState('stopped')
  }

  return <main className="min-h-screen bg-[#290D47] px-6 py-10 text-[#F8F7F5] flex items-center justify-center">
    <section className="w-full max-w-md space-y-6 rounded-2xl bg-[#1A0F2E] p-7 shadow-xl">
      <p className="text-xs font-semibold tracking-widest text-[#00F5E4]">CGT</p>
      <h1 className="text-2xl font-bold">Use this phone as the microphone</h1>
      <p className="text-[#F8F7F5]/75">for your workflow recording.</p>
      {title && <p className="rounded-lg bg-white/10 px-4 py-3 font-medium">{title}</p>}
      {state === 'loading' && <p>Checking recording link...</p>}
      {state === 'error' && <p className="text-red-300">{message}</p>}
      {(state === 'ready' || state === 'permission') && <button onClick={() => void start()} disabled={state === 'permission'} className="w-full rounded-lg bg-[#00F5E4] px-4 py-3 font-semibold text-[#1A0F2E] disabled:opacity-50">{state === 'permission' ? 'Requesting microphone...' : 'Start Microphone'}</button>}
      {state === 'recording' && <div className="space-y-5"><p className="text-lg">Microphone recording</p><p className="font-mono text-4xl">{new Date(elapsed * 1000).toISOString().slice(11, 19)}</p><p className="text-sm text-[#F8F7F5]/70">Your screen recording is running on the other computer. Stopping here or there ends both.</p><button onClick={() => void stop()} className="w-full rounded-lg bg-red-500 px-4 py-3 font-semibold">Stop Microphone</button></div>}
      {state === 'stopped' && <p>Microphone stopped. You can close this page.</p>}
      {message && state !== 'error' && <p className="text-sm text-red-300">{message}</p>}
    </section>
  </main>
}
