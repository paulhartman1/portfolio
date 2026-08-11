import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateStructuredJson,
  isModelInstalled,
  OllamaProviderError,
  resolveOllamaConfig,
} from './ollama'

const config = { baseUrl: 'http://127.0.0.1:11434', model: 'qwen3:8b', requestTimeoutMs: 10_000 }
const messages = [
  { role: 'system' as const, content: 'sys' },
  { role: 'user' as const, content: 'user' },
]

function jsonResponse(content: string) {
  return new Response(JSON.stringify({ message: { content } }), { status: 200 })
}

function rawResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200 })
}

describe('resolveOllamaConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to local Ollama and qwen3:8b when unset', () => {
    vi.stubEnv('OLLAMA_BASE_URL', '')
    vi.stubEnv('OLLAMA_MODEL', '')
    vi.stubEnv('OLLAMA_REQUEST_TIMEOUT_MS', '')
    const resolved = resolveOllamaConfig()
    expect(resolved.baseUrl).toBe('http://127.0.0.1:11434')
    expect(resolved.model).toBe('qwen3:8b')
  })

  it('reads config from the environment', () => {
    vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:1234')
    vi.stubEnv('OLLAMA_MODEL', 'llama3.2:3b')
    vi.stubEnv('OLLAMA_REQUEST_TIMEOUT_MS', '120000')
    const resolved = resolveOllamaConfig()
    expect(resolved.baseUrl).toBe('http://localhost:1234')
    expect(resolved.model).toBe('llama3.2:3b')
    expect(resolved.requestTimeoutMs).toBe(120000)
  })
})

describe('generateStructuredJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed JSON from the model message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('{"candidates":[]}')))
    const result = await generateStructuredJson(messages, config)
    expect(result).toEqual({ candidates: [] })
    const calledUrl = vi.mocked(fetch).mock.calls[0][0]
    expect(calledUrl).toBe('http://127.0.0.1:11434/api/chat')
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.model).toBe('qwen3:8b')
    expect(body.format).toBe('json')
    expect(body.stream).toBe(false)
  })

  it('throws non_json when the model returns prose', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('Here are some insights...')))
    await expect(generateStructuredJson(messages, config)).rejects.toMatchObject({ kind: 'non_json' })
  })

  it('throws model_missing on a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))
    await expect(generateStructuredJson(messages, config)).rejects.toMatchObject({ kind: 'model_missing' })
  })

  it('throws http for other non-ok statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })))
    await expect(generateStructuredJson(messages, config)).rejects.toMatchObject({ kind: 'http', status: 500 })
  })

  it('throws not_reachable when the host is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(generateStructuredJson(messages, config)).rejects.toMatchObject({ kind: 'not_reachable' })
  })
})

describe('isModelInstalled', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is true when the model name matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rawResponse({ models: [{ name: 'qwen3:8b' }] })))
    expect(await isModelInstalled(config, 'qwen3:8b')).toBe(true)
  })

  it('is false when no model is installed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rawResponse({ models: [] })))
    expect(await isModelInstalled(config, 'qwen3:8b')).toBe(false)
  })
})

it('OllamaProviderError carries a kind and status', () => {
  const error = new OllamaProviderError('http', 'boom', 500)
  expect(error.kind).toBe('http')
  expect(error.status).toBe(500)
})