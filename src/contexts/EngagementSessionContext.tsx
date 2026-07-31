'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import { usePathname } from 'next/navigation'

type SessionStatus = 'recording' | 'paused' | 'finalized' | 'failed'
type NoteType = 'question' | 'friction' | 'decision' | 'observation' | 'action'

type ActiveSession = {
  id: string
  projectId: string
  title: string
  status: SessionStatus
}

type RecordingState = {
  status: 'idle' | 'recording' | 'paused'
  elapsedSeconds: number
}

type PageContext = {
  path: string
  label: string
}

type Capture = {
  id: string
  type: NoteType
  text: string
  timestamp: number
  createdAt: string
}

type EngagementSessionContextValue = {
  activeSession: ActiveSession | null
  recordingState: RecordingState
  pageContext: PageContext
  recentCaptures: Capture[]
  dockVisible: boolean
  toggleDock: () => void
  addCapture: (noteType: NoteType, noteText: string) => Promise<void>
  setActiveSession: (session: ActiveSession | null) => void
  setRecordingState: (state: RecordingState) => void
}

const EngagementSessionContext = createContext<EngagementSessionContextValue | undefined>(undefined)

export function EngagementSessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>({ status: 'idle', elapsedSeconds: 0 })
  const [recentCaptures, setRecentCaptures] = useState<Capture[]>([])
  const [dockVisible, setDockVisible] = useState(true)
  const pathname = usePathname()

  const pageContext: PageContext = {
    path: pathname,
    label: pathname.split('/').filter(Boolean).pop() || 'home'
  }

  // Restore active session from database on mount
  useEffect(() => {
    void restoreActiveSession()
  }, [])

  async function restoreActiveSession() {
    const { data, error } = await supabaseBrowser
      .from('engagement_recordings')
      .select('id, project_id, title, status')
      .in('status', ['recording', 'paused'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Failed to restore active session:', error)
      return
    }

    if (data) {
      setActiveSession({
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        status: data.status as SessionStatus
      })
    }
  }

  // Load recent captures when active session changes
  useEffect(() => {
    if (!activeSession) {
      setRecentCaptures([])
      return
    }

    void loadRecentCaptures(activeSession.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id])

  async function loadRecentCaptures(recordingId: string) {
    const { data, error } = await supabaseBrowser
      .from('engagement_session_notes')
      .select('id, note_type, note_text, timestamp_seconds, created_at')
      .eq('recording_id', recordingId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Failed to load recent captures:', error)
      return
    }

    if (data) {
      setRecentCaptures(
        data.map((note) => ({
          id: note.id,
          type: note.note_type as NoteType,
          text: note.note_text,
          timestamp: note.timestamp_seconds,
          createdAt: note.created_at
        }))
      )
    }
  }

  const addCapture = useCallback(async (noteType: NoteType, noteText: string) => {
    if (!activeSession) {
      throw new Error('No active session')
    }

    const response = await fetch(`/api/admin/recordings/${activeSession.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_type: noteType,
        note_text: noteText.trim() || null,
        timestamp_seconds: recordingState.elapsedSeconds
      })
    })

    if (!response.ok) {
      const body = await response.json()
      throw new Error(body.error || 'Failed to save note')
    }

    // Reload recent captures
    await loadRecentCaptures(activeSession.id)
  }, [activeSession, recordingState.elapsedSeconds])

  const toggleDock = useCallback(() => {
    setDockVisible((prev) => !prev)
  }, [])

  return (
    <EngagementSessionContext.Provider
      value={{
        activeSession,
        recordingState,
        pageContext,
        recentCaptures,
        dockVisible,
        toggleDock,
        addCapture,
        setActiveSession,
        setRecordingState
      }}
    >
      {children}
    </EngagementSessionContext.Provider>
  )
}

export function useEngagementSession() {
  const context = useContext(EngagementSessionContext)
  if (!context) {
    throw new Error('useEngagementSession must be used within EngagementSessionProvider')
  }
  return context
}
