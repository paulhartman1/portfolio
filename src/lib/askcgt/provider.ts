import { generateStructuredJson as generateOpenAiJson, OpenAiProviderError, resolveOpenAiConfig, OpenAiConfig, OpenAiResponseMeta } from './openai'
import { generateAnthropicJson, resolveAnthropicConfig, AnthropicConfig } from '@/lib/project-intelligence/anthropic'
import { ProviderError } from '@/lib/project-intelligence/provider'
import { generateStructuredJson as generateOllamaJson, resolveOllamaConfig, OllamaConfig } from '@/lib/project-intelligence/ollama'

/**
 * AskCGT provider dispatch.
 *
 * The AskCGT reasoning model is behind a provider/model boundary. The caller
 * (ask.ts) never imports a vendor SDK directly; it asks this module for a
 * provider and calls generateAnswer. Swapping or routing models later means
 * changing this file (or its environment configuration), not AskCGT.
 *
 * Provider selection, highest precedence first:
 *   ASK_CGT_PROVIDER   AskCGT-specific override (openai|anthropic|ollama)
 *   AI_PROVIDER        the application-wide provider used by the rest of CGT
 *   'anthropic'        default, matching AI_PROVIDER's own default
 *
 * AskCGT previously defaulted to OpenAI and ignored AI_PROVIDER entirely, so a
 * deployment configured with AI_PROVIDER=anthropic silently required an
 * unrelated OPENAI_API_KEY and an OpenAI model name. Honoring AI_PROVIDER
 * keeps AskCGT on the same provider as project-intelligence unless Paul
 * deliberately overrides it.
 *
 * Model selection:
 *   ASK_CGT_MODEL (openai, default gpt-4o)
 *   ANTHROPIC_MODEL (anthropic, default claude-sonnet-4-6)
 *   OLLAMA_MODEL (ollama, default qwen3:8b)
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

export const ASK_CGT_ERROR_KINDS = [
  'not_configured',
  'auth',
  'rate_limit',
  'timeout',
  'overloaded',
  'unavailable',
  'invalid_response',
  'unknown',
] as const
export type AskCgtProviderErrorKind = (typeof ASK_CGT_ERROR_KINDS)[number]

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

export const DEFAULT_ASK_CGT_PROVIDER: AskCgtProviderKind = 'anthropic'

function normalizeProvider(raw: string | undefined): AskCgtProviderKind | null {
  if (!raw) return null
  const value = raw.toLowerCase().trim()
  if (!value) return null
  return ASK_CGT_PROVIDER_KINDS.includes(value as AskCgtProviderKind) ? (value as AskCgtProviderKind) : null
}

/**
 * The configured provider. ASK_CGT_PROVIDER wins; otherwise AskCGT follows the
 * application-wide AI_PROVIDER so one deployment variable governs both
 * features. An unrecognized value is reported rather than silently coerced.
 */
export function resolveProvider(): AskCgtProviderKind {
  const explicit = process.env.ASK_CGT_PROVIDER?.trim()
  if (explicit) {
    const resolved = normalizeProvider(explicit)
    if (!resolved) {
      throw new AskCgtProviderError(
        DEFAULT_ASK_CGT_PROVIDER,
        'not_configured',
        `ASK_CGT_PROVIDER="${explicit}" is not a supported AskCGT provider. Use one of: ${ASK_CGT_PROVIDER_KINDS.join(', ')}.`
      )
    }
    return resolved
  }

  const shared = process.env.AI_PROVIDER?.trim()
  if (shared) {
    const resolved = normalizeProvider(shared)
    if (!resolved) {
      throw new AskCgtProviderError(
        DEFAULT_ASK_CGT_PROVIDER,
        'not_configured',
        `AI_PROVIDER="${shared}" is not a provider AskCGT supports. Set ASK_CGT_PROVIDER to one of: ${ASK_CGT_PROVIDER_KINDS.join(', ')}.`
      )
    }
    return resolved
  }

  return DEFAULT_ASK_CGT_PROVIDER
}

/** Resolved model name for the configured provider (for usage reporting). */
export function resolveModelName(): string {
  const provider = resolveProvider()
  if (provider === 'openai') return resolveOpenAiConfig().model
  if (provider === 'anthropic') return resolveAnthropicConfig().model
  return resolveOllamaConfig().model
}

/**
 * Preflight the credential the SELECTED provider actually requires.
 *
 * Previously only the OpenAI branch was checked, so an anthropic/ollama
 * deployment passed preflight with no credential and failed later inside the
 * vendor call with a vaguer error. Never include a secret value in the
 * message — only the variable name.
 */
export function preflight(provider: AskCgtProviderKind): void {
  if (provider === 'openai') {
    const config = resolveOpenAiConfig()
    if (!config.apiKey) {
      throw new AskCgtProviderError(
        'openai',
        'not_configured',
        `OPENAI_API_KEY is not set, but AskCGT resolved provider "openai" (model ${config.model}). Set OPENAI_API_KEY, or set ASK_CGT_PROVIDER/AI_PROVIDER to a configured provider.`
      )
    }
    return
  }

  if (provider === 'anthropic') {
    const config = resolveAnthropicConfig()
    if (!config.apiKey) {
      throw new AskCgtProviderError(
        'anthropic',
        'not_configured',
        `ANTHROPIC_API_KEY is not set, but AskCGT resolved provider "anthropic" (model ${config.model}). Set ANTHROPIC_API_KEY, or set ASK_CGT_PROVIDER to a configured provider.`
      )
    }
    return
  }

  const config = resolveOllamaConfig()
  if (!config.baseUrl) {
    throw new AskCgtProviderError(
      'ollama',
      'not_configured',
      'OLLAMA_BASE_URL is not set and no default could be resolved for AskCGT provider "ollama".'
    )
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

  // anthropic/ollama surface project-intelligence's ProviderError. Its `kind`
  // vocabulary overlaps ours, so carry it across instead of flattening every
  // anthropic failure to 'unknown' (which would misreport a missing key or a
  // rate limit as an unexplained provider failure).
  if (error instanceof ProviderError) {
    const kind: AskCgtProviderErrorKind = (ASK_CGT_ERROR_KINDS as readonly string[]).includes(error.kind)
      ? (error.kind as AskCgtProviderErrorKind)
      : 'unknown'
    return new AskCgtProviderError(provider, kind, error.message, error.status)
  }

  return new AskCgtProviderError(provider, 'unknown', error instanceof Error ? error.message : String(error))
}

export type { OpenAiConfig, AnthropicConfig, OllamaConfig }
export { resolveOpenAiConfig }