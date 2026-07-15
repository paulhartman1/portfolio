'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChoraleTrack } from './types'

type StreamResponse = {
  track_id: string
  stream: {
    streamUrl: string
    expiresInSeconds: number
  }
}

export default function ChoraleAudioPlayer({
  track,
}: {
  track: ChoraleTrack | null
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStreamUrl(null)
    setExpiresAtMs(null)
    setError(null)
  }, [track?.id])

  const requestSignedStream = useCallback(
    async (resumeTime?: number, autoplay?: boolean) => {
      if (!track?.id || isLoading || isRefreshing) return false

      setError(null)
      setIsLoading(!resumeTime)
      setIsRefreshing(Boolean(resumeTime))

      try {
        const response = await fetch('/api/chorale/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_id: track.id }),
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Unable to start audio stream.')
        }

        const payload = (await response.json()) as StreamResponse
        const nextUrl = payload.stream.streamUrl
        const nextExpires = Date.now() + payload.stream.expiresInSeconds * 1000

        setStreamUrl(nextUrl)
        setExpiresAtMs(nextExpires)

        const audio = audioRef.current
        if (audio) {
          audio.src = nextUrl
          if (typeof resumeTime === 'number' && Number.isFinite(resumeTime) && resumeTime > 0) {
            audio.currentTime = resumeTime
          }
          if (autoplay) {
            await audio.play()
          }
        }

        return true
      } catch (requestErr) {
        console.error('stream request failed', requestErr)
        setError('Unable to load stream right now. Please try again.')
        return false
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [isLoading, isRefreshing, track?.id]
  )

  const ensureFreshUrl = useCallback(
    async (autoplay?: boolean) => {
      const now = Date.now()
      const expiresSoon = !expiresAtMs || now >= expiresAtMs - 15_000
      const hasUrl = Boolean(streamUrl)

      if (!hasUrl || expiresSoon) {
        const resumeTime = audioRef.current?.currentTime
        return requestSignedStream(resumeTime, autoplay)
      }

      if (autoplay) {
        await audioRef.current?.play()
      }

      return true
    },
    [expiresAtMs, requestSignedStream, streamUrl]
  )

  const handlePlayClick = useCallback(async () => {
    await ensureFreshUrl(true)
  }, [ensureFreshUrl])

  const handleAudioPlay = useCallback(async () => {
    await ensureFreshUrl(false)
  }, [ensureFreshUrl])

  const handleAudioError = useCallback(async () => {
    if (!audioRef.current || !track?.id) return

    const attemptedResumeTime = audioRef.current.currentTime
    await requestSignedStream(attemptedResumeTime, true)
  }, [requestSignedStream, track?.id])

  if (!track) {
    return (
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Now playing</h3>
        <p className="text-white/70 text-sm">Select a track to begin streaming.</p>
      </section>
    )
  }

  return (
    <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">Now playing</h3>
      <p className="text-white">{track.title}</p>
      {track.composer && (
        <p className="text-white/70 text-sm mt-1">Composer: {track.composer}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePlayClick}
          className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 disabled:opacity-60"
          disabled={isLoading || isRefreshing}
        >
          {isLoading ? 'Loading stream…' : isRefreshing ? 'Refreshing…' : 'Play stream'}
        </button>
        <button
          type="button"
          onClick={() => requestSignedStream(audioRef.current?.currentTime)}
          className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-60"
          disabled={isLoading || isRefreshing}
        >
          Refresh stream
        </button>
      </div>

      <audio
        ref={audioRef}
        className="mt-4 w-full"
        controls
        preload="none"
        controlsList="nodownload"
        onPlay={handleAudioPlay}
        onError={handleAudioError}
        onContextMenu={(event) => event.preventDefault()}
      />

      {error && <p className="text-red-200 text-sm mt-3">{error}</p>}
      {!error && (
        <p className="text-white/60 text-xs mt-3">
          Streams are temporary and refresh automatically when needed.
        </p>
      )}
    </section>
  )
}
