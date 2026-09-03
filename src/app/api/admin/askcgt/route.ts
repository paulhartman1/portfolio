import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'
import { AskCgtError, askCgt } from '@/lib/askcgt/ask'

export const maxDuration = 300

/**
 * POST /api/admin/askcgt
 *
 * AskCGT entry point. Requires an admin session (internal use, like the
 * existing project-intelligence routes). Authorization is enforced here AND
 * again inside retrieval, which uses the caller's RLS-enforced client scoped
 * by project_id — the model never receives evidence the authenticated user
 * could not retrieve.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  let projectId: string | undefined
  let question: string | undefined
  let experimentId: string | undefined
  try {
    const body = await request.json()
    projectId = body?.projectId?.toString()
    question = body?.question?.toString()
    // Optional. When present, retrieval verifies it belongs to projectId.
    experimentId = body?.experimentId ? body.experimentId.toString() : undefined
  } catch {
    projectId = undefined
    question = undefined
    experimentId = undefined
  }

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  try {
    const result = await askCgt({
      supabase: admin.supabase,
      projectId,
      question: question || '',
      experimentId: experimentId || null,
    })
    return NextResponse.json({ ...result })
  } catch (error) {
    if (error instanceof AskCgtError) {
      const status =
        error.code === 'invalid_input' ? 400
        : error.code === 'project_not_found' ? 404
        : error.code === 'experiment_not_found' ? 404
        : error.code === 'model_unavailable' ? 503
        : error.code === 'provider_failure' ? 502
        : 502
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('[askcgt] route:unexpected', error)
    return NextResponse.json({ error: 'AskCGT failed' }, { status: 500 })
  }
}