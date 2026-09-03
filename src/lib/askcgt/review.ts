import { SupabaseClient } from '@supabase/supabase-js'
import { AskCgtAllowedIds, retrieveProjectEvidence } from './retrieve'
import { AskCgtEvidenceRef, CONCLUSION_KINDS, ConclusionKind, EVIDENCE_TYPES, EvidenceType } from './types'
import { FindingReviewStatus } from '@/lib/experiments/types'

/**
 * Human review of a single AskCGT conclusion.
 *
 * The epistemic contract this module enforces:
 *
 *   Source material remains evidence.
 *   An AskCGT conclusion is a proposed interpretation.
 *   Paul's acceptance makes it a reviewed FINDING linked to evidence —
 *   it does not make it evidence.
 *
 * Nothing here trusts the client. The conclusion text, its epistemic class and
 * its citations all arrive from the browser, so every citation is re-validated
 * against evidence re-retrieved server-side through the caller's own
 * RLS-scoped client at acceptance time. A citation that was valid when the
 * answer was produced but has since become unavailable STOPS the acceptance
 * rather than being silently dropped — a finding must never be presented as
 * grounded in evidence that no longer supports it.
 */

export class AskCgtReviewError extends Error {
  readonly code:
    | 'invalid_input'
    | 'project_not_found'
    | 'experiment_not_found'
    | 'invalid_citations'
    | 'already_accepted'
    | 'write_failed'
  readonly details?: Record<string, unknown>
  constructor(code: AskCgtReviewError['code'], message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AskCgtReviewError'
    this.code = code
    this.details = details
  }
}

export const MAX_STATEMENT_CHARS = 1500
export const MAX_INTERPRETATION_CHARS = 2000
export const MAX_CITATIONS = 20

export type AcceptConclusionRequest = {
  supabase: SupabaseClient
  /** The authenticated admin performing the review. Never client-supplied. */
  reviewerId: string
  projectId: string
  experimentId: string
  /** The model's original wording, preserved verbatim. */
  proposedStatement: string
  /** The wording to commit. Equal to proposedStatement unless Paul edited it. */
  acceptedStatement: string
  proposedInterpretation?: string | null
  acceptedInterpretation?: string | null
  epistemicType: ConclusionKind
  proposedConfidence?: number | null
  citations: AskCgtEvidenceRef[]
  model?: string | null
  provider?: string | null
}

export type AcceptConclusionResult = {
  findingId: string
  reviewStatus: FindingReviewStatus
  /** Citations actually persisted. Always equal in length to the submitted set. */
  citationsPersisted: number
  wasEdited: boolean
}

function normalize(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

/** Maps a citable evidence type to its allow-list set. Exhaustive by construction. */
function allowedSetFor(type: EvidenceType, allowed: AskCgtAllowedIds): Set<string> {
  switch (type) {
    case 'transcript':
      return allowed.transcripts
    case 'observation':
      return allowed.observations
    case 'marker':
      return allowed.markers
    case 'candidate':
      return allowed.candidates
    case 'experiment':
      return allowed.experiments
    case 'proposal':
      return allowed.proposals
    case 'work_item':
      return allowed.workItems
    case 'decision':
      return allowed.decisions
    case 'finding':
      return allowed.findings
  }
}

/**
 * Maps a citation to the evidence_links row that preserves it as a typed
 * reference with its full canonical identifier.
 *
 * Citations are never stored as formatted display strings: the repository
 * already has a canonical typed-reference pattern (evidence_links) and losing
 * the type or truncating the id is exactly the defect that made earlier
 * AskCGT citations unusable.
 */
function evidenceLinkRow(findingId: string, ref: AskCgtEvidenceRef): Record<string, unknown> {
  const base = { subject_finding_id: findingId, role: 'supporting' as const }
  switch (ref.type) {
    case 'transcript':
      return {
        ...base,
        source_kind: 'transcript_utterance',
        source_transcript_id: ref.id,
        // May legitimately be empty: a transcript-level citation with no
        // specific utterance is still a real reference.
        source_utterance_ids: ref.utteranceIds && ref.utteranceIds.length > 0 ? ref.utteranceIds : null,
      }
    case 'observation':
      return { ...base, source_kind: 'observation', source_observation_id: ref.id }
    case 'marker':
      return { ...base, source_kind: 'session_marker', source_marker_id: ref.id }
    case 'candidate':
      return { ...base, source_kind: 'intelligence_candidate', source_candidate_id: ref.id }
    case 'experiment':
      return { ...base, source_kind: 'experiment', source_experiment_id: ref.id }
    case 'proposal':
      return { ...base, source_kind: 'proposal', source_proposal_id: ref.id }
    case 'work_item':
      return { ...base, source_kind: 'work_item', source_work_item_id: ref.id }
    case 'decision':
      return { ...base, source_kind: 'decision', source_decision_id: ref.id }
    case 'finding':
      // A reviewed finding supported by another reviewed finding. Recorded as
      // a note so the chain is visible; there is no source_finding_id column
      // and adding one is not needed for this change.
      return { ...base, source_kind: 'external', source_label: `reviewed finding ${ref.id}` }
  }
}

/**
 * Parses and shape-checks client-submitted citations.
 *
 * Authorization is NOT done here — that requires the live allow-list.
 */
export function parseCitations(raw: unknown): AskCgtEvidenceRef[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const refs: AskCgtEvidenceRef[] = []
  for (const entry of raw.slice(0, MAX_CITATIONS)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const record = entry as Record<string, unknown>
    const type = normalize(record.type, 20)
    const id = normalize(record.id, 64)
    if (!type || !id || !(EVIDENCE_TYPES as readonly string[]).includes(type)) continue
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    const utteranceIds = Array.isArray(record.utteranceIds)
      ? Array.from(
          new Set(
            record.utteranceIds.filter((u): u is string => typeof u === 'string' && u.trim().length > 0).slice(0, 40)
          )
        )
      : undefined
    refs.push({ type: type as EvidenceType, id, ...(utteranceIds ? { utteranceIds } : {}) })
  }
  return refs
}

/**
 * Accepts one AskCGT conclusion as a durable, human-reviewed finding.
 *
 * Order of operations matters and is deliberate:
 *   1. shape-validate the submitted claim;
 *   2. re-retrieve evidence server-side (this proves the experiment belongs to
 *      the project AND rebuilds the live allow-list);
 *   3. re-validate every citation against that allow-list;
 *   4. only then write.
 *
 * A failure at any step writes nothing.
 */
export async function acceptConclusion(request: AcceptConclusionRequest): Promise<AcceptConclusionResult> {
  const {
    supabase,
    reviewerId,
    projectId,
    experimentId,
    epistemicType,
    citations,
    model,
    provider,
    proposedConfidence,
  } = request

  if (!reviewerId) {
    throw new AskCgtReviewError('invalid_input', 'A reviewer identity is required')
  }
  if (!experimentId) {
    throw new AskCgtReviewError('invalid_input', 'experimentId is required to accept a finding')
  }

  const proposedStatement = normalize(request.proposedStatement, MAX_STATEMENT_CHARS)
  const acceptedStatement = normalize(request.acceptedStatement, MAX_STATEMENT_CHARS)
  if (!proposedStatement) {
    throw new AskCgtReviewError('invalid_input', 'The original conclusion text is required')
  }
  if (!acceptedStatement) {
    throw new AskCgtReviewError('invalid_input', 'The accepted finding text cannot be empty')
  }
  if (!(CONCLUSION_KINDS as readonly string[]).includes(epistemicType)) {
    throw new AskCgtReviewError('invalid_input', `Unknown epistemic type "${epistemicType}"`)
  }

  const proposedInterpretation = normalize(request.proposedInterpretation, MAX_INTERPRETATION_CHARS)
  const acceptedInterpretation = normalize(request.acceptedInterpretation, MAX_INTERPRETATION_CHARS)

  const wasEdited =
    acceptedStatement !== proposedStatement ||
    (acceptedInterpretation ?? null) !== (proposedInterpretation ?? null)
  const reviewStatus: FindingReviewStatus = acceptedStatement !== proposedStatement ? 'accepted_edited' : 'accepted'

  // Step 2: re-retrieve. retrieveProjectEvidence verifies experiment→project
  // ownership itself and throws when the experiment is missing, hidden by RLS,
  // or belongs to another project.
  let allowed: AskCgtAllowedIds
  try {
    const retrieved = await retrieveProjectEvidence(supabase, projectId, { experimentId })
    allowed = retrieved.allowed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'Project not found') {
      throw new AskCgtReviewError('project_not_found', 'Project not found or not accessible')
    }
    if (message === 'Experiment not found') {
      throw new AskCgtReviewError(
        'experiment_not_found',
        'Experiment not found, not accessible, or does not belong to this project'
      )
    }
    throw error
  }

  // Step 3: every citation must still be valid. Unavailable citations stop the
  // acceptance and are reported, never dropped.
  const rejected: Array<{ type: string; id: string }> = []
  for (const ref of citations) {
    const set = allowedSetFor(ref.type, allowed)
    if (!set.has(ref.id)) {
      rejected.push({ type: ref.type, id: ref.id })
      continue
    }
    if (ref.type === 'transcript' && ref.utteranceIds?.length) {
      const allowedUtterances = allowed.utterancesByTranscript.get(ref.id)
      const bad = ref.utteranceIds.filter((u) => !allowedUtterances?.has(u))
      if (bad.length > 0) rejected.push({ type: 'transcript:utterance', id: bad.join(',') })
    }
  }
  if (rejected.length > 0) {
    throw new AskCgtReviewError(
      'invalid_citations',
      `${rejected.length} citation(s) are no longer valid for this experiment, so the finding was not saved. ` +
        'They may be fabricated, from another project, or no longer accessible.',
      { rejected }
    )
  }

  // Step 4: write. The finding first, then its citations.
  const { data: finding, error: findingError } = await supabase
    .from('experiment_findings')
    .insert({
      project_id: projectId,
      experiment_id: experimentId,
      statement: acceptedStatement,
      interpretation: acceptedInterpretation,
      origin: 'askcgt',
      proposed_statement: proposedStatement,
      proposed_interpretation: proposedInterpretation,
      proposed_confidence:
        typeof proposedConfidence === 'number' && Number.isFinite(proposedConfidence)
          ? Math.min(1, Math.max(0, proposedConfidence))
          : null,
      epistemic_type: epistemicType,
      review_status: reviewStatus,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      model: model ?? null,
      provider: provider ?? null,
      created_by: reviewerId,
      // supports_hypothesis is intentionally left at its 'inconclusive'
      // default. Accepting that a claim is a reasonable interpretation of the
      // evidence is NOT the same as judging that it supports the hypothesis.
    })
    .select('id, review_status')
    .single()

  if (findingError || !finding) {
    // 23505 = unique_violation on uniq_experiment_findings_askcgt_proposal.
    if (findingError?.code === '23505') {
      throw new AskCgtReviewError(
        'already_accepted',
        'This conclusion has already been accepted as a finding for this experiment.'
      )
    }
    throw new AskCgtReviewError('write_failed', `Could not save the finding: ${findingError?.message ?? 'unknown error'}`)
  }

  if (citations.length > 0) {
    const { error: linkError } = await supabase
      .from('evidence_links')
      .insert(citations.map((ref) => evidenceLinkRow(finding.id, ref)))

    if (linkError) {
      // A finding whose citations failed to persist would read as grounded
      // while being unsupported. Roll the finding back rather than leave that
      // behind, and report the failure honestly.
      await supabase.from('experiment_findings').delete().eq('id', finding.id)
      throw new AskCgtReviewError(
        'write_failed',
        `The finding was not saved because its evidence references could not be stored: ${linkError.message}`
      )
    }
  }

  return {
    findingId: finding.id as string,
    reviewStatus,
    citationsPersisted: citations.length,
    wasEdited,
  }
}
