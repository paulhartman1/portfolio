import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'
import { acceptCandidate, rejectCandidate } from '@/lib/project-intelligence/accept'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id: transcriptId, candidateId } = await params

  let statementOverride: string | null = null
  try {
    const body = await request.json()
    statementOverride = body?.statement != null ? String(body.statement) : null
  } catch {
    statementOverride = null
  }

  const result = await acceptCandidate(admin.supabase, {
    candidateId,
    transcriptId,
    reviewedBy: admin.user.id,
    statementOverride,
  })

  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : result.code === 'not_pending' ? 409 : 500
    return NextResponse.json({ error: result.reason }, { status })
  }

  return NextResponse.json({ acceptedObservationId: result.acceptedObservationId })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id: transcriptId, candidateId } = await params

  const result = await rejectCandidate(admin.supabase, {
    candidateId,
    transcriptId,
    reviewedBy: admin.user.id,
  })
  if (!result.ok) return NextResponse.json({ error: result.reason || 'Reject failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}