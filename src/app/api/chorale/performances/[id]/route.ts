import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthContext } from '@/lib/chorale/auth'

const PERFORMANCE_SELECT_FIELDS =
  'id, title, description, performance_date, sort_order, is_published, created_at, updated_at'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, isAdmin, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let query = supabase.from('performances').select(PERFORMANCE_SELECT_FIELDS).eq('id', id)

  if (!isAdmin) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return NextResponse.json({ error: 'Performance not found' }, { status: 404 })
  }

  return NextResponse.json({ performance: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, isAdmin, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const payload: Record<string, string | number | boolean | null> = {
    updated_by: user.id,
  }

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    payload.title = title
  }

  if (body.description !== undefined) {
    payload.description = body.description ? String(body.description).trim() : null
  }

  if (body.performance_date !== undefined) {
    payload.performance_date = body.performance_date ? String(body.performance_date) : null
  }

  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order)) {
      return NextResponse.json({ error: 'sort_order must be an integer' }, { status: 400 })
    }
    payload.sort_order = Number(body.sort_order)
  }

  if (body.is_published !== undefined) {
    payload.is_published = Boolean(body.is_published)
  }

  if (Object.keys(payload).length === 1) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('performances')
    .update(payload)
    .eq('id', id)
    .select(PERFORMANCE_SELECT_FIELDS)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Performance not found' }, { status: 400 })
  }

  return NextResponse.json({ performance: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, isAdmin, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('performances').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
