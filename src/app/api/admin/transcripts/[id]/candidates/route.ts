import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id: transcriptId } = await params

  const { data: candidates, error } = await admin.supabase
    .from('project_intelligence_candidates')
    .select('*, project_intelligence_candidate_evidence(*)')
    .eq('transcript_id', transcriptId)
    .in('status', ['candidate', 'accepted'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ candidates: candidates || [] })
}