import { NextResponse } from 'next/server'
import { requireAdmin } from '../../_lib'
import { transcribeRecording } from '../../_transcribe'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  const { id } = await params
  const result = await transcribeRecording(id)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
