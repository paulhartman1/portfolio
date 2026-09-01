'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

type Props = { projectId: string }
type MicMode = 'computer' | 'phone' | 'none'
type Status = 'idle' | 'pairing' | 'phone-ready' | 'requesting' | 'recording' | 'uploading' | 'done' | 'error'

function time(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }

export default function RecordScreenButton({ projectId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [micMode, setMicMode] = useState<MicMode>('computer')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [phoneStatus, setPhoneStatus] = useState('')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamsRef = useRef<MediaStream[]>([])
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)
  const pollRef = useRef<number | null>(null)

  useEffect(() => () => { streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop())); if (pollRef.current) window.clearInterval(pollRef.current) }, [])
  useEffect(() => { if (status !== 'recording') return; const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedRef.current) / 1000)), 1000); return () => window.clearInterval(id) }, [status])

  async function choosePhone() {
    setMicMode('phone'); setStatus('pairing'); setMessage('')
    try {
      const created = await fetch(`/api/portal/projects/${projectId}/recordings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mic_source: 'phone' }) })
      const recordingBody = await created.json(); if (!created.ok) throw new Error(recordingBody.error)
      const id = recordingBody.recording.id as string; setRecordingId(id)
      const paired = await fetch(`/api/portal/projects/${projectId}/recordings/${id}/phone-pairing`, { method: 'POST' })
      const pairingBody = await paired.json(); if (!paired.ok) throw new Error(pairingBody.error)
      setQr(await QRCode.toDataURL(pairingBody.qr_url, { width: 220, margin: 2 })); setPhoneStatus('Waiting for phone...')
      pollRef.current = window.setInterval(async () => {
        const response = await fetch(`/api/portal/projects/${projectId}/recordings/${id}/phone-pairing/status`)
        if (!response.ok) return
        const body = await response.json(); setPhoneStatus(body.status === 'active' ? 'Phone microphone connected ✓' : body.status === 'opened' ? 'Phone opened link' : body.status === 'error' ? 'Phone microphone error' : 'Waiting for phone...')
        if (body.status === 'active') setStatus('phone-ready')
      }, 2000)
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not pair phone.') }
  }

  async function start() {
    setStatus('requesting'); setMessage('')
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); streamsRef.current.push(display)
      let mic: MediaStream | null = null
      if (micMode === 'computer') { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); streamsRef.current.push(mic) }
      const tracks = [...display.getVideoTracks(), ...(micMode === 'none' ? display.getAudioTracks() : mic ? [...display.getAudioTracks(), ...mic.getAudioTracks()] : display.getAudioTracks())]
      const recorder = new MediaRecorder(new MediaStream(tracks)); chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      recorder.onstop = () => void finish(recorder.mimeType || 'video/webm')
      recorderRef.current = recorder; recorder.start(); startedRef.current = Date.now(); setElapsed(0); setStatus('recording')
      display.getVideoTracks()[0]?.addEventListener('ended', stop)
    } catch (error) { setStatus('idle'); setMessage(error instanceof Error ? error.message : 'Screen or microphone permission was denied.') }
  }

  function stop() { if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop() }
  async function finish(mimeType: string) {
    setStatus('uploading'); const blob = new Blob(chunksRef.current, { type: mimeType }); const { data: { user } } = await supabaseBrowser.auth.getUser()
    try {
      if (!user || !blob.size) throw new Error('Recording was empty or you are signed out.')
      const name = `screen-recording-${Date.now()}.webm`; const path = `${projectId}/${Date.now()}-${name}`
      const upload = await supabaseBrowser.storage.from('client-files').upload(path, blob, { contentType: mimeType, upsert: false }); if (upload.error) throw upload.error
      const inserted = await supabaseBrowser.from('project_files').insert({ project_id: projectId, uploader_id: user.id, file_name: name, file_path: path, bucket_name: 'client-files', category: 'recording', mime_type: mimeType, file_size: blob.size }).select('id').single(); if (inserted.error) throw inserted.error
      if (recordingId) await fetch(`/api/portal/projects/${projectId}/recordings/${recordingId}/attach-video`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_file_id: inserted.data.id }) })
      setStatus('done'); setMessage('Recording uploaded to Documents.'); router.refresh()
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Upload failed.') }
    finally { streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop())); streamsRef.current = []; recorderRef.current = null; if (pollRef.current) window.clearInterval(pollRef.current) }
  }

  async function close() { if (status === 'recording') stop(); if (recordingId && status !== 'done') await fetch(`/api/portal/projects/${projectId}/recordings/${recordingId}/cancel`, { method: 'POST' }).catch(() => {}); setOpen(false); setStatus('idle'); setRecordingId(null); setQr(null); setMessage('') }
  return <><button type="button" onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg border border-white/25 text-white text-sm hover:bg-white/10">Record Screen</button>{open && <div className="fixed right-4 top-20 z-50 w-[280px] rounded-xl border border-[#290D47]/15 bg-white shadow-xl"><div className="flex justify-between border-b p-3"><b>Record screen</b><button onClick={() => void close()}>✕</button></div><div className="space-y-3 p-3"><fieldset disabled={!['idle', 'pairing', 'phone-ready'].includes(status)}><legend className="text-sm font-semibold">Microphone</legend>{(['computer', 'phone', 'none'] as MicMode[]).map((mode) => <label key={mode} className="block text-sm"><input type="radio" checked={micMode === mode} onChange={() => mode === 'phone' ? void choosePhone() : setMicMode(mode)} /> {mode === 'computer' ? 'This computer' : mode === 'phone' ? 'Use my phone' : 'No microphone'}</label>)}</fieldset>{qr && <div className="text-center text-xs text-[#6B6785]"><p>Scan this QR code with your phone.</p><img src={qr} alt="Phone microphone QR code" className="mx-auto my-2 h-48 w-48" /><p>{phoneStatus}</p></div>}{status === 'recording' && <div className="font-mono text-lg">{time(elapsed)}</div>}{status === 'uploading' && <p className="text-sm">Uploading recording...</p>}{(status === 'idle' || status === 'phone-ready') && <button disabled={micMode === 'phone' && status !== 'phone-ready'} onClick={() => void start()} className="w-full rounded-lg bg-[#00F5E4] px-3 py-2 text-sm font-medium disabled:opacity-40">Start Recording</button>}{status === 'recording' && <button onClick={stop} className="w-full rounded-lg bg-red-500 px-3 py-2 text-sm text-white">Stop Recording</button>}{message && <p className="text-xs text-red-600">{message}</p>}{status === 'done' && <button onClick={() => void close()} className="w-full rounded-lg border px-3 py-2 text-sm">Close</button>}</div></div>}</>
}
