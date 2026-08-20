import { describe, expect, it } from 'vitest'
import { extractPlainTextFromEmail } from './_email'

function eml(lines: string[]): Buffer {
  return Buffer.from(lines.join('\r\n'), 'utf8')
}

describe('extractPlainTextFromEmail', () => {
  it('extracts a simple 7bit text/plain email', () => {
    const raw = eml([
      'From: chatgpt@chatgpt.net',
      'To: cgt@loveondev.com',
      'Subject: Alpine notes',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Alpine organizational knowledge is heavily dependent on human memory.',
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.extractionMethod).toBe('mime_text_plain')
    expect(result.text).toBe('Alpine organizational knowledge is heavily dependent on human memory.')
  })

  it('decodes a base64-encoded text/plain part', () => {
    const body = 'Locating affected code relies on tribal knowledge.'
    const encoded = Buffer.from(body, 'utf8').toString('base64')
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      encoded,
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.extractionMethod).toBe('mime_text_plain')
    expect(result.text).toBe(body)
  })

  it('decodes a quoted-printable text/plain part with non-ASCII characters', () => {
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Caf=C3=A9 knowledge transfer risk',
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.extractionMethod).toBe('mime_text_plain')
    expect(result.text).toBe('Café knowledge transfer risk')
  })

  it('prefers text/plain over text/html in a multipart/alternative message', () => {
    const boundary = 'BOUNDARY123'
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Plain version wins.',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>HTML version loses.</p>',
      `--${boundary}--`,
      '',
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.extractionMethod).toBe('mime_text_plain')
    expect(result.text).toBe('Plain version wins.')
  })

  it('falls back to stripping HTML when no text/plain part exists', () => {
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<html><body><p>Hello <strong>Alpine</strong> team.</p><p>Second paragraph.</p></body></html>',
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.extractionMethod).toBe('mime_html_stripped')
    expect(result.text).toContain('Hello Alpine team.')
    expect(result.text).toContain('Second paragraph.')
    expect(result.text).not.toContain('<p>')
    expect(result.text).not.toContain('<strong>')
  })

  it('strips script and style blocks entirely rather than including their content', () => {
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<html><head><style>.a{color:red}</style><script>alert(1)</script></head><body><p>Safe text</p></body></html>',
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.text).toContain('Safe text')
    expect(result.text).not.toContain('alert(1)')
    expect(result.text).not.toContain('color:red')
  })

  it('decodes named and numeric HTML entities', () => {
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Tom &amp; Jerry &#8211; a &quot;classic&quot;</p>',
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.text).toContain('Tom & Jerry')
    expect(result.text).toContain('"classic"')
  })

  it('falls back to raw text without throwing when no text/plain or text/html part is found', () => {
    const boundary = 'BOUNDARY456'
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: application/octet-stream',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from('binary-ish content').toString('base64'),
      `--${boundary}--`,
      '',
    ])

    expect(() => extractPlainTextFromEmail(raw)).not.toThrow()
    const result = extractPlainTextFromEmail(raw)
    expect(result.extractionMethod).toBe('raw_fallback')
  })

  it('treats a non-multipart email with no explicit Content-Type as plain text', () => {
    const raw = eml([
      'From: a@example.com',
      'To: cgt@loveondev.com',
      'Subject: Test',
      '',
      'Bare body with no MIME headers at all.',
    ])

    const result = extractPlainTextFromEmail(raw)
    expect(result.extractionMethod).toBe('mime_text_plain')
    expect(result.text).toBe('Bare body with no MIME headers at all.')
  })
})
