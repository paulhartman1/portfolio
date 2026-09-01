import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '../../../../../_lib'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { generatePairingToken, pairingUrl, PAIRING_TTL_MS } from '@/lib/recordings/mic-pairing'

async function loadOwnedRecording(serviceRole: ReturnType<typeof createServiceRoleClient>, projectId: string, id: string) {
  const { data: recording } = await serviceRole
    .from('engagement_recordings')
    .select('id, project_id, mic_source, pipeline_status')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle()
  return recording
}

// Creates a short-lived, single-use-scope pairing token for this recording
// and returns the raw token once (only its hash is ever persisted). The
// desktop renders this into a QR code client-side; nothing else in the app
// ever sees the raw token again.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await params
  const access = await requireProjectAccess(projectId)
  if ('error' in access) {
    return access.error
  }

  const serviceRole = createServiceRoleClient()
  const recording = await loadOwnedRecording(serviceRole, projectId, id)

  if (!recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (recording.mic_source !== 'phone') {
    return NextResponse.json({ error: 'Recording is not configured for phone microphone' }, { status: 400 })
  }

  if (recording.pipeline_status !== 'recording') {
    return NextResponse.json({ error: 'Recording is not accepting audio' }, { status: 400 })
  }

  // Revoke any prior pairing for this recording so only one QR is ever live.
  await serviceRole
    .from('engagement_mic_pairings')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('recording_id', id)
    .in('status', ['pending', 'opened', 'permission_pending', 'active'])

  const { token, tokenHash } = generatePairingToken()
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString()

  const { data: pairing, error } = await serviceRole
    .from('engagement_mic_pairings')
    .insert({
      recording_id: id,
      token_hash: tokenHash,
      status: 'pending',
      created_by: access.user.id,
      expires_at: expiresAt,
    })
    .select('id, status, expires_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    pairing_id: pairing.id,
    status: pairing.status,
    expires_at: pairing.expires_at,
    qr_url: pairingUrl(token),
  })
}

// Explicitly ends the current pairing -- used when the user switches away
// from "Use my phone", closes the setup panel, or stops the recording. The
// phone's next call to any /api/record/mic/[token]/* route will fail once
// this happens.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await params
  const access = await requireProjectAccess(projectId)
  if ('error' in access) {
    return access.error
  }

  const serviceRole = createServiceRoleClient()
  const recording = await loadOwnedRecording(serviceRole, projectId, id)
  if (!recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  const { error } = await serviceRole
    .from('engagement_mic_pairings')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('recording_id', id)
    .in('status', ['pending', 'opened', 'permission_pending', 'active'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
