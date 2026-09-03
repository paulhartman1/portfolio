import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'
import { AskCgtReviewError, acceptConclusion, parseCitations } from '@/lib/askcgt/review'
import { ConclusionKind } from '@/lib/askcgt/types'

export const maxDuration = 60

const MAX_BODY_CHARS = 64_000

/**
 * POST /api/admin/askcgt/accept
 *
 * Commits ONE reviewed AskCGT conclusion as a durable experiment finding.
 *
 * Everything in the body is untrusted. The reviewer identity comes from the
 * authenticated session, never from the request, and every citation is
 * re-validated server-side against evidence re-retrieved through the caller's
 * own RLS-scoped client before anything is written.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  let body: Record<string, unknown>
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad shape')
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId : ''
  const experimentId = typeof body.experimentId === 'string' ? body.experimentId : ''
  if (!projectId || !experimentId) {
    return NextResponse.json({ error: 'projectId and experimentId are required' }, { status: 400 })
  }

  try {
    const result = await acceptConclusion({
      supabase: admin.supabase,
      // Reviewer identity is taken from the session, never the payload.
      reviewerId: admin.user.id,
      projectId,
      experimentId,
      proposedStatement: String(body.proposedStatement ?? ''),
      acceptedStatement: String(body.acceptedStatement ?? ''),
      proposedInterpretation:
        typeof body.proposedInterpretation === 'string' ? body.proposedInterpretation : null,
      acceptedInterpretation:
        typeof body.acceptedInterpretation === 'string' ? body.acceptedInterpretation : null,
      epistemicType: String(body.epistemicType ?? '') as ConclusionKind,
      proposedConfidence: typeof body.proposedConfidence === 'number' ? body.proposedConfidence : null,
      citations: parseCitations(body.citations),
      model: typeof body.model === 'string' ? body.model : null,
      provider: typeof body.provider === 'string' ? body.provider : null,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AskCgtReviewError) {
      const status =
        error.code === 'invalid_input' ? 400
        : error.code === 'project_not_found' ? 404
        : error.code === 'experiment_not_found' ? 404
        : error.code === 'invalid_citations' ? 409
        : error.code === 'already_accepted' ? 409
        : 500
      return NextResponse.json(
        { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) },
        { status }
      )
    }
    // Never log the evidence or the claim text itself.
    console.error('[askcgt:accept] unexpected', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Could not save the finding' }, { status: 500 })
  }
}
