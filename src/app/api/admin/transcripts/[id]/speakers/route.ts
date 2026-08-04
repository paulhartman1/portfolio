import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const { id } = await params
  const serviceRole = createServiceRoleClient()
  const { data, error } = await serviceRole
    .from('engagement_transcript_speaker_clusters')
    .select('id, provider_speaker_key, display_label, first_appearance_seconds, last_appearance_seconds, utterance_count, total_speaking_duration, engagement_speaker_identity_assignments(id, person_id, assignment_method, confirmation_state, assigned_by, assigned_at, notes, persons(id, display_name, company, title, email))')
    .eq('transcript_id', id)
    .order('first_appearance_seconds')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clusters: data || [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const { id } = await params
  const body = await request.json()
  const clusterId = body.cluster_id?.toString()
  const personId = body.person_id?.toString()
  if (!clusterId || !personId) return NextResponse.json({ error: 'cluster_id and person_id are required' }, { status: 400 })

  const serviceRole = createServiceRoleClient()
  const { data: cluster } = await serviceRole.from('engagement_transcript_speaker_clusters').select('id').eq('id', clusterId).eq('transcript_id', id).single()
  if (!cluster) return NextResponse.json({ error: 'Speaker cluster not found' }, { status: 404 })
  const { data: person } = await serviceRole.from('persons').select('id').eq('id', personId).single()
  if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

  const { data: current } = await serviceRole.from('engagement_speaker_identity_assignments').select('id').eq('speaker_cluster_id', clusterId).is('superseded_at', null).maybeSingle()
  if (current) await serviceRole.from('engagement_speaker_identity_assignments').update({ superseded_at: new Date().toISOString() }).eq('id', current.id)
  const { data: assignment, error } = await serviceRole.from('engagement_speaker_identity_assignments').insert({ speaker_cluster_id: clusterId, person_id: personId, assignment_method: 'manual_confirmation', confirmation_state: 'confirmed', assigned_by: admin.user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignment })
}
