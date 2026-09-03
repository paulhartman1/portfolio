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

/**
 * Citable evidence types.
 *
 * 'experiment' and 'proposal' were added so the record under discussion and
 * its commercial/approval provenance can be cited directly. Every type here
 * MUST be rendered into the prompt with its full canonical identifier and
 * MUST have a corresponding allow-list set in AskCgtAllowedIds — otherwise the
 * model is invited to cite something that validation will always reject.
 */
export const EVIDENCE_TYPES = [
  'transcript',
  'observation',
  'marker',
  'candidate',
  'experiment',
  'proposal',
  'work_item',
  'decision',
  // A prior AskCGT conclusion that a human reviewed and accepted. Citable
  // because it carries more authority than an unreviewed candidate — but it
  // remains a reviewed interpretation, never a source fact.
  'finding',
] as const
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

/**
 * How many citations the model submitted vs how many survived allow-list
 * validation.
 *
 * Validation silently dropping a citation used to be invisible: a conclusion
 * whose every reference was rejected rendered as a bare claim, and Paul could
 * not tell "the model chose not to cite" from "the pipeline destroyed the
 * citation". A non-zero `rejected` means the answer is less grounded than it
 * looks and must be surfaced.
 */
export type AskCgtCitationAudit = {
  submitted: number
  accepted: number
  rejected: number
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