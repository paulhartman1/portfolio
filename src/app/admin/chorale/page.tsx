'use client'

import { useEffect, useMemo, useState, type DragEvent } from 'react'
import type {
  ChoraleSignedUploadResponse,
  PerformanceRecord,
  RehearsalTrackRecord,
} from '@/types/chorale'

type PerformanceWithTracks = PerformanceRecord & {
  tracks: RehearsalTrackRecord[]
}

type TrackForm = {
  title: string
  composer: string
  description: string
}

type ApiError = {
  error?: string
}

function reorderById<T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] {
  if (sourceId === targetId) return items
  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return items
  const next = [...items]
  const [source] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, source)
  return next
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiError
    if (payload.error) return payload.error
  } catch {
    // no-op
  }
  return `Request failed (${response.status})`
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  return (await response.json()) as T
}

function createSignedUploadHttpUrl(path: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  const encodedPath = path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `${baseUrl}/storage/v1/object/upload/sign/chorale-audio/${encodedPath}?token=${encodeURIComponent(token)}`
}

async function uploadFileWithProgress(
  signedPath: string,
  token: string,
  file: File,
  onProgress: (progress: number) => void
) {
  const uploadUrl = createSignedUploadHttpUrl(signedPath, token)
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`Upload failed (${request.status})`))
      }
    }
    request.onerror = () => reject(new Error('Upload failed'))
    request.open('PUT', uploadUrl)
    request.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
    request.send(file)
  })
}

export default function AdminChoralePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [performances, setPerformances] = useState<PerformanceWithTracks[]>([])
  const [creatingPerformance, setCreatingPerformance] = useState(false)
  const [newPerformanceTitle, setNewPerformanceTitle] = useState('')
  const [newPerformanceDescription, setNewPerformanceDescription] = useState('')
  const [newPerformanceDate, setNewPerformanceDate] = useState('')
  const [uploadingPerformanceId, setUploadingPerformanceId] = useState('')
  const [uploadProgressByPerformance, setUploadProgressByPerformance] = useState<Record<string, number>>({})
  const [trackFormsByPerformance, setTrackFormsByPerformance] = useState<Record<string, TrackForm>>({})
  const [draggingTrack, setDraggingTrack] = useState<{ performanceId: string; trackId: string } | null>(null)

  useEffect(() => {
    void loadData()
  }, [])

  const filteredPerformances = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return performances
    return performances
      .map((performance) => {
        const matchesPerformance =
          performance.title.toLowerCase().includes(query) ||
          (performance.description || '').toLowerCase().includes(query)
        if (matchesPerformance) return performance
        const matchingTracks = performance.tracks.filter((track) => {
          return (
            track.title.toLowerCase().includes(query) ||
            (track.composer || '').toLowerCase().includes(query) ||
            (track.description || '').toLowerCase().includes(query)
          )
        })
        if (matchingTracks.length === 0) return null
        return { ...performance, tracks: matchingTracks }
      })
      .filter((performance): performance is PerformanceWithTracks => Boolean(performance))
  }, [performances, search])

  function defaultTrackForm(): TrackForm {
    return {
      title: '',
      composer: '',
      description: '',
    }
  }

  function mapData(
    performanceList: PerformanceRecord[],
    trackList: RehearsalTrackRecord[]
  ): PerformanceWithTracks[] {
    const groupedTracks = trackList.reduce<Record<string, RehearsalTrackRecord[]>>((acc, track) => {
      if (!acc[track.performance_id]) acc[track.performance_id] = []
      acc[track.performance_id].push(track)
      return acc
    }, {})

    return performanceList
      .map((performance) => ({
        ...performance,
        tracks: (groupedTracks[performance.id] || []).sort((a, b) => a.sort_order - b.sort_order),
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [performanceRes, trackRes] = await Promise.all([
        fetchJson<{ performances: PerformanceRecord[] }>('/api/chorale/performances?includeUnpublished=true'),
        fetchJson<{ tracks: RehearsalTrackRecord[] }>('/api/chorale/rehearsal-tracks?includeUnpublished=true'),
      ])
      setPerformances(mapData(performanceRes.performances || [], trackRes.tracks || []))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load chorale admin data')
    } finally {
      setLoading(false)
    }
  }

  async function createPerformance() {
    if (!newPerformanceTitle.trim()) {
      setError('Performance title is required')
      return
    }
    setCreatingPerformance(true)
    setError('')
    try {
      await fetchJson('/api/chorale/performances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPerformanceTitle.trim(),
          description: newPerformanceDescription.trim() || null,
          performance_date: newPerformanceDate || null,
          is_published: false,
        }),
      })
      setNotice('Performance created')
      setNewPerformanceTitle('')
      setNewPerformanceDescription('')
      setNewPerformanceDate('')
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create performance')
    } finally {
      setCreatingPerformance(false)
    }
  }

  async function updatePerformance(
    performanceId: string,
    payload: Partial<Pick<PerformanceRecord, 'title' | 'description' | 'performance_date' | 'is_published'>>
  ) {
    setError('')
    try {
      await fetchJson(`/api/chorale/performances/${performanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update performance')
    }
  }

  async function deletePerformance(performanceId: string) {
    if (!confirm('Delete this performance and all associated tracks?')) return
    setError('')
    try {
      await fetchJson(`/api/chorale/performances/${performanceId}`, { method: 'DELETE' })
      setNotice('Performance deleted')
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete performance')
    }
  }

  function updateTrackForm(performanceId: string, updates: Partial<TrackForm>) {
    setTrackFormsByPerformance((current) => ({
      ...current,
      [performanceId]: {
        ...(current[performanceId] || defaultTrackForm()),
        ...updates,
      },
    }))
  }

  async function requestSignedUpload(performanceId: string, fileName: string) {
    return fetchJson<ChoraleSignedUploadResponse>('/api/chorale/rehearsal-tracks/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        performance_id: performanceId,
        file_name: fileName,
      }),
    })
  }

  async function createTrack(performance: PerformanceWithTracks, file: File) {
    const form = trackFormsByPerformance[performance.id] || defaultTrackForm()
    const title = form.title.trim() || file.name.replace(/\.[^.]+$/, '')
    if (!title) {
      setError('Track title is required')
      return
    }

    setUploadingPerformanceId(performance.id)
    setUploadProgressByPerformance((current) => ({ ...current, [performance.id]: 0 }))
    setError('')

    try {
      const { signedUpload } = await requestSignedUpload(performance.id, file.name)
      await uploadFileWithProgress(signedUpload.path, signedUpload.token, file, (progress) => {
        setUploadProgressByPerformance((current) => ({ ...current, [performance.id]: progress }))
      })

      await fetchJson('/api/chorale/rehearsal-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performance_id: performance.id,
          title,
          description: form.description.trim() || null,
          composer: form.composer.trim() || null,
          sort_order: performance.tracks.length,
          storage_object_path: signedUpload.objectPath,
          mime_type: file.type || 'audio/mpeg',
          is_published: false,
        }),
      })

      setTrackFormsByPerformance((current) => ({
        ...current,
        [performance.id]: defaultTrackForm(),
      }))
      setNotice('Track uploaded')
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to upload track')
    } finally {
      setUploadingPerformanceId('')
      setUploadProgressByPerformance((current) => ({ ...current, [performance.id]: 0 }))
    }
  }

  async function replaceTrackAudio(track: RehearsalTrackRecord, file: File) {
    setError('')
    try {
      const { signedUpload } = await requestSignedUpload(track.performance_id, file.name)
      await uploadFileWithProgress(signedUpload.path, signedUpload.token, file, () => undefined)
      await fetchJson(`/api/chorale/rehearsal-tracks/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_object_path: signedUpload.objectPath,
          mime_type: file.type || 'audio/mpeg',
        }),
      })
      setNotice('Track audio replaced')
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to replace track audio')
    }
  }

  async function updateTrack(trackId: string, payload: Partial<RehearsalTrackRecord>) {
    setError('')
    try {
      await fetchJson(`/api/chorale/rehearsal-tracks/${trackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update track')
    }
  }

  async function deleteTrack(trackId: string) {
    if (!confirm('Delete this track?')) return
    setError('')
    try {
      await fetchJson(`/api/chorale/rehearsal-tracks/${trackId}`, { method: 'DELETE' })
      setNotice('Track deleted')
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete track')
    }
  }

  async function reorderTracks(performanceId: string, sourceId: string, targetId: string) {
    const performance = performances.find((item) => item.id === performanceId)
    if (!performance) return
    const reordered = reorderById(performance.tracks, sourceId, targetId)
    setPerformances((current) =>
      current.map((item) => (item.id === performanceId ? { ...item, tracks: reordered } : item))
    )

    try {
      await fetchJson('/api/chorale/rehearsal-tracks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performance_id: performanceId,
          track_ids: reordered.map((track) => track.id),
        }),
      })
      setNotice('Track order updated')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to reorder tracks')
      await loadData()
    }
  }

  function handleDropUpload(event: DragEvent<HTMLDivElement>, performance: PerformanceWithTracks) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    void createTrack(performance, file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Chorale Admin</h1>
        <p className="text-white/80">
          Manage private streaming tracks. Upload, replace, edit, delete, reorder, and publish without
          exposing download links or storage object URLs.
        </p>
      </div>

      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-64">
            <label className="block text-sm text-white/70 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40"
              placeholder="Search performances or tracks"
            />
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {error && <p className="text-red-200 text-sm mt-3">{error}</p>}
        {notice && <p className="text-green-200 text-sm mt-3">{notice}</p>}
      </section>

      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Create performance</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={newPerformanceTitle}
            onChange={(event) => setNewPerformanceTitle(event.target.value)}
            placeholder="Performance title"
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40"
          />
          <input
            type="date"
            value={newPerformanceDate}
            onChange={(event) => setNewPerformanceDate(event.target.value)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
          />
          <textarea
            value={newPerformanceDescription}
            onChange={(event) => setNewPerformanceDescription(event.target.value)}
            placeholder="Description"
            rows={3}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40 md:col-span-2"
          />
        </div>
        <button
          type="button"
          onClick={createPerformance}
          disabled={creatingPerformance}
          className="mt-4 px-5 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
        >
          {creatingPerformance ? 'Creating…' : 'Create performance'}
        </button>
      </section>

      <section className="space-y-5">
        {filteredPerformances.map((performance) => {
          const trackForm = trackFormsByPerformance[performance.id] || defaultTrackForm()
          const isUploading = uploadingPerformanceId === performance.id
          const uploadProgress = uploadProgressByPerformance[performance.id] || 0

          return (
            <article
              key={performance.id}
              className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6"
            >
              <div className="flex flex-wrap justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-2xl font-semibold text-white">{performance.title}</h3>
                  <p className="text-white/70 text-sm">
                    {performance.performance_date
                      ? new Date(performance.performance_date).toLocaleDateString()
                      : 'No date'}
                  </p>
                  {performance.description && (
                    <p className="text-white/80 text-sm mt-2">{performance.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 h-fit">
                  <button
                    type="button"
                    onClick={() =>
                      updatePerformance(performance.id, { is_published: !performance.is_published })
                    }
                    className="px-3 py-1 rounded bg-blue-500/30 text-blue-100 hover:bg-blue-500/40 text-sm"
                  >
                    {performance.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const title = prompt('New performance title', performance.title)
                      if (title === null) return
                      void updatePerformance(performance.id, { title: title.trim() || performance.title })
                    }}
                    className="px-3 py-1 rounded bg-white/20 text-white hover:bg-white/30 text-sm"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePerformance(performance.id)}
                    className="px-3 py-1 rounded bg-red-500/30 text-red-100 hover:bg-red-500/40 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="bg-white/5 border border-white/20 rounded-xl p-4 mb-4">
                <h4 className="text-white font-semibold mb-3">Upload track (drag-and-drop)</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={trackForm.title}
                    onChange={(event) => updateTrackForm(performance.id, { title: event.target.value })}
                    placeholder="Track title"
                    className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white placeholder:text-white/40"
                  />
                  <input
                    type="text"
                    value={trackForm.composer}
                    onChange={(event) => updateTrackForm(performance.id, { composer: event.target.value })}
                    placeholder="Composer"
                    className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white placeholder:text-white/40"
                  />
                  <input
                    type="text"
                    value={trackForm.description}
                    onChange={(event) => updateTrackForm(performance.id, { description: event.target.value })}
                    placeholder="Description"
                    className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div
                  className="mt-3 p-4 rounded border border-dashed border-white/40 bg-white/5"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDropUpload(event, performance)}
                >
                  <label className="text-white/80 text-sm block mb-2">
                    Drop an audio file here or choose one manually
                  </label>
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={isUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      void createTrack(performance, file)
                      event.currentTarget.value = ''
                    }}
                    className="block text-white text-sm"
                  />
                  {isUploading && (
                    <p className="text-white/80 text-sm mt-2">Uploading… {uploadProgress}%</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {performance.tracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onUpdate={updateTrack}
                    onDelete={deleteTrack}
                    onReplaceAudio={replaceTrackAudio}
                    draggable
                    onDragStart={() =>
                      setDraggingTrack({ performanceId: performance.id, trackId: track.id })
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggingTrack) return
                      if (draggingTrack.performanceId !== performance.id) return
                      if (draggingTrack.trackId === track.id) return
                      void reorderTracks(performance.id, draggingTrack.trackId, track.id)
                      setDraggingTrack(null)
                    }}
                  />
                ))}
                {performance.tracks.length === 0 && (
                  <p className="text-white/60 text-sm">No tracks yet.</p>
                )}
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

type TrackRowProps = {
  track: RehearsalTrackRecord
  onUpdate: (trackId: string, payload: Partial<RehearsalTrackRecord>) => Promise<void>
  onDelete: (trackId: string) => Promise<void>
  onReplaceAudio: (track: RehearsalTrackRecord, file: File) => Promise<void>
  draggable: boolean
  onDragStart: () => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: () => void
}

function TrackRow({
  track,
  onUpdate,
  onDelete,
  onReplaceAudio,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: TrackRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(track.title)
  const [composer, setComposer] = useState(track.composer || '')
  const [description, setDescription] = useState(track.description || '')

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="bg-white/5 border border-white/20 rounded-lg p-4"
    >
      {editing ? (
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full px-3 py-2 rounded bg-white/5 border border-white/20 text-white"
          />
          <div className="grid md:grid-cols-2 gap-2">
            <input
              type="text"
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="Composer"
              className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white"
            />
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                void onUpdate(track.id, {
                  title: title.trim() || track.title,
                  composer: composer.trim() || null,
                  description: description.trim() || null,
                }).then(() => setEditing(false))
              }
              className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setTitle(track.title)
                setComposer(track.composer || '')
                setDescription(track.description || '')
              }}
              className="px-3 py-1 rounded bg-white/20 text-white hover:bg-white/30 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-2 mb-3">
          <div>
            <p className="text-white font-semibold">{track.title}</p>
            <p className="text-white/70 text-sm">
              {track.composer || 'Composer unknown'}
              {track.duration_seconds ? ` • ${Math.round(track.duration_seconds)}s` : ''}
            </p>
            {track.description && <p className="text-white/70 text-sm mt-1">{track.description}</p>}
          </div>
          <span
            className={`h-fit px-2 py-1 rounded text-xs font-semibold ${
              track.is_published ? 'bg-green-600/30 text-green-100' : 'bg-white/20 text-white/80'
            }`}
          >
            {track.is_published ? 'Published' : 'Unpublished'}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          className="px-3 py-1 rounded bg-white/20 text-white hover:bg-white/30 text-sm"
        >
          {editing ? 'Close' : 'Edit metadata'}
        </button>
        <button
          type="button"
          onClick={() => void onUpdate(track.id, { is_published: !track.is_published })}
          className="px-3 py-1 rounded bg-blue-500/30 text-blue-100 hover:bg-blue-500/40 text-sm"
        >
          {track.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <label className="px-3 py-1 rounded bg-purple-500/30 text-purple-100 hover:bg-purple-500/40 text-sm cursor-pointer">
          Replace audio
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              void onReplaceAudio(track, file)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void onDelete(track.id)}
          className="px-3 py-1 rounded bg-red-500/30 text-red-100 hover:bg-red-500/40 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
