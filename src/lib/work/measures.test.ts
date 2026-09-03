import { describe, expect, it } from 'vitest'
import {
  computeWorkMeasures,
  evaluateExp003Criteria,
  EXP003_COVERAGE_THRESHOLD,
} from './measures'
import { Decision, WorkItem, WorkItemEvent } from './types'

const P = '11111111-1111-4111-8111-111111111111'
const E = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CHRISTIE = '22222222-2222-4222-8222-222222222222'
const RICH = '22222222-2222-4222-8222-222222222223'

let seq = 0
function item(overrides: Partial<WorkItem> = {}): WorkItem {
  seq += 1
  return {
    id: `item-${seq}`,
    project_id: P,
    experiment_id: E,
    item_number: seq,
    code: `WORK-${String(seq).padStart(3, '0')}`,
    title: `Item ${seq}`,
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

function event(overrides: Partial<WorkItemEvent> = {}): WorkItemEvent {
  return {
    id: `event-${Math.random()}`,
    project_id: P,
    experiment_id: E,
    work_item_id: null,
    event_type: 'inventory_maintained',
    actor_person_id: null,
    actor_profile_id: null,
    from_state: null,
    to_state: null,
    field_changed: null,
    previous_value: null,
    note: null,
    effort_minutes: null,
    occurred_at: '2026-09-04T10:00:00Z',
    created_by: null,
    created_at: '2026-09-04T10:00:00Z',
    ...overrides,
  }
}

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: `decision-${Math.random()}`,
    project_id: P,
    experiment_id: E,
    decision_number: 1,
    code: 'DEC-001',
    statement: 'A decision.',
    rationale: null,
    decision_type: 'other',
    status: 'active',
    supersedes_decision_id: null,
    alternatives_considered: null,
    informed_by_view: false,
    decided_by_person_id: null,
    decided_at: '2026-09-04T10:00:00Z',
    client_visible: false,
    created_by: null,
    created_at: '2026-09-04T10:00:00Z',
    updated_at: '2026-09-04T10:00:00Z',
    ...overrides,
  }
}

function measure(workItems: WorkItem[] = [], events: WorkItemEvent[] = [], decisions: Decision[] = []) {
  return computeWorkMeasures({ workItems, events, decisions })
}

describe('coverage — items discovered after the initial inventory', () => {
  it('reports no coverage fraction for an empty inventory rather than 100%', () => {
    const m = measure()
    expect(m.coverage.total).toBe(0)
    // 0/0 is not full coverage; it is no evidence.
    expect(m.coverage.representedFraction).toBeNull()
  })

  it('separates baseline items from late discoveries', () => {
    const m = measure([
      item({ in_initial_inventory: true }),
      item({ in_initial_inventory: true }),
      item({ in_initial_inventory: false, discovery_method: 'observed_during_pilot' }),
    ])
    expect(m.coverage.total).toBe(3)
    expect(m.coverage.inInitialInventory).toBe(2)
    expect(m.coverage.discoveredLate).toBe(1)
    expect(m.coverage.representedFraction).toBeCloseTo(2 / 3)
  })

  it('excludes removed items from the inventory count', () => {
    const m = measure([item(), item({ validation_state: 'removed', validated_at: '2026-09-05T00:00:00Z' })])
    expect(m.coverage.total).toBe(1)
    expect(m.validation.removed).toBe(1)
  })
})

describe('completeness — the per-item success criterion', () => {
  it('counts an item as fully specified only with description, owner and next action', () => {
    const m = measure([
      item({ description: 'd', owner_person_id: CHRISTIE, next_action: 'call vendor' }),
      item({ description: 'd', owner_person_id: CHRISTIE }), // no next action
      item({ description: 'd', next_action: 'x' }), // no owner
      item({ owner_person_id: CHRISTIE, next_action: 'x' }), // no description
    ])
    expect(m.completeness.fullySpecified).toBe(1)
    expect(m.completeness.fullySpecifiedFraction).toBeCloseTo(0.25)
  })

  it('accepts a stated dependency in place of a next action', () => {
    const m = measure([
      item({ state: 'blocked', description: 'd', owner_person_id: RICH, blocked_reason: 'waiting on vendor' }),
    ])
    expect(m.completeness.fullySpecified).toBe(1)
    expect(m.completeness.withNextActionOrDependency).toBe(1)
  })

  it('treats whitespace-only text as absent', () => {
    const m = measure([item({ description: '   ', owner_person_id: RICH, next_action: '\n' })])
    expect(m.completeness.fullySpecified).toBe(0)
    expect(m.completeness.withDescription).toBe(0)
  })

  // The "status lives only in someone's head" condition must be countable.
  it('counts waiting/blocked items with no stated reason', () => {
    const m = measure([
      item({ state: 'blocked' }),
      item({ state: 'waiting' }),
      item({ state: 'blocked', blocked_reason: 'vendor' }),
      item({ state: 'active' }),
    ])
    expect(m.completeness.stalledWithoutStatedReason).toBe(2)
    expect(m.stalledItems).toBe(3)
  })
})

describe('validation — Christie\'s review, including corrections and disputes', () => {
  it('counts each review outcome separately', () => {
    const at = '2026-09-05T00:00:00Z'
    const m = measure([
      item({ validation_state: 'confirmed', validated_at: at }),
      item({ validation_state: 'corrected', validated_at: at }),
      item({ validation_state: 'disputed', validated_at: at }),
      item(),
    ])
    expect(m.validation).toMatchObject({ confirmed: 1, corrected: 1, disputed: 1, unvalidated: 1, reviewed: 3 })
    expect(m.validation.reviewedFraction).toBeCloseTo(0.75)
  })
})

describe('concentration — dependence on one person', () => {
  it('identifies the owner holding the most open work', () => {
    const m = measure([
      item({ state: 'active', owner_person_id: CHRISTIE }),
      item({ state: 'waiting', owner_person_id: CHRISTIE }),
      item({ state: 'blocked', owner_person_id: CHRISTIE }),
      item({ state: 'active', owner_person_id: RICH }),
    ])
    expect(m.concentration.topOwnerPersonId).toBe(CHRISTIE)
    expect(m.concentration.topOwnerOpenItems).toBe(3)
    expect(m.concentration.topOwnerFraction).toBeCloseTo(0.75)
  })

  it('excludes closed work from concentration', () => {
    const m = measure([
      item({ state: 'done', owner_person_id: CHRISTIE }),
      item({ state: 'active', owner_person_id: RICH }),
    ])
    expect(m.concentration.topOwnerPersonId).toBe(RICH)
    expect(m.openItems).toBe(1)
  })

  // Unowned work must not be reported as a person hoarding work.
  it('reports unowned open work separately and never as the top owner', () => {
    const m = measure([item({ state: 'active' }), item({ state: 'active' }), item({ state: 'active', owner_person_id: RICH })])
    expect(m.concentration.unownedOpenItems).toBe(2)
    expect(m.concentration.topOwnerPersonId).toBe(RICH)
  })

  it('has no top owner when nothing is owned', () => {
    const m = measure([item({ state: 'active' })])
    expect(m.concentration.topOwnerPersonId).toBeNull()
    expect(m.concentration.topOwnerFraction).toBeNull()
  })
})

describe('intake — channel fragmentation and informal work', () => {
  it('counts distinct channels and ranks them', () => {
    const m = measure([
      item({ intake_channel: 'email' }),
      item({ intake_channel: 'email' }),
      item({ intake_channel: 'verbal' }),
      item({ intake_channel: 'clickup' }),
    ])
    expect(m.intake.distinctChannels).toBe(3)
    expect(m.intake.channels[0]).toEqual({ channel: 'email', items: 2 })
  })

  it('does not count "unknown" or missing as a channel', () => {
    const m = measure([item({ intake_channel: 'unknown' }), item({ intake_channel: null }), item({ intake_channel: 'email' })])
    expect(m.intake.distinctChannels).toBe(1)
    expect(m.intake.unknownChannelItems).toBe(2)
  })

  it('counts informal work that lives in no system', () => {
    expect(measure([item({ is_informal: true }), item()]).intake.informalItems).toBe(1)
  })
})

describe('maintenance — administrative effort', () => {
  it('reports no mean when nothing has been logged, rather than zero', () => {
    const m = measure([item()], [event({ effort_minutes: null })])
    expect(m.maintenance.totalEffortMinutes).toBe(0)
    // An unlogged constraint is unevaluated, not satisfied.
    expect(m.maintenance.meanMinutesPerActiveDay).toBeNull()
    expect(m.maintenance.daysWithRecordedEffort).toBe(0)
  })

  it('aggregates effort per calendar day', () => {
    const m = measure(
      [item()],
      [
        event({ effort_minutes: 5, occurred_at: '2026-09-04T09:00:00Z' }),
        event({ effort_minutes: 6, occurred_at: '2026-09-04T17:00:00Z' }),
        event({ effort_minutes: 8, occurred_at: '2026-09-05T09:00:00Z' }),
      ]
    )
    expect(m.maintenance.totalEffortMinutes).toBe(19)
    expect(m.maintenance.daysWithRecordedEffort).toBe(2)
    expect(m.maintenance.meanMinutesPerActiveDay).toBeCloseTo(9.5)
    expect(m.maintenance.daysOverFifteenMinutes).toBe(0)
  })

  it('flags a day that breaches the 15-minute constraint', () => {
    const m = measure(
      [item()],
      [
        event({ effort_minutes: 10, occurred_at: '2026-09-04T09:00:00Z' }),
        event({ effort_minutes: 9, occurred_at: '2026-09-04T15:00:00Z' }),
      ]
    )
    expect(m.maintenance.daysOverFifteenMinutes).toBe(1)
  })

  it('counts correction and validation events', () => {
    const m = measure(
      [item()],
      [
        event({ event_type: 'corrected', work_item_id: 'item-1' }),
        event({ event_type: 'corrected', work_item_id: 'item-1' }),
        event({ event_type: 'confirmed', work_item_id: 'item-1' }),
        event({ event_type: 'disputed', work_item_id: 'item-1' }),
      ]
    )
    expect(m.maintenance.correctionEvents).toBe(2)
    expect(m.maintenance.validationEvents).toBe(2)
  })
})

describe('decisions — did the view actually inform anything', () => {
  it('only counts a qualifying decision when it was informed by the view', () => {
    const m = measure(
      [],
      [],
      [
        decision({ decision_type: 'prioritization', informed_by_view: false }),
        decision({ decision_type: 'other', informed_by_view: true }),
        decision({ decision_type: 'deferral', informed_by_view: true }),
      ]
    )
    expect(m.decisions.total).toBe(3)
    expect(m.decisions.informedByView).toBe(2)
    expect(m.decisions.qualifyingInformedByView).toBe(1)
  })

  it('accepts all four EXP-003 qualifying types', () => {
    const m = measure(
      [],
      [],
      (['prioritization', 'sequencing', 'deferral', 'wip_limit'] as const).map((t) =>
        decision({ decision_type: t, informed_by_view: true })
      )
    )
    expect(m.decisions.qualifyingInformedByView).toBe(4)
  })

  it('counts decisions with no rationale and with rejected alternatives', () => {
    const m = measure(
      [],
      [],
      [decision({ rationale: 'because x', alternatives_considered: 'considered y' }), decision()]
    )
    expect(m.decisions.withoutRationale).toBe(1)
    expect(m.decisions.withAlternatives).toBe(1)
  })

  it('tracks status so superseded conclusions are distinguishable', () => {
    const m = measure(
      [],
      [],
      [decision({ status: 'active' }), decision({ status: 'tentative' }), decision({ status: 'superseded' })]
    )
    expect(m.decisions).toMatchObject({ active: 1, tentative: 1, superseded: 1 })
  })
})

describe('provenance — unsourced inventory entries', () => {
  it('treats every item as unsourced when no evidence index is supplied', () => {
    const m = computeWorkMeasures({ workItems: [item(), item()], events: [], decisions: [] })
    expect(m.itemsWithoutEvidence).toBe(2)
  })

  it('counts only items missing an evidence link', () => {
    const a = item()
    const b = item()
    const m = computeWorkMeasures({
      workItems: [a, b],
      events: [],
      decisions: [],
      workItemIdsWithEvidence: new Set([a.id]),
    })
    expect(m.itemsWithoutEvidence).toBe(1)
  })
})

describe('evaluateExp003Criteria', () => {
  it('marks every computable criterion unevaluated for an empty inventory', () => {
    const results = evaluateExp003Criteria(measure())
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]))
    for (const key of ['coverage', 'item_completeness', 'christie_validation', 'real_decision', 'maintenance_cost']) {
      expect(byKey[key].status, key).toBe('unevaluated')
      expect(byKey[key].blockedBy, key).toBeTruthy()
    }
  })

  // The central honesty property: absent measurement must never read as success.
  it('never reports a criterion as met when there is no evidence for it', () => {
    const results = evaluateExp003Criteria(measure())
    expect(results.some((r) => r.status === 'met')).toBe(false)
  })

  it('meets coverage at the 90% threshold and fails below it', () => {
    const nine = Array.from({ length: 9 }, () => item({ in_initial_inventory: true }))
    const met = evaluateExp003Criteria(measure([...nine, item({ in_initial_inventory: false })]))
    expect(met.find((r) => r.key === 'coverage')!.status).toBe('met')
    expect(EXP003_COVERAGE_THRESHOLD).toBe(0.9)

    const notMet = evaluateExp003Criteria(
      measure([...Array.from({ length: 8 }, () => item({ in_initial_inventory: true })), item({ in_initial_inventory: false }), item({ in_initial_inventory: false })])
    )
    expect(notMet.find((r) => r.key === 'coverage')!.status).toBe('not_met')
  })

  it('reports the real-decision criterion met with one qualifying decision', () => {
    const results = evaluateExp003Criteria(
      measure([item()], [], [decision({ decision_type: 'prioritization', informed_by_view: true })])
    )
    const r = results.find((x) => x.key === 'real_decision')!
    expect(r.status).toBe('met')
    expect(r.observed).toContain('1 qualifying decision')
  })

  it('reports not_met when decisions exist but none were informed by the view', () => {
    const results = evaluateExp003Criteria(
      measure([item()], [], [decision({ decision_type: 'prioritization', informed_by_view: false })])
    )
    expect(results.find((x) => x.key === 'real_decision')!.status).toBe('not_met')
  })

  it('fails the maintenance constraint when a day exceeds 15 minutes', () => {
    const results = evaluateExp003Criteria(
      measure([item()], [event({ effort_minutes: 22, occurred_at: '2026-09-04T09:00:00Z' })])
    )
    const r = results.find((x) => x.key === 'maintenance_cost')!
    expect(r.status).toBe('not_met')
    expect(r.observed).toContain('1 day(s) over 15 minutes')
  })

  // Christie's rating has no table; it must be surfaced as a gap.
  it('always reports Christie\'s subjective assessment as unevaluated with a stated reason', () => {
    const full = evaluateExp003Criteria(
      measure(
        [item({ description: 'd', owner_person_id: CHRISTIE, next_action: 'x', validation_state: 'confirmed', validated_at: '2026-09-05T00:00:00Z' })],
        [event({ effort_minutes: 5, occurred_at: '2026-09-04T09:00:00Z' })],
        [decision({ decision_type: 'wip_limit', informed_by_view: true })]
      )
    )
    const r = full.find((x) => x.key === 'christie_assessment')!
    expect(r.status).toBe('unevaluated')
    expect(r.blockedBy).toMatch(/no durable representation of a participant rating/)
  })

  it('can report a fully satisfied computable set while still flagging the assessment gap', () => {
    const results = evaluateExp003Criteria(
      measure(
        [item({ description: 'd', owner_person_id: CHRISTIE, next_action: 'x', validation_state: 'confirmed', validated_at: '2026-09-05T00:00:00Z' })],
        [event({ effort_minutes: 5, occurred_at: '2026-09-04T09:00:00Z' })],
        [decision({ decision_type: 'wip_limit', informed_by_view: true })]
      )
    )
    expect(results.filter((r) => r.status === 'met').length).toBe(5)
    expect(results.filter((r) => r.status === 'unevaluated').length).toBe(1)
  })
})
