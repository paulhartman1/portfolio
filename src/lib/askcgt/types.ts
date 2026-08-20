/**
 * AskCGT types.
 *
 * The reasoning model returns a structured answer over retrieved CGT
 * evidence. Every substantive conclusion must be traceable back to a
 * specific piece of retrieved evidence (transcript/utterance, observation,
 * session marker, or candidate). Model output is validated against the
 * retrieved set before it is returned to the caller.
 */

export const CONCLUSION_KINDS = ['evidence', 'inference', 'unknown'] as const
export type ConclusionKind = (typeof CONCLUSION_KINDS)[number]

export const EVIDENCE_TYPES = ['transcript', 'observation', 'marker', 'candidate'] as const
export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

/** A reference from a conclusion back to one retrieved evidence item. */
export type AskCgtEvidenceRef = {
  type: EvidenceType
  id: string
  /** Transcript utterance IDs, only valid when type === 'transcript'. */
  utteranceIds?: string[]
}

/** One substantive claim the model made. */
export type AskCgtConclusion = {
  statement: string
  kind: ConclusionKind
  confidence: number
  reasoning: string | null
  evidence: AskCgtEvidenceRef[]
}

/** The validated, provenance-checked response from the reasoning model. */
export type AskCgtAnswer = {
  answer: string
  conclusions: AskCgtConclusion[]
  unknowns: string[]
}

/** Usage metadata captured from the model call. */
export type AskCgtUsage = {
  provider: string
  model: string
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  durationMs: number
  evidenceItemsRetrieved: number
}