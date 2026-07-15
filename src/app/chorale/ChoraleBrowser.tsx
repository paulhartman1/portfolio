'use client'

import { useMemo, useState } from 'react'
import ChoraleAudioPlayer from './ChoraleAudioPlayer'
import type { ChoralePerformance, ChoraleTrack } from './types'

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return null
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatDate(value: string | null) {
  if (!value) return 'Date TBD'
  return new Date(value).toLocaleDateString()
}

export default function ChoraleBrowser({
  performances,
  tracks,
}: {
  performances: ChoralePerformance[]
  tracks: ChoraleTrack[]
}) {
  const [query, setQuery] = useState('')
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)

  const performanceById = useMemo(() => {
    return performances.reduce<Record<string, ChoralePerformance>>((acc, performance) => {
      acc[performance.id] = performance
      return acc
    }, {})
  }, [performances])

  const filteredTracks = useMemo(() => {
    const lowered = query.trim().toLowerCase()
    if (!lowered) return tracks

    return tracks.filter((track) => {
      const performanceTitle = track.performance_id
        ? performanceById[track.performance_id]?.title
        : ''

      return [track.title, track.description, track.composer, performanceTitle]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(lowered))
    })
  }, [performanceById, query, tracks])

  const selectedTrack = useMemo(() => {
    if (!selectedTrackId) return null
    return tracks.find((track) => track.id === selectedTrackId) ?? null
  }, [selectedTrackId, tracks])

  return (
    <div className="space-y-6">
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-white mb-2">Chorale library</h1>
        <p className="text-white/80 text-sm">
          Browse performances and rehearsal tracks, then stream securely in the player below.
        </p>
        <label htmlFor="chorale-search" className="block text-white/80 text-sm mt-4 mb-2">
          Search tracks
        </label>
        <input
          id="chorale-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, composer, or performance"
          className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </section>

      <section className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Performances</h2>
          <div className="space-y-3">
            {performances.map((performance) => (
              <article key={performance.id} className="bg-white/5 border border-white/20 rounded-lg p-4">
                <p className="text-white font-medium">{performance.title}</p>
                <p className="text-white/70 text-xs mt-1">{formatDate(performance.performance_date)}</p>
                {performance.description && (
                  <p className="text-white/80 text-sm mt-2">{performance.description}</p>
                )}
              </article>
            ))}
            {!performances.length && (
              <p className="text-white/70 text-sm">No published performances available yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Rehearsal tracks</h2>
          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {filteredTracks.map((track) => {
              const performance = track.performance_id
                ? performanceById[track.performance_id]
                : null
              return (
                <article key={track.id} className="bg-white/5 border border-white/20 rounded-lg p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-white font-medium">{track.title}</p>
                      <p className="text-white/70 text-xs mt-1">
                        {performance?.title ?? 'General rehearsal'}
                        {track.composer ? ` · ${track.composer}` : ''}
                        {formatDuration(track.duration_seconds)
                          ? ` · ${formatDuration(track.duration_seconds)}`
                          : ''}
                      </p>
                      {track.description && (
                        <p className="text-white/80 text-sm mt-2">{track.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTrackId(track.id)}
                      className="px-3 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 h-fit"
                    >
                      Play
                    </button>
                  </div>
                </article>
              )
            })}
            {!filteredTracks.length && (
              <p className="text-white/70 text-sm">No tracks match your search.</p>
            )}
          </div>
        </div>
      </section>

      <ChoraleAudioPlayer track={selectedTrack} />
    </div>
  )
}
