import Anthropic from '@anthropic-ai/sdk'
import { DEFAULT_ANTHROPIC_MODEL, ProviderMessage } from './types'

/**
 * Anthropic (Claude) provider. One of the interchangeable inference providers
 * behind `provider.ts`. Nothing outside this module knows the Claude SDK
 * details. It only returns parsed JSON; it never persists anything.
 */

export const ANTHROPIC_ERROR_KINDS = [
  'not_configured',
  'auth',
  'rate_limit',
  'timeout',
  'overloaded',
  'http',
  'non_json',
] as const

export type AnthropicErrorKind = (typeof ANTHROPIC_ERROR_KINDS)[number]

export class AnthropicProviderError extends Error {
  readonly kind: AnthropicErrorKind
  readonly status: number | null
  constructor(kind: AnthropicErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'AnthropicProviderError'
    this.kind = kind
    this.status = status
  }
}

export type AnthropicConfig = {
  apiKey: string | undefined
  model: string
  maxTokens: number
  requestTimeoutMs: number
}

export function resolveAnthropicConfig(): AnthropicConfig {
  const parsedMaxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS)
  const parsedTimeout = Number(process.env.ANTHROPIC_REQUEST_TIMEOUT_MS)
  return {
    apiKey: process.env.ANTHROPIC_API_KEY || undefined,
    model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    maxTokens: Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0 ? parsedMaxTokens : 8192,
    requestTimeoutMs: Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 120_000,
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

function mapSdkError(error: unknown): AnthropicProviderError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AnthropicProviderError('timeout', 'Claude request timed out')
  }
  if (error instanceof Anthropic.APIError) {
    const status = typeof error.status === 'number' ? error.status : null
    if (status === 401 || status === 403) {
      return new AnthropicProviderError('auth', `Claude authentication failed (status ${status}). Check ANTHROPIC_API_KEY.`, status)
    }
    if (status === 429) {
      return new AnthropicProviderError('rate_limit', 'Claude rate limit exceeded', status)
    }
    if (status === 529) {
      return new AnthropicProviderError('overloaded', 'Claude is temporarily overloaded', status)
    }
    if (status !== null && status >= 500) {
      return new AnthropicProviderError('overloaded', `Claude server error (status ${status})`, status)
    }
    return new AnthropicProviderError('http', `Claude request failed: ${error.message}`, status)
  }
  return new AnthropicProviderError('http', error instanceof Error ? error.message : String(error))
}

/**
 * Calls Claude and returns the structured (JSON) payload. Only parsed JSON is
 * returned; validation and persistence happen elsewhere.
 */
export async function generateAnthropicJson(
  messages: ProviderMessage[],
  config: AnthropicConfig
): Promise<unknown> {
  if (!config.apiKey) {
    throw new AnthropicProviderError('not_configured', 'ANTHROPIC_API_KEY is not set')
  }

  const client = new Anthropic({ apiKey: config.apiKey, timeout: config.requestTimeoutMs, maxRetries: 2 })

  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }))

  let response: Anthropic.Messages.Message
  try {
    response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: 0.2,
      ...(system ? { system } : {}),
      messages: conversation,
    })
  } catch (error) {
    throw mapSdkError(error)
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  if (!text.trim()) {
    const detail = response.stop_reason === 'max_tokens' ? ' (hit max_tokens)' : ''
    throw new AnthropicProviderError('non_json', `Claude returned an empty response${detail}`)
  }

  const json = extractJson(text)
  if (json === null || typeof json !== 'object') {
    const detail = response.stop_reason === 'max_tokens' ? ' (output truncated at max_tokens; raise ANTHROPIC_MAX_TOKENS)' : ''
    throw new AnthropicProviderError('non_json', `Claude returned content that is not valid JSON${detail}`)
  }
  return json
}
