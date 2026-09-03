import {
  AskCgtContext,
  AskCgtDecision,
  AskCgtExperiment,
  AskCgtProposal,
  AskCgtWorkCorrection,
  AskCgtWorkItem,
} from './retrieve'
import { computeWorkMeasures, evaluateExp003Criteria } from '@/lib/work/measures'
import { Decision, WorkItem, WorkItemEvent } from '@/lib/work/types'

/**
 * Shared AskCGT test fixtures.
 *
 * IDs here are FULL 36-character UUIDs on purpose. The previous fixtures used
 * short ids like 'obs-1', which made `id.slice(0, 8)` a no-op and hid a real
 * defect: the prompt rendered abbreviated ids while validation compared
 * against full UUIDs, so every non-transcript citation was silently dropped in
 * production. Any fixture id shorter than 9 characters can mask that class of
 * bug again — keep these full length.
 */

export const IDS = {
  project: '11111111-1111-4111-8111-111111111111',
  otherProject: '99999999-9999-4999-8999-999999999999',
  personChristie: '22222222-2222-4222-8222-222222222222',
  personRich: '22222222-2222-4222-8222-222222222223',
  transcript: '33333333-3333-4333-8333-333333333333',
  otherTranscript: '33333333-3333-4333-8333-33333333339e',
  utterance1: '44444444-4444-4444-8444-444444444441',
  utterance2: '44444444-4444-4444-8444-444444444442',
  recording: '55555555-5555-4555-8555-555555555555',
  observation: '66666666-6666-4666-8666-666666666666',
  marker: '77777777-7777-4777-8777-777777777777',
  candidate: '88888888-8888-4888-8888-888888888888',
  experiment003: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  experiment001: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  proposal005: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  workItem1: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  workItem2: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  workItem3: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  decision1: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  decision2: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  finding1: 'f1111111-1111-4111-8111-111111111111',
  finding2: 'f1111111-1111-4111-8111-111111111112',
} as const

/**
 * Alpine EXP-003 "Make the work visible", matching the real production record
 * shape (verified read-only against the live experiments row). Text is
 * abbreviated where length does not matter, but every field that carries
 * consulting meaning — problem, method, criteria, and the design.out_of_scope
 * boundary — reflects the real content.
 */
export function exp003(): AskCgtExperiment {
  return {
    id: IDS.experiment003,
    code: 'EXP-003',
    slug: 'make-the-work-visible',
    title: 'Make the work visible',
    status: 'approved',
    primary_question:
      'Whether CGT can help Alpine create and maintain a sufficiently complete, shared view of all its work so the team can make deliberate decisions about priorities and work in progress.',
    problem:
      'Alpine does not have a shared, reliable view of all requested, active, waiting, blocked, and planned work. Requests and updates arrive through multiple channels, much of the resulting work remains informal, and status is often known only to the person performing or coordinating it. Christie serves as the primary intake point, evaluator, product manager, developer, and conduit to other team members, so understanding the current state of work frequently depends on asking her.',
    hypothesis:
      'If Alpine represents all requested, active, waiting, blocked, and planned work in a shared, consistently maintained view, then the team will have enough reliable information to coordinate priorities and make deliberate decisions about work in progress.',
    rationale: null,
    method: [
      'Ask Christie to identify all Alpine work she currently knows to be active, waiting, blocked, committed, or planned.',
      'Extract additional work items from approved evidence, including the recorded conversation, end-of-month recording, email, spreadsheets, documents, and existing task records.',
      'Combine the findings into one work inventory, preserving the source of each item.',
      'Have Christie review and correct the inventory until she considers it a sufficiently accurate representation of the work she manages.',
      'Maintain the inventory with Christie during a two-week pilot, adding new work and updating items as their state changes.',
      'Have Christie use the inventory during actual prioritization, sequencing, deferral, and WIP decisions.',
    ].join('\n'),
    success_criteria: [
      'Christie confirms that the inventory represents all materially significant Alpine work she currently manages.',
      'At least 90% of meaningful work identified through Outlook, ClickUp, recordings, documents, and follow-up interviews is already represented in the inventory at each review.',
      'Christie uses the inventory to make at least one real prioritization, sequencing, deferral, or WIP decision.',
      'Maintaining the inventory requires no more than 15 minutes of deliberate administrative effort per working day.',
    ].join('\n'),
    failure_criteria: [
      'Christie determines that materially significant work she manages remains routinely absent from the inventory.',
      'The inventory does not support any real prioritization, sequencing, deferral, or WIP decision during the pilot.',
    ].join('\n'),
    stop_conditions: null,
    scope: null,
    decision_rule: null,
    conclusion: null,
    recommendation: null,
    resulting_decision: null,
    confidence: null,
    design: {
      measures: [
        'Number of meaningful work items identified',
        'Time required to maintain the view',
        'Decisions the view helps Christie make',
      ].join('\n'),
      evidence_requirements: [
        'Recorded interviews and transcripts',
        'The resulting work inventory with links to source evidence where available',
        "Christie's corrections and validation",
      ].join('\n'),
      assumptions: 'Christie can identify the work she manages.',
      unknowns: 'How much meaningful work is invisible today.',
      risks: [
        'The inventory may appear complete while meaningful work is still missing.',
        "Maintaining it may add to Christie's workload.",
      ].join('\n'),
      constraints: [
        'Limited to work Christie manages or must answer for.',
        'The experiment must not interfere with required Alpine work.',
        'Christie must validate AI-generated interpretations.',
      ].join('\n'),
      security_constraints: [
        "Record and process information only with Christie's approval.",
        'Use supervised or read-only access to Alpine systems.',
      ].join('\n'),
      out_of_scope: [
        'Team-wide adoption',
        'Selecting or proving a specific tool',
        'Establishing permanent WIP limits',
        'Automating work intake',
        'Evaluating individual productivity',
      ].join('\n'),
    },
    created_at: '2026-09-02T19:00:00Z',
    proposed_at: '2026-09-02T19:41:13Z',
    approved_at: '2026-09-03T02:37:31Z',
    activated_at: null,
    completed_at: null,
  }
}

/** PROP-005, the accepted proposal that approved EXP-003. */
export function prop005(): AskCgtProposal {
  return {
    id: IDS.proposal005,
    code: 'PROP-005',
    title: 'Make the work visible',
    status: 'accepted',
    kind: 'experiment',
    sent_at: '2026-09-02T19:41:13Z',
    accepted_at: '2026-09-03T02:37:31Z',
    declined_at: null,
    created_at: '2026-09-02T18:00:00Z',
  }
}

/** A second experiment in the same project, used to test summary rendering. */
export function exp001(): AskCgtExperiment {
  return {
    id: IDS.experiment001,
    code: 'EXP-001',
    slug: 'ai-assisted-crf-analysis',
    title: 'AI-Assisted CRF Analysis',
    status: 'active',
    primary_question: 'Can an AI agent produce useful, verifiable analysis of a Change Request Form?',
    problem: null,
    hypothesis: 'Richer, well-provenanced context materially improves usefulness.',
    rationale: null,
    method: null,
    success_criteria: null,
    failure_criteria: null,
    stop_conditions: null,
    scope: null,
    decision_rule: null,
    conclusion: null,
    recommendation: null,
    resulting_decision: null,
    confidence: null,
    design: {},
    created_at: '2026-08-21T00:00:00Z',
    proposed_at: null,
    approved_at: null,
    activated_at: '2026-08-28T14:57:51Z',
    completed_at: null,
  }
}

// --------------------------------------------------------------------------
// Work artifacts
// --------------------------------------------------------------------------

function workItemRow(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: IDS.workItem1,
    project_id: IDS.project,
    experiment_id: IDS.experiment003,
    item_number: 1,
    code: 'WORK-001',
    title: 'Untitled work',
    description: null,
    state: 'active',
    owner_person_id: null,
    requested_by_person_id: null,
    intake_channel: null,
    next_action: null,
    blocked_reason: null,
    is_informal: false,
    first_seen_at: null,
    discovered_at: '2026-09-04T10:00:00Z',
    discovery_method: 'christie_interview',
    in_initial_inventory: true,
    validation_state: 'unvalidated',
    validated_at: null,
    validated_by_person_id: null,
    client_visible: true,
    created_by: null,
    created_at: '2026-09-04T10:00:00Z',
    updated_at: '2026-09-04T10:00:00Z',
    ...overrides,
  }
}

/**
 * A small but realistic inventory: one validated and well-specified item, one
 * blocked item with no stated dependency, and one informal item discovered
 * after the baseline with no recorded source. Together these exercise every
 * gap the measures are meant to surface.
 */
export function workItemRows(): WorkItem[] {
  return [
    workItemRow({
      id: IDS.workItem1,
      item_number: 1,
      code: 'WORK-001',
      title: 'Renew the Contoso maintenance agreement',
      description: 'Annual renewal, needs a signed SOW.',
      state: 'active',
      owner_person_id: IDS.personChristie,
      intake_channel: 'email',
      next_action: 'Send the SOW to Contoso for signature',
      validation_state: 'confirmed',
      validated_at: '2026-09-05T09:00:00Z',
      validated_by_person_id: IDS.personChristie,
    }),
    workItemRow({
      id: IDS.workItem2,
      item_number: 2,
      code: 'WORK-002',
      title: 'Fix the invoice export rounding bug',
      description: 'Reported by two clients.',
      state: 'blocked',
      owner_person_id: IDS.personChristie,
      intake_channel: 'verbal',
      // Deliberately no blocked_reason: the "status lives in someone's head"
      // condition must be recordable.
      blocked_reason: null,
      next_action: null,
      validation_state: 'corrected',
      validated_at: '2026-09-05T09:05:00Z',
      validated_by_person_id: IDS.personChristie,
    }),
    workItemRow({
      id: IDS.workItem3,
      item_number: 3,
      code: 'WORK-003',
      title: 'Month-end reconciliation spreadsheet upkeep',
      description: null,
      state: 'waiting',
      owner_person_id: null,
      intake_channel: 'spreadsheet',
      is_informal: true,
      in_initial_inventory: false,
      discovery_method: 'observed_during_pilot',
      discovered_at: '2026-09-11T14:00:00Z',
      next_action: null,
      blocked_reason: null,
    }),
  ]
}

export function workEventRows(): WorkItemEvent[] {
  return [
    {
      id: 'f0000000-0000-4000-8000-000000000001',
      project_id: IDS.project,
      experiment_id: IDS.experiment003,
      work_item_id: IDS.workItem2,
      event_type: 'corrected',
      actor_person_id: IDS.personChristie,
      actor_profile_id: null,
      from_state: null,
      to_state: null,
      field_changed: 'validation_state',
      previous_value: 'unvalidated',
      note: 'Christie says this is blocked on the vendor, not on her.',
      effort_minutes: null,
      occurred_at: '2026-09-05T09:05:00Z',
      created_by: null,
      created_at: '2026-09-05T09:05:00Z',
    },
    {
      id: 'f0000000-0000-4000-8000-000000000002',
      project_id: IDS.project,
      experiment_id: IDS.experiment003,
      work_item_id: null,
      event_type: 'inventory_maintained',
      actor_person_id: null,
      actor_profile_id: null,
      from_state: null,
      to_state: null,
      field_changed: null,
      previous_value: null,
      note: 'Daily upkeep',
      effort_minutes: 9,
      occurred_at: '2026-09-08T09:00:00Z',
      created_by: null,
      created_at: '2026-09-08T09:00:00Z',
    },
  ]
}

export function decisionRows(): Decision[] {
  return [
    {
      id: IDS.decision1,
      project_id: IDS.project,
      experiment_id: IDS.experiment003,
      decision_number: 1,
      code: 'DEC-001',
      statement: 'Defer the invoice export bug until the vendor responds.',
      rationale: 'It is blocked externally, and Christie has two committed items ahead of it.',
      decision_type: 'deferral',
      status: 'active',
      supersedes_decision_id: null,
      alternatives_considered: 'Considered escalating to the vendor immediately; rejected as premature.',
      informed_by_view: true,
      decided_by_person_id: IDS.personChristie,
      decided_at: '2026-09-09T10:00:00Z',
      client_visible: true,
      created_by: null,
      created_at: '2026-09-09T10:00:00Z',
      updated_at: '2026-09-09T10:00:00Z',
    },
    {
      id: IDS.decision2,
      project_id: IDS.project,
      experiment_id: IDS.experiment003,
      decision_number: 2,
      code: 'DEC-002',
      statement: 'Track the inventory in a shared spreadsheet for the pilot.',
      // Deliberately no rationale: the prompt must flag an unjustifiable decision.
      rationale: null,
      decision_type: 'tool_selection',
      status: 'superseded',
      supersedes_decision_id: null,
      alternatives_considered: null,
      informed_by_view: false,
      decided_by_person_id: null,
      decided_at: '2026-09-06T10:00:00Z',
      client_visible: false,
      created_by: null,
      created_at: '2026-09-06T10:00:00Z',
      updated_at: '2026-09-06T10:00:00Z',
    },
  ]
}

const PERSON_NAMES = new Map<string, string>([
  [IDS.personChristie, 'Christie'],
  [IDS.personRich, 'Rich'],
])

/** Decorates raw rows the way retrieveWorkArtifacts does. */
export function decoratedWorkItems(): AskCgtWorkItem[] {
  // WORK-001 has one source; WORK-002 has one contradicting source; WORK-003
  // has none, so the "unsourced assertion" path is exercised.
  const evidence = new Map<string, { total: number; contradicting: number }>([
    [IDS.workItem1, { total: 2, contradicting: 0 }],
    [IDS.workItem2, { total: 1, contradicting: 1 }],
  ])
  return workItemRows().map((item) => ({
    ...item,
    ownerName: item.owner_person_id ? PERSON_NAMES.get(item.owner_person_id) ?? null : null,
    requestedByName: null,
    validatedByName: item.validated_by_person_id ? PERSON_NAMES.get(item.validated_by_person_id) ?? null : null,
    evidenceCount: evidence.get(item.id)?.total ?? 0,
    contradictingEvidenceCount: evidence.get(item.id)?.contradicting ?? 0,
  }))
}

export function decoratedDecisions(): AskCgtDecision[] {
  return decisionRows().map((decision) => ({
    ...decision,
    decidedByName: decision.decided_by_person_id ? PERSON_NAMES.get(decision.decided_by_person_id) ?? null : null,
    supersedesCode: null,
  }))
}

export function workCorrections(): AskCgtWorkCorrection[] {
  return [
    {
      id: 'f0000000-0000-4000-8000-000000000001',
      workItemCode: 'WORK-002',
      workItemTitle: 'Fix the invoice export rounding bug',
      eventType: 'corrected',
      actorPersonId: IDS.personChristie,
      actorName: 'Christie',
      previousValue: 'unvalidated',
      note: 'Christie says this is blocked on the vendor, not on her.',
      occurredAt: '2026-09-05T09:05:00Z',
    },
  ]
}

/** Project-level context with no active experiment. */
export function baseContext(): AskCgtContext {
  return {
    project: {
      id: IDS.project,
      name: 'Alpine Technology Group',
      description: 'Software consultancy.',
      status: 'active',
    },
    people: [
      { id: IDS.personChristie, displayName: 'Christie', company: 'Alpine', title: 'Analyst' },
      { id: IDS.personRich, displayName: 'Rich', company: 'Alpine', title: 'Developer' },
    ],
    speakerMaps: [
      { transcriptId: IDS.transcript, providerSpeakerKey: 'speaker-0', personName: 'Rich' },
      { transcriptId: IDS.transcript, providerSpeakerKey: 'speaker-1', personName: 'Paul' },
    ],
    transcripts: [
      {
        id: IDS.transcript,
        recordingId: IDS.recording,
        title: 'Rich convo',
        status: 'complete',
        completedAt: '2026-08-19T00:00:00Z',
        utterances: [
          { id: IDS.utterance1, start: 0, end: 5, speakerKey: 'speaker-0', text: 'We locate the affected code by memory.' },
          { id: IDS.utterance2, start: 5, end: 10, speakerKey: 'speaker-1', text: 'No written process?' },
        ],
      },
    ],
    observations: [
      {
        id: IDS.observation,
        transcriptId: IDS.transcript,
        recordingTitle: 'Rich convo',
        statement: 'CRF analysis depends heavily on tribal knowledge.',
        confidence: 'high',
        notes: null,
        created_at: '2026-08-19T00:00:00Z',
      },
    ],
    markers: [
      {
        id: IDS.marker,
        recordingId: IDS.recording,
        recordingTitle: 'Rich convo',
        noteType: 'friction',
        noteText: null,
        timestampSeconds: 52,
        created_at: '2026-08-19T00:00:00Z',
      },
    ],
    candidates: [
      {
        id: IDS.candidate,
        transcriptId: IDS.transcript,
        recordingTitle: 'Rich convo',
        type: 'knowledge_transfer_risk',
        content: 'Rich is the sole owner of CRF analysis.',
        reasoningSummary: 'He described locating code from memory.',
        confidence: 0.93,
        status: 'candidate',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        created_at: '2026-08-20T00:00:00Z',
        evidence: [{ transcript_id: IDS.transcript, utterance_ids: [IDS.utterance1], role: 'supporting' }],
      },
    ],
    experiments: [exp001()],
    activeExperiment: null,
    activeExperimentProposals: [],
    workItems: [],
    decisions: [],
    workCorrections: [],
    reviewedFindings: [],
    workMeasures: null,
    workCriteria: [],
  }
}

/**
 * Context as AskCGT sees it when Paul is viewing EXP-003 and the inventory is
 * still EMPTY — the situation on the day the experiment was approved.
 */
export function exp003Context(): AskCgtContext {
  const context = baseContext()
  const experiment = exp003()
  return {
    ...context,
    experiments: [exp001(), experiment],
    activeExperiment: experiment,
    activeExperimentProposals: [prop005()],
  }
}

/**
 * Context once EXP-003 has produced artifacts: a partial inventory, one of
 * Christie's corrections, and two decisions. Measures and criteria are
 * computed with the same functions the admin UI uses.
 */
export function exp003ContextWithWork(): AskCgtContext {
  const base = exp003Context()
  const items = workItemRows()
  const events = workEventRows()
  const decisions = decisionRows()
  const measures = computeWorkMeasures({
    workItems: items,
    events,
    decisions,
    workItemIdsWithEvidence: new Set([IDS.workItem1, IDS.workItem2]),
  })
  return {
    ...base,
    workItems: decoratedWorkItems(),
    decisions: decoratedDecisions(),
    workCorrections: workCorrections(),
    workMeasures: measures,
    workCriteria: evaluateExp003Criteria(measures),
  }
}
