import { ProviderMessage } from './types'
import { generateAnthropicJson, resolveAnthropicConfig, AnthropicProviderError } from './anthropic'
import { generateStructuredJson as generateOllamaJson, resolveOllamaConfig, isModelInstalled, OllamaProviderError } from './ollama'

/**
 * Unified provider interface. analyze.ts calls `resolveProvider` + `preflight`
 * + `generateStructuredJson` without knowing which backend is configured.
 */

export const PROVIDER_KINDS = ['anthropic', 'ollama'] as const
export type ProviderKind = (typeof PROVIDER_KINDS)[number]

export const PROVIDER_ERROR_KINDS = [
  'not_configured',
  'auth',
  'rate_limit',
  'timeout',
  'overloaded',
  'unavailable',
  'invalid_response',
  'unknown',
] as const
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number]

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly status: number | null
  readonly provider: ProviderKind
  constructor(provider: ProviderKind, kind: ProviderErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.kind = kind
    this.status = status
  }
}

export function resolveProvider(): ProviderKind {
  const raw = (process.env.AI_PROVIDER || 'anthropic').toLowerCase().trim()
  return PROVIDER_KINDS.includes(raw as ProviderKind) ? (raw as ProviderKind) : 'anthropic'
}

/** Lightweight preflight: API key present, Ollama model installed, etc. */
export async function preflight(provider: ProviderKind): Promise<void> {
  if (provider === 'anthropic') {
    const config = resolveAnthropicConfig()
    if (!config.apiKey) {
      throw new ProviderError('anthropic', 'not_configured', 'ANTHROPIC_API_KEY is not set')
    }
    return
  }

  // ollama
  const config = resolveOllamaConfig()
  try {
    const installed = await isModelInstalled(config, config.model)
    if (!installed) {
      throw new ProviderError('ollama', 'unavailable', `Ollama has no model matching "${config.model}". Run: ollama pull ${config.model}`)
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error
    throw new ProviderError('ollama', 'unknown', error instanceof OllamaProviderError ? error.message : 'Could not contact Ollama')
  }
}

/** Dispatches generateStructuredJson to the configured provider. */
export async function generateStructuredJson(
  messages: ProviderMessage[],
  provider: ProviderKind
): Promise<unknown> {
  if (provider === 'anthropic') {
    const config = resolveAnthropicConfig()
    return generateAnthropicJson(messages, config)
  }

  const config = resolveOllamaConfig()
  return generateOllamaJson(messages, config)
}

/** Maps a provider-specific error to the unified ProviderError. */
export function mapProviderError(provider: ProviderKind, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error

  if (provider === 'anthropic' && error instanceof AnthropicProviderError) {
    const kind: ProviderErrorKind =
      error.kind === 'not_configured' ? 'not_configured'
      : error.kind === 'auth' ? 'auth'
      : error.kind === 'rate_limit' ? 'rate_limit'
      : error.kind === 'timeout' ? 'timeout'
      : error.kind === 'overloaded' ? 'overloaded'
      : error.kind === 'non_json' ? 'invalid_response'
      : 'unknown'
    return new ProviderError('anthropic', kind, error.message, error.status)
  }

  if (provider === 'ollama' && error instanceof OllamaProviderError) {
    const kind: ProviderErrorKind =
      error.kind === 'model_missing' ? 'unavailable'
      : error.kind === 'not_reachable' ? 'unknown'
      : error.kind === 'timeout' ? 'timeout'
      : error.kind === 'non_json' ? 'invalid_response'
      : 'unknown'
    return new ProviderError('ollama', kind, error.message, error.status)
  }

  return new ProviderError(provider, 'unknown', error instanceof Error ? error.message : String(error))
}
