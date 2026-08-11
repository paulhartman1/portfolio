import {
  AiCandidateInput,
  CANDIDATE_TYPES,
  CandidateType,
  EVIDENCE_ROLES,
  EvidenceRef,
  EvidenceRole,
} from './types'

/**
 * Strict validation of model output before anything touches CGT state.
 * Malformed model output must never corrupt CGT state.
 */

export class ModelOutputError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(`Invalid model output: ${reason}`)
    this.name = 'ModelOutputError'
    this.reason = reason
  }
}

const MAX_CANDIDATES = 8
const MAX_CONTENT = 2000
const MAX_SUMMARY = 3000
const MAX_UTTERANCE_IDS = 40

export type AllowedIds = {
  transcripts: Set<string>
  utterancesByTranscript: Map<string, Set<string>>
}

export type ParseResult = { ok: true; candidates: AiCandidateInput[] } | { ok: false; reason: string }

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

function validateEvidence(raw: unknown, allowed: AllowedIds): EvidenceRef[] {
  if (!Array.isArray(raw)) return []
  const valid: EvidenceRef[] = []
  for (const item of raw) {
    const record = asRecord(item)
    if (!record) continue
    const transcriptId = asString(record.transcriptId ?? record.transcript_id, 64)
    if (!transcriptId || !allowed.transcripts.has(transcriptId)) continue
    const utteranceIds = asUtteranceIds(record.utteranceIds ?? record.utterance_ids)
    if (!utteranceIds) continue
    const allowedForTranscript = allowed.utterancesByTranscript.get(transcriptId)
    if (!allowedForTranscript) continue
    const scoped = utteranceIds.filter((id) => allowedForTranscript.has(id))
    if (scoped.length === 0) continue
    const roleRaw = asString(record.role, 20)
    const role: EvidenceRole = roleRaw && (EVIDENCE_ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as EvidenceRole) : 'context'
    valid.push({ transcriptId, utteranceIds: scoped, role })
  }
  return valid
}

export function validateCandidate(raw: unknown, allowed: AllowedIds): AiCandidateInput | null {
  const record = asRecord(raw)
  if (!record) return null

  const type = asString(record.type, 40)
  if (!type || !(CANDIDATE_TYPES as readonly string[]).includes(type)) return null

  const content = asString(record.content, MAX_CONTENT)
  if (!content) return null

  const reasoningSummary = asString(record.reasoningSummary ?? record.reasoning_summary, MAX_SUMMARY) ?? ''

  const confidence = asConfidence(record.confidence) ?? 0.5

  const evidence = validateEvidence(record.evidence, allowed)

  const relatedRaw = record.relatedHypothesisIds
  const relatedHypothesisIds = Array.isArray(relatedRaw)
    ? Array.from(new Set(relatedRaw.filter((id): id is string => typeof id === 'string'))).slice(0, 20)
    : []

  return {
    type: type as CandidateType,
    content,
    reasoningSummary,
    confidence,
    evidence,
    relatedHypothesisIds,
  }
}

/**
 * Normalizes whatever the model returned (an array, or {candidates:[...]})
 * into validated candidate inputs. Returns { ok:false } when the payload shape
 * is unusable at all (fail safe, nothing persisted).
 */
export function parseModelResponse(raw: unknown, allowed: AllowedIds): ParseResult {
  let candidateList: unknown
  if (Array.isArray(raw)) {
    candidateList = raw
  } else {
    const record = asRecord(raw)
    if (!record) return { ok: false, reason: 'expected an array or object payload' }
    const explicit = record.candidates
    if (Array.isArray(explicit)) {
      candidateList = explicit
    } else if (Array.isArray(record.insights)) {
      candidateList = record.insights
    } else {
      return { ok: false, reason: 'no candidates array in payload' }
    }
  }

  const candidates: AiCandidateInput[] = []
  for (const item of candidateList as unknown[]) {
    const candidate = validateCandidate(item, allowed)
    if (candidate) {
      candidates.push(candidate)
      if (candidates.length >= MAX_CANDIDATES) break
    }
  }

  return { ok: true, candidates }
}

export { ModelOutputError as MalformedModelOutputError }