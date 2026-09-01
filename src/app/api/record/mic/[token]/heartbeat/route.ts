import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { validateMicPairingToken } from '@/lib/recordings/mic-pairing'

const ALLOWED_STATUSES = new Set(['permission_pending', 'active', 'error'])

// Lightweight liveness + intermediate-status signal from the phone (mic
// permission requested, permission denied, still recording, etc). The
// desktop derives "Phone disconnected" itself by comparing last_seen_at
// against wall-clock time -- no server-side cron/polling job needed.
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
  const requestedStatus = body.status?.toString()
  const errorMessage = body.error_message?.toString()?.slice(0, 500) ?? null

  const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() }
  if (requestedStatus && ALLOWED_STATUSES.has(requestedStatus)) {
    update.status = requestedStatus
    if (requestedStatus === 'error') {
      update.error_message = errorMessage
    }
  }

  const { error } = await serviceRole
    .from('engagement_mic_pairings')
    .update(update)
    .eq('id', result.pairing.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
