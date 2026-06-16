'use client'

import { useMemo, useRef, useState } from 'react'

type CommentRecord = {
  id: string
  url: string
  comment_text: string
  priority: 'low' | 'medium' | 'high'
  status: 'new' | 'in-progress' | 'resolved'
  created_at: string
  x_position: number | null
  y_position: number | null
  viewport_width: number | null
}

type DraftPin = {
  x: number
  y: number
}

type Props = {
  projectId: string
  projectName: string
  previewUrl: string | null
  subdomain: string
  initialComments: CommentRecord[]
}

function normalizePath(input: string) {
  if (!input) return '/'
  if (input.startsWith('/')) return input
  try {
    const parsed = new URL(input)
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch {
    return '/'
  }
}

function getPriorityDot(priority: CommentRecord['priority']) {
  if (priority === 'high') return '🔴'
  if (priority === 'medium') return '🟡'
  return '🟢'
}

export default function PreviewWorkspace({
  projectId,
  projectName,
  previewUrl,
  subdomain,
  initialComments,
}: Props) {
  const iframeWrapperRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [comments, setComments] = useState<CommentRecord[]>(initialComments)
  const [isFeedbackMode, setIsFeedbackMode] = useState(false)
  const [draftPin, setDraftPin] = useState<DraftPin | null>(null)
  const [selectedComment, setSelectedComment] = useState<CommentRecord | null>(null)
  const [commentText, setCommentText] = useState('')
  const [priority, setPriority] = useState<CommentRecord['priority']>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const initialPath = useMemo(() => normalizePath(previewUrl || '/'), [previewUrl])
  const [currentPath, setCurrentPath] = useState(initialPath)

  const commentsForCurrentPath = comments.filter(
    (comment) => normalizePath(comment.url) === currentPath
  )

  function trySyncPathFromIframe() {
    try {
      const frameLocation = iframeRef.current?.contentWindow?.location
      if (!frameLocation) return
      const nextPath = `${frameLocation.pathname}${frameLocation.search}${frameLocation.hash}` || '/'
      setCurrentPath(nextPath)
    } catch {
      // Cross-origin iframe access is blocked; keep the last known path.
    }
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!isFeedbackMode) return
    const wrapper = iframeWrapperRef.current
    if (!wrapper) return

    const bounds = wrapper.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top

    setDraftPin({ x, y })
    setSelectedComment(null)
    setCommentText('')
    setPriority('medium')
    setSubmitError(null)
    setIsFeedbackMode(false)
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draftPin || !commentText.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/portal/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          subdomain,
          url: currentPath,
          x_position: Math.round(draftPin.x),
          y_position: Math.round(draftPin.y),
          viewport_width: Math.round(iframeWrapperRef.current?.clientWidth || 0),
          comment_text: commentText.trim(),
          priority,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to submit comment' }))
        throw new Error(errorBody.error || 'Failed to submit comment')
      }

      const created = (await response.json()) as CommentRecord
      setComments((prev) => [created, ...prev])
      setDraftPin(null)
      setCommentText('')
      setPriority('medium')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-6">
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Preview Site</h2>
            <p className="text-white/75 text-sm">
              Use feedback mode to drop a pin and leave a note exactly where you want a change.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFeedbackMode((prev) => !prev)}
            className={`px-4 py-2 rounded-lg text-white font-medium ${
              isFeedbackMode ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {isFeedbackMode ? 'Exit Feedback Mode' : '💬 Feedback Mode'}
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-white/80 text-sm mb-1">Current page path</label>
          <input
            value={currentPath}
            readOnly
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
          />
        </div>

        <div ref={iframeWrapperRef} className="relative bg-white rounded-lg overflow-hidden" style={{ height: '70vh' }}>
          {previewUrl ? (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full"
              title={projectName}
              onLoad={trySyncPathFromIframe}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5">
              <p className="text-slate-700">Preview URL is not configured yet.</p>
            </div>
          )}

          {commentsForCurrentPath.map((comment) =>
            comment.x_position !== null && comment.y_position !== null ? (
              <button
                key={comment.id}
                type="button"
                onClick={() => {
                  setSelectedComment(comment)
                  setDraftPin(null)
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl"
                style={{ left: `${comment.x_position}px`, top: `${comment.y_position}px` }}
                title={comment.comment_text}
              >
                📌
              </button>
            ) : null
          )}

          {draftPin && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl"
              style={{ left: `${draftPin.x}px`, top: `${draftPin.y}px` }}
            >
              📍
            </div>
          )}

          {previewUrl && (
            <button
              type="button"
              onClick={trySyncPathFromIframe}
              className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-slate-900/70 text-white text-xs"
            >
              Refresh path
            </button>
          )}

          <button
            type="button"
            onClick={handleOverlayClick}
            className={`absolute inset-0 ${
              isFeedbackMode ? 'cursor-crosshair bg-sky-400/10' : 'pointer-events-none'
            }`}
            aria-label="Preview feedback overlay"
          />
        </div>
      </section>

      <aside className="space-y-6">
        {draftPin && (
          <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-3">Add Comment</h3>
            <form onSubmit={submitComment} className="space-y-3">
              <div>
                <label className="block text-white/80 text-sm mb-1">Page path</label>
                <input
                  value={currentPath}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as CommentRecord['priority'])}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Comment</label>
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  required
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                  placeholder="Describe the update you want in this area."
                />
              </div>
              {submitError && <p className="text-red-200 text-sm">{submitError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : 'Submit comment'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraftPin(null)}
                  className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {selectedComment && (
          <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-3">Comment Details</h3>
            <p className="text-white/80 text-sm mb-1">Path: {normalizePath(selectedComment.url)}</p>
            <p className="text-white text-sm mb-2">{selectedComment.comment_text}</p>
            <p className="text-white/80 text-sm">
              {getPriorityDot(selectedComment.priority)} {selectedComment.priority} ·{' '}
              {selectedComment.status}
            </p>
            <p className="text-white/60 text-xs mt-2">
              {new Date(selectedComment.created_at).toLocaleString()}
            </p>
            <button
              type="button"
              onClick={() => setSelectedComment(null)}
              className="mt-4 px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
            >
              Close
            </button>
          </section>
        )}

        <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Comments on this page</h3>
          <div className="space-y-3 max-h-[400px] overflow-auto pr-1">
            {commentsForCurrentPath.map((comment) => (
              <button
                key={comment.id}
                type="button"
                onClick={() => setSelectedComment(comment)}
                className="w-full text-left bg-white/5 border border-white/20 rounded-lg p-3 hover:bg-white/10"
              >
                <p className="text-white text-sm">{comment.comment_text}</p>
                <p className="text-white/65 text-xs mt-2">
                  {getPriorityDot(comment.priority)} {comment.priority} · {comment.status}
                </p>
              </button>
            ))}
            {!commentsForCurrentPath.length && (
              <p className="text-white/70 text-sm">
                No comments on this path yet. Turn on feedback mode and click anywhere on the preview.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}
