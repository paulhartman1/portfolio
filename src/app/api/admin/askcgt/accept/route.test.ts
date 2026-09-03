import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Authorization and untrusted-input handling on the acceptance route.
 *
 * The route is the boundary where a client-supplied claim becomes durable
 * organizational knowledge, so the two properties under test are: only an
 * authenticated admin can reach it, and the reviewer identity comes from the
 * session rather than the payload.
 */

const requireAdminMock = vi.fn()
const acceptConclusionMock = vi.fn()

vi.mock('@/app/api/admin/recordings/_lib', () => ({
  requireAdmin: () => requireAdminMock(),
}))

vi.mock('@/lib/askcgt/review', async () => {
  const actual = await vi.importActual<typeof import('@/lib/askcgt/review')>('@/lib/askcgt/review')
  return {
    ...actual,
    acceptConclusion: (request: unknown) => acceptConclusionMock(request),
  }
})

const SUPABASE = { marker: 'rls-scoped-client' }
const ADMIN_ID = 'admin-session-user'

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/askcgt/accept', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Invokes the route and asserts a response was produced. */
async function call(body: unknown): Promise<Response> {
  const { POST } = await import('./route')
  const res = await POST(post(body))
  if (!res) throw new Error('Expected the route to return a response')
  return res
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'project-1',
    experimentId: 'experiment-1',
    proposedStatement: 'A claim.',
    acceptedStatement: 'A claim.',
    epistemicType: 'inference',
    citations: [],
    ...overrides,
  }
}

beforeEach(() => {
  requireAdminMock.mockReset()
  acceptConclusionMock.mockReset()
  acceptConclusionMock.mockResolvedValue({
    findingId: 'finding-1',
    reviewStatus: 'accepted',
    citationsPersisted: 0,
    wasEdited: false,
  })
})

describe('authorization', () => {
  it('rejects an unauthenticated caller with 401 and never writes', async () => {
    requireAdminMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
        const res = await call(validBody())
    expect(res.status).toBe(401)
    expect(acceptConclusionMock).not.toHaveBeenCalled()
  })

  it('rejects a non-admin caller with 403 and never writes', async () => {
    requireAdminMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403 }),
    })
        const res = await call(validBody())
    expect(res.status).toBe(403)
    expect(acceptConclusionMock).not.toHaveBeenCalled()
  })

  it('passes the caller\'s RLS-scoped client through, not a service-role client', async () => {
    requireAdminMock.mockResolvedValue({ supabase: SUPABASE, user: { id: ADMIN_ID } })
        await call(validBody())
    expect(acceptConclusionMock.mock.calls[0][0].supabase).toBe(SUPABASE)
  })

  // The reviewer must be auditably the authenticated human.
  it('takes the reviewer identity from the session and ignores any in the payload', async () => {
    requireAdminMock.mockResolvedValue({ supabase: SUPABASE, user: { id: ADMIN_ID } })
        await call(validBody({ reviewerId: 'attacker-supplied', reviewed_by: 'attacker-supplied' }))
    expect(acceptConclusionMock.mock.calls[0][0].reviewerId).toBe(ADMIN_ID)
  })
})

describe('input validation', () => {
  beforeEach(() => {
    requireAdminMock.mockResolvedValue({ supabase: SUPABASE, user: { id: ADMIN_ID } })
  })

  it('requires projectId and experimentId', async () => {
        expect((await call({ ...validBody(), projectId: undefined })).status).toBe(400)
    expect((await call({ ...validBody(), experimentId: undefined })).status).toBe(400)
    expect(acceptConclusionMock).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
        expect((await call('{not json')).status).toBe(400)
  })

  it('rejects a non-object body', async () => {
        expect((await call([1, 2, 3])).status).toBe(400)
  })

  it('rejects an oversized body with 413', async () => {
        const res = await call(validBody({ acceptedStatement: 'x'.repeat(70_000) }))
    expect(res.status).toBe(413)
    expect(acceptConclusionMock).not.toHaveBeenCalled()
  })
})

describe('error mapping', () => {
  beforeEach(() => {
    requireAdminMock.mockResolvedValue({ supabase: SUPABASE, user: { id: ADMIN_ID } })
  })

  it('maps invalid citations to 409 and includes which ones failed', async () => {
    const { AskCgtReviewError } = await import('@/lib/askcgt/review')
    acceptConclusionMock.mockRejectedValue(
      new AskCgtReviewError('invalid_citations', '1 citation(s) are no longer valid', {
        rejected: [{ type: 'marker', id: 'bogus' }],
      })
    )
        const res = await call(validBody())
    expect(res.status).toBe(409)
    const payload = await res.json()
    expect(payload.code).toBe('invalid_citations')
    expect(payload.details.rejected).toHaveLength(1)
  })

  it('maps duplicate acceptance to 409', async () => {
    const { AskCgtReviewError } = await import('@/lib/askcgt/review')
    acceptConclusionMock.mockRejectedValue(
      new AskCgtReviewError('already_accepted', 'This conclusion has already been accepted')
    )
        expect((await call(validBody())).status).toBe(409)
  })

  it('maps a cross-project experiment to 404', async () => {
    const { AskCgtReviewError } = await import('@/lib/askcgt/review')
    acceptConclusionMock.mockRejectedValue(
      new AskCgtReviewError('experiment_not_found', 'does not belong to this project')
    )
        expect((await call(validBody())).status).toBe(404)
  })

  // A failed write must never be reported as a success.
  it('reports a write failure as 500 without a findingId', async () => {
    const { AskCgtReviewError } = await import('@/lib/askcgt/review')
    acceptConclusionMock.mockRejectedValue(new AskCgtReviewError('write_failed', 'db down'))
        const res = await call(validBody())
    expect(res.status).toBe(500)
    expect((await res.json()).findingId).toBeUndefined()
  })

  it('does not leak the claim text or evidence in an unexpected error response', async () => {
    acceptConclusionMock.mockRejectedValue(new Error('secret evidence detail leaked here'))
        const res = await call(validBody({ acceptedStatement: 'sensitive claim text' }))
    const payload = await res.json()
    expect(res.status).toBe(500)
    expect(JSON.stringify(payload)).not.toContain('sensitive claim text')
    expect(JSON.stringify(payload)).not.toContain('secret evidence detail')
  })
})

describe('success', () => {
  it('returns the durable finding id only after the write succeeded', async () => {
    requireAdminMock.mockResolvedValue({ supabase: SUPABASE, user: { id: ADMIN_ID } })
        const res = await call(validBody())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ findingId: 'finding-1', reviewStatus: 'accepted' })
  })
})
