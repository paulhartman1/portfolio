import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthContext } from '@/lib/chorale/auth'
import { CHORALE_AUDIO_BUCKET } from '@/lib/chorale/streaming'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

const TRACK_SELECT_FIELDS =
  'id, performance_id, title, description, composer, duration_seconds, sort_order, is_published, mime_type, created_at, updated_at'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, isAdmin, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let query = supabase.from('rehearsal_tracks').select(TRACK_SELECT_FIELDS).eq('id', id)

  if (!isAdmin) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  return NextResponse.json({ track: data })
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

  if (body.performance_id !== undefined) {
    const performanceId = String(body.performance_id).trim()
    if (!performanceId) {
      return NextResponse.json({ error: 'performance_id cannot be empty' }, { status: 400 })
    }
    payload.performance_id = performanceId
  }

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    }
    payload.title = title
  }

  if (body.description !== undefined) {
    payload.description = body.description ? String(body.description).trim() : null
  }

  if (body.composer !== undefined) {
    payload.composer = body.composer ? String(body.composer).trim() : null
  }

  if (body.duration_seconds !== undefined) {
    if (body.duration_seconds !== null && !Number.isInteger(body.duration_seconds)) {
      return NextResponse.json({ error: 'duration_seconds must be an integer or null' }, { status: 400 })
    }
    payload.duration_seconds =
      body.duration_seconds === null ? null : Number(body.duration_seconds)
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

  if (body.storage_object_path !== undefined) {
    const path = String(body.storage_object_path).trim()
    if (!path) {
      return NextResponse.json({ error: 'storage_object_path cannot be empty' }, { status: 400 })
    }
    payload.storage_object_path = path
    payload.storage_bucket = CHORALE_AUDIO_BUCKET
  }

  if (body.mime_type !== undefined) {
    payload.mime_type = body.mime_type ? String(body.mime_type).trim() : null
  }

  if (Object.keys(payload).length === 1) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('rehearsal_tracks')
    .update(payload)
    .eq('id', id)
    .select(TRACK_SELECT_FIELDS)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Track not found' }, { status: 400 })
  }

  return NextResponse.json({ track: data })
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

  const { data: existing, error: lookupError } = await supabase
    .from('rehearsal_tracks')
    .select('id, storage_object_path')
    .eq('id', id)
    .single()

  if (lookupError || !existing) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  const serviceRole = createServiceRoleClient()
  const { error: storageDeleteError } = await serviceRole.storage
    .from(CHORALE_AUDIO_BUCKET)
    .remove([existing.storage_object_path])

  if (storageDeleteError) {
    return NextResponse.json({ error: storageDeleteError.message }, { status: 500 })
  }

  const { error } = await supabase.from('rehearsal_tracks').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
