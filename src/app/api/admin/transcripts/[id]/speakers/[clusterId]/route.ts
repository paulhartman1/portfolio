import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; clusterId: string }> }) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const { id, clusterId } = await params
  const serviceRole = createServiceRoleClient()
  const { data: cluster } = await serviceRole.from('engagement_transcript_speaker_clusters').select('id').eq('id', clusterId).eq('transcript_id', id).single()
  if (!cluster) return NextResponse.json({ error: 'Speaker cluster not found' }, { status: 404 })
  const { error } = await serviceRole.from('engagement_speaker_identity_assignments').update({ superseded_at: new Date().toISOString() }).eq('speaker_cluster_id', clusterId).is('superseded_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
