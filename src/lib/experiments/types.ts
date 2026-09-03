// Shared Experiment domain types and constants.
//
// An Experiment is CGT's first-class inquiry object: what are we trying to
// learn, how will we test it, what evidence will count, and what decision
// follows? It gives meaning to existing objects (sessions, observations,
// evidence, proposals) rather than absorbing them.

export const EXPERIMENT_STATUSES = [
  'draft',
  'proposed',
  'approved',
  'active',
  'completed',
  'rejected',
  'paused',
  'cancelled',
] as const

export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number]

// Statuses at which a client can see the experiment (mirrors RLS).
export const CLIENT_VISIBLE_STATUSES: ExperimentStatus[] = [
  'proposed',
  'approved',
  'active',
  'completed',
]

export const EXPERIMENT_RELATIONS = [
  'derived_from',
  'tests',
  'enables',
  'depends_on',
  'informed_by',
  'resulted_in',
  'supersedes',
  'may_create',
] as const

export type ExperimentRelation = (typeof EXPERIMENT_RELATIONS)[number]

export const EXPERIMENT_LINK_TARGET_TYPES = [
  'experiment',
  'condition',
  'observation',
  'proposal',
  'session',
  'project',
  'finding',
  'external',
] as const

export type ExperimentLinkTargetType =
  (typeof EXPERIMENT_LINK_TARGET_TYPES)[number]

export type Confidence = 'high' | 'medium' | 'low'

export type SupportsHypothesis = 'supports' | 'refutes' | 'inconclusive'

export interface Experiment {
  id: string
  project_id: string
  experiment_number: number
  code: string
  slug: string
  title: string
  status: ExperimentStatus
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
  confidence: Confidence | null
  design: Record<string, unknown>
  owner_id: string | null
  client_stakeholder_person_id: string | null
  proposed_at: string | null
  approved_at: string | null
  activated_at: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ExperimentCondition {
  id: string
  experiment_id: string
  label: string
  name: string
  description: string | null
  config: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ExperimentLink {
  id: string
  experiment_id: string
  relation: ExperimentRelation
  target_type: ExperimentLinkTargetType
  target_id: string | null
  target_condition_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

/**
 * How a finding came to exist.
 *
 * 'manual' — a person wrote it directly in the findings editor.
 * 'askcgt' — an AskCGT conclusion a human reviewed and deliberately accepted.
 *   Acceptance makes it a reviewed FINDING linked to evidence; it does not
 *   make it evidence.
 */
export const FINDING_ORIGINS = ['manual', 'askcgt'] as const
export type FindingOrigin = (typeof FINDING_ORIGINS)[number]

/**
 * Committed review states. Uncommitted model output is never written to this
 * table, so there is no 'proposed' row state — a conclusion under review is
 * ephemeral until Paul accepts it.
 */
export const FINDING_REVIEW_STATUSES = ['accepted', 'accepted_edited'] as const
export type FindingReviewStatus = (typeof FINDING_REVIEW_STATUSES)[number]

/** The epistemic class the model assigned to the original conclusion. */
export const FINDING_EPISTEMIC_TYPES = ['evidence', 'inference', 'unknown'] as const
export type FindingEpistemicType = (typeof FINDING_EPISTEMIC_TYPES)[number]

export interface ExperimentFinding {
  id: string
  project_id: string
  experiment_id: string
  /** The wording that was actually accepted. */
  statement: string
  interpretation: string | null
  supports_hypothesis: SupportsHypothesis
  confidence: Confidence | null

  origin: FindingOrigin
  /** The model's original wording, never overwritten. Null for manual findings. */
  proposed_statement: string | null
  proposed_interpretation: string | null
  /** The model's 0-1 confidence, kept numeric rather than coerced into the text enum. */
  proposed_confidence: number | null
  epistemic_type: FindingEpistemicType | null
  review_status: FindingReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  model: string | null
  provider: string | null
  /** Findings are internal by default; sharing with the client is deliberate. */
  client_visible: boolean

  created_by: string | null
  created_at: string
  updated_at: string
}

// Human-facing labels.
export const STATUS_LABELS: Record<ExperimentStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  approved: 'Approved',
  active: 'Active',
  completed: 'Completed',
  rejected: 'Rejected',
  paused: 'Paused',
  cancelled: 'Cancelled',
}

export const RELATION_LABELS: Record<ExperimentRelation, string> = {
  derived_from: 'derived from',
  tests: 'tests',
  enables: 'enables',
  depends_on: 'depends on',
  informed_by: 'informed by',
  resulted_in: 'resulted in',
  supersedes: 'supersedes',
  may_create: 'may create',
}

// Tailwind color classes for a status badge, consistent with the app's
// existing status color language.
export function statusBadgeClasses(status: ExperimentStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'approved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'proposed':
      return 'bg-cyan-100 text-cyan-900 border-cyan-200'
    case 'completed':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'paused':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'rejected':
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}
