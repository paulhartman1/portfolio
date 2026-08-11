import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'
import { AnalyzeError, analyzeTranscriptForProject } from '@/lib/project-intelligence/analyze'

export const maxDuration = 300

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id: transcriptId } = await params
  let projectId: string | undefined
  try {
    const body = await request.json()
    projectId = body?.projectId?.toString()
  } catch {
    projectId = undefined
  }

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required for project-scoped analysis' }, { status: 400 })
  }

  console.log('[project-intelligence] route:analyze:request', JSON.stringify({ transcriptId, projectId }))
  try {
    const candidates = await analyzeTranscriptForProject({ projectId, transcriptId })
    console.log('[project-intelligence] route:analyze:response', JSON.stringify({ transcriptId, candidates: candidates.length }))
    return NextResponse.json({ candidates })
  } catch (error) {
    if (error instanceof AnalyzeError) {
      console.warn('[project-intelligence] route:analyze:error', JSON.stringify({ transcriptId, code: error.code, message: error.message }))
      const status =
        error.code === 'transcript_not_found' ? 404
        : error.code === 'project_mismatch' ? 403
        : error.code === 'model_unavailable' ? 503
        : error.code === 'provider_failure' ? 502
        : 502
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('[project-intelligence] analyze failed', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}