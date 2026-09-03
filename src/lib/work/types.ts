// Shared domain types for the work inventory, decisions, and their provenance.
//
// These mirror the tables created in
// supabase/migrations/20260903120000_work_items_and_decisions.sql. Constant
// arrays are the single source of truth for the DB CHECK vocabularies, so a
// value the database would reject cannot be constructed in the UI.
//
// Scope note: this is not a task tracker. It records what work exists, where
// CGT learned of it, who validated it, and what was decided — the artifacts an
// experiment produces.

// --------------------------------------------------------------------------
// Work items
// --------------------------------------------------------------------------

/**
 * The states EXP-003 names: "all requested, active, waiting, blocked,
 * committed, and planned work", plus terminal states so the inventory can be
 * maintained rather than only grown.
 */
export const WORK_STATES = [
  'requested',
  'planned',
  'committed',
  'active',
  'waiting',
  'blocked',
  'done',
  'dropped',
] as const
export type WorkState = (typeof WORK_STATES)[number]

/** States that represent work still in flight — the WIP question. */
export const OPEN_WORK_STATES: WorkState[] = ['requested', 'planned', 'committed', 'active', 'waiting', 'blocked']

/** States where the work is actively consuming attention right now. */
export const WIP_WORK_STATES: WorkState[] = ['active']

/** States where progress depends on something outside the owner's control. */
export const STALLED_WORK_STATES: WorkState[] = ['waiting', 'blocked']

export const WORK_STATE_LABELS: Record<WorkState, string> = {
  requested: 'Requested',
  planned: 'Planned',
  committed: 'Committed',
  active: 'Active',
  waiting: 'Waiting',
  blocked: 'Blocked',
  done: 'Done',
  dropped: 'Dropped',
}

/** Fragmented intake is part of EXP-003's observed problem, so it is recorded per item. */
export const INTAKE_CHANNELS = [
  'email',
  'verbal',
  'phone',
  'teams',
  'chat',
  'meeting',
  'clickup',
  'ticket',
  'spreadsheet',
  'document',
  'self_initiated',
  'unknown',
  'other',
] as const
export type IntakeChannel = (typeof INTAKE_CHANNELS)[number]

/** How CGT learned the work exists. Drives the "discovered late" measure. */
export const DISCOVERY_METHODS = [
  'christie_interview',
  'follow_up_interview',
  'transcript',
  'session_marker',
  'email',
  'spreadsheet',
  'document',
  'clickup',
  'outlook',
  'observed_during_pilot',
  'reported_by_team_member',
  'other',
] as const
export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[number]

export const DISCOVERY_METHOD_LABELS: Record<DiscoveryMethod, string> = {
  christie_interview: 'Initial interview',
  follow_up_interview: 'Follow-up interview',
  transcript: 'Recorded conversation',
  session_marker: 'Session marker',
  email: 'Email',
  spreadsheet: 'Spreadsheet',
  document: 'Document',
  clickup: 'ClickUp',
  outlook: 'Outlook',
  observed_during_pilot: 'Observed during pilot',
  reported_by_team_member: 'Reported by team member',
  other: 'Other',
}

/**
 * Whether a human has reviewed the item.
 *
 * 'corrected' and 'disputed' matter as much as 'confirmed': EXP-003 requires
 * Christie's corrections be preserved, and a disputed item is evidence that
 * CGT's interpretation was wrong.
 */
export const VALIDATION_STATES = ['unvalidated', 'confirmed', 'corrected', 'disputed', 'removed'] as const
export type ValidationState = (typeof VALIDATION_STATES)[number]

export const VALIDATION_STATE_LABELS: Record<ValidationState, string> = {
  unvalidated: 'Not yet validated',
  confirmed: 'Confirmed',
  corrected: 'Corrected',
  disputed: 'Disputed',
  removed: 'Removed (not real work)',
}

export interface WorkItem {
  id: string
  project_id: string
  experiment_id: string | null
  item_number: number
  code: string
  title: string
  description: string | null
  state: WorkState
  owner_person_id: string | null
  requested_by_person_id: string | null
  intake_channel: IntakeChannel | null
  next_action: string | null
  blocked_reason: string | null
  is_informal: boolean
  first_seen_at: string | null
  discovered_at: string
  discovery_method: DiscoveryMethod
  in_initial_inventory: boolean
  validation_state: ValidationState
  validated_at: string | null
  validated_by_person_id: string | null
  client_visible: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// --------------------------------------------------------------------------
// Decisions
// --------------------------------------------------------------------------

/**
 * EXP-003's success criterion requires "at least one real prioritization,
 * sequencing, deferral, or WIP decision", so those are first-class values.
 */
export const DECISION_TYPES = [
  'prioritization',
  'sequencing',
  'deferral',
  'wip_limit',
  'scope',
  'tool_selection',
  'process',
  'commercial',
  'experiment_direction',
  'other',
] as const
export type DecisionType = (typeof DECISION_TYPES)[number]

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  prioritization: 'Prioritization',
  sequencing: 'Sequencing',
  deferral: 'Deferral',
  wip_limit: 'WIP limit',
  scope: 'Scope',
  tool_selection: 'Tool selection',
  process: 'Process',
  commercial: 'Commercial',
  experiment_direction: 'Experiment direction',
  other: 'Other',
}

/**
 * The four decision types EXP-003 accepts as evidence that the shared view
 * supported real decision-making.
 */
export const EXP003_QUALIFYING_DECISION_TYPES: DecisionType[] = [
  'prioritization',
  'sequencing',
  'deferral',
  'wip_limit',
]

/** Continuity: which conclusions still hold, which were only tentative. */
export const DECISION_STATUSES = ['tentative', 'active', 'superseded', 'reversed'] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  tentative: 'Tentative',
  active: 'Active',
  superseded: 'Superseded',
  reversed: 'Reversed',
}

export interface Decision {
  id: string
  project_id: string
  experiment_id: string | null
  decision_number: number
  code: string
  statement: string
  rationale: string | null
  decision_type: DecisionType
  status: DecisionStatus
  supersedes_decision_id: string | null
  alternatives_considered: string | null
  informed_by_view: boolean
  decided_by_person_id: string | null
  decided_at: string
  client_visible: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// --------------------------------------------------------------------------
// Events (maintenance / correction / validation log)
// --------------------------------------------------------------------------

export const WORK_EVENT_TYPES = [
  'discovered',
  'state_changed',
  'corrected',
  'confirmed',
  'disputed',
  'owner_changed',
  'next_action_changed',
  'removed',
  'note',
  'inventory_maintained',
  'inventory_reviewed',
] as const
export type WorkEventType = (typeof WORK_EVENT_TYPES)[number]

/** Events that describe the inventory as a whole rather than one item. */
export const INVENTORY_WIDE_EVENT_TYPES: WorkEventType[] = ['inventory_maintained', 'inventory_reviewed']

export const WORK_EVENT_TYPE_LABELS: Record<WorkEventType, string> = {
  discovered: 'Discovered',
  state_changed: 'State changed',
  corrected: 'Corrected',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  owner_changed: 'Owner changed',
  next_action_changed: 'Next action changed',
  removed: 'Removed',
  note: 'Note',
  inventory_maintained: 'Inventory maintained',
  inventory_reviewed: 'Inventory reviewed',
}

export interface WorkItemEvent {
  id: string
  project_id: string
  experiment_id: string | null
  work_item_id: string | null
  event_type: WorkEventType
  actor_person_id: string | null
  actor_profile_id: string | null
  from_state: string | null
  to_state: string | null
  field_changed: string | null
  previous_value: string | null
  note: string | null
  effort_minutes: number | null
  occurred_at: string
  created_by: string | null
  created_at: string
}

// --------------------------------------------------------------------------
// Evidence provenance
// --------------------------------------------------------------------------

export const EVIDENCE_SOURCE_KINDS = [
  'transcript_utterance',
  'observation',
  'session_marker',
  'intelligence_candidate',
  'email_source',
  'project_file',
  'work_item',
  'decision',
  'stated_by_person',
  'external',
] as const
export type EvidenceSourceKind = (typeof EVIDENCE_SOURCE_KINDS)[number]

export const EVIDENCE_SOURCE_KIND_LABELS: Record<EvidenceSourceKind, string> = {
  transcript_utterance: 'Transcript utterance',
  observation: 'Accepted observation',
  session_marker: 'Session marker',
  intelligence_candidate: 'Model candidate (unreviewed)',
  email_source: 'Email',
  project_file: 'Uploaded file',
  work_item: 'Another work item',
  decision: 'Another decision',
  stated_by_person: 'Stated by a person',
  external: 'External source (not in CGT)',
}

export const EVIDENCE_ROLES = ['supporting', 'contradicting', 'context'] as const
export type EvidenceRole = (typeof EVIDENCE_ROLES)[number]

export interface EvidenceLink {
  id: string
  subject_work_item_id: string | null
  subject_decision_id: string | null
  source_kind: EvidenceSourceKind
  source_transcript_id: string | null
  source_utterance_ids: string[] | null
  source_observation_id: string | null
  source_marker_id: string | null
  source_candidate_id: string | null
  source_email_id: string | null
  source_file_id: string | null
  source_work_item_id: string | null
  source_decision_id: string | null
  source_person_id: string | null
  source_label: string | null
  excerpt_text: string | null
  note: string | null
  role: EvidenceRole
  created_by: string | null
  created_at: string
}

// --------------------------------------------------------------------------
// Guards
// --------------------------------------------------------------------------

export function isWorkState(value: unknown): value is WorkState {
  return typeof value === 'string' && (WORK_STATES as readonly string[]).includes(value)
}

export function isIntakeChannel(value: unknown): value is IntakeChannel {
  return typeof value === 'string' && (INTAKE_CHANNELS as readonly string[]).includes(value)
}

export function isDiscoveryMethod(value: unknown): value is DiscoveryMethod {
  return typeof value === 'string' && (DISCOVERY_METHODS as readonly string[]).includes(value)
}

export function isValidationState(value: unknown): value is ValidationState {
  return typeof value === 'string' && (VALIDATION_STATES as readonly string[]).includes(value)
}

export function isDecisionType(value: unknown): value is DecisionType {
  return typeof value === 'string' && (DECISION_TYPES as readonly string[]).includes(value)
}

export function isDecisionStatus(value: unknown): value is DecisionStatus {
  return typeof value === 'string' && (DECISION_STATUSES as readonly string[]).includes(value)
}

export function isWorkEventType(value: unknown): value is WorkEventType {
  return typeof value === 'string' && (WORK_EVENT_TYPES as readonly string[]).includes(value)
}

export function isEvidenceSourceKind(value: unknown): value is EvidenceSourceKind {
  return typeof value === 'string' && (EVIDENCE_SOURCE_KINDS as readonly string[]).includes(value)
}

export function isEvidenceRole(value: unknown): value is EvidenceRole {
  return typeof value === 'string' && (EVIDENCE_ROLES as readonly string[]).includes(value)
}
