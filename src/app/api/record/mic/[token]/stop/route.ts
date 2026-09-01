import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { hashPairingToken } from '@/lib/recordings/mic-pairing'

// Phone tapped "Stop Microphone" (voluntarily, independent of the desktop).
// This does NOT end the overall recording -- the desktop's screen capture
// keeps going, and already-uploaded phone audio remains valid. It just
// marks this pairing disconnected so the desktop can show
// "Phone disconnected" and, if the user wants, generate a fresh QR code.
//
// Deliberately tolerant of an already-invalid token (expired/revoked): the
// phone may be calling this during/after the recording ending anyway.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const serviceRole = createServiceRoleClient()
  const tokenHash = hashPairingToken(token)

  const { error } = await serviceRole
    .from('engagement_mic_pairings')
    .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .in('status', ['pending', 'opened', 'permission_pending', 'active'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
