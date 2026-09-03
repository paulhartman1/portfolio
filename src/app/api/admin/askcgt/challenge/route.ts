import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'
import { AskCgtError } from '@/lib/askcgt/ask'
import { reconsiderConclusion } from '@/lib/askcgt/reconsider'
import { parseCitations } from '@/lib/askcgt/review'
import { ConclusionKind } from '@/lib/askcgt/types'

export const maxDuration = 300

const MAX_BODY_CHARS = 64_000

/**
 * POST /api/admin/askcgt/challenge
 *
 * Re-examines ONE conclusion against Paul's objection and the same complete
 * evidence the original analysis had.
 *
 * PERSISTS NOTHING. The result is a revised proposal that Paul must still
 * accept explicitly through /accept before it becomes organizational
 * knowledge. The challenge text is untrusted and is fenced in the prompt.
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
    const result = await reconsiderConclusion({
      supabase: admin.supabase,
      projectId,
      experimentId,
      originalStatement: String(body.originalStatement ?? ''),
      originalKind: String(body.originalKind ?? '') as ConclusionKind,
      originalCitations: parseCitations(body.originalCitations),
      challenge: String(body.challenge ?? ''),
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AskCgtError) {
      const status =
        error.code === 'invalid_input' ? 400
        : error.code === 'project_not_found' ? 404
        : error.code === 'experiment_not_found' ? 404
        : error.code === 'model_unavailable' ? 503
        : 502
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('[askcgt:challenge] unexpected', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Reconsideration failed' }, { status: 500 })
  }
}
