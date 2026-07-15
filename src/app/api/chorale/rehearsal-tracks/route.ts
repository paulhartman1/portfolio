import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthContext } from '@/lib/chorale/auth'
import { CHORALE_AUDIO_BUCKET } from '@/lib/chorale/streaming'

const TRACK_SELECT_FIELDS =
  'id, performance_id, title, description, composer, duration_seconds, sort_order, is_published, mime_type, created_at, updated_at'

export async function GET(request: NextRequest) {
  const { user, isAdmin, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const search = request.nextUrl.searchParams.get('search')?.trim()
  const performanceId = request.nextUrl.searchParams.get('performanceId')?.trim()
  const includeUnpublished = request.nextUrl.searchParams.get('includeUnpublished') === 'true'

  let query = supabase
    .from('rehearsal_tracks')
    .select(TRACK_SELECT_FIELDS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (performanceId) {
    query = query.eq('performance_id', performanceId)
  }

  if (!isAdmin || !includeUnpublished) {
    query = query.eq('is_published', true)
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,composer.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tracks: data || [] })
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
  const performanceId = String(body.performance_id || '').trim()
  const title = String(body.title || '').trim()
  const storageObjectPath = String(body.storage_object_path || '').trim()

  if (!performanceId || !title || !storageObjectPath) {
    return NextResponse.json(
      { error: 'performance_id, title, and storage_object_path are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('rehearsal_tracks')
    .insert({
      performance_id: performanceId,
      title,
      description: body.description ? String(body.description).trim() : null,
      composer: body.composer ? String(body.composer).trim() : null,
      duration_seconds: Number.isInteger(body.duration_seconds) ? Number(body.duration_seconds) : null,
      sort_order: Number.isInteger(body.sort_order) ? Number(body.sort_order) : 0,
      is_published: Boolean(body.is_published),
      storage_bucket: CHORALE_AUDIO_BUCKET,
      storage_object_path: storageObjectPath,
      mime_type: body.mime_type ? String(body.mime_type).trim() : null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(TRACK_SELECT_FIELDS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ track: data }, { status: 201 })
}
