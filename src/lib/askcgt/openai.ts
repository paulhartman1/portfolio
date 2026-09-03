import { ProviderMessage } from './provider'

/**
 * Single-provider boundary for OpenAI-compatible chat completions.
 * Nothing in CGT outside this module knows the OpenAI HTTP details.
 * Only a configured OpenAI-compatible endpoint is ever contacted.
 *
 * Model, key, base URL, and limits come from environment variables so the
 * model can be swapped without touching AskCGT code:
 *   OPENAI_API_KEY        (required)
 *   ASK_CGT_MODEL         (default gpt-4o)
 *   ASK_CGT_BASE_URL      (default https://api.openai.com/v1)
 *   ASK_CGT_MAX_TOKENS    (default 8192)
 *   ASK_CGT_TIMEOUT_MS    (default 120000)
 */

export const OPENAI_ERROR_KINDS = [
  'not_configured',
  'auth',
  'rate_limit',
  'timeout',
  'overloaded',
  'http',
  'non_json',
] as const

export type OpenAiErrorKind = (typeof OPENAI_ERROR_KINDS)[number]

export class OpenAiProviderError extends Error {
  readonly kind: OpenAiErrorKind
  readonly status: number | null
  constructor(kind: OpenAiErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'OpenAiProviderError'
    this.kind = kind
    this.status = status
  }
}

export type OpenAiConfig = {
  apiKey: string | undefined
  baseUrl: string
  model: string
  maxTokens: number
  requestTimeoutMs: number
}

/**
 * Default OpenAI model for AskCGT.
 *
 * This was previously "gpt-5.6-luna", which is not a model the OpenAI API
 * serves — any request using it would have failed with a model-not-found
 * error. gpt-4o is a real model that supports the json_schema response
 * format AskCGT relies on.
 */
export const DEFAULT_ASK_CGT_MODEL = 'gpt-4o'

export function resolveOpenAiConfig(): OpenAiConfig {
  const baseUrl = (process.env.ASK_CGT_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const parsedMaxTokens = Number(process.env.ASK_CGT_MAX_TOKENS)
  const parsedTimeout = Number(process.env.ASK_CGT_TIMEOUT_MS)
  return {
    apiKey: process.env.OPENAI_API_KEY || undefined,
    baseUrl,
    model: process.env.ASK_CGT_MODEL || DEFAULT_ASK_CGT_MODEL,
    maxTokens: Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0 ? parsedMaxTokens : 8192,
    requestTimeoutMs: Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 120_000,
  }
}

type OpenAiChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type OpenAiUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

/** Metadata captured from the OpenAI response for observability. */
export type OpenAiResponseMeta = {
  id: string | null
  model: string | null
  finishReason: string | null
  systemFingerprint: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

async function fetchWithTimeout(path: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(path, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenAiProviderError('timeout', `OpenAI request timed out after ${timeoutMs}ms`)
    }
    throw new OpenAiProviderError('http', `Could not reach OpenAI at ${path}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** Best-effort extraction of a JSON value from model text (tolerates fences/prose). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through to brace/bracket extraction
  }
  const fenceStripped = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(fenceStripped)
  } catch {
    // fall through
  }
  const firstObj = fenceStripped.indexOf('{')
  const firstArr = fenceStripped.indexOf('[')
  const start = firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr)
  if (start === -1) return null
  const openChar = fenceStripped[start]
  const closeChar = openChar === '{' ? '}' : ']'
  const end = fenceStripped.lastIndexOf(closeChar)
  if (end <= start) return null
  try {
    return JSON.parse(fenceStripped.slice(start, end + 1))
  } catch {
    return null
  }
}

function mapSdkError(error: unknown): OpenAiProviderError {
  if (error instanceof OpenAiProviderError) return error
  return new OpenAiProviderError('http', error instanceof Error ? error.message : String(error))
}

/**
 * Calls the configured OpenAI-compatible endpoint and returns the parsed
 * structured (JSON) payload plus usage metadata. Returns parsed JSON only;
 * validation and provenance checks happen in the AskCGT layer.
 */
export async function generateStructuredJson(
  messages: ProviderMessage[],
  config: OpenAiConfig
): Promise<{ json: unknown; usage: OpenAiUsage; meta: OpenAiResponseMeta }> {
  if (!config.apiKey) {
    throw new OpenAiProviderError('not_configured', 'OPENAI_API_KEY is not set')
  }

  const jsonSchema = {
    name: 'AskCgtAnswer',
    schema: {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        conclusions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              statement: { type: 'string' },
              kind: { type: 'string', enum: ['evidence', 'inference', 'unknown'] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: ['string', 'null'] },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['transcript', 'observation', 'marker', 'candidate'] },
                    id: { type: 'string' },
                    utteranceIds: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['type', 'id', 'utteranceIds'],
                  additionalProperties: false,
                },
              },
            },
            required: ['statement', 'kind', 'confidence', 'reasoning', 'evidence'],
            additionalProperties: false,
          },
        },
        unknowns: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['answer', 'conclusions', 'unknowns'],
      additionalProperties: false,
    },
    strict: false,
  }

  const body = {
    model: config.model,
    max_completion_tokens: config.maxTokens,
    response_format: { type: 'json_schema', json_schema: jsonSchema },
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })) as OpenAiChatMessage[],
  }

  let response: Response
  try {
    response = await fetchWithTimeout(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    }, config.requestTimeoutMs)
  } catch (error) {
    throw mapSdkError(error)
  }

  if (response.status === 401 || response.status === 403) {
    throw new OpenAiProviderError('auth', `OpenAI authentication failed (status ${response.status}). Check OPENAI_API_KEY.`, response.status)
  }
  if (response.status === 429) {
    throw new OpenAiProviderError('rate_limit', 'OpenAI rate limit exceeded', response.status)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new OpenAiProviderError('http', `OpenAI request failed (status ${response.status}): ${detail.slice(0, 300)}`, response.status)
  }

  const payload = (await response.json()) as {
    id?: string
    model?: string
    system_fingerprint?: string
    choices?: Array<{
      message?: { content?: string; refusal?: string | null }
      finish_reason?: string
    }>
    usage?: OpenAiUsage
    error?: { message?: string; type?: string; code?: string }
  }

  const choice = payload.choices?.[0]
  const content = choice?.message?.content?.trim() || ''
  const refusal = choice?.message?.refusal
  const finishReason = choice?.finish_reason || null

  const meta: OpenAiResponseMeta = {
    id: payload.id || null,
    model: payload.model || null,
    finishReason,
    systemFingerprint: payload.system_fingerprint || null,
    promptTokens: payload.usage?.prompt_tokens ?? null,
    completionTokens: payload.usage?.completion_tokens ?? null,
    totalTokens: payload.usage?.total_tokens ?? null,
  }

  // OpenAI returned a top-level error (some APIs do this with 200)
  if (payload.error) {
    throw new OpenAiProviderError(
      'http',
      `OpenAI API error: ${payload.error.message || JSON.stringify(payload.error)}`,
      null
    )
  }

  // Model refused to generate (safety filter, etc.)
  if (refusal) {
    throw new OpenAiProviderError('non_json', `OpenAI model refused to generate: ${refusal}`)
  }

  // No content and no refusal — capture finish_reason for diagnosis
  if (!content) {
    const details = [
      finishReason ? `finish_reason=${finishReason}` : null,
      payload.model ? `model=${payload.model}` : null,
      payload.id ? `id=${payload.id}` : null,
    ].filter(Boolean).join(', ')
    throw new OpenAiProviderError(
      'non_json',
      `OpenAI returned empty content${details ? ` (${details})` : ''}`,
      null
    )
  }

  // Content present but finish_reason indicates truncation
  if (finishReason === 'length') {
    throw new OpenAiProviderError('non_json', `OpenAI response was truncated (finish_reason=length, max_completion_tokens=${config.maxTokens})`)
  }

  // Content present but finish_reason indicates content filtering
  if (finishReason === 'content_filter') {
    throw new OpenAiProviderError('non_json', 'OpenAI response was blocked by content filter')
  }

  const json = extractJson(content)
  if (json === null || typeof json !== 'object') {
    throw new OpenAiProviderError('non_json', `OpenAI returned content that is not valid JSON (finish_reason=${finishReason}, max_completion_tokens=${config.maxTokens})`)
  }
  const usage = payload.usage || {}
  return { json, usage, meta }
}