import { generateStructuredJson as generateOpenAiJson, OpenAiProviderError, resolveOpenAiConfig, OpenAiConfig, OpenAiResponseMeta } from './openai'
import { generateAnthropicJson, resolveAnthropicConfig, AnthropicConfig } from '@/lib/project-intelligence/anthropic'
import { generateStructuredJson as generateOllamaJson, resolveOllamaConfig, OllamaConfig } from '@/lib/project-intelligence/ollama'

/**
 * AskCGT provider dispatch.
 *
 * The AskCGT reasoning model is behind a provider/model boundary. The caller
 * (ask.ts) never imports a vendor SDK directly; it asks this module for a
 * provider and calls generateAnswer. Swapping or routing models later means
 * changing this file (or its environment configuration), not AskCGT.
 *
 * Provider selection (default: openai):
 *   ASK_CGT_PROVIDER=openai|anthropic|ollama
 *
 * Model selection:
 *   ASK_CGT_MODEL (openai, default gpt-5.6-luna)
 *   ANTHROPIC_MODEL (anthropic)
 *   OLLAMA_MODEL (ollama)
 */

export const ASK_CGT_PROVIDER_KINDS = ['openai', 'anthropic', 'ollama'] as const
export type AskCgtProviderKind = (typeof ASK_CGT_PROVIDER_KINDS)[number]

export type ProviderMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type AskCgtProviderUsage = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export type AskCgtProviderResult = {
  json: unknown
  usage: AskCgtProviderUsage
  meta?: OpenAiResponseMeta
}

export type AskCgtProviderErrorKind = 'not_configured' | 'auth' | 'rate_limit' | 'timeout' | 'overloaded' | 'unavailable' | 'invalid_response' | 'unknown'

export class AskCgtProviderError extends Error {
  readonly provider: AskCgtProviderKind
  readonly kind: AskCgtProviderErrorKind
  readonly status: number | null
  constructor(provider: AskCgtProviderKind, kind: AskCgtProviderErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'AskCgtProviderError'
    this.provider = provider
    this.kind = kind
    this.status = status
  }
}

export function resolveProvider(): AskCgtProviderKind {
  const raw = (process.env.ASK_CGT_PROVIDER || 'openai').toLowerCase().trim()
  return ASK_CGT_PROVIDER_KINDS.includes(raw as AskCgtProviderKind) ? (raw as AskCgtProviderKind) : 'openai'
}

/** Resolved model name for the configured provider (for usage reporting). */
export function resolveModelName(): string {
  const provider = resolveProvider()
  if (provider === 'openai') return resolveOpenAiConfig().model
  if (provider === 'anthropic') return resolveAnthropicConfig().model
  return resolveOllamaConfig().model
}

/** Lightweight preflight: required credential present. */
export function preflight(provider: AskCgtProviderKind): void {
  if (provider === 'openai') {
    const config = resolveOpenAiConfig()
    if (!config.apiKey) {
      throw new AskCgtProviderError('openai', 'not_configured', 'OPENAI_API_KEY is not set. AskCGT uses OpenAI (gpt-5.6-luna) by default.')
    }
  }
}

/** Dispatch generateAnswer to the configured provider. */
export async function generateAnswer(
  messages: ProviderMessage[],
  provider: AskCgtProviderKind
): Promise<AskCgtProviderResult> {
  if (provider === 'openai') {
    const config = resolveOpenAiConfig()
    const { json, usage, meta } = await generateOpenAiJson(messages, config)
    return {
      json,
      usage: {
        promptTokens: usage.prompt_tokens ?? null,
        completionTokens: usage.completion_tokens ?? null,
        totalTokens: usage.total_tokens ?? null,
      },
      meta,
    }
  }

  if (provider === 'anthropic') {
    const config = resolveAnthropicConfig()
    const json = await generateAnthropicJson(messages, config)
    return { json, usage: { promptTokens: null, completionTokens: null, totalTokens: null } }
  }

  const config = resolveOllamaConfig()
  const json = await generateOllamaJson(messages, config)
  return { json, usage: { promptTokens: null, completionTokens: null, totalTokens: null } }
}

/** Maps a provider-specific error to the unified AskCgtProviderError. */
export function mapProviderError(provider: AskCgtProviderKind, error: unknown): AskCgtProviderError {
  if (error instanceof AskCgtProviderError) return error

  if (provider === 'openai' && error instanceof OpenAiProviderError) {
    const kind: AskCgtProviderErrorKind =
      error.kind === 'not_configured' ? 'not_configured'
      : error.kind === 'auth' ? 'auth'
      : error.kind === 'rate_limit' ? 'rate_limit'
      : error.kind === 'timeout' ? 'timeout'
      : error.kind === 'overloaded' ? 'overloaded'
      : error.kind === 'non_json' ? 'invalid_response'
      : 'unknown'
    return new AskCgtProviderError('openai', kind, error.message, error.status)
  }

  return new AskCgtProviderError(provider, 'unknown', error instanceof Error ? error.message : String(error))
}

export type { OpenAiConfig, AnthropicConfig, OllamaConfig }
export { resolveOpenAiConfig }