import { AskCgtAllowedIds } from './retrieve'
import { AskCgtAnswer, AskCgtCitationAudit, AskCgtConclusion, CONCLUSION_KINDS, ConclusionKind, EVIDENCE_TYPES, EvidenceType } from './types'

/**
 * Strict validation of AskCGT model output.
 *
 * The model may only cite evidence that was actually retrieved for this
 * project/user. Any reference outside the allowed sets is dropped. Malformed
 * output must never be returned to the caller as if it were CGT knowledge.
 */

export const MAX_ANSWER_CHARS = 20000
export const MAX_CONCLUSIONS = 12
export const MAX_STATEMENT_CHARS = 1500
export const MAX_REASONING_CHARS = 2000
export const MAX_EVIDENCE_REFS = 10
export const MAX_UTTERANCE_IDS = 40
export const MAX_UNKNOWNS = 20
export const MAX_UNKNOWN_CHARS = 800

export type ParseResult =
  | { ok: true; answer: AskCgtAnswer; citations: AskCgtCitationAudit }
  | { ok: false; reason: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function asConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100))
}

function asUtteranceIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids = value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  if (ids.length === 0) return null
  return Array.from(new Set(ids)).slice(0, MAX_UTTERANCE_IDS)
}

function validateEvidenceRef(raw: unknown, allowed: AskCgtAllowedIds): { type: EvidenceType; id: string; utteranceIds?: string[] } | null {
  const record = asRecord(raw)
  if (!record) return null
  const typeRaw = asString(record.type, 20)
  if (!typeRaw || !(EVIDENCE_TYPES as readonly string[]).includes(typeRaw)) return null
  const type = typeRaw as EvidenceType
  const id = asString(record.id, 64)
  if (!id) return null

  if (type === 'transcript') {
    if (!allowed.transcripts.has(id)) return null
    const utteranceIds = asUtteranceIds(record.utteranceIds)
    const allowedForTranscript = allowed.utterancesByTranscript.get(id)
    if (!allowedForTranscript) return null
    const scoped = utteranceIds ? utteranceIds.filter((u) => allowedForTranscript.has(u)) : []
    return { type, id, utteranceIds: scoped }
  }

  // Every citable type must map to an allow-list set. A type with no set would
  // silently accept anything, so the mapping is exhaustive by construction.
  const set =
    type === 'observation' ? allowed.observations
    : type === 'marker' ? allowed.markers
    : type === 'candidate' ? allowed.candidates
    : type === 'experiment' ? allowed.experiments
    : type === 'proposal' ? allowed.proposals
    : type === 'work_item' ? allowed.workItems
    : type === 'decision' ? allowed.decisions
    : allowed.findings
  if (!set.has(id)) return null
  return { type, id }
}

type ConclusionResult = { conclusion: AskCgtConclusion; submitted: number; accepted: number }

function validateConclusion(raw: unknown, allowed: AskCgtAllowedIds): ConclusionResult | null {
  const record = asRecord(raw)
  if (!record) return null

  const statement = asString(record.statement, MAX_STATEMENT_CHARS)
  if (!statement) return null

  const kindRaw = asString(record.kind, 20)
  if (!kindRaw || !(CONCLUSION_KINDS as readonly string[]).includes(kindRaw)) return null
  const kind = kindRaw as ConclusionKind

  const confidence = asConfidence(record.confidence) ?? 0.5
  const reasoning = asString(record.reasoning, MAX_REASONING_CHARS) ?? null

  let evidence: AskCgtConclusion['evidence'] = []
  let submitted = 0
  if (Array.isArray(record.evidence)) {
    submitted = record.evidence.length
    evidence = record.evidence
      .map((ref) => validateEvidenceRef(ref, allowed))
      .filter((ref): ref is { type: EvidenceType; id: string; utteranceIds?: string[] } => Boolean(ref))
      .slice(0, MAX_EVIDENCE_REFS)
  }

  return { conclusion: { statement, kind, confidence, reasoning, evidence }, submitted, accepted: evidence.length }
}

export function validateAnswer(raw: unknown, allowed: AskCgtAllowedIds): ParseResult {
  const record = asRecord(raw)
  if (!record) return { ok: false, reason: 'expected an object payload' }

  const answer = asString(record.answer, MAX_ANSWER_CHARS)
  if (!answer) return { ok: false, reason: 'missing answer text' }

  const conclusions: AskCgtConclusion[] = []
  let submitted = 0
  let accepted = 0
  if (Array.isArray(record.conclusions)) {
    for (const item of record.conclusions) {
      const result = validateConclusion(item, allowed)
      if (result) {
        conclusions.push(result.conclusion)
        submitted += result.submitted
        accepted += result.accepted
        if (conclusions.length >= MAX_CONCLUSIONS) break
      }
    }
  }

  let unknowns: string[] = []
  if (Array.isArray(record.unknowns)) {
    unknowns = record.unknowns
      .map((unknown) => asString(unknown, MAX_UNKNOWN_CHARS))
      .filter((unknown): unknown is string => Boolean(unknown))
      .slice(0, MAX_UNKNOWNS)
  }

  return {
    ok: true,
    answer: { answer, conclusions, unknowns },
    citations: { submitted, accepted, rejected: Math.max(0, submitted - accepted) },
  }
}