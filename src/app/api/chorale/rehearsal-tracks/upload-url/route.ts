import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthContext } from '@/lib/chorale/auth'
import { createChoraleSignedUpload } from '@/lib/chorale/streaming'

export async function POST(request: NextRequest) {
  const { user, isAdmin } = await getRequestAuthContext(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const performanceId = String(body.performance_id || '').trim()
  const fileName = String(body.file_name || '').trim()

  if (!performanceId || !fileName) {
    return NextResponse.json(
      { error: 'performance_id and file_name are required' },
      { status: 400 }
    )
  }

  try {
    const signedUpload = await createChoraleSignedUpload({
      performanceId,
      originalFileName: fileName,
    })

    return NextResponse.json({ signedUpload })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
