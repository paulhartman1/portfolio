import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_lib'
import { assembleRecording } from '../../_assembly'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return admin.error
  }

  const { id } = await params
  
  // Transition status to upload_complete
  const { error: updateError } = await admin.supabase
    .from('engagement_recordings')
    .update({ 
      pipeline_status: 'upload_complete',
      upload_completed_at: new Date().toISOString()
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Start assembly
  const result = await assembleRecording(id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    revision: result.revision,
  })
}
