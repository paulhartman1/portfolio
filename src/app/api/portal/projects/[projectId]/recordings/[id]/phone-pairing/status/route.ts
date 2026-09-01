import { NextResponse } from 'next/server'
import { requireProjectAccess } from '../../../../../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await params
  const access = await requireProjectAccess(projectId)
  if ('error' in access) return access.error

  const serviceRole = createServiceRoleClient()
  const { data, error } = await serviceRole
    .from('engagement_mic_pairings')
    .select('status, last_seen_at, expires_at, error_message')
    .eq('recording_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Pairing not found' }, { status: 404 })

  const stale = data.status === 'active' && data.last_seen_at && Date.now() - new Date(data.last_seen_at).getTime() > 20000
  return NextResponse.json({ ...data, status: stale ? 'disconnected' : data.status })
}
