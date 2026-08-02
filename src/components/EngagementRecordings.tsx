'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type RecordingStatus = 'recording' | 'paused' | 'finalized' | 'failed'

type Marker = {
  id: string
  note_type: 'question' | 'friction' | 'decision' | 'observation' | 'action'
  note_text: string | null
  timestamp_seconds: number
  created_at: string
}

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
  markers: Marker[]
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

  const scopeKey = useMemo(() => (clientId ? `client:${clientId}` : `project:${projectId}`), [clientId, projectId])

  useEffect(() => {
    void loadRecordings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey])

  async function loadRecordings() {
    setLoading(true)
    setError('')

    try {
      const param = clientId
        ? `client_id=${encodeURIComponent(clientId)}`
        : `project_id=${encodeURIComponent(projectId as string)}`
      const response = await fetch(`/api/admin/recordings?${param}`)
      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || 'Failed to load recordings')
      }
      const payload = await response.json()
      setRecordings(payload.recordings || [])
    } catch (err) {
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

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
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
                    </div>
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
                      onClick={() => void deleteRecording(recording.id)}
                      disabled={deletingId === recording.id}
                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200 text-sm font-semibold disabled:opacity-50"
                    >
                      {deletingId === recording.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
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
    </section>
  )
}
