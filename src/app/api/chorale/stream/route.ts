import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthContext } from '@/lib/chorale/auth'
import { createChoraleStreamSignedUrl } from '@/lib/chorale/streaming'

export async function POST(request: NextRequest) {
  const { user, supabase } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const trackId = String(body.track_id || '').trim()

  if (!trackId) {
    return NextResponse.json({ error: 'track_id is required' }, { status: 400 })
  }

  const { data: track, error } = await supabase
    .from('rehearsal_tracks')
    .select('id, storage_object_path')
    .eq('id', trackId)
    .single()

  if (error || !track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  try {
    const signedStream = await createChoraleStreamSignedUrl(track.storage_object_path)
    return NextResponse.json({
      track_id: track.id,
      stream: signedStream,
    })
  } catch (streamError) {
    return NextResponse.json({ error: (streamError as Error).message }, { status: 500 })
  }
}
