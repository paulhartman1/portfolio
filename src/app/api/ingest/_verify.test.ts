import { describe, expect, it } from 'vitest'
import { createHmac } from 'crypto'
import { verifyIngestSignature } from './_verify'

const SECRET = 'test-signing-secret'
const TOLERANCE = 300

function sign(body: string, timestamp: number, secret = SECRET): string {
  const hex = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex')
  return `sha256=${hex}`
}

describe('verifyIngestSignature', () => {
  it('accepts a correctly signed request within tolerance', () => {
    const body = JSON.stringify({ hello: 'world' })
    const now = 1_700_000_000
    const timestamp = now
    const result = verifyIngestSignature({
      rawBody: body,
      timestampHeader: String(timestamp),
      signatureHeader: sign(body, timestamp),
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a signature computed with the wrong secret', () => {
    const body = JSON.stringify({ hello: 'world' })
    const now = 1_700_000_000
    const result = verifyIngestSignature({
      rawBody: body,
      timestampHeader: String(now),
      signatureHeader: sign(body, now, 'wrong-secret'),
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('rejects a signature computed over a different body (tampering)', () => {
    const now = 1_700_000_000
    const signedBody = JSON.stringify({ amount: 1 })
    const tamperedBody = JSON.stringify({ amount: 1000000 })
    const result = verifyIngestSignature({
      rawBody: tamperedBody,
      timestampHeader: String(now),
      signatureHeader: sign(signedBody, now),
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('rejects a missing timestamp header', () => {
    const result = verifyIngestSignature({
      rawBody: '{}',
      timestampHeader: null,
      signatureHeader: 'sha256=abc',
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
    })
    expect(result).toEqual({ ok: false, reason: 'missing_timestamp' })
  })

  it('rejects a non-numeric timestamp header', () => {
    const result = verifyIngestSignature({
      rawBody: '{}',
      timestampHeader: 'not-a-number',
      signatureHeader: 'sha256=abc',
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
    })
    expect(result).toEqual({ ok: false, reason: 'invalid_timestamp' })
  })

  it('rejects a timestamp too far in the past', () => {
    const now = 1_700_000_000
    const body = '{}'
    const oldTimestamp = now - TOLERANCE - 1
    const result = verifyIngestSignature({
      rawBody: body,
      timestampHeader: String(oldTimestamp),
      signatureHeader: sign(body, oldTimestamp),
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' })
  })

  it('rejects a timestamp too far in the future (clock-skew abuse / replay-window padding)', () => {
    const now = 1_700_000_000
    const body = '{}'
    const futureTimestamp = now + TOLERANCE + 1
    const result = verifyIngestSignature({
      rawBody: body,
      timestampHeader: String(futureTimestamp),
      signatureHeader: sign(body, futureTimestamp),
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' })
  })

  it('accepts a timestamp exactly at the tolerance boundary', () => {
    const now = 1_700_000_000
    const body = '{}'
    const boundaryTimestamp = now - TOLERANCE
    const result = verifyIngestSignature({
      rawBody: body,
      timestampHeader: String(boundaryTimestamp),
      signatureHeader: sign(body, boundaryTimestamp),
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a missing signature header', () => {
    const now = 1_700_000_000
    const result = verifyIngestSignature({
      rawBody: '{}',
      timestampHeader: String(now),
      signatureHeader: null,
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result).toEqual({ ok: false, reason: 'missing_signature' })
  })

  it('rejects a signature missing the algorithm prefix', () => {
    const now = 1_700_000_000
    const body = '{}'
    const hex = createHmac('sha256', SECRET).update(`${now}.${body}`, 'utf8').digest('hex')
    const result = verifyIngestSignature({
      rawBody: body,
      timestampHeader: String(now),
      signatureHeader: hex, // missing "sha256=" prefix
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result).toEqual({ ok: false, reason: 'invalid_signature_format' })
  })

  it('rejects non-hex garbage in the signature without throwing', () => {
    const now = 1_700_000_000
    expect(() =>
      verifyIngestSignature({
        rawBody: '{}',
        timestampHeader: String(now),
        signatureHeader: 'sha256=not-valid-hex!!!',
        secret: SECRET,
        toleranceSeconds: TOLERANCE,
        now,
      })
    ).not.toThrow()
  })

  it('rejects an empty signature value', () => {
    const now = 1_700_000_000
    const result = verifyIngestSignature({
      rawBody: '{}',
      timestampHeader: String(now),
      signatureHeader: 'sha256=',
      secret: SECRET,
      toleranceSeconds: TOLERANCE,
      now,
    })
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })
})
