import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

const SECRET = 'test-signing-secret'

type MockResult<T> = { data: T | null; error: { message: string; code?: string } | null }
type Call = { table: string; op: string; args?: unknown }

let currentClient: unknown

vi.mock('@/utils/supabase/service-role', () => ({
  createServiceRoleClient: () => currentClient,
}))

function eqChain(result: MockResult<unknown>) {
  const obj = {
    eq: vi.fn(() => obj),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  return obj
}

function makeSupabaseMock(config: {
  sourcesSelect?: MockResult<{ id: string; project_id: string | null; context_resolution: string; claimed_context: string | null; created_at: string }>
  projectsSelect?: MockResult<{ id: string }>
  sourcesInsert?: MockResult<{ id: string; project_id: string | null; context_resolution: string; claimed_context: string | null; created_at: string }>
  representationsInsert?: MockResult<{ id: string; representation_kind: string; status: string }>
  uploadError?: { message: string } | null
  removeError?: { message: string } | null
}) {
  const calls: Call[] = []

  const sourcesSelectResult = config.sourcesSelect ?? { data: null, error: null }
  const projectsSelectResult = config.projectsSelect ?? { data: null, error: null }
  const sourcesInsertResult =
    config.sourcesInsert ??
    ({ data: { id: 'src-1', project_id: null, context_resolution: 'unresolved', claimed_context: null, created_at: '2026-01-01T00:00:00Z' }, error: null } as MockResult<{
      id: string
      project_id: string | null
      context_resolution: string
      claimed_context: string | null
      created_at: string
    }>)
  const representationsInsertResult =
    config.representationsInsert ??
    ({ data: { id: 'rep-1', representation_kind: 'plain_text', status: 'complete' }, error: null } as MockResult<{
      id: string
      representation_kind: string
      status: string
    }>)

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'sources') {
      return {
        select: vi.fn().mockImplementation((cols: unknown) => {
          calls.push({ table, op: 'select', args: cols })
          return eqChain(sourcesSelectResult)
        }),
        insert: vi.fn().mockImplementation((values: unknown) => {
          calls.push({ table, op: 'insert', args: values })
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(sourcesInsertResult),
            }),
          }
        }),
      }
    }
    if (table === 'projects') {
      return {
        select: vi.fn().mockImplementation((cols: unknown) => {
          calls.push({ table, op: 'select', args: cols })
          return eqChain(projectsSelectResult)
        }),
      }
    }
    if (table === 'source_representations') {
      return {
        insert: vi.fn().mockImplementation((values: unknown) => {
          calls.push({ table, op: 'insert', args: values })
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(representationsInsertResult),
            }),
          }
        }),
      }
    }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  const storageFrom = vi.fn().mockImplementation((bucket: string) => ({
    upload: vi.fn().mockImplementation((path: string) => {
      calls.push({ table: `storage:${bucket}`, op: 'upload', args: { path } })
      return Promise.resolve({ data: config.uploadError ? null : { path }, error: config.uploadError ?? null })
    }),
    remove: vi.fn().mockImplementation((paths: string[]) => {
      calls.push({ table: `storage:${bucket}`, op: 'remove', args: paths })
      return Promise.resolve({ data: null, error: config.removeError ?? null })
    }),
  }))

  return { client: { from, storage: { from: storageFrom } }, calls }
}

function sign(body: string, timestamp: number, secret = SECRET): string {
  const hex = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex')
  return `sha256=${hex}`
}

function rawEmailBase64(bodyText = 'Alpine organizational knowledge is heavily dependent on human memory.'): string {
  const raw = [
    'From: chatgpt@chatgpt.net',
    'To: cgt@loveondev.com',
    'Subject: CGT this: Alpine notes',
    'Content-Type: text/plain; charset=utf-8',
    '',
    bodyText,
  ].join('\r\n')
  return Buffer.from(raw, 'utf8').toString('base64')
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    source_kind: 'email',
    transport: 'cloudflare-email',
    external_id: 'msg-123',
    received_at: '2026-08-20T12:00:00Z',
    from: 'chatgpt@chatgpt.net',
    to: 'cgt@loveondev.com',
    subject: 'CGT this: Alpine notes',
    claimed_context: 'alpine',
    raw_mime_base64: rawEmailBase64(),
    ...overrides,
  }
}

function buildRequest(bodyObj: unknown, options: { timestamp?: number; secretForSig?: string; signatureOverride?: string; timestampOverride?: string } = {}) {
  const body = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj)
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const signature = options.signatureOverride ?? sign(body, timestamp, options.secretForSig)
  return new NextRequest('http://localhost/api/ingest', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-cgt-timestamp': options.timestampOverride ?? String(timestamp),
      'x-cgt-signature': signature,
    },
  })
}

describe('POST /api/ingest', () => {
  beforeEach(() => {
    process.env.CGT_INGEST_SIGNING_SECRET = SECRET
    currentClient = undefined
  })

  afterEach(() => {
    delete process.env.CGT_INGEST_SIGNING_SECRET
    vi.resetModules()
  })

  it('rejects requests with an invalid signature', async () => {
    const { POST } = await import('./route')
    const req = buildRequest(validPayload(), { secretForSig: 'wrong-secret' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.reason).toBe('signature_mismatch')
  })

  it('rejects requests with an expired timestamp', async () => {
    const { POST } = await import('./route')
    const staleTimestamp = Math.floor(Date.now() / 1000) - 10_000
    const req = buildRequest(validPayload(), { timestamp: staleTimestamp })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.reason).toBe('timestamp_out_of_tolerance')
  })

  it('rejects malformed JSON bodies (even if signed correctly)', async () => {
    const { POST } = await import('./route')
    const req = buildRequest('not valid json {{{')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects a payload missing required fields', async () => {
    const { mock } = { mock: makeSupabaseMock({}) }
    currentClient = mock.client
    const { POST } = await import('./route')
    const payload = validPayload({ external_id: undefined })
    const req = buildRequest(payload)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('external_id')
  })

  it('rejects an unsupported source_kind', async () => {
    currentClient = makeSupabaseMock({}).client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload({ source_kind: 'slack_message' }))
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates a source and a plain_text representation on a valid signed request', async () => {
    const mock = makeSupabaseMock({
      projectsSelect: { data: { id: 'proj-alpine' }, error: null },
    })
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload())
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.duplicate).toBe(false)
    expect(body.source).toBeTruthy()
    expect(body.representation).toBeTruthy()

    const sourcesInsertCall = mock.calls.find((c) => c.table === 'sources' && c.op === 'insert')
    expect(sourcesInsertCall).toBeTruthy()
  })

  it('persists the raw MIME to storage before inserting the source row', async () => {
    const mock = makeSupabaseMock({})
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload())
    await POST(req)

    const uploadCall = mock.calls.find((c) => c.op === 'upload')
    expect(uploadCall).toBeTruthy()
    expect(uploadCall!.table).toBe('storage:external-sources')

    const sourcesInsertCall = mock.calls.find((c) => c.table === 'sources' && c.op === 'insert')
    const insertedValues = sourcesInsertCall!.args as { raw_storage_bucket: string; raw_storage_path: string }
    expect(insertedValues.raw_storage_bucket).toBe('external-sources')
    expect(insertedValues.raw_storage_path).toMatch(/\/raw\.eml$/)
  })

  it('extracts the email plain-text body into a source_representations row', async () => {
    const mock = makeSupabaseMock({})
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload({ raw_mime_base64: rawEmailBase64('Locating affected code relies on tribal knowledge.') }))
    await POST(req)

    const repInsertCall = mock.calls.find((c) => c.table === 'source_representations' && c.op === 'insert')
    expect(repInsertCall).toBeTruthy()
    const values = repInsertCall!.args as { representation_kind: string; text_content: string; extraction_method: string; status: string }
    expect(values.representation_kind).toBe('plain_text')
    expect(values.text_content).toBe('Locating affected code relies on tribal knowledge.')
    expect(values.extraction_method).toBe('mime_text_plain')
    expect(values.status).toBe('complete')
  })

  it('resolves claimed_context to a project via an explicit subdomain match', async () => {
    const mock = makeSupabaseMock({
      projectsSelect: { data: { id: 'proj-alpine' }, error: null },
    })
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload({ claimed_context: 'alpine' }))
    await POST(req)

    const sourcesInsertCall = mock.calls.find((c) => c.table === 'sources' && c.op === 'insert')
    const values = sourcesInsertCall!.args as { project_id: string | null; context_resolution: string; claimed_context: string }
    expect(values.project_id).toBe('proj-alpine')
    expect(values.context_resolution).toBe('explicit_slug')
    expect(values.claimed_context).toBe('alpine')
  })

  it('preserves claimed_context distinctly from an unresolved project association', async () => {
    const mock = makeSupabaseMock({
      projectsSelect: { data: null, error: null }, // no matching subdomain
    })
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload({ claimed_context: 'does-not-exist' }))
    await POST(req)

    const sourcesInsertCall = mock.calls.find((c) => c.table === 'sources' && c.op === 'insert')
    const values = sourcesInsertCall!.args as { project_id: string | null; context_resolution: string; claimed_context: string }
    expect(values.project_id).toBeNull()
    expect(values.context_resolution).toBe('unresolved')
    // WHAT ARRIVED (the sender's assertion) must still be preserved verbatim,
    // even though CGT could not resolve it.
    expect(values.claimed_context).toBe('does-not-exist')
  })

  it('leaves context unresolved (not project_id null with no record) when no claimed_context is supplied', async () => {
    const mock = makeSupabaseMock({})
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload({ claimed_context: undefined }))
    await POST(req)

    const sourcesInsertCall = mock.calls.find((c) => c.table === 'sources' && c.op === 'insert')
    const values = sourcesInsertCall!.args as { project_id: string | null; context_resolution: string; claimed_context: string | null }
    expect(values.project_id).toBeNull()
    expect(values.context_resolution).toBe('unresolved')
    expect(values.claimed_context).toBeNull()

    // No project lookup should have been attempted at all.
    const projectsSelectCall = mock.calls.find((c) => c.table === 'projects')
    expect(projectsSelectCall).toBeUndefined()
  })

  it('returns the existing source on duplicate delivery instead of creating a new one', async () => {
    const existing = {
      id: 'src-existing',
      project_id: 'proj-alpine',
      context_resolution: 'explicit_slug',
      claimed_context: 'alpine',
      created_at: '2026-08-20T12:00:00Z',
    }
    const mock = makeSupabaseMock({ sourcesSelect: { data: existing, error: null } })
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload())
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.duplicate).toBe(true)
    expect(body.source.id).toBe('src-existing')

    // No new source insert, no storage upload, no representation insert.
    expect(mock.calls.some((c) => c.table === 'sources' && c.op === 'insert')).toBe(false)
    expect(mock.calls.some((c) => c.op === 'upload')).toBe(false)
    expect(mock.calls.some((c) => c.table === 'source_representations')).toBe(false)
  })

  it('never creates observations, candidates, or other organizational-knowledge rows', async () => {
    const mock = makeSupabaseMock({
      projectsSelect: { data: { id: 'proj-alpine' }, error: null },
    })
    currentClient = mock.client
    const { POST } = await import('./route')
    const req = buildRequest(validPayload())
    const res = await POST(req)

    expect(res.status).toBe(201)
    const forbiddenTables = [
      'transcript_observations',
      'transcript_observation_evidence',
      'project_intelligence_candidates',
      'project_intelligence_candidate_evidence',
      'engagement_recordings',
      'engagement_transcripts',
    ]
    const touchedTables = new Set(mock.calls.map((c) => c.table))
    for (const forbidden of forbiddenTables) {
      expect(touchedTables.has(forbidden)).toBe(false)
    }
    expect(touchedTables.has('sources')).toBe(true)
    expect(touchedTables.has('source_representations')).toBe(true)
  })

  it('returns 500 when CGT_INGEST_SIGNING_SECRET is not configured', async () => {
    delete process.env.CGT_INGEST_SIGNING_SECRET
    const { POST } = await import('./route')
    const req = buildRequest(validPayload())
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
