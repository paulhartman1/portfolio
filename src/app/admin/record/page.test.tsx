import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  },
}))

vi.mock('@/utils/supabase/client', () => ({
  supabaseBrowser: supabaseMock,
}))

vi.mock('@/contexts/EngagementSessionContext', () => ({
  useEngagementSession: () => ({
    setActiveSession: vi.fn(),
    setRecordingState: vi.fn(),
    addCapture: vi.fn(),
    recentCaptures: [],
  }),
}))

describe('AdminRecordPage', () => {
  beforeEach(() => {
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
  })

  it('renders the recording page shell', () => {
    vi.stubGlobal('React', React)

    return import('./page').then(({ default: AdminRecordPage }) => {
      render(<AdminRecordPage />)

      expect(screen.getByRole('heading', { name: 'Engagement Recorder' })).toBeInTheDocument()
    })
  })
})
