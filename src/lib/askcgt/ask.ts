import { SupabaseClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from './context'
import { generateAnswer, mapProviderError, preflight, resolveModelName, resolveProvider } from './provider'
import { AskCgtAnswer, AskCgtUsage } from './types'
import { retrieveProjectEvidence } from './retrieve'
import { validateAnswer } from './validation'

/**
 * AskCGT capability boundary.
 *
 * askCgt(...) owns the whole reasoning loop:
 *   project-scoped retrieval (RLS-enforced) → prompt construction → model →
 *   validation → usage. Callers never see vendor SDK details or the raw
 *   model output; they receive a validated answer plus usage metadata.
 *
 * Authorization happens BEFORE retrieval (the caller must already be an
 * authenticated user whose RLS policies permit reading the project's
 * evidence). AskCGT never persists anything the model says.
 */

export class AskCgtError extends Error {
  readonly code: 'invalid_input' | 'project_not_found' | 'model_unavailable' | 'provider_failure' | 'invalid_model_output'
  constructor(code: AskCgtError['code'], message: string) {
    super(message)
    this.name = 'AskCgtError'
    this.code = code
  }
}

const MAX_QUESTION_CHARS = 2000

export type AskCgtRequest = {
  supabase: SupabaseClient
  projectId: string
  question: string
}

export type AskCgtResult = {
  answer: AskCgtAnswer
  usage: AskCgtUsage
}

export async function askCgt(request: AskCgtRequest): Promise<AskCgtResult> {
  const { supabase, projectId, question } = request
  const log = (message: string, extra?: Record<string, unknown>) =>
    console.log(`[askcgt] ${message}`, extra ? JSON.stringify(extra) : '')
  const startedAt = Date.now()

  const trimmedQuestion = question?.trim() || ''
  if (!trimmedQuestion) {
    throw new AskCgtError('invalid_input', 'Question is required')
  }
  if (trimmedQuestion.length > MAX_QUESTION_CHARS) {
    throw new AskCgtError('invalid_input', `Question must be ${MAX_QUESTION_CHARS} characters or fewer`)
  }

  const provider = resolveProvider()
  try {
    preflight(provider)
  } catch (error) {
    const mapped = mapProviderError(provider, error)
    throw new AskCgtError('model_unavailable', mapped.message)
  }

  // Authorization before retrieval: the caller's RLS-enforced client is the
  // only client we use. If they cannot read the project, retrieval yields
  // nothing and AskCGT stops.
  let context
  try {
    const retrieved = await retrieveProjectEvidence(supabase, projectId)
    context = retrieved
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      throw new AskCgtError('project_not_found', error.message)
    }
    throw error
  }

  log('retrieve:done', {
    projectId,
    transcripts: context.context.transcripts.length,
    observations: context.context.observations.length,
    markers: context.context.markers.length,
    candidates: context.context.candidates.length,
    evidenceItemsRetrieved: context.evidenceItemsRetrieved,
  })

  const system = buildSystemPrompt()
  const user = buildUserPrompt({ ...context.context, question: trimmedQuestion })
  const systemChars = system.length
  const userChars = user.length
  const transcriptChars = context.context.transcripts.reduce((sum, t) => sum + t.utterances.reduce((uSum, u) => uSum + u.text.length, 0), 0)
  log('prompt', {
    systemChars,
    userChars,
    transcriptChars,
    totalChars: systemChars + userChars,
    questionChars: trimmedQuestion.length,
  })

  const modelStartedAt = Date.now()
  let raw: unknown
  let usageTokens: { prompt: number | null; completion: number | null; total: number | null } = { prompt: null, completion: null, total: null }
  try {
    const result = await generateAnswer(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      provider
    )
    raw = result.json
    usageTokens = {
      prompt: result.usage.promptTokens,
      completion: result.usage.completionTokens,
      total: result.usage.totalTokens,
    }
    if (result.meta) {
      log('model:response', {
        elapsedMs: Date.now() - modelStartedAt,
        provider,
        model: resolveModelName(),
        responseModel: result.meta.model,
        responseId: result.meta.id,
        finishReason: result.meta.finishReason,
        systemFingerprint: result.meta.systemFingerprint,
        promptTokens: result.meta.promptTokens,
        completionTokens: result.meta.completionTokens,
        totalTokens: result.meta.totalTokens,
      })
    } else {
      log('model:response', { elapsedMs: Date.now() - modelStartedAt, provider, model: resolveModelName() })
    }
  } catch (error) {
    const mapped = mapProviderError(provider, error)
    log('model:error', { elapsedMs: Date.now() - modelStartedAt, kind: mapped.kind, message: mapped.message })
    if (mapped.kind === 'not_configured' || mapped.kind === 'unavailable') {
      throw new AskCgtError('model_unavailable', mapped.message)
    }
    throw new AskCgtError('provider_failure', mapped.message)
  }

  const parsed = validateAnswer(raw, context.allowed)
  if (!parsed.ok) {
    log('validation:rejected', { reason: parsed.reason })
    throw new AskCgtError('invalid_model_output', `${provider} returned unusable output: ${parsed.reason}`)
  }

  const conclusionEvidenceCount = parsed.answer.conclusions.reduce((sum, c) => sum + c.evidence.length, 0)
  const usage: AskCgtUsage = {
    provider,
    model: resolveModelName(),
    promptTokens: usageTokens.prompt,
    completionTokens: usageTokens.completion,
    totalTokens: usageTokens.total,
    durationMs: Date.now() - startedAt,
    evidenceItemsRetrieved: context.evidenceItemsRetrieved,
  }
  log('done', {
    totalMs: usage.durationMs,
    model: usage.model,
    provider,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    conclusions: parsed.answer.conclusions.length,
    unknowns: parsed.answer.unknowns.length,
    conclusionEvidenceCount,
  })

  return { answer: parsed.answer, usage }
}