import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireAdminMock = vi.fn()

vi.mock('./_lib', () => ({
  requireAdmin: () => requireAdminMock(),
}))

describe('POST /api/admin/recordings', () => {
  beforeEach(() => {
    requireAdminMock.mockReset()
  })

  it('returns 400 when required fields are missing', async () => {
    requireAdminMock.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1' },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/recordings', {
      method: 'POST',
      body: JSON.stringify({
        project_id: 'project-1',
        title: 'Session',
        session_type: 'discovery',
        consent_given: false,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    if (!res) {
      throw new Error('Expected response')
    }
    expect(res.status).toBe(400)
  })

  it('creates a recording when payload is valid', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'rec-1',
        project_id: 'project-1',
        title: 'Session',
        session_type: 'discovery',
        status: 'recording',
        started_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })

    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const insertMock = vi.fn().mockReturnValue({ select: selectMock })

    requireAdminMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {
        from: vi.fn().mockReturnValue({
          insert: insertMock,
        }),
      },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/recordings', {
      method: 'POST',
      body: JSON.stringify({
        project_id: 'project-1',
        title: 'Session',
        session_type: 'discovery',
        consent_given: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    if (!res) {
      throw new Error('Expected response')
    }
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recording.id).toBe('rec-1')
    expect(insertMock).toHaveBeenCalled()
  })
})

describe('GET /api/admin/recordings', () => {
  beforeEach(() => {
    requireAdminMock.mockReset()
  })

  it('returns 400 when project_id is missing', async () => {
    requireAdminMock.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1' },
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/recordings')

    const res = await GET(req)
    if (!res) {
      throw new Error('Expected response')
    }
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('project_id')
  })

  it('returns recordings with grouped markers', async () => {
    const recordings = [
      {
        id: 'rec-1',
        project_id: 'project-1',
        title: 'Session A',
        session_type: 'discovery',
        status: 'finalized',
        started_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'rec-2',
        project_id: 'project-1',
        title: 'Session B',
        session_type: 'review',
        status: 'recording',
        started_at: '2026-01-02T00:00:00Z',
      },
    ]

    const markers = [
      {
        id: 'note-1',
        recording_id: 'rec-1',
        note_type: 'question',
        note_text: null,
        timestamp_seconds: 5,
        created_at: '2026-01-01T00:00:10Z',
      },
      {
        id: 'note-2',
        recording_id: 'rec-1',
        note_type: 'observation',
        note_text: 'Saw a pattern',
        timestamp_seconds: 14,
        created_at: '2026-01-01T00:00:20Z',
      },
    ]

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'engagement_recordings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: recordings, error: null }),
            }),
          }),
        }
      }
      if (table === 'engagement_session_notes') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: markers, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    requireAdminMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: fromMock },
    })

    const { GET } = await import('./route')
    const req = new NextRequest(
      'http://localhost/api/admin/recordings?project_id=project-1'
    )

    const res = await GET(req)
    if (!res) {
      throw new Error('Expected response')
    }
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recordings).toHaveLength(2)
    expect(body.recordings[1].title).toBe('Session B')
    expect(body.recordings[0].markers).toHaveLength(2)
    expect(body.recordings[0].markers[0].id).toBe('note-1')
    expect(body.recordings[1].markers).toHaveLength(0)
  })

  it('returns an empty recordings array when none exist', async () => {
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })

    requireAdminMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: fromMock },
    })

    const { GET } = await import('./route')
    const req = new NextRequest(
      'http://localhost/api/admin/recordings?project_id=project-1'
    )

    const res = await GET(req)
    if (!res) {
      throw new Error('Expected response')
    }
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recordings).toEqual([])
  })
})
