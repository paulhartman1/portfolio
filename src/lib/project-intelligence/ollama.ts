import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from './types'

/**
 * Single-provider boundary. Nothing in CGT outside this module knows the
 * Ollama HTTP details. Only local Ollama is ever contacted.
 */

export const OLLAMA_ERROR_KINDS = [
  'not_reachable',
  'model_missing',
  'non_json',
  'http',
  'timeout',
] as const

export type OllamaErrorKind = (typeof OLLAMA_ERROR_KINDS)[number]

export class OllamaProviderError extends Error {
  readonly kind: OllamaErrorKind
  readonly status: number | null
  constructor(kind: OllamaErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'OllamaProviderError'
    this.kind = kind
    this.status = status
  }
}

export type OllamaConfig = {
  baseUrl: string
  model: string
  requestTimeoutMs: number
}

export function resolveOllamaConfig(): OllamaConfig {
  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '')
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
  const parsedTimeout = Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS)
  const requestTimeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 300_000
  return { baseUrl, model, requestTimeoutMs }
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type ChatRequestBody = {
  model: string
  stream: false
  format: 'json'
  messages: ChatMessage[]
  options: { temperature: number }
}

async function fetchWithTimeout(path: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(path, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OllamaProviderError('timeout', `Ollama request timed out after ${timeoutMs}ms`)
    }
    throw new OllamaProviderError('not_reachable', `Could not reach Ollama at ${path}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** Returns the installed model tags; used to give a clear "model not installed" message. */
export async function listLocalModels(config: OllamaConfig): Promise<string[]> {
  const path = `${config.baseUrl}/api/tags`
  const response = await fetchWithTimeout(path, { method: 'GET' }, Math.min(config.requestTimeoutMs, 30_000))
  if (!response.ok) {
    throw new OllamaProviderError('http', `Ollama tags request failed with status ${response.status}`, response.status)
  }
  const payload = (await response.json()) as { models?: Array<{ name: string }> }
  return (payload.models || []).map((model) => model.name)
}

export async function isModelInstalled(config: OllamaConfig, model: string): Promise<boolean> {
  const models = await listLocalModels(config)
  return models.some((name) => name === model || name.startsWith(`${model}:`))
}

/**
 * Calls the local Ollama model and returns the structured (JSON) payload.
 * The provider only returns the parsed JSON; it does not persist anything.
 */
export async function generateStructuredJson(
  messages: ChatMessage[],
  config: OllamaConfig
): Promise<unknown> {
  const path = `${config.baseUrl}/api/chat`
  const body: ChatRequestBody = {
    model: config.model,
    stream: false,
    format: 'json',
    messages,
    options: { temperature: 0.2 },
  }

  const response = await fetchWithTimeout(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, config.requestTimeoutMs)

  if (response.status === 404) {
    throw new OllamaProviderError('model_missing', `Model "${config.model}" does not exist in this Ollama instance`)
  }

  if (!response.ok) {
    throw new OllamaProviderError('http', `Ollama chat request failed with status ${response.status}`, response.status)
  }

  const payload = (await response.json()) as { message?: { content?: string } } | { response?: string }
  const rawContent =
    (payload as { message?: { content?: string } }).message?.content ||
    (payload as { response?: string }).response

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new OllamaProviderError('non_json', 'Ollama returned an empty response')
  }

  try {
    return JSON.parse(rawContent)
  } catch {
    throw new OllamaProviderError('non_json', 'Ollama returned content that is not valid JSON')
  }
}