/**
 * Minimal, self-contained MIME parsing for the email source kind.
 *
 * This intentionally does not depend on a third-party MIME/HTML library.
 * The ingestion endpoint receives content from an external, semi-trusted
 * transport; a smaller, fully-understood parsing surface is preferable to a
 * general-purpose library's larger and more complex dependency chain.
 *
 * Scope: extract the best available plain-text representation of an email
 * (prefer a text/plain MIME part; fall back to stripping a text/html part;
 * fall back further to treating the whole body as text). This is mechanical
 * extraction only -- no interpretation, summarization, or classification.
 */

export type EmailExtractionMethod = 'mime_text_plain' | 'mime_html_stripped' | 'raw_fallback'

export type EmailExtractionResult = {
  text: string
  extractionMethod: EmailExtractionMethod
}

type MimePart = {
  contentType: string
  params: Record<string, string>
  transferEncoding: string
  /** Raw, undecoded part body, held as a "binary" string (1 char = 1 byte). */
  bodyBinary: string
  children?: MimePart[]
}

function splitHeadersAndBody(raw: string): { headers: string; body: string } {
  const idxCRLF = raw.indexOf('\r\n\r\n')
  const idxLF = raw.indexOf('\n\n')

  let idx = -1
  let sepLen = 0
  if (idxCRLF !== -1 && (idxLF === -1 || idxCRLF <= idxLF)) {
    idx = idxCRLF
    sepLen = 4
  } else if (idxLF !== -1) {
    idx = idxLF
    sepLen = 2
  }

  if (idx === -1) return { headers: raw, body: '' }
  return { headers: raw.slice(0, idx), body: raw.slice(idx + sepLen) }
}

function parseHeaders(headerText: string): Record<string, string> {
  const unfolded = headerText.replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ')
  const lines = unfolded.split('\n').filter((line) => line.trim().length > 0)
  const headers: Record<string, string> = {}
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const name = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (!(name in headers)) headers[name] = value
  }
  return headers
}

function parseContentType(value: string): { type: string; params: Record<string, string> } {
  const segments = value.split(';').map((segment) => segment.trim())
  const type = (segments[0] || 'text/plain').toLowerCase()
  const params: Record<string, string> = {}
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf('=')
    if (eq === -1) continue
    const key = segment.slice(0, eq).trim().toLowerCase()
    let val = segment.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    params[key] = val
  }
  return { type, params }
}

function splitByBoundary(body: string, boundary: string): string[] {
  const marker = `--${boundary}`
  const rawParts = body.split(marker)
  const parts: string[] = []
  for (let i = 1; i < rawParts.length; i++) {
    let segment = rawParts[i]
    if (segment.startsWith('--')) break // closing boundary marker reached
    segment = segment.replace(/^\r?\n/, '')
    segment = segment.replace(/\r?\n$/, '')
    parts.push(segment)
  }
  return parts
}

function parsePart(headerText: string, bodyBinary: string): MimePart {
  const headers = parseHeaders(headerText)
  const contentTypeHeader = headers['content-type'] || 'text/plain; charset=us-ascii'
  const { type, params } = parseContentType(contentTypeHeader)
  const transferEncoding = (headers['content-transfer-encoding'] || '7bit').trim().toLowerCase()

  if (type.startsWith('multipart/') && params.boundary) {
    const childRaws = splitByBoundary(bodyBinary, params.boundary)
    const children = childRaws.map((childRaw) => {
      const { headers: childHeaders, body: childBody } = splitHeadersAndBody(childRaw)
      return parsePart(childHeaders, childBody)
    })
    return { contentType: type, params, transferEncoding, bodyBinary: '', children }
  }

  return { contentType: type, params, transferEncoding, bodyBinary }
}

function findLeafByType(part: MimePart, contentType: string): MimePart | null {
  if (part.children && part.children.length > 0) {
    for (const child of part.children) {
      const found = findLeafByType(child, contentType)
      if (found) return found
    }
    return null
  }
  return part.contentType === contentType ? part : null
}

function decodeQuotedPrintable(input: string): string {
  let s = input.replace(/=\r\n/g, '').replace(/=\n/g, '')
  s = s.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  return s
}

function decodeBodyToBuffer(bodyBinary: string, transferEncoding: string): Buffer {
  switch (transferEncoding) {
    case 'base64': {
      const cleaned = bodyBinary.replace(/[^A-Za-z0-9+/=]/g, '')
      return Buffer.from(cleaned, 'base64')
    }
    case 'quoted-printable':
      return Buffer.from(decodeQuotedPrintable(bodyBinary), 'binary')
    case '7bit':
    case '8bit':
    case 'binary':
    default:
      return Buffer.from(bodyBinary, 'binary')
  }
}

function decodeText(buffer: Buffer, charset?: string): string {
  const label = (charset || 'utf-8').toLowerCase().replace(/"/g, '')
  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer)
  } catch {
    return buffer.toString('utf-8')
  }
}

function stripHtmlToText(html: string): string {
  let s = html
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<(br|br\/)\s*>/gi, '\n')
  s = s.replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')

  const namedEntities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  }
  s = s.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (match) => namedEntities[match] || match)
  s = s.replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))

  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

/**
 * Extracts the best-available plain-text representation from a raw RFC 5322
 * / MIME email buffer. Never throws for malformed-but-parseable input; may
 * throw only on truly unexpected internal errors, which the caller should
 * treat as a failed (but still source-preserving) extraction.
 */
export function extractPlainTextFromEmail(raw: Buffer): EmailExtractionResult {
  const rawBinary = raw.toString('binary')
  const { headers: headerText, body: bodyBinary } = splitHeadersAndBody(rawBinary)
  const root = parsePart(headerText, bodyBinary)

  const plainLeaf = findLeafByType(root, 'text/plain')
  if (plainLeaf) {
    const decoded = decodeBodyToBuffer(plainLeaf.bodyBinary, plainLeaf.transferEncoding)
    const text = decodeText(decoded, plainLeaf.params.charset)
    return { text: text.trim(), extractionMethod: 'mime_text_plain' }
  }

  const htmlLeaf = findLeafByType(root, 'text/html')
  if (htmlLeaf) {
    const decoded = decodeBodyToBuffer(htmlLeaf.bodyBinary, htmlLeaf.transferEncoding)
    const html = decodeText(decoded, htmlLeaf.params.charset)
    return { text: stripHtmlToText(html), extractionMethod: 'mime_html_stripped' }
  }

  // Nothing recognizable as text/plain or text/html anywhere in the MIME
  // tree (e.g. a lone non-text part). Best-effort: decode the whole raw body
  // as UTF-8 text rather than discarding it.
  const rootHeaders = parseHeaders(headerText)
  const rootEncoding = (rootHeaders['content-transfer-encoding'] || '7bit').trim().toLowerCase()
  const decoded = decodeBodyToBuffer(bodyBinary, rootEncoding)
  const text = decodeText(decoded, 'utf-8')
  return { text: text.trim(), extractionMethod: 'raw_fallback' }
}
