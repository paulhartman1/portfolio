import {
  Decision,
  EXP003_QUALIFYING_DECISION_TYPES,
  STALLED_WORK_STATES,
  OPEN_WORK_STATES,
  WIP_WORK_STATES,
  WorkItem,
  WorkItemEvent,
  WorkState,
} from './types'

/**
 * Derived measures over a stored work inventory.
 *
 * Everything here is a PURE function of rows already in the database. Nothing
 * is estimated, inferred, or remembered — which is the point: EXP-003's
 * success and failure criteria are numeric thresholds, and a threshold that
 * cannot be computed from durable records cannot be honestly evaluated.
 *
 * These measures are consumed by both the admin UI and AskCGT, so a number
 * Paul sees on screen is the same number the model reasons over.
 *
 * Deliberate omission: Christie's own 1-5 completeness/usefulness rating and
 * her "would you continue" answer are NOT modelled here. They are her
 * subjective assessment, not a derived measure, and they have no table yet.
 * `assessment` is reported as an explicit gap rather than silently absent.
 */

export type CoverageMeasure = {
  /** Total items that are not marked removed. */
  total: number
  /** Items present when the inventory was first agreed. */
  inInitialInventory: number
  /** Items found afterwards — work that was invisible at baseline. */
  discoveredLate: number
  /**
   * Share of items that were already represented, as a 0-1 fraction.
   * EXP-003 succeeds at >= 0.9 and fails below it. Null when there are no
   * items, because 0/0 is not 100% coverage — it is no evidence.
   */
  representedFraction: number | null
}

export type CompletenessMeasure = {
  /** Items carrying a next action OR a stated dependency. */
  withNextActionOrDependency: number
  /** Items with an identified owner. */
  withOwner: number
  /** Items with a description beyond the title. */
  withDescription: number
  /** Items satisfying the full success criterion (description, state, owner, next action/dependency). */
  fullySpecified: number
  /** 0-1 fraction fully specified, or null when there are no items. */
  fullySpecifiedFraction: number | null
  /**
   * Open items in waiting/blocked with NO stated reason. This is the "status
   * lives only in someone's head" condition, recorded rather than rejected.
   */
  stalledWithoutStatedReason: number
}

export type ValidationMeasure = {
  unvalidated: number
  confirmed: number
  corrected: number
  disputed: number
  removed: number
  /** Items Christie has actually reviewed in some way. */
  reviewed: number
  /** 0-1 fraction reviewed, or null when there are no items. */
  reviewedFraction: number | null
}

export type ConcentrationMeasure = {
  /** Open items grouped by owner person id; null key means unowned. */
  openByOwner: Array<{ ownerPersonId: string | null; openItems: number }>
  /** The single owner holding the most open work, if any. */
  topOwnerPersonId: string | null
  topOwnerOpenItems: number
  /**
   * Share of open work held by the top owner, 0-1. High concentration is the
   * condition EXP-003's problem statement describes for Christie.
   */
  topOwnerFraction: number | null
  /** Open items with nobody identified as owner. */
  unownedOpenItems: number
}

export type IntakeMeasure = {
  /** Distinct intake channels observed. Fragmentation is the observed problem. */
  channels: Array<{ channel: string; items: number }>
  distinctChannels: number
  /** Items whose intake channel was never recorded. */
  unknownChannelItems: number
  /** Items marked as living in no system at all. */
  informalItems: number
}

export type MaintenanceMeasure = {
  /** Total recorded deliberate administrative minutes. */
  totalEffortMinutes: number
  /** Distinct calendar days on which effort was recorded. */
  daysWithRecordedEffort: number
  /**
   * Mean minutes per day that had recorded effort. EXP-003 fails above 15.
   * Null when no effort has been recorded — which means the constraint is
   * unevaluated, NOT satisfied.
   */
  meanMinutesPerActiveDay: number | null
  /** Days whose recorded effort exceeded the 15-minute constraint. */
  daysOverFifteenMinutes: number
  correctionEvents: number
  validationEvents: number
}

export type DecisionMeasure = {
  total: number
  /** Decisions Paul recorded as actually informed by the shared view. */
  informedByView: number
  /**
   * Decisions that both qualify by type (prioritization / sequencing /
   * deferral / WIP) AND were informed by the view. EXP-003 requires >= 1.
   */
  qualifyingInformedByView: number
  active: number
  tentative: number
  superseded: number
  /** Decisions with no recorded rationale — a decision nobody can later justify. */
  withoutRationale: number
  /** Decisions recording what was considered and rejected. */
  withAlternatives: number
}

export type StateBreakdown = Array<{ state: WorkState; items: number }>

export type WorkMeasures = {
  coverage: CoverageMeasure
  completeness: CompletenessMeasure
  validation: ValidationMeasure
  concentration: ConcentrationMeasure
  intake: IntakeMeasure
  maintenance: MaintenanceMeasure
  decisions: DecisionMeasure
  byState: StateBreakdown
  wipItems: number
  openItems: number
  stalledItems: number
  /** Items with no provenance link at all — unsourced inventory entries. */
  itemsWithoutEvidence: number
}

export type MeasureInput = {
  workItems: WorkItem[]
  events: WorkItemEvent[]
  decisions: Decision[]
  /** Work item ids that have at least one evidence_links row. */
  workItemIdsWithEvidence?: Set<string>
}

function fraction(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return numerator / denominator
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function computeWorkMeasures(input: MeasureInput): WorkMeasures {
  const { events, decisions, workItemIdsWithEvidence } = input

  // 'removed' items were judged not to be real work, so they are excluded from
  // coverage and completeness rather than counted as inventory.
  const live = input.workItems.filter((item) => item.validation_state !== 'removed')
  const total = live.length

  const openStates = new Set<string>(OPEN_WORK_STATES)
  const wipStates = new Set<string>(WIP_WORK_STATES)
  const stalledStates = new Set<string>(STALLED_WORK_STATES)

  const open = live.filter((item) => openStates.has(item.state))

  // --- coverage ---
  const inInitialInventory = live.filter((item) => item.in_initial_inventory).length
  const coverage: CoverageMeasure = {
    total,
    inInitialInventory,
    discoveredLate: total - inInitialInventory,
    representedFraction: fraction(inInitialInventory, total),
  }

  // --- completeness ---
  const hasText = (value: string | null) => Boolean(value && value.trim())
  const withNextActionOrDependency = live.filter(
    (item) => hasText(item.next_action) || hasText(item.blocked_reason)
  ).length
  const withOwner = live.filter((item) => Boolean(item.owner_person_id)).length
  const withDescription = live.filter((item) => hasText(item.description)).length
  const fullySpecified = live.filter(
    (item) =>
      hasText(item.description) &&
      Boolean(item.owner_person_id) &&
      (hasText(item.next_action) || hasText(item.blocked_reason))
  ).length
  const completeness: CompletenessMeasure = {
    withNextActionOrDependency,
    withOwner,
    withDescription,
    fullySpecified,
    fullySpecifiedFraction: fraction(fullySpecified, total),
    stalledWithoutStatedReason: live.filter(
      (item) => stalledStates.has(item.state) && !hasText(item.blocked_reason)
    ).length,
  }

  // --- validation ---
  const countBy = (state: string) => live.filter((item) => item.validation_state === state).length
  const reviewed = live.filter((item) => item.validation_state !== 'unvalidated').length
  const validation: ValidationMeasure = {
    unvalidated: countBy('unvalidated'),
    confirmed: countBy('confirmed'),
    corrected: countBy('corrected'),
    disputed: countBy('disputed'),
    // 'removed' is counted from the unfiltered set, since removal is itself a
    // validation outcome.
    removed: input.workItems.filter((item) => item.validation_state === 'removed').length,
    reviewed,
    reviewedFraction: fraction(reviewed, total),
  }

  // --- ownership concentration ---
  const ownerCounts = new Map<string | null, number>()
  for (const item of open) {
    const key = item.owner_person_id ?? null
    ownerCounts.set(key, (ownerCounts.get(key) ?? 0) + 1)
  }
  const openByOwner = Array.from(ownerCounts.entries())
    .map(([ownerPersonId, openItems]) => ({ ownerPersonId, openItems }))
    .sort((a, b) => b.openItems - a.openItems)
  // The "top owner" must be a real person; unowned work is reported separately.
  const topOwned = openByOwner.filter((entry) => entry.ownerPersonId !== null)
  const concentration: ConcentrationMeasure = {
    openByOwner,
    topOwnerPersonId: topOwned[0]?.ownerPersonId ?? null,
    topOwnerOpenItems: topOwned[0]?.openItems ?? 0,
    topOwnerFraction: topOwned[0] ? fraction(topOwned[0].openItems, open.length) : null,
    unownedOpenItems: ownerCounts.get(null) ?? 0,
  }

  // --- intake fragmentation ---
  const channelCounts = new Map<string, number>()
  for (const item of live) {
    if (!item.intake_channel || item.intake_channel === 'unknown') continue
    channelCounts.set(item.intake_channel, (channelCounts.get(item.intake_channel) ?? 0) + 1)
  }
  const intake: IntakeMeasure = {
    channels: Array.from(channelCounts.entries())
      .map(([channel, items]) => ({ channel, items }))
      .sort((a, b) => b.items - a.items),
    distinctChannels: channelCounts.size,
    unknownChannelItems: live.filter((item) => !item.intake_channel || item.intake_channel === 'unknown').length,
    informalItems: live.filter((item) => item.is_informal).length,
  }

  // --- maintenance effort ---
  const effortByDay = new Map<string, number>()
  let totalEffortMinutes = 0
  for (const event of events) {
    if (event.effort_minutes == null) continue
    totalEffortMinutes += event.effort_minutes
    const key = dayKey(event.occurred_at)
    effortByDay.set(key, (effortByDay.get(key) ?? 0) + event.effort_minutes)
  }
  const maintenance: MaintenanceMeasure = {
    totalEffortMinutes,
    daysWithRecordedEffort: effortByDay.size,
    meanMinutesPerActiveDay: fraction(totalEffortMinutes, effortByDay.size),
    daysOverFifteenMinutes: Array.from(effortByDay.values()).filter((minutes) => minutes > 15).length,
    correctionEvents: events.filter((event) => event.event_type === 'corrected').length,
    validationEvents: events.filter(
      (event) => event.event_type === 'confirmed' || event.event_type === 'disputed'
    ).length,
  }

  // --- decisions ---
  const qualifying = new Set<string>(EXP003_QUALIFYING_DECISION_TYPES)
  const decisionMeasure: DecisionMeasure = {
    total: decisions.length,
    informedByView: decisions.filter((d) => d.informed_by_view).length,
    qualifyingInformedByView: decisions.filter((d) => d.informed_by_view && qualifying.has(d.decision_type)).length,
    active: decisions.filter((d) => d.status === 'active').length,
    tentative: decisions.filter((d) => d.status === 'tentative').length,
    superseded: decisions.filter((d) => d.status === 'superseded').length,
    withoutRationale: decisions.filter((d) => !hasText(d.rationale)).length,
    withAlternatives: decisions.filter((d) => hasText(d.alternatives_considered)).length,
  }

  const stateCounts = new Map<WorkState, number>()
  for (const item of live) stateCounts.set(item.state, (stateCounts.get(item.state) ?? 0) + 1)

  return {
    coverage,
    completeness,
    validation,
    concentration,
    intake,
    maintenance,
    decisions: decisionMeasure,
    byState: Array.from(stateCounts.entries())
      .map(([state, items]) => ({ state, items }))
      .sort((a, b) => b.items - a.items),
    wipItems: live.filter((item) => wipStates.has(item.state)).length,
    openItems: open.length,
    stalledItems: live.filter((item) => stalledStates.has(item.state)).length,
    itemsWithoutEvidence: workItemIdsWithEvidence
      ? live.filter((item) => !workItemIdsWithEvidence.has(item.id)).length
      : total,
  }
}

// --------------------------------------------------------------------------
// EXP-003 criteria evaluation
// --------------------------------------------------------------------------

/**
 * A criterion's status. 'unevaluated' is deliberately distinct from 'not_met':
 * an absent measurement must never read as a satisfied threshold.
 */
export type CriterionStatus = 'met' | 'not_met' | 'unevaluated'

export type CriterionResult = {
  key: string
  criterion: string
  status: CriterionStatus
  /** What the stored data actually shows, in plain language. */
  observed: string
  /** Why the criterion cannot yet be judged, when unevaluated. */
  blockedBy?: string
}

export const EXP003_COVERAGE_THRESHOLD = 0.9
export const EXP003_MAX_MINUTES_PER_DAY = 15

/**
 * Evaluates the EXP-003 success/failure criteria that are computable from
 * durable records.
 *
 * This does NOT decide whether the experiment succeeded. It reports which
 * thresholds the stored evidence can currently speak to, so the ones that
 * cannot be evaluated are visible as gaps rather than assumed.
 */
export function evaluateExp003Criteria(measures: WorkMeasures): CriterionResult[] {
  const results: CriterionResult[] = []
  const pct = (value: number | null) => (value == null ? 'n/a' : `${Math.round(value * 1000) / 10}%`)

  results.push(
    measures.coverage.total === 0
      ? {
          key: 'coverage',
          criterion: `At least ${EXP003_COVERAGE_THRESHOLD * 100}% of meaningful work identified at review is already represented`,
          status: 'unevaluated',
          observed: 'The inventory is empty.',
          blockedBy: 'No work items have been recorded yet.',
        }
      : {
          key: 'coverage',
          criterion: `At least ${EXP003_COVERAGE_THRESHOLD * 100}% of meaningful work identified at review is already represented`,
          status:
            (measures.coverage.representedFraction ?? 0) >= EXP003_COVERAGE_THRESHOLD ? 'met' : 'not_met',
          observed: `${measures.coverage.inInitialInventory} of ${measures.coverage.total} items (${pct(
            measures.coverage.representedFraction
          )}) were already represented; ${measures.coverage.discoveredLate} were discovered later.`,
        }
  )

  results.push(
    measures.coverage.total === 0
      ? {
          key: 'item_completeness',
          criterion: 'Every item has a description, current state, owner, and next action or dependency',
          status: 'unevaluated',
          observed: 'The inventory is empty.',
          blockedBy: 'No work items have been recorded yet.',
        }
      : {
          key: 'item_completeness',
          criterion: 'Every item has a description, current state, owner, and next action or dependency',
          status: measures.completeness.fullySpecified === measures.coverage.total ? 'met' : 'not_met',
          observed: `${measures.completeness.fullySpecified} of ${measures.coverage.total} items (${pct(
            measures.completeness.fullySpecifiedFraction
          )}) are fully specified. ${measures.completeness.stalledWithoutStatedReason} waiting/blocked items have no stated dependency.`,
        }
  )

  results.push(
    measures.validation.reviewed === 0
      ? {
          key: 'christie_validation',
          criterion: 'Christie confirms the inventory represents all materially significant work she manages',
          status: 'unevaluated',
          observed: 'No item has been validated by anyone.',
          blockedBy: 'Christie has not yet reviewed the inventory.',
        }
      : {
          key: 'christie_validation',
          criterion: 'Christie confirms the inventory represents all materially significant work she manages',
          status: measures.validation.unvalidated === 0 ? 'met' : 'not_met',
          observed: `${measures.validation.reviewed} of ${measures.coverage.total} items reviewed (${measures.validation.confirmed} confirmed, ${measures.validation.corrected} corrected, ${measures.validation.disputed} disputed); ${measures.validation.unvalidated} still unvalidated.`,
        }
  )

  results.push(
    measures.decisions.total === 0
      ? {
          key: 'real_decision',
          criterion:
            'Christie uses the inventory to make at least one real prioritization, sequencing, deferral, or WIP decision',
          status: 'unevaluated',
          observed: 'No decisions recorded.',
          blockedBy: 'No decisions have been recorded against this experiment.',
        }
      : {
          key: 'real_decision',
          criterion:
            'Christie uses the inventory to make at least one real prioritization, sequencing, deferral, or WIP decision',
          status: measures.decisions.qualifyingInformedByView >= 1 ? 'met' : 'not_met',
          observed: `${measures.decisions.qualifyingInformedByView} qualifying decision(s) informed by the view, out of ${measures.decisions.total} recorded decision(s) (${measures.decisions.informedByView} informed by the view in total).`,
        }
  )

  results.push(
    measures.maintenance.daysWithRecordedEffort === 0
      ? {
          key: 'maintenance_cost',
          criterion: `Maintaining the inventory takes no more than ${EXP003_MAX_MINUTES_PER_DAY} minutes of deliberate effort per working day`,
          status: 'unevaluated',
          observed: 'No maintenance effort has been recorded.',
          blockedBy: 'Effort must be logged on inventory events before this can be judged.',
        }
      : {
          key: 'maintenance_cost',
          criterion: `Maintaining the inventory takes no more than ${EXP003_MAX_MINUTES_PER_DAY} minutes of deliberate effort per working day`,
          status: measures.maintenance.daysOverFifteenMinutes === 0 ? 'met' : 'not_met',
          observed: `${measures.maintenance.totalEffortMinutes} minutes recorded across ${measures.maintenance.daysWithRecordedEffort} day(s); mean ${
            measures.maintenance.meanMinutesPerActiveDay == null
              ? 'n/a'
              : Math.round(measures.maintenance.meanMinutesPerActiveDay * 10) / 10
          } min/day; ${measures.maintenance.daysOverFifteenMinutes} day(s) over ${EXP003_MAX_MINUTES_PER_DAY} minutes.`,
        }
  )

  // Christie's subjective rating has no durable home yet. Reporting it as
  // unevaluated is the honest answer; omitting it would imply the experiment
  // can conclude without it.
  results.push({
    key: 'christie_assessment',
    criterion: 'Christie rates the view at least 4/5 for completeness and usefulness and chooses to continue',
    status: 'unevaluated',
    observed: 'Not recorded.',
    blockedBy: 'CGT has no durable representation of a participant rating. This criterion cannot be evaluated from stored data.',
  })

  return results
}
