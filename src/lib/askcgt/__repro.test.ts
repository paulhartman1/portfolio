// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { retrieveProjectEvidence } from '@/lib/askcgt/retrieve'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/askcgt/context'
import Anthropic from '@anthropic-ai/sdk'
import { describe, it } from 'vitest'

const PROJECT = '6e63bb4e-0218-462c-a946-e528fdc94452'

describe('repro', () => {
  it('reproduces the anthropic failure with the real payload', async () => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const res = await retrieveProjectEvidence(sb as never, PROJECT)
    const system = buildSystemPrompt()
    const user = buildUserPrompt({ ...res.context, question: 'What should I do next?' })
    console.log('sizes:', { systemChars: system.length, userChars: user.length, total: system.length + user.length })

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 120000, maxRetries: 0 })

    // 1. Token count first — cheap, tells us if the payload is even acceptable.
    try {
      const counted = await client.messages.countTokens({
        model: 'claude-sonnet-4-6',
        system,
        messages: [{ role: 'user', content: user }],
      })
      console.log('COUNT TOKENS OK:', JSON.stringify(counted))
    } catch (e) {
      const err = e as Error & { cause?: unknown; status?: number }
      console.log('COUNT TOKENS FAILED:', err.constructor.name, err.message, 'status=', err.status)
      console.log('  cause:', err.cause ? String(err.cause) : 'none')
    }

    // 2. The real call, with the cause unwrapped.
    try {
      const r = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: user }],
      })
      console.log('CREATE OK stop_reason=', r.stop_reason, 'usage=', JSON.stringify(r.usage))
    } catch (e) {
      const err = e as Error & { cause?: unknown; status?: number; name?: string }
      console.log('CREATE FAILED:', err.constructor.name, '|', err.message, '| status=', err.status)
      let c: unknown = err.cause
      let depth = 0
      while (c && depth < 5) {
        const ce = c as Error & { cause?: unknown; code?: string; errno?: number }
        console.log(`  cause[${depth}]:`, ce.constructor?.name, '|', ce.message, '| code=', ce.code, '| errno=', ce.errno)
        c = ce.cause
        depth += 1
      }
    }
  }, 300000)
})
