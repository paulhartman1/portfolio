import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { verifyIngestSignature } from './_verify'
import { extractPlainTextFromEmail } from './_email'
import { MAX_REQUEST_BODY_BYTES, MAX_RAW_MIME_BYTES, TIMESTAMP_TOLERANCE_SECONDS } from './_constants'

/**
 * CGT external-ingestion boundary.
 *
 * SOURCE -> SOURCE REPRESENTATION. Stops there by design: this endpoint
 * never produces observations, evidence, candidates, or any other
 * organizational knowledge. It exists to answer one question faithfully:
 * "I received something from the outside world -- here is exactly what
 * arrived, where it came from, and how it got here."
 *
 * Trust boundary: the caller (a Cloudflare Worker or equivalent transport)
 * never holds a Supabase or CGT admin credential. It holds only a narrowly
 * scoped HMAC signing secret (CGT_INGEST_SIGNING_SECRET). See _verify.ts.
 */

const SUPPORTED_SOURCE_KINDS = new Set(['email'])

type IngestPayload = {
  source_kind?: unknown
  transport?: unknown
  external_id?: unknown
  received_at?: unknown
  from?: unknown
  to?: unknown
  subject?: unknown
  claimed_context?: unknown
  raw_mime_base64?: unknown
}

function badRequest(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status: 400 })
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest) {
  const secret = process.env.CGT_INGEST_SIGNING_SECRET
  if (!secret) {
    console.error('[ingest] CGT_INGEST_SIGNING_SECRET is not configured')
    return NextResponse.json({ error: 'Ingestion is not configured' }, { status: 500 })
  }

  const contentLengthHeader = request.headers.get('content-length')
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }

  const verification = verifyIngestSignature({
    rawBody,
    timestampHeader: request.headers.get('x-cgt-timestamp'),
    signatureHeader: request.headers.get('x-cgt-signature'),
    secret,
    toleranceSeconds: TIMESTAMP_TOLERANCE_SECONDS,
  })

  if (!verification.ok) {
    console.warn('[ingest] Signature verification failed', { reason: verification.reason })
    return NextResponse.json({ error: 'Unauthorized', reason: verification.reason }, { status: 401 })
  }

  let payload: IngestPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return badRequest('Malformed JSON body')
  }

  if (!payload || typeof payload !== 'object') {
    return badRequest('Request body must be a JSON object')
  }

  const sourceKind = asTrimmedString(payload.source_kind)
  const transport = asTrimmedString(payload.transport)
  const externalId = asTrimmedString(payload.external_id)
  const receivedAtRaw = asTrimmedString(payload.received_at)
  const from = asTrimmedString(payload.from)
  const to = asTrimmedString(payload.to)
  const subject = typeof payload.subject === 'string' ? payload.subject : null
  const claimedContext = asTrimmedString(payload.claimed_context)
  const rawMimeBase64 = typeof payload.raw_mime_base64 === 'string' ? payload.raw_mime_base64 : null

  if (!sourceKind || !SUPPORTED_SOURCE_KINDS.has(sourceKind)) {
    return badRequest('source_kind is required and must be a supported kind', {
      supported: Array.from(SUPPORTED_SOURCE_KINDS),
    })
  }
  if (!transport) return badRequest('transport is required')
  if (!externalId) return badRequest('external_id is required')
  if (!receivedAtRaw || Number.isNaN(Date.parse(receivedAtRaw))) {
    return badRequest('received_at is required and must be a valid ISO 8601 timestamp')
  }
  if (!from) return badRequest('from is required')
  if (!to) return badRequest('to is required')
  if (!rawMimeBase64) return badRequest('raw_mime_base64 is required')

  const receivedAt = new Date(receivedAtRaw).toISOString()
  const serviceRole = createServiceRoleClient()

  // Idempotency: (transport, external_id) is the uniqueness scope. Duplicate
  // delivery of the same transport message returns the already-created
  // source rather than creating another one.
  const { data: existing, error: existingError } = await serviceRole
    .from('sources')
    .select('id, project_id, context_resolution, claimed_context, created_at')
    .eq('transport', transport)
    .eq('external_id', externalId)
    .maybeSingle()

  if (existingError) {
    console.error('[ingest] Failed to check for existing source', { error: existingError.message })
    return NextResponse.json({ error: 'Ingestion failed' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, source: existing })
  }

  let rawBuffer: Buffer
  try {
    rawBuffer = Buffer.from(rawMimeBase64, 'base64')
  } catch {
    return badRequest('raw_mime_base64 is not valid base64')
  }
  if (rawBuffer.length === 0) return badRequest('raw_mime_base64 decoded to empty content')
  if (rawBuffer.length > MAX_RAW_MIME_BYTES) {
    return NextResponse.json({ error: 'Raw source payload too large' }, { status: 413 })
  }

  const sourceId = randomUUID()
  const bucket = 'external-sources'
  const storagePath = `${sourceId}/raw.eml`

  const { error: uploadError } = await serviceRole.storage
    .from(bucket)
    .upload(storagePath, rawBuffer, { contentType: 'message/rfc822', upsert: false })

  if (uploadError) {
    console.error('[ingest] Failed to store raw source', { error: uploadError.message })
    return NextResponse.json({ error: 'Failed to persist raw source' }, { status: 500 })
  }

  // Explicit context resolution only. "alpine" is an assertion made by the
  // sender, matched against projects.subdomain (the existing engagement-slug
  // concept used for portal routing). No inference is performed here.
  let resolvedProjectId: string | null = null
  let contextResolution: 'unresolved' | 'explicit_slug' = 'unresolved'
  if (claimedContext) {
    const { data: project, error: projectLookupError } = await serviceRole
      .from('projects')
      .select('id')
      .eq('subdomain', claimedContext)
      .maybeSingle()
    if (projectLookupError) {
      console.error('[ingest] Context resolution lookup failed', { error: projectLookupError.message })
    } else if (project) {
      resolvedProjectId = project.id
      contextResolution = 'explicit_slug'
    }
  }

  const { data: source, error: insertError } = await serviceRole
    .from('sources')
    .insert({
      id: sourceId,
      project_id: resolvedProjectId,
      source_kind: sourceKind,
      transport,
      external_id: externalId,
      received_at: receivedAt,
      sender: from,
      recipient: to,
      raw_storage_bucket: bucket,
      raw_storage_path: storagePath,
      claimed_context: claimedContext,
      context_resolution: contextResolution,
      transport_metadata: { subject },
    })
    .select('id, project_id, context_resolution, claimed_context, created_at')
    .single()

  if (insertError) {
    // Unique violation on (transport, external_id): a concurrent request won
    // the race. Clean up our orphaned upload and return the winner's row.
    if (insertError.code === '23505') {
      await serviceRole.storage.from(bucket).remove([storagePath])
      const { data: raceExisting } = await serviceRole
        .from('sources')
        .select('id, project_id, context_resolution, claimed_context, created_at')
        .eq('transport', transport)
        .eq('external_id', externalId)
        .maybeSingle()
      if (raceExisting) {
        return NextResponse.json({ ok: true, duplicate: true, source: raceExisting })
      }
    }
    console.error('[ingest] Failed to insert source', { error: insertError.message })
    return NextResponse.json({ error: 'Failed to persist source' }, { status: 500 })
  }

  // Mechanical text extraction only -- no AI, no summarization, no
  // classification. Failure to extract does not discard the source: the raw
  // MIME is already durably stored above.
  let representation: { id: string; representation_kind: string; status: string } | null = null
  try {
    const { text, extractionMethod } = extractPlainTextFromEmail(rawBuffer)
    const { data: rep, error: repError } = await serviceRole
      .from('source_representations')
      .insert({
        source_id: sourceId,
        representation_kind: 'plain_text',
        text_content: text,
        extraction_method: extractionMethod,
        status: 'complete',
      })
      .select('id, representation_kind, status')
      .single()
    if (repError) throw repError
    representation = rep
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown extraction error'
    console.error('[ingest] Text extraction failed', { sourceId, error: message })
    const { data: rep } = await serviceRole
      .from('source_representations')
      .insert({
        source_id: sourceId,
        representation_kind: 'plain_text',
        text_content: '',
        extraction_method: 'mime_extraction_failed',
        status: 'failed',
        error_details: message,
      })
      .select('id, representation_kind, status')
      .single()
    representation = rep || null
  }

  return NextResponse.json(
    { ok: true, duplicate: false, source, representation },
    { status: 201 }
  )
}
