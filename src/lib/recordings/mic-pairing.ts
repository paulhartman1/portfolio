import { randomBytes, createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Shared pairing-token logic used by both the routes that create a pairing
// (admin/portal, authenticated) and the public routes the phone talks to
// (token-authenticated only). Keeping this in one place means the phone
// never gets a separate/parallel security model from the rest of the
// recorder -- it is the same recording, just a second contributing device.

export const PAIRING_TTL_MS = 15 * 60 * 1000 // must be opened + started within 15 minutes
const HEARTBEAT_STALE_MS = 20 * 1000 // no heartbeat/chunk in 20s => treat as disconnected client-side

export type MicPairingStatus =
  | 'pending'
  | 'opened'
  | 'permission_pending'
  | 'active'
  | 'disconnected'
  | 'revoked'
  | 'error'

export type MicPairingRow = {
  id: string
  recording_id: string
  token_hash: string
  status: MicPairingStatus
  created_by: string | null
  created_at: string
  expires_at: string
  opened_at: string | null
  connected_at: string | null
  last_seen_at: string | null
  disconnected_at: string | null
  revoked_at: string | null
  phone_started_at: string | null
  server_started_at: string | null
  error_message: string | null
}

export function generatePairingToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashPairingToken(token) }
}

export function hashPairingToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function pairingUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://cgt.loveondev.com'
  return `${base.replace(/\/$/, '')}/record/mic/${token}`
}

export function isPairingStale(pairing: Pick<MicPairingRow, 'status' | 'last_seen_at'>) {
  if (pairing.status !== 'active') return false
  if (!pairing.last_seen_at) return false
  return Date.now() - new Date(pairing.last_seen_at).getTime() > HEARTBEAT_STALE_MS
}

type ValidationSuccess = {
  ok: true
  pairing: MicPairingRow
  recording: { id: string; title: string; pipeline_status: string; mic_source: string }
}

type ValidationFailure = {
  ok: false
  status: number
  error: string
}

/**
 * Validates a raw pairing token from the phone. Looks up by hash only --
 * the raw token is never persisted. Also enforces that the parent recording
 * is still actively accepting audio (pipeline_status = 'recording'), so the
 * token automatically stops working the moment the recording is finalized,
 * cancelled, or otherwise ended -- no separate revocation step is required
 * for the "recording ended" case, though we also revoke explicitly for the
 * "user switched mic mode" case.
 */
export async function validateMicPairingToken(
  serviceRole: SupabaseClient,
  token: string
): Promise<ValidationSuccess | ValidationFailure> {
  if (!token || token.length < 16) {
    return { ok: false, status: 400, error: 'Invalid token' }
  }

  const tokenHash = hashPairingToken(token)

  const { data: pairing, error } = await serviceRole
    .from('engagement_mic_pairings')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  if (!pairing) {
    return { ok: false, status: 404, error: 'This link is invalid.' }
  }

  if (pairing.status === 'revoked') {
    return { ok: false, status: 410, error: 'This link has been revoked.' }
  }

  if (new Date(pairing.expires_at).getTime() < Date.now() && pairing.status !== 'active') {
    return { ok: false, status: 410, error: 'This link has expired.' }
  }

  const { data: recording, error: recordingError } = await serviceRole
    .from('engagement_recordings')
    .select('id, title, pipeline_status, mic_source')
    .eq('id', pairing.recording_id)
    .single()

  if (recordingError || !recording) {
    return { ok: false, status: 404, error: 'Recording not found.' }
  }

  if (recording.pipeline_status !== 'recording') {
    return { ok: false, status: 410, error: 'This recording has ended.' }
  }

  return { ok: true, pairing: pairing as MicPairingRow, recording }
}
