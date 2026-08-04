import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const { id } = await params
  const search = new URL(request.url).searchParams.get('search')?.trim() || ''
  const serviceRole = createServiceRoleClient()
  const [{ data: projectPeople, error: projectPeopleError }, { data: projectClients, error: projectClientsError }] = await Promise.all([
    serviceRole.from('project_persons').select('source, created_at, persons(id, display_name, company, title, email)').eq('project_id', id).order('created_at', { ascending: true }),
    serviceRole.from('project_clients').select('created_at, profiles:client_id(id, display_name, company, email)').eq('project_id', id).order('created_at', { ascending: true }),
  ])
  if (projectPeopleError || projectClientsError) return NextResponse.json({ error: projectPeopleError?.message || projectClientsError?.message }, { status: 500 })

  const peopleById = new Map<string, { id: string; display_name: string; company: string | null; title: string | null; email: string | null }>()
  for (const row of projectPeople || []) {
    const person = Array.isArray(row.persons) ? row.persons[0] : row.persons
    if (person) peopleById.set(person.id, person)
  }
  for (const row of projectClients || []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    if (!profile) continue
    const { data: person } = await serviceRole.from('persons').select('id, display_name, company, title, email').eq('profile_id', profile.id).maybeSingle()
    if (person) peopleById.set(person.id, person)
  }
  const people = [...peopleById.values()].filter((person) => !search || `${person.display_name} ${person.company || ''} ${person.title || ''}`.toLowerCase().includes(search.toLowerCase()))
  return NextResponse.json({ people })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const { id } = await params
  const body = await request.json()
  const displayName = body.display_name?.toString().trim()
  if (!displayName) return NextResponse.json({ error: 'display_name is required' }, { status: 400 })
  const serviceRole = createServiceRoleClient()
  const { data: person, error: personError } = await serviceRole.from('persons').insert({ display_name: displayName, company: body.company?.toString().trim() || null, title: body.title?.toString().trim() || null, created_by: admin.user.id }).select().single()
  if (personError) return NextResponse.json({ error: personError.message }, { status: 500 })
  const { error: associationError } = await serviceRole.from('project_persons').insert({ project_id: id, person_id: person.id, source: 'manual', created_by: admin.user.id })
  if (associationError) return NextResponse.json({ error: associationError.message }, { status: 500 })
  return NextResponse.json({ person })
}
