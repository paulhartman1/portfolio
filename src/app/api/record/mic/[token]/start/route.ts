import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { validateMicPairingToken } from '@/lib/recordings/mic-pairing'

// Phone tapped "Start Microphone". Records both the phone's own clock
// (client_started_at, informational only) and the server's clock
// (server_started_at, authoritative) so screen-recording elapsed time and
// phone-audio elapsed time can later be correlated to roughly one second of
// precision without assuming the two devices' clocks agree.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const serviceRole = createServiceRoleClient()
  const result = await validateMicPairingToken(serviceRole, token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const body = await request.json().catch(() => ({}))
  const clientStartedAtMs = Number(body.client_started_at_ms)
  const serverStartedAt = new Date().toISOString()

  const { error } = await serviceRole
    .from('engagement_mic_pairings')
    .update({
      status: 'active',
      connected_at: result.pairing.connected_at ?? serverStartedAt,
      last_seen_at: serverStartedAt,
      server_started_at: serverStartedAt,
      phone_started_at: Number.isFinite(clientStartedAtMs)
        ? new Date(clientStartedAtMs).toISOString()
        : serverStartedAt,
      error_message: null,
    })
    .eq('id', result.pairing.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    recording_id: result.recording.id,
    server_time: serverStartedAt,
  })
}
