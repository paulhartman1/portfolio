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
