import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthContext } from '@/lib/chorale/auth'

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
  const trackIds = Array.isArray(body.track_ids)
    ? body.track_ids.map((item: unknown) => String(item).trim()).filter(Boolean)
    : []

  if (!performanceId || trackIds.length === 0) {
    return NextResponse.json(
      { error: 'performance_id and non-empty track_ids are required' },
      { status: 400 }
    )
  }

  const { data: existingTracks, error: lookupError } = await supabase
    .from('rehearsal_tracks')
    .select('id')
    .eq('performance_id', performanceId)
    .in('id', trackIds)

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 400 })
  }

  if ((existingTracks || []).length !== trackIds.length) {
    return NextResponse.json(
      { error: 'One or more tracks were not found for this performance' },
      { status: 400 }
    )
  }

  for (let index = 0; index < trackIds.length; index += 1) {
    const trackId = trackIds[index]
    const { error } = await supabase
      .from('rehearsal_tracks')
      .update({
        sort_order: index,
        updated_by: user.id,
      })
      .eq('id', trackId)
      .eq('performance_id', performanceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}
