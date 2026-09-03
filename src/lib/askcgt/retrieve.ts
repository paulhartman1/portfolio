import { SupabaseClient } from '@supabase/supabase-js'
import { computeWorkMeasures, CriterionResult, evaluateExp003Criteria, WorkMeasures } from '@/lib/work/measures'
import { Decision, EvidenceLink, WorkItem, WorkItemEvent } from '@/lib/work/types'

/**
 * Project-scoped evidence retrieval for AskCGT.
 *
 * Everything is queried through the caller's RLS-enforced Supabase client.
 * Retrieval NEVER bypasses RLS (no service role here) and every query is
 * scoped by project_id so an authenticated user can only ever retrieve
 * evidence their own policies permit. AskCGT never assembles a cross-project
 * blob.
 *
 * The returned context plus the AllowedIds sets feed both prompt construction
 * and output validation: the model may only cite what was actually retrieved.
 */

export type AskCgtTranscript = {
  id: string
  recordingId: string
  title: string
  status: string
  completedAt: string | null
  utterances: Array<{ id: string; start: number; end: number; speakerKey: string; text: string }>
}

export type AskCgtObservation = {
  id: string
  transcriptId: string
  recordingTitle: string | null
  statement: string
  confidence: string
  notes: string | null
  created_at: string
}

export type AskCgtMarker = {
  id: string
  recordingId: string
  recordingTitle: string | null
  noteType: string
  noteText: string | null
  timestampSeconds: number
  created_at: string | null
}

export type AskCgtCandidate = {
  id: string
  transcriptId: string
  recordingTitle: string | null
  type: string
  content: string
  reasoningSummary: string | null
  confidence: number | null
  status: string
  provider: string
  model: string
  created_at: string | null
  evidence: Array<{ transcript_id: string; utterance_ids: string[]; role: string }>
}
export type AskCgtExperiment = {
  id: string
  code: string
  slug: string
  title: string
  status: string
  primary_question: string | null
  problem: string | null
  hypothesis: string | null
  rationale: string | null
  method: string | null
  success_criteria: string | null
  failure_criteria: string | null
  stop_conditions: string | null
  scope: string | null
  decision_rule: string | null
  conclusion: string | null
  recommendation: string | null
  resulting_decision: string | null
  confidence: string | null
  design: Record<string, unknown>
  /** Lifecycle dates, present only on the ACTIVE experiment. */
  created_at?: string | null
  proposed_at?: string | null
  approved_at?: string | null
  activated_at?: string | null
  completed_at?: string | null
}

/**
 * A proposal connected to the active experiment via proposal_experiments.
 *
 * This exists so AskCGT can establish approval provenance — whether a
 * commercial commitment covers this experiment, and when it was sent and
 * accepted. It is deliberately NOT a general proposal-reasoning surface.
 */
export type AskCgtProposal = {
  id: string
  code: string | null
  title: string | null
  status: string | null
  kind: string | null
  sent_at: string | null
  accepted_at: string | null
  declined_at: string | null
  created_at: string | null
}

/**
 * A work item from the inventory, with a count of its recorded sources.
 *
 * `evidenceCount` is carried here rather than re-derived at render time so the
 * model can see which inventory entries are unsourced assertions.
 */
export type AskCgtWorkItem = WorkItem & {
  ownerName: string | null
  requestedByName: string | null
  validatedByName: string | null
  evidenceCount: number
  contradictingEvidenceCount: number
}

/**
 * A human-reviewed experiment finding.
 *
 * This is a reviewed consulting judgment, NOT source evidence. It carries both
 * the model's original proposal and the wording Paul accepted, so a later
 * reader can see whether the interpretation was edited — and can still reach
 * the primary evidence underneath through its citations.
 */
export type AskCgtReviewedFinding = {
  id: string
  experimentId: string
  experimentCode: string | null
  statement: string
  interpretation: string | null
  proposedStatement: string | null
  epistemicType: string | null
  reviewStatus: string
  wasEdited: boolean
  reviewerName: string | null
  reviewedAt: string | null
  model: string | null
  provider: string | null
  proposedConfidence: number | null
  /** Canonical typed citations, preserved from acceptance. */
  citations: Array<{ type: string; id: string; utteranceIds: string[] | null }>
}

/** A durable decision, with the code of the decision it replaced (if any). */
export type AskCgtDecision = Decision & {
  decidedByName: string | null
  supersedesCode: string | null
}

/**
 * A correction or dispute a human made to the inventory.
 *
 * These are the highest-value evidence in the whole set: they record where
 * CGT's interpretation was wrong and who said so.
 */
export type AskCgtWorkCorrection = {
  id: string
  workItemCode: string | null
  workItemTitle: string | null
  eventType: string
  actorPersonId: string | null
  actorName: string | null
  previousValue: string | null
  note: string | null
  occurredAt: string
}

export type AskCgtPerson = {
  id: string
  displayName: string
  company: string | null
  title: string | null
}

export type AskCgtSpeakerMap = {
  transcriptId: string
  providerSpeakerKey: string
  personName: string | null
}

export type AskCgtProject = {
  id: string
  name: string
  description: string | null
  status: string
}

export type AskCgtContext = {
  project: AskCgtProject
  people: AskCgtPerson[]
  speakerMaps: AskCgtSpeakerMap[]
  transcripts: AskCgtTranscript[]
  observations: AskCgtObservation[]
  markers: AskCgtMarker[]
  candidates: AskCgtCandidate[]
  experiments: AskCgtExperiment[]
  /**
   * The experiment Paul is actually looking at, when AskCGT was invoked from
   * an experiment page. Rendered in full, and always also present in
   * `experiments`. Null for the project-level entry point.
   */
  activeExperiment: AskCgtExperiment | null
  /** Proposals connected to activeExperiment. Empty when there is no active experiment. */
  activeExperimentProposals: AskCgtProposal[]
  /** The work inventory for this project. */
  workItems: AskCgtWorkItem[]
  /** Durable decisions for this project. */
  decisions: AskCgtDecision[]
  /** Human corrections and disputes, most recent first. */
  workCorrections: AskCgtWorkCorrection[]
  /** Paul-reviewed findings for this project, most recent first. */
  reviewedFindings: AskCgtReviewedFinding[]
  /**
   * Derived measures and EXP-003 criteria for the ACTIVE experiment's
   * inventory, or null when there is no active experiment. Computed from the
   * same pure functions the admin UI uses, so the model and Paul see
   * identical numbers.
   */
  workMeasures: WorkMeasures | null
  workCriteria: CriterionResult[]
}

/** The IDs the model is allowed to cite. Built from the retrieved context. */
export type AskCgtAllowedIds = {
  transcripts: Set<string>
  utterancesByTranscript: Map<string, Set<string>>
  observations: Set<string>
  markers: Set<string>
  candidates: Set<string>
  experiments: Set<string>
  proposals: Set<string>
  workItems: Set<string>
  decisions: Set<string>
  findings: Set<string>
}

export type RetrieveResult = {
  context: AskCgtContext
  allowed: AskCgtAllowedIds
  evidenceItemsRetrieved: number
}

type Supabase = SupabaseClient

/** Head+tail cap so a huge organization never sends its whole history. */
function capUtterances<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items
  const head = items.slice(0, Math.ceil(cap / 2))
  const tail = items.slice(-Math.floor(cap / 2))
  return [...head, ...tail]
}

function resolveUtteranceCap(): number {
  const parsed = Number(process.env.ASK_CGT_MAX_UTTERANCES_PER_TRANSCRIPT)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500
}

type ExperimentRow = Record<string, unknown>

/** Normalizes an `experiments` row into AskCgtExperiment. */
function toExperiment(row: ExperimentRow): AskCgtExperiment {
  const str = (key: string): string | null => {
    const value = row[key]
    return typeof value === 'string' && value.trim() ? value : null
  }
  const design = row.design
  return {
    id: String(row.id),
    code: String(row.code ?? ''),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    status: String(row.status ?? ''),
    primary_question: str('primary_question'),
    problem: str('problem'),
    hypothesis: str('hypothesis'),
    rationale: str('rationale'),
    method: str('method'),
    success_criteria: str('success_criteria'),
    failure_criteria: str('failure_criteria'),
    stop_conditions: str('stop_conditions'),
    scope: str('scope'),
    decision_rule: str('decision_rule'),
    conclusion: str('conclusion'),
    recommendation: str('recommendation'),
    resulting_decision: str('resulting_decision'),
    confidence: str('confidence'),
    design: design && typeof design === 'object' && !Array.isArray(design) ? (design as Record<string, unknown>) : {},
    created_at: str('created_at'),
    proposed_at: str('proposed_at'),
    approved_at: str('approved_at'),
    activated_at: str('activated_at'),
    completed_at: str('completed_at'),
  }
}

/**
 * Proposals connected to one experiment via proposal_experiments.
 *
 * Scoped to a single experiment ID that the caller has already verified
 * belongs to the project. A failure here is non-fatal: approval provenance is
 * valuable but AskCGT must still be able to answer without it, and it says so
 * in the prompt rather than implying no proposal exists.
 */
async function retrieveExperimentProposals(supabase: Supabase, experimentId: string): Promise<AskCgtProposal[]> {
  const { data, error } = await supabase
    .from('proposal_experiments')
    .select('proposals(id, code, title, status, kind, sent_at, accepted_at, declined_at, created_at)')
    .eq('experiment_id', experimentId)
  if (error || !data) return []

  const rows = data as Array<{ proposals: AskCgtProposal | AskCgtProposal[] | null }>
  const seen = new Set<string>()
  const proposals: AskCgtProposal[] = []
  for (const row of rows) {
    const candidate = Array.isArray(row.proposals) ? row.proposals[0] : row.proposals
    if (!candidate?.id || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    proposals.push({
      id: candidate.id,
      code: candidate.code ?? null,
      title: candidate.title ?? null,
      status: candidate.status ?? null,
      kind: candidate.kind ?? null,
      sent_at: candidate.sent_at ?? null,
      accepted_at: candidate.accepted_at ?? null,
      declined_at: candidate.declined_at ?? null,
      created_at: candidate.created_at ?? null,
    })
  }
  return proposals
}

/**
 * Retrieves the work inventory, decisions, and their provenance for a project.
 *
 * All three queries are scoped by project_id. Evidence links are then fetched
 * for exactly the retrieved subjects, so a link belonging to another project's
 * item can never enter the set.
 *
 * A failure here is non-fatal: AskCGT must still answer without the inventory,
 * and the prompt states that the inventory is empty rather than implying no
 * work exists.
 */
async function retrieveWorkArtifacts(
  supabase: Supabase,
  projectId: string,
  personNameById: Map<string, string>
): Promise<{
  workItems: AskCgtWorkItem[]
  decisions: AskCgtDecision[]
  corrections: AskCgtWorkCorrection[]
  rawItems: WorkItem[]
  rawEvents: WorkItemEvent[]
  rawDecisions: Decision[]
  itemIdsWithEvidence: Set<string>
}> {
  const empty = {
    workItems: [],
    decisions: [],
    corrections: [],
    rawItems: [],
    rawEvents: [],
    rawDecisions: [],
    itemIdsWithEvidence: new Set<string>(),
  }

  const [itemsResult, decisionsResult, eventsResult] = await Promise.all([
    supabase.from('work_items').select('*').eq('project_id', projectId).order('item_number', { ascending: true }),
    supabase.from('decisions').select('*').eq('project_id', projectId).order('decision_number', { ascending: true }),
    supabase
      .from('work_item_events')
      .select('*')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: false }),
  ])

  if (itemsResult.error && decisionsResult.error) return empty

  const rawItems = (itemsResult.data || []) as WorkItem[]
  const rawDecisions = (decisionsResult.data || []) as Decision[]
  const rawEvents = (eventsResult.data || []) as WorkItemEvent[]

  // Resolve names for every person these artifacts actually reference.
  //
  // The caller's map is built from project_persons, but a work item may name
  // a person who was never added to that junction (Christie is exactly this
  // case on Alpine). Relying on the junction alone left the name null, which
  // the renderer then printed as "NOBODY" — turning a lookup failure into a
  // false claim that the work is unowned. Any referenced id is resolved here.
  const referenced = new Set<string>()
  for (const item of rawItems) {
    for (const id of [item.owner_person_id, item.requested_by_person_id, item.validated_by_person_id]) {
      if (id && !personNameById.has(id)) referenced.add(id)
    }
  }
  for (const decision of rawDecisions) {
    if (decision.decided_by_person_id && !personNameById.has(decision.decided_by_person_id)) {
      referenced.add(decision.decided_by_person_id)
    }
  }
  for (const event of rawEvents) {
    if (event.actor_person_id && !personNameById.has(event.actor_person_id)) {
      referenced.add(event.actor_person_id)
    }
  }
  if (referenced.size > 0) {
    const { data: extraPeople } = await supabase
      .from('persons')
      .select('id, display_name')
      .in('id', Array.from(referenced))
    for (const person of (extraPeople || []) as Array<{ id: string; display_name: string }>) {
      personNameById.set(person.id, person.display_name)
    }
  }

  // Provenance is fetched for the retrieved subjects only.
  const itemIds = rawItems.map((i) => i.id)
  const decisionIds = rawDecisions.map((d) => d.id)
  const [itemLinksResult, decisionLinksResult] = await Promise.all([
    itemIds.length
      ? supabase.from('evidence_links').select('*').in('subject_work_item_id', itemIds)
      : Promise.resolve({ data: [] as EvidenceLink[], error: null }),
    decisionIds.length
      ? supabase.from('evidence_links').select('*').in('subject_decision_id', decisionIds)
      : Promise.resolve({ data: [] as EvidenceLink[], error: null }),
  ])

  const itemLinks = (itemLinksResult.data || []) as EvidenceLink[]
  const decisionLinks = (decisionLinksResult.data || []) as EvidenceLink[]

  const linkCount = new Map<string, number>()
  const contradictingCount = new Map<string, number>()
  for (const link of [...itemLinks, ...decisionLinks]) {
    const key = link.subject_work_item_id ?? link.subject_decision_id
    if (!key) continue
    linkCount.set(key, (linkCount.get(key) ?? 0) + 1)
    if (link.role === 'contradicting') {
      contradictingCount.set(key, (contradictingCount.get(key) ?? 0) + 1)
    }
  }

  const name = (id: string | null) => (id ? personNameById.get(id) ?? null : null)
  const decisionCodeById = new Map(rawDecisions.map((d) => [d.id, d.code]))
  const itemById = new Map(rawItems.map((i) => [i.id, i]))

  const workItems: AskCgtWorkItem[] = rawItems.map((item) => ({
    ...item,
    ownerName: name(item.owner_person_id),
    requestedByName: name(item.requested_by_person_id),
    validatedByName: name(item.validated_by_person_id),
    evidenceCount: linkCount.get(item.id) ?? 0,
    contradictingEvidenceCount: contradictingCount.get(item.id) ?? 0,
  }))

  const decisions: AskCgtDecision[] = rawDecisions.map((decision) => ({
    ...decision,
    decidedByName: name(decision.decided_by_person_id),
    supersedesCode: decision.supersedes_decision_id
      ? decisionCodeById.get(decision.supersedes_decision_id) ?? null
      : null,
  }))

  // Only human review outcomes are surfaced as corrections. Mechanical
  // state/owner changes are noise for consulting reasoning.
  const correctionTypes = new Set(['corrected', 'disputed', 'confirmed', 'removed'])
  const corrections: AskCgtWorkCorrection[] = rawEvents
    .filter((event) => correctionTypes.has(event.event_type))
    .map((event) => {
      const item = event.work_item_id ? itemById.get(event.work_item_id) : undefined
      return {
        id: event.id,
        workItemCode: item?.code ?? null,
        workItemTitle: item?.title ?? null,
        eventType: event.event_type,
        actorPersonId: event.actor_person_id,
        actorName: name(event.actor_person_id),
        previousValue: event.previous_value,
        note: event.note,
        occurredAt: event.occurred_at,
      }
    })

  return {
    workItems,
    decisions,
    corrections,
    rawItems,
    rawEvents,
    rawDecisions,
    itemIdsWithEvidence: new Set(
      itemLinks.map((l) => l.subject_work_item_id).filter((id): id is string => Boolean(id))
    ),
  }
}

/**
 * Retrieves human-reviewed findings for a project, with their citations.
 *
 * Only `origin = 'askcgt'` findings are returned: a manually written finding
 * has no model proposal to compare against and is not part of the AskCGT
 * review loop. Scoped by project_id in the query.
 *
 * Non-fatal on failure — AskCGT must still answer, and the prompt states that
 * no reviewed findings exist rather than implying none were ever made.
 */
async function retrieveReviewedFindings(
  supabase: Supabase,
  projectId: string,
  experimentCodeById: Map<string, string>,
  profileNameById: Map<string, string>
): Promise<AskCgtReviewedFinding[]> {
  const { data, error } = await supabase
    .from('experiment_findings')
    .select(
      'id, experiment_id, statement, interpretation, proposed_statement, epistemic_type, review_status, reviewed_by, reviewed_at, model, provider, proposed_confidence'
    )
    .eq('project_id', projectId)
    .eq('origin', 'askcgt')
    .order('reviewed_at', { ascending: false })
  if (error || !data) return []

  type Row = {
    id: string
    experiment_id: string
    statement: string
    interpretation: string | null
    proposed_statement: string | null
    epistemic_type: string | null
    review_status: string
    reviewed_by: string | null
    reviewed_at: string | null
    model: string | null
    provider: string | null
    proposed_confidence: number | null
  }
  const rows = data as Row[]
  if (rows.length === 0) return []

  const { data: linkData } = await supabase
    .from('evidence_links')
    .select(
      'subject_finding_id, source_kind, source_transcript_id, source_utterance_ids, source_observation_id, source_marker_id, source_candidate_id, source_experiment_id, source_proposal_id, source_work_item_id, source_decision_id, source_label'
    )
    .in(
      'subject_finding_id',
      rows.map((row) => row.id)
    )

  type LinkRow = Record<string, unknown> & { subject_finding_id: string; source_kind: string }
  const citationsByFinding = new Map<string, AskCgtReviewedFinding['citations']>()
  for (const link of (linkData || []) as LinkRow[]) {
    // Map the stored typed reference back to the canonical citation shape so
    // the underlying evidence stays reachable.
    const mapping: Array<[string, string]> = [
      ['source_transcript_id', 'transcript'],
      ['source_observation_id', 'observation'],
      ['source_marker_id', 'marker'],
      ['source_candidate_id', 'candidate'],
      ['source_experiment_id', 'experiment'],
      ['source_proposal_id', 'proposal'],
      ['source_work_item_id', 'work_item'],
      ['source_decision_id', 'decision'],
    ]
    for (const [column, type] of mapping) {
      const id = link[column]
      if (typeof id !== 'string' || !id) continue
      const list = citationsByFinding.get(link.subject_finding_id) ?? []
      list.push({
        type,
        id,
        utteranceIds: Array.isArray(link.source_utterance_ids)
          ? (link.source_utterance_ids as string[])
          : null,
      })
      citationsByFinding.set(link.subject_finding_id, list)
      break
    }
  }

  return rows.map((row) => ({
    id: row.id,
    experimentId: row.experiment_id,
    experimentCode: experimentCodeById.get(row.experiment_id) ?? null,
    statement: row.statement,
    interpretation: row.interpretation,
    proposedStatement: row.proposed_statement,
    epistemicType: row.epistemic_type,
    reviewStatus: row.review_status,
    wasEdited: row.review_status === 'accepted_edited',
    reviewerName: row.reviewed_by ? profileNameById.get(row.reviewed_by) ?? null : null,
    reviewedAt: row.reviewed_at,
    model: row.model,
    provider: row.provider,
    proposedConfidence: row.proposed_confidence,
    citations: citationsByFinding.get(row.id) ?? [],
  }))
}

export type RetrieveOptions = {
  /**
   * The experiment Paul is viewing. Verified to belong to `projectId` before
   * any of its content is used; a mismatch throws 'Experiment not found'
   * rather than silently degrading to project-level context.
   */
  experimentId?: string | null
}

/** Columns of `experiments` AskCGT reasons over. Kept in one place so retrieval and rendering cannot drift apart. */
const EXPERIMENT_COLUMNS =
  'id, code, slug, title, status, primary_question, problem, hypothesis, rationale, method, success_criteria, failure_criteria, stop_conditions, scope, decision_rule, conclusion, recommendation, resulting_decision, confidence, design, created_at, proposed_at, approved_at, activated_at, completed_at'

export async function retrieveProjectEvidence(
  supabase: Supabase,
  projectId: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  // Project itself. If the caller cannot read this project, the query returns
  // nothing and AskCGT stops here — authorization happens before any evidence
  // is assembled.
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('id, name, description, status')
    .eq('id', projectId)
    .maybeSingle()
  if (projectError) {
    throw new Error(`Failed to load project: ${projectError.message}`)
  }
  if (!projectData) {
    throw new Error('Project not found')
  }
  const project: AskCgtProject = projectData as AskCgtProject

  const [peopleResult, recordingsResult, candidatesResult, experimentsResult] =
    await Promise.all([
      supabase
        .from('project_persons')
        .select('persons(id, display_name, company, title)')
        .eq('project_id', projectId),
      supabase
        .from('engagement_recordings')
        .select('id, project_id, title, session_type, started_at, source_type, status')
        .eq('project_id', projectId)
        .order('started_at', { ascending: false }),
      supabase
        .from('project_intelligence_candidates')
        .select('id, transcript_id, type, content, reasoning_summary, confidence, status, provider, model, created_at, project_intelligence_candidate_evidence(transcript_id, utterance_ids, role)')
        .eq('project_id', projectId),
      supabase
        .from('experiments')
        .select(EXPERIMENT_COLUMNS)
        .eq('project_id', projectId),
    ])

  // Filter experiments to only visible statuses (proposed, approved, active, completed)
  // Mirrors the RLS policy: clients see experiments once they leave draft status.
  const visibleStatuses = new Set(['proposed', 'approved', 'active', 'completed'])
  const experiments = (experimentsResult.data || [])
    .filter((e) => visibleStatuses.has(e.status))
    .map(toExperiment)

  // The active experiment is resolved with an explicit project_id predicate, so
  // an experimentId belonging to another project can never be used. It is
  // looked up separately from the list above because the list drops draft
  // experiments, and Paul may legitimately be viewing a draft he is editing.
  let activeExperiment: AskCgtExperiment | null = null
  let activeExperimentProposals: AskCgtProposal[] = []
  if (options.experimentId) {
    const { data: activeData, error: activeError } = await supabase
      .from('experiments')
      .select(EXPERIMENT_COLUMNS)
      .eq('id', options.experimentId)
      .eq('project_id', projectId)
      .maybeSingle()
    if (activeError) {
      throw new Error(`Failed to load experiment: ${activeError.message}`)
    }
    if (!activeData) {
      // Either it does not exist, RLS hid it, or it belongs to another
      // project. All three are the same answer to the caller.
      throw new Error('Experiment not found')
    }
    activeExperiment = toExperiment(activeData)
    activeExperimentProposals = await retrieveExperimentProposals(supabase, activeExperiment.id)
  }

  const recordings = (recordingsResult.data || []) as Array<{
    id: string
    project_id: string
    title: string
  }>
  const recordingIds = recordings.map((r) => r.id)
  const recordingTitleById = new Map(recordings.map((r) => [r.id, r.title]))

  // Markers and transcripts are scoped to THIS project's recordings in the
  // query. Previously these tables were fetched unscoped (every row the
  // admin's RLS allowed, across all clients) and narrowed with an in-memory
  // filter; isolation now rests on the query itself.
  const [transcriptsResult, markersResult] = await Promise.all([
    supabase
      .from('engagement_transcripts')
      .select('id, recording_id, status, completed_at, utterances')
      .in('recording_id', recordingIds),
    supabase
      .from('engagement_session_notes')
      .select('id, recording_id, note_type, note_text, timestamp_seconds, created_at')
      .in('recording_id', recordingIds),
  ])

  const transcripts = (transcriptsResult.data || []) as Array<{
    id: string
    recording_id: string
    status: string
    completed_at: string | null
    utterances: Array<{ id?: string; start?: number; end?: number; speaker?: number; provider_speaker_key?: string; transcript?: string }>
  }>
  const transcriptIds = transcripts.map((t) => t.id)
  const recordingByTranscript = new Map(transcripts.map((t) => [t.id, t.recording_id]))

  // Observations reach the project via transcript -> recording -> project, so
  // they can only be scoped once transcriptIds are known.
  const observationsResult = await supabase
    .from('transcript_observations')
    .select('id, transcript_id, statement, confidence, notes, created_at')
    .in('transcript_id', transcriptIds)

  type ObservationRow = {
    id: string
    transcript_id: string
    statement: string
    confidence: string
    notes: string | null
    created_at: string
  }
  const observations: AskCgtObservation[] = ((observationsResult.data || []) as ObservationRow[])
    .filter((o) => transcriptIds.includes(o.transcript_id))
    .map((o) => ({
      id: o.id,
      transcriptId: o.transcript_id,
      recordingTitle: recordingTitleById.get(recordingByTranscript.get(o.transcript_id) || '') || null,
      statement: o.statement,
      confidence: o.confidence,
      notes: o.notes,
      created_at: o.created_at,
    }))

  type MarkerRow = {
    id: string
    recording_id: string
    note_type: string
    note_text: string | null
    timestamp_seconds: number
    created_at: string | null
  }
  const markers: AskCgtMarker[] = ((markersResult.data || []) as MarkerRow[])
    .filter((m) => recordingIds.includes(m.recording_id))
    .map((m) => ({
      id: m.id,
      recordingId: m.recording_id,
      recordingTitle: recordingTitleById.get(m.recording_id) || null,
      noteType: m.note_type,
      noteText: m.note_text,
      timestampSeconds: m.timestamp_seconds,
      created_at: m.created_at ?? null,
    }))

  type CandidateEvidenceRow = { transcript_id: string; utterance_ids: string[]; role: string }
  type CandidateRow = {
    id: string
    transcript_id: string
    type: string
    content: string
    reasoning_summary: string | null
    confidence: number | null
    status: string
    provider: string
    model: string
    created_at: string | null
    project_intelligence_candidate_evidence: CandidateEvidenceRow[]
  }
  const candidates: AskCgtCandidate[] = ((candidatesResult.data || []) as CandidateRow[])
    .filter((c) => transcriptIds.includes(c.transcript_id))
    .map((c) => ({
      id: c.id,
      transcriptId: c.transcript_id,
      recordingTitle: recordingTitleById.get(recordingByTranscript.get(c.transcript_id) || '') || null,
      type: c.type,
      content: c.content,
      reasoningSummary: c.reasoning_summary,
      confidence: c.confidence,
      status: c.status,
      provider: c.provider,
      model: c.model,
      created_at: c.created_at ?? null,
      evidence: (c.project_intelligence_candidate_evidence || []).map((evidence) => ({
        transcript_id: evidence.transcript_id,
        utterance_ids: evidence.utterance_ids,
        role: evidence.role,
      })),
    }))

  // People + speaker identity.
  type PersonRow = { id: string; display_name: string; company: string | null; title: string | null }
  const people = ((peopleResult.data || []) as Array<{ persons: PersonRow | PersonRow[] | null }>)
    .map((row) => {
      const person = Array.isArray(row.persons) ? row.persons[0] : row.persons
      return person
        ? { id: person.id, displayName: person.display_name, company: person.company, title: person.title }
        : null
    })
    .filter((person): person is AskCgtPerson => Boolean(person))

  const clustersResult = await supabase
    .from('engagement_transcript_speaker_clusters')
    .select('transcript_id, provider_speaker_key, engagement_speaker_identity_assignments(id, person_id, persons(display_name))')
    .in('transcript_id', transcriptIds)

  type PersonName = { display_name: string }
  type ClusterRow = {
    transcript_id: string
    provider_speaker_key: string
    engagement_speaker_identity_assignments: Array<{ persons: PersonName | PersonName[] | null }> | null
  }
  const speakerMaps: AskCgtSpeakerMap[] = ((clustersResult.data || []) as ClusterRow[]).flatMap((cluster) => {
    const assignment = Array.isArray(cluster.engagement_speaker_identity_assignments)
      ? cluster.engagement_speaker_identity_assignments[0]
      : null
    const person = assignment?.persons
    const personName = Array.isArray(person) ? person[0]?.display_name : person?.display_name
    if (!personName) return []
    return [{
      transcriptId: cluster.transcript_id,
      providerSpeakerKey: cluster.provider_speaker_key,
      personName: personName as string,
    }]
  })

  const contextTranscripts: AskCgtTranscript[] = transcripts.map((t) => {
    const cap = resolveUtteranceCap()
    return {
      id: t.id,
      recordingId: t.recording_id,
      title: recordingTitleById.get(t.recording_id) || 'Untitled recording',
      status: t.status,
      completedAt: t.completed_at,
      utterances: capUtterances(
        (t.utterances || [])
          .filter((u) => u.id && u.transcript)
          .map((u) => ({
            id: u.id as string,
            start: u.start ?? 0,
            end: u.end ?? 0,
            speakerKey: u.provider_speaker_key || `speaker-${u.speaker ?? 0}`,
            text: (u.transcript as string).trim(),
          }))
          .filter((u) => u.text),
        cap
      ),
    }
  })

  // The active experiment must be citable even when its status excludes it
  // from the visible list (e.g. a draft Paul is editing), so it is merged in
  // rather than assumed present.
  const experimentsById = new Map(experiments.map((e) => [e.id, e]))
  if (activeExperiment) experimentsById.set(activeExperiment.id, activeExperiment)
  const allExperiments = Array.from(experimentsById.values())

  // Work artifacts. Person names are resolved here so the prompt can say
  // "Christie" rather than a bare UUID.
  const personNameById = new Map(people.map((person) => [person.id, person.displayName]))
  const work = await retrieveWorkArtifacts(supabase, projectId, personNameById)

  // Reviewed findings. The reviewer is a profile (an authenticated admin), not
  // a `persons` row, so their name is resolved separately.
  const experimentCodeById = new Map(allExperiments.map((e) => [e.id, e.code]))
  const profileNameById = new Map<string, string>()
  const { data: reviewerProfiles } = await supabase.from('profiles').select('id, display_name, email')
  for (const profile of (reviewerProfiles || []) as Array<{ id: string; display_name: string | null; email: string | null }>) {
    profileNameById.set(profile.id, profile.display_name || profile.email || profile.id)
  }
  const reviewedFindings = await retrieveReviewedFindings(supabase, projectId, experimentCodeById, profileNameById)

  // Measures are computed for the ACTIVE experiment's inventory only. A
  // project-wide number would misreport EXP-003's thresholds, which are about
  // one experiment's inventory.
  let workMeasures: WorkMeasures | null = null
  let workCriteria: CriterionResult[] = []
  if (activeExperiment) {
    const scopedItems = work.rawItems.filter((item) => item.experiment_id === activeExperiment.id)
    const scopedItemIds = new Set(scopedItems.map((item) => item.id))
    workMeasures = computeWorkMeasures({
      workItems: scopedItems,
      events: work.rawEvents.filter(
        (event) =>
          event.experiment_id === activeExperiment.id ||
          (event.work_item_id !== null && scopedItemIds.has(event.work_item_id))
      ),
      decisions: work.rawDecisions.filter((decision) => decision.experiment_id === activeExperiment.id),
      workItemIdsWithEvidence: work.itemIdsWithEvidence,
    })
    workCriteria = evaluateExp003Criteria(workMeasures)
  }

  const context: AskCgtContext = {
    project,
    people,
    speakerMaps,
    transcripts: contextTranscripts,
    observations,
    markers,
    candidates,
    experiments: allExperiments,
    activeExperiment,
    activeExperimentProposals,
    workItems: work.workItems,
    decisions: work.decisions,
    workCorrections: work.corrections,
    reviewedFindings,
    workMeasures,
    workCriteria,
  }

  const allowed: AskCgtAllowedIds = {
    transcripts: new Set(contextTranscripts.map((t) => t.id)),
    utterancesByTranscript: new Map(
      contextTranscripts.map((t) => [t.id, new Set(t.utterances.map((u) => u.id))])
    ),
    observations: new Set(observations.map((o) => o.id)),
    markers: new Set(markers.map((m) => m.id)),
    candidates: new Set(candidates.map((c) => c.id)),
    experiments: new Set(allExperiments.map((e) => e.id)),
    proposals: new Set(activeExperimentProposals.map((p) => p.id)),
    workItems: new Set(work.workItems.map((item) => item.id)),
    decisions: new Set(work.decisions.map((decision) => decision.id)),
    findings: new Set(reviewedFindings.map((finding) => finding.id)),
  }

  const evidenceItemsRetrieved =
    contextTranscripts.length +
    observations.length +
    markers.length +
    candidates.length +
    allExperiments.length +
    activeExperimentProposals.length +
    work.workItems.length +
    work.decisions.length +
    work.corrections.length +
    reviewedFindings.length +
    contextTranscripts.reduce((sum, t) => sum + t.utterances.length, 0)

  return { context, allowed, evidenceItemsRetrieved }
}