'use client'

import { useState } from 'react'
import { useEngagementSession } from '@/contexts/EngagementSessionContext'

type NoteType = 'question' | 'friction' | 'decision' | 'observation' | 'action'

export function CaptureDock() {
  const {
    activeSession,
    recordingState,
    recentCaptures,
    dockVisible,
    toggleDock,
    addCapture
  } = useEngagementSession()

  const [noteInput, setNoteInput] = useState('')
  const [notice, setNotice] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)

  if (!activeSession || !dockVisible) {
    return null
  }

  async function handleAddCapture(noteType: NoteType) {
    try {
      const text = noteInput.trim() || ''
      await addCapture(noteType, text)
      setNoteInput('')
      setNotice(`${noteType} marked`)
      setTimeout(() => setNotice(''), 1500)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to save marker')
      setTimeout(() => setNotice(''), 3000)
    }
  }

  function formatTime(total: number) {
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white/95 backdrop-blur-lg border border-gray-300 rounded-2xl shadow-2xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{activeSession.title}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className={`inline-block w-2 h-2 rounded-full ${
              recordingState.status === 'recording' ? 'bg-red-500 animate-pulse' :
              recordingState.status === 'paused' ? 'bg-amber-500' : 'bg-gray-400'
            }`} />
            <span className="font-mono">{formatTime(recordingState.elapsedSeconds)}</span>
            <span className="text-gray-400">•</span>
            <span>{recordingState.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-gray-100"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              )}
            </svg>
          </button>
          <button
            onClick={toggleDock}
            className="p-1 rounded hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* One-click marker buttons - always enabled */}
          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={() => void handleAddCapture('question')}
              className="px-2 py-3 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 active:scale-95 transition-transform"
              title="Something not yet understood"
            >
              ❓
            </button>
            <button
              onClick={() => void handleAddCapture('friction')}
              className="px-2 py-3 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 active:scale-95 transition-transform"
              title="Something that makes work harder"
            >
              ⚠️
            </button>
            <button
              onClick={() => void handleAddCapture('decision')}
              className="px-2 py-3 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 active:scale-95 transition-transform"
              title="A decision made during session"
            >
              ✅
            </button>
            <button
              onClick={() => void handleAddCapture('observation')}
              className="px-2 py-3 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 active:scale-95 transition-transform"
              title="Something important noticed"
            >
              👁
            </button>
            <button
              onClick={() => void handleAddCapture('action')}
              className="px-2 py-3 rounded-lg bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 active:scale-95 transition-transform"
              title="Something to do after session"
            >
              ➜
            </button>
          </div>

          {/* Optional text input - for adding context after marking */}
          <textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            className="w-full min-h-16 px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-gray-400"
            placeholder="Optional: Add context to your last marker..."
          />

          {notice && (
            <div className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm">
              {notice}
            </div>
          )}

          {recentCaptures.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Recent Captures</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {recentCaptures.map((capture) => (
                  <div key={capture.id} className="p-2 rounded-lg bg-gray-50 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-white font-medium ${
                        capture.type === 'question' ? 'bg-blue-500' :
                        capture.type === 'friction' ? 'bg-amber-500' :
                        capture.type === 'decision' ? 'bg-green-500' :
                        capture.type === 'observation' ? 'bg-purple-500' : 'bg-sky-500'
                      }`}>
                        {capture.type === 'question' ? '❓' :
                         capture.type === 'friction' ? '⚠️' :
                         capture.type === 'decision' ? '✅' :
                         capture.type === 'observation' ? '👁' : '➜'} {capture.type}
                      </span>
                      <span className="text-gray-500 font-mono">{formatTime(capture.timestamp)}</span>
                    </div>
                    <p className="text-gray-700">{capture.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
