import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthContext } from '@/lib/chorale/auth'

const PERFORMANCE_SELECT_FIELDS =
  'id, title, description, performance_date, sort_order, is_published, created_at, updated_at'

export async function GET(request: NextRequest) {
  const { user, isAdmin, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const search = request.nextUrl.searchParams.get('search')?.trim()
  const includeUnpublished = request.nextUrl.searchParams.get('includeUnpublished') === 'true'

  let query = supabase
    .from('performances')
    .select(PERFORMANCE_SELECT_FIELDS)
    .order('sort_order', { ascending: true })
    .order('performance_date', { ascending: false })

  if (!isAdmin || !includeUnpublished) {
    query = query.eq('is_published', true)
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ performances: data || [] })
}

export async function POST(request: NextRequest) {
  const { user, isAdmin, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const title = String(body.title || '').trim()

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const payload = {
    title,
    description: body.description ? String(body.description).trim() : null,
    performance_date: body.performance_date ? String(body.performance_date) : null,
    sort_order: Number.isInteger(body.sort_order) ? Number(body.sort_order) : 0,
    is_published: Boolean(body.is_published),
    created_by: user.id,
    updated_by: user.id,
  }

  const { data, error } = await supabase
    .from('performances')
    .insert(payload)
    .select(PERFORMANCE_SELECT_FIELDS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ performance: data }, { status: 201 })
}
