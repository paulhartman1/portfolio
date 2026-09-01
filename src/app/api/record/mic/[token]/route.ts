import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { validateMicPairingToken } from '@/lib/recordings/mic-pairing'

// Public, unauthenticated (token-scoped) endpoint the phone page calls on
// load. Returns the *minimum* needed to render the phone UI -- the
// recording's title -- and nothing about the project, client, or any other
// CGT data. This is the only "read" surface the phone has into CGT.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const serviceRole = createServiceRoleClient()
  const result = await validateMicPairingToken(serviceRole, token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (result.pairing.status === 'pending') {
    await serviceRole
      .from('engagement_mic_pairings')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', result.pairing.id)
  }

  return NextResponse.json({
    recording_title: result.recording.title,
    status: result.pairing.status === 'pending' ? 'opened' : result.pairing.status,
  })
}
