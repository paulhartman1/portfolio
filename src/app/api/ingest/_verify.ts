import { createHmac, timingSafeEqual } from 'crypto'

/**
 * HMAC verification for the CGT external-ingestion boundary.
 *
 * Mirrors the trust model already used for Stripe webhooks
 * (`src/app/api/stripe/webhook/route.ts`): the transport (a Cloudflare
 * Worker) never receives a Supabase or CGT admin credential. It only holds a
 * narrowly-scoped signing secret (`CGT_INGEST_SIGNING_SECRET`) used to prove
 * "this request really came from the configured transport" and "this
 * request has not been replayed."
 *
 * Signed string: `${timestamp}.${rawBody}`
 * Algorithm: HMAC-SHA256, hex-encoded, prefixed with "sha256="
 * Comparison: timing-safe (crypto.timingSafeEqual)
 */

const SIGNATURE_PREFIX = 'sha256='

export type VerifyIngestSignatureParams = {
  rawBody: string
  timestampHeader: string | null
  signatureHeader: string | null
  secret: string
  toleranceSeconds: number
  /** Injectable for tests; defaults to the real clock. */
  now?: number
}

export type VerifyIngestSignatureResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'missing_timestamp'
        | 'invalid_timestamp'
        | 'timestamp_out_of_tolerance'
        | 'missing_signature'
        | 'invalid_signature_format'
        | 'signature_mismatch'
    }

export function verifyIngestSignature(
  params: VerifyIngestSignatureParams
): VerifyIngestSignatureResult {
  const { rawBody, timestampHeader, signatureHeader, secret, toleranceSeconds } = params
  const now = params.now ?? Math.floor(Date.now() / 1000)

  if (!timestampHeader) return { ok: false, reason: 'missing_timestamp' }

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp)) {
    return { ok: false, reason: 'invalid_timestamp' }
  }

  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' }
  }

  if (!signatureHeader) return { ok: false, reason: 'missing_signature' }
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return { ok: false, reason: 'invalid_signature_format' }
  }

  const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length)
  const expectedHex = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`, 'utf8')
    .digest('hex')

  const providedBuffer = Buffer.from(providedHex, 'hex')
  const expectedBuffer = Buffer.from(expectedHex, 'hex')

  // Reject up front on length mismatch (also guards empty/garbage hex from
  // Buffer.from silently truncating at the first invalid character) rather
  // than calling timingSafeEqual, which throws on unequal-length buffers.
  if (providedBuffer.length === 0 || providedBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: 'signature_mismatch' }
  }

  const matches = timingSafeEqual(providedBuffer, expectedBuffer)
  if (!matches) return { ok: false, reason: 'signature_mismatch' }

  return { ok: true }
}
