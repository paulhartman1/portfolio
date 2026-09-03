import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AskCgtProviderError, preflight, resolveModelName, resolveProvider } from './provider'
import { DEFAULT_ASK_CGT_MODEL } from './openai'

/**
 * Provider configuration.
 *
 * Two real defects are covered here: AskCGT ignored AI_PROVIDER (so a
 * deployment configured for anthropic silently required an OpenAI key), and
 * preflight only validated the OpenAI credential regardless of which provider
 * was selected.
 */

const KEYS = ['ASK_CGT_PROVIDER', 'AI_PROVIDER', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ASK_CGT_MODEL', 'ANTHROPIC_MODEL'] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('resolveProvider', () => {
  it('defaults to anthropic, matching the rest of the application', () => {
    expect(resolveProvider()).toBe('anthropic')
  })

  it('honors AI_PROVIDER when ASK_CGT_PROVIDER is unset', () => {
    process.env.AI_PROVIDER = 'ollama'
    expect(resolveProvider()).toBe('ollama')
  })

  it('lets ASK_CGT_PROVIDER override AI_PROVIDER', () => {
    process.env.AI_PROVIDER = 'anthropic'
    process.env.ASK_CGT_PROVIDER = 'openai'
    expect(resolveProvider()).toBe('openai')
  })

  it('accepts each supported provider', () => {
    for (const provider of ['openai', 'anthropic', 'ollama']) {
      process.env.ASK_CGT_PROVIDER = provider
      expect(resolveProvider()).toBe(provider)
    }
  })

  it('is case and whitespace insensitive', () => {
    process.env.AI_PROVIDER = '  Anthropic  '
    expect(resolveProvider()).toBe('anthropic')
  })

  // Previously an unrecognized value was silently coerced to openai, which is
  // how a deployment ends up on an unconfigured provider without any signal.
  it('gives a clear diagnostic for an invalid ASK_CGT_PROVIDER instead of silently coercing', () => {
    process.env.ASK_CGT_PROVIDER = 'gemini'
    expect(() => resolveProvider()).toThrow(AskCgtProviderError)
    expect(() => resolveProvider()).toThrow(/ASK_CGT_PROVIDER="gemini" is not a supported/)
  })

  it('gives a clear diagnostic for an AI_PROVIDER AskCGT cannot use', () => {
    process.env.AI_PROVIDER = 'bedrock'
    expect(() => resolveProvider()).toThrow(/AI_PROVIDER="bedrock" is not a provider AskCGT supports/)
  })

  it('names the supported providers in the diagnostic', () => {
    process.env.ASK_CGT_PROVIDER = 'nope'
    expect(() => resolveProvider()).toThrow(/openai, anthropic, ollama/)
  })
})

describe('resolveModelName', () => {
  it('reports the anthropic model by default', () => {
    expect(resolveModelName()).toBe('claude-sonnet-4-6')
  })

  it('reports the configured anthropic model', () => {
    process.env.ANTHROPIC_MODEL = 'claude-opus-4-1'
    expect(resolveModelName()).toBe('claude-opus-4-1')
  })

  it('reports a real OpenAI model when openai is selected', () => {
    process.env.ASK_CGT_PROVIDER = 'openai'
    expect(resolveModelName()).toBe(DEFAULT_ASK_CGT_MODEL)
  })

  // The old default, 'gpt-5.6-luna', is not a model the OpenAI API serves.
  it('does not use a non-existent default OpenAI model', () => {
    expect(DEFAULT_ASK_CGT_MODEL).not.toBe('gpt-5.6-luna')
    expect(DEFAULT_ASK_CGT_MODEL).toMatch(/^gpt-/)
  })
})

describe('preflight', () => {
  it('validates the ANTHROPIC key when anthropic is selected', () => {
    expect(() => preflight('anthropic')).toThrow(/ANTHROPIC_API_KEY is not set/)
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(() => preflight('anthropic')).not.toThrow()
  })

  it('validates the OPENAI key when openai is selected', () => {
    expect(() => preflight('openai')).toThrow(/OPENAI_API_KEY is not set/)
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(() => preflight('openai')).not.toThrow()
  })

  // Before the repair, preflight('anthropic') passed with no anthropic key
  // because only the openai branch was checked.
  it('does not accept an OpenAI key as a substitute for the anthropic credential', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(() => preflight('anthropic')).toThrow(/ANTHROPIC_API_KEY is not set/)
  })

  it('does not accept an anthropic key as a substitute for the OpenAI credential', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(() => preflight('openai')).toThrow(/OPENAI_API_KEY is not set/)
  })

  it('names the resolved provider and model in the diagnostic', () => {
    expect(() => preflight('anthropic')).toThrow(/provider "anthropic" \(model claude-sonnet-4-6\)/)
  })

  it('never includes the secret value in the diagnostic', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-super-secret-value'
    process.env.ASK_CGT_PROVIDER = 'openai'
    try {
      preflight('openai')
      throw new Error('expected preflight to throw')
    } catch (error) {
      expect((error as Error).message).not.toContain('super-secret-value')
    }
  })

  it('accepts ollama, which needs a base URL rather than a key', () => {
    expect(() => preflight('ollama')).not.toThrow()
  })
})
