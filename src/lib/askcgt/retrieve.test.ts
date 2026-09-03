import { describe, expect, it } from 'vitest'
import { SupabaseClient } from '@supabase/supabase-js'
import { retrieveProjectEvidence } from './retrieve'
import { buildUserPrompt } from './context'
import { IDS } from './fixtures'

/**
 * A minimal chainable Supabase stub.
 *
 * It applies eq/in filters the way PostgREST would, so a test can prove that
 * retrieval scopes a query rather than relying on a later in-memory filter.
 * Rows for a table that is never registered come back empty, which is what an
 * RLS denial looks like to this code.
 */
type Row = Record<string, unknown>

function makeSupabase(tables: Record<string, Row[]>) {
  const queries: Array<{ table: string; filters: Array<[string, string, unknown]> }> = []

  function builder(table: string) {
    const filters: Array<[string, string, unknown]> = []
    const record = { table, filters }
    queries.push(record)

    const apply = (): Row[] => {
      let rows = tables[table] ? [...tables[table]] : []
      for (const [op, column, value] of filters) {
        if (op === 'eq') rows = rows.filter((r) => r[column] === value)
        if (op === 'in') rows = rows.filter((r) => (value as unknown[]).includes(r[column]))
      }
      return rows
    }

    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push(['eq', column, value])
        return chain
      },
      in: (column: string, value: unknown) => {
        filters.push(['in', column, value])
        return chain
      },
      maybeSingle: async () => ({ data: apply()[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: apply(), error: null }),
    }
    return chain
  }

  const client = { from: (table: string) => builder(table) } as unknown as SupabaseClient
  return { client, queries }
}

const PROJECT = { id: IDS.project, name: 'Alpine Technology Group', description: 'Software consultancy.', status: 'active' }
const OTHER_PROJECT = { id: IDS.otherProject, name: 'Rush N Dush', description: null, status: 'active' }

function experimentRow(overrides: Row = {}): Row {
  return {
    id: IDS.experiment003,
    project_id: IDS.project,
    code: 'EXP-003',
    slug: 'make-the-work-visible',
    title: 'Make the work visible',
    status: 'approved',
    primary_question: 'Whether CGT can help Alpine create a shared view of all its work.',
    problem: 'Christie serves as the primary intake point, evaluator, product manager, and developer.',
    hypothesis: 'A shared, consistently maintained view enables deliberate WIP decisions.',
    rationale: null,
    method: 'Ask Christie to identify all Alpine work she currently knows about.',
    success_criteria: 'Christie confirms the inventory represents all materially significant work.',
    failure_criteria: 'Materially significant work remains routinely absent.',
    stop_conditions: null,
    scope: null,
    decision_rule: null,
    conclusion: null,
    recommendation: null,
    resulting_decision: null,
    confidence: null,
    design: { out_of_scope: 'Selecting or proving a specific tool' },
    created_at: '2026-09-02T19:00:00Z',
    proposed_at: '2026-09-02T19:41:13Z',
    approved_at: '2026-09-03T02:37:31Z',
    activated_at: null,
    completed_at: null,
    ...overrides,
  }
}

function baseTables(): Record<string, Row[]> {
  return {
    projects: [PROJECT, OTHER_PROJECT],
    project_persons: [],
    engagement_recordings: [],
    project_intelligence_candidates: [],
    experiments: [experimentRow()],
    proposal_experiments: [],
    engagement_transcripts: [],
    engagement_session_notes: [],
    transcript_observations: [],
    engagement_transcript_speaker_clusters: [],
  }
}

describe('retrieveProjectEvidence — project level (no experiment)', () => {
  it('works without an experiment id and reports no active experiment', async () => {
    const { client } = makeSupabase(baseTables())
    const result = await retrieveProjectEvidence(client, IDS.project)
    expect(result.context.project.name).toBe('Alpine Technology Group')
    expect(result.context.activeExperiment).toBeNull()
    expect(result.context.activeExperimentProposals).toEqual([])
  })

  it('throws when the project cannot be read', async () => {
    const { client } = makeSupabase({ ...baseTables(), projects: [] })
    await expect(retrieveProjectEvidence(client, IDS.project)).rejects.toThrow('Project not found')
  })

  it('does not query the active-experiment path at all', async () => {
    const { client, queries } = makeSupabase(baseTables())
    await retrieveProjectEvidence(client, IDS.project)
    expect(queries.some((q) => q.table === 'proposal_experiments')).toBe(false)
  })
})

describe('retrieveProjectEvidence — active experiment ownership', () => {
  it('resolves the active experiment when it belongs to the project', async () => {
    const { client } = makeSupabase(baseTables())
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.context.activeExperiment?.code).toBe('EXP-003')
    expect(result.context.activeExperiment?.status).toBe('approved')
  })

  // The ownership check is the security boundary for this feature.
  it('scopes the active-experiment query by BOTH id and project_id', async () => {
    const { client, queries } = makeSupabase(baseTables())
    await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    const lookups = queries.filter((q) => q.table === 'experiments')
    const scoped = lookups.find((q) => q.filters.some(([, col]) => col === 'id'))
    expect(scoped).toBeDefined()
    expect(scoped!.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'id', IDS.experiment003],
        ['eq', 'project_id', IDS.project],
      ])
    )
  })

  it('fails safely when the experiment belongs to another project', async () => {
    const tables = baseTables()
    tables.experiments = [experimentRow({ project_id: IDS.otherProject })]
    const { client } = makeSupabase(tables)
    await expect(
      retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    ).rejects.toThrow('Experiment not found')
  })

  it('fails safely when the experiment does not exist or RLS hides it', async () => {
    const { client } = makeSupabase({ ...baseTables(), experiments: [] })
    await expect(
      retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    ).rejects.toThrow('Experiment not found')
  })

  it('makes a draft active experiment citable even though drafts are excluded from the list', async () => {
    const tables = baseTables()
    tables.experiments = [experimentRow({ status: 'draft' })]
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.context.activeExperiment?.status).toBe('draft')
    expect(result.allowed.experiments.has(IDS.experiment003)).toBe(true)
  })
})

describe('retrieveProjectEvidence — proposal provenance', () => {
  it('traverses proposal_experiments to the connected proposal', async () => {
    const tables = baseTables()
    tables.proposal_experiments = [
      {
        experiment_id: IDS.experiment003,
        proposals: {
          id: IDS.proposal005,
          code: 'PROP-005',
          title: 'Make the work visible',
          status: 'accepted',
          kind: 'experiment',
          sent_at: '2026-09-02T19:41:13Z',
          accepted_at: '2026-09-03T02:37:31Z',
          declined_at: null,
          created_at: '2026-09-02T18:00:00Z',
        },
      },
    ]
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.context.activeExperimentProposals).toHaveLength(1)
    expect(result.context.activeExperimentProposals[0].code).toBe('PROP-005')
    expect(result.context.activeExperimentProposals[0].accepted_at).toBe('2026-09-03T02:37:31Z')
    expect(result.allowed.proposals.has(IDS.proposal005)).toBe(true)
  })

  it('scopes the proposal lookup to the active experiment', async () => {
    const { client, queries } = makeSupabase(baseTables())
    await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    const q = queries.find((x) => x.table === 'proposal_experiments')
    expect(q!.filters).toEqual([['eq', 'experiment_id', IDS.experiment003]])
  })

  it('returns no proposals rather than failing when none are connected', async () => {
    const { client } = makeSupabase(baseTables())
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.context.activeExperimentProposals).toEqual([])
    expect(result.allowed.proposals.size).toBe(0)
  })
})

describe('retrieveProjectEvidence — cross-project isolation', () => {
  it('excludes another project\'s experiments from context and allow-list', async () => {
    const tables = baseTables()
    tables.experiments = [
      experimentRow(),
      experimentRow({ id: IDS.experiment001, project_id: IDS.otherProject, code: 'RND-001', title: 'Novation calculator' }),
    ]
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.context.experiments.map((e) => e.code)).toEqual(['EXP-003'])
    expect(result.allowed.experiments.has(IDS.experiment001)).toBe(false)
  })

  it('scopes recordings, transcripts, markers and observations by query, not by later filtering', async () => {
    const { client, queries } = makeSupabase(baseTables())
    await retrieveProjectEvidence(client, IDS.project)

    const recordings = queries.find((q) => q.table === 'engagement_recordings')
    expect(recordings!.filters).toEqual([['eq', 'project_id', IDS.project]])

    // These three used to be fetched with NO scoping at all (every row the
    // caller's RLS allowed, across all clients) and narrowed in memory.
    for (const table of ['engagement_transcripts', 'engagement_session_notes', 'transcript_observations']) {
      const q = queries.find((x) => x.table === table)
      expect(q, `${table} should be queried`).toBeDefined()
      expect(q!.filters.length, `${table} must be scoped in the query`).toBeGreaterThan(0)
      expect(q!.filters[0][0]).toBe('in')
    }
  })

  it('keeps another project\'s evidence out of the built prompt', async () => {
    const tables = baseTables()
    // Recordings/transcripts/markers that belong to the other project.
    tables.engagement_recordings = [
      { id: IDS.recording, project_id: IDS.project, title: 'Alpine convo' },
      { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', project_id: IDS.otherProject, title: 'RND convo' },
    ]
    tables.engagement_transcripts = [
      { id: IDS.transcript, recording_id: IDS.recording, status: 'complete', completed_at: null, utterances: [{ id: IDS.utterance1, transcript: 'Alpine utterance', provider_speaker_key: 'speaker-0' }] },
      { id: IDS.otherTranscript, recording_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', status: 'complete', completed_at: null, utterances: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', transcript: 'LEAKED RND utterance', provider_speaker_key: 'speaker-0' }] },
    ]
    tables.engagement_session_notes = [
      { id: IDS.marker, recording_id: IDS.recording, note_type: 'friction', note_text: 'Alpine friction', timestamp_seconds: 5, created_at: null },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', recording_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', note_type: 'friction', note_text: 'LEAKED RND friction', timestamp_seconds: 5, created_at: null },
    ]

    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project)
    const prompt = buildUserPrompt({ ...result.context, question: 'q' })

    expect(prompt).toContain('Alpine utterance')
    expect(prompt).not.toContain('LEAKED RND utterance')
    expect(prompt).not.toContain('LEAKED RND friction')
    expect(prompt).not.toContain(IDS.otherTranscript)
    expect(result.allowed.transcripts.has(IDS.otherTranscript)).toBe(false)
  })
})

describe('retrieveProjectEvidence — experiment fields survive retrieval', () => {
  it('carries every reasoning field through to the prompt', async () => {
    const { client } = makeSupabase(baseTables())
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    const prompt = buildUserPrompt({ ...result.context, question: 'What should I do next?' })

    expect(prompt).toContain('Status: approved')
    expect(prompt).toContain('Christie serves as the primary intake point')
    expect(prompt).toContain('Ask Christie to identify all Alpine work she currently knows about.')
    expect(prompt).toContain('Selecting or proving a specific tool')
    expect(prompt).toContain(`Experiment ${IDS.experiment003}`)
  })

  it('counts the active experiment and its proposals as retrieved evidence', async () => {
    const tables = baseTables()
    tables.proposal_experiments = [
      { experiment_id: IDS.experiment003, proposals: { id: IDS.proposal005, code: 'PROP-005', title: 't', status: 'accepted', kind: 'experiment', sent_at: null, accepted_at: null, declined_at: null, created_at: null } },
    ]
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.evidenceItemsRetrieved).toBe(2)
  })
})

// --------------------------------------------------------------------------
// Work artifacts (inventory, decisions, corrections, measures)
// --------------------------------------------------------------------------

function workItemRow(overrides: Row = {}): Row {
  return {
    id: IDS.workItem1,
    project_id: IDS.project,
    experiment_id: IDS.experiment003,
    item_number: 1,
    code: 'WORK-001',
    title: 'Renew the Contoso maintenance agreement',
    description: 'Annual renewal.',
    state: 'active',
    owner_person_id: IDS.personChristie,
    requested_by_person_id: null,
    intake_channel: 'email',
    next_action: 'Send the SOW',
    blocked_reason: null,
    is_informal: false,
    first_seen_at: null,
    discovered_at: '2026-09-04T10:00:00Z',
    discovery_method: 'christie_interview',
    in_initial_inventory: true,
    validation_state: 'confirmed',
    validated_at: '2026-09-05T09:00:00Z',
    validated_by_person_id: IDS.personChristie,
    client_visible: true,
    created_by: null,
    created_at: '2026-09-04T10:00:00Z',
    updated_at: '2026-09-04T10:00:00Z',
    ...overrides,
  }
}

function decisionRow(overrides: Row = {}): Row {
  return {
    id: IDS.decision1,
    project_id: IDS.project,
    experiment_id: IDS.experiment003,
    decision_number: 1,
    code: 'DEC-001',
    statement: 'Defer the invoice export bug.',
    rationale: 'Blocked externally.',
    decision_type: 'deferral',
    status: 'active',
    supersedes_decision_id: null,
    alternatives_considered: null,
    informed_by_view: true,
    decided_by_person_id: IDS.personChristie,
    decided_at: '2026-09-09T10:00:00Z',
    client_visible: true,
    created_by: null,
    created_at: '2026-09-09T10:00:00Z',
    updated_at: '2026-09-09T10:00:00Z',
    ...overrides,
  }
}

function withPeople(tables: Record<string, Row[]>): Record<string, Row[]> {
  return {
    ...tables,
    project_persons: [
      { project_id: IDS.project, persons: { id: IDS.personChristie, display_name: 'Christie', company: 'Alpine', title: 'Analyst' } },
    ],
  }
}

describe('retrieveProjectEvidence — work artifacts', () => {
  it('retrieves work items, decisions and resolves person names', async () => {
    const tables = withPeople({
      ...baseTables(),
      work_items: [workItemRow()],
      decisions: [decisionRow()],
    })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })

    expect(result.context.workItems).toHaveLength(1)
    expect(result.context.workItems[0].ownerName).toBe('Christie')
    expect(result.context.workItems[0].validatedByName).toBe('Christie')
    expect(result.context.decisions).toHaveLength(1)
    expect(result.context.decisions[0].decidedByName).toBe('Christie')
  })

  it('scopes work items, decisions and events by project_id in the query', async () => {
    const { client, queries } = makeSupabase(withPeople(baseTables()))
    await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    for (const table of ['work_items', 'decisions', 'work_item_events']) {
      const q = queries.find((x) => x.table === table)
      expect(q, `${table} should be queried`).toBeDefined()
      expect(q!.filters).toEqual([['eq', 'project_id', IDS.project]])
    }
  })

  it('excludes another project\'s work items and decisions', async () => {
    const tables = withPeople({
      ...baseTables(),
      work_items: [workItemRow(), workItemRow({ id: IDS.workItem2, project_id: IDS.otherProject, code: 'RND-001', title: 'LEAKED work' })],
      decisions: [decisionRow(), decisionRow({ id: IDS.decision2, project_id: IDS.otherProject, code: 'RND-DEC', statement: 'LEAKED decision' })],
    })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    const prompt = buildUserPrompt({ ...result.context, question: 'q' })

    expect(result.context.workItems.map((i) => i.code)).toEqual(['WORK-001'])
    expect(result.context.decisions.map((d) => d.code)).toEqual(['DEC-001'])
    expect(prompt).not.toContain('LEAKED work')
    expect(prompt).not.toContain('LEAKED decision')
    expect(result.allowed.workItems.has(IDS.workItem2)).toBe(false)
    expect(result.allowed.decisions.has(IDS.decision2)).toBe(false)
  })

  it('adds work items and decisions to the citation allow-list', async () => {
    const tables = withPeople({ ...baseTables(), work_items: [workItemRow()], decisions: [decisionRow()] })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.allowed.workItems.has(IDS.workItem1)).toBe(true)
    expect(result.allowed.decisions.has(IDS.decision1)).toBe(true)
  })

  it('counts evidence links per item and marks unsourced items', async () => {
    const tables = withPeople({
      ...baseTables(),
      work_items: [workItemRow(), workItemRow({ id: IDS.workItem2, item_number: 2, code: 'WORK-002' })],
      evidence_links: [
        { id: 'l1', subject_work_item_id: IDS.workItem1, subject_decision_id: null, source_kind: 'observation', role: 'supporting' },
        { id: 'l2', subject_work_item_id: IDS.workItem1, subject_decision_id: null, source_kind: 'external', role: 'contradicting' },
      ],
    })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    const first = result.context.workItems.find((i) => i.id === IDS.workItem1)!
    const second = result.context.workItems.find((i) => i.id === IDS.workItem2)!
    expect(first.evidenceCount).toBe(2)
    expect(first.contradictingEvidenceCount).toBe(1)
    expect(second.evidenceCount).toBe(0)
  })

  it('surfaces only human review events as corrections, not mechanical changes', async () => {
    const baseEvent = {
      project_id: IDS.project,
      experiment_id: IDS.experiment003,
      work_item_id: IDS.workItem1,
      actor_person_id: IDS.personChristie,
      actor_profile_id: null,
      from_state: null,
      to_state: null,
      field_changed: null,
      previous_value: 'unvalidated',
      note: null,
      effort_minutes: null,
      occurred_at: '2026-09-05T09:00:00Z',
      created_by: null,
      created_at: '2026-09-05T09:00:00Z',
    }
    const tables = withPeople({
      ...baseTables(),
      work_items: [workItemRow()],
      work_item_events: [
        { ...baseEvent, id: 'e1', event_type: 'corrected' },
        { ...baseEvent, id: 'e2', event_type: 'state_changed' },
        { ...baseEvent, id: 'e3', event_type: 'owner_changed' },
        { ...baseEvent, id: 'e4', event_type: 'disputed' },
      ],
    })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.context.workCorrections.map((c) => c.eventType).sort()).toEqual(['corrected', 'disputed'])
    expect(result.context.workCorrections[0].actorName).toBe('Christie')
    expect(result.context.workCorrections[0].workItemCode).toBe('WORK-001')
  })

  it('computes measures scoped to the ACTIVE experiment only', async () => {
    const tables = withPeople({
      ...baseTables(),
      work_items: [
        workItemRow(),
        // Same project, different experiment: must not inflate this
        // experiment's inventory count.
        workItemRow({ id: IDS.workItem2, item_number: 2, code: 'WORK-002', experiment_id: IDS.experiment001 }),
      ],
      decisions: [decisionRow(), decisionRow({ id: IDS.decision2, code: 'DEC-002', experiment_id: IDS.experiment001 })],
    })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })

    expect(result.context.workItems).toHaveLength(2)
    expect(result.context.workMeasures!.coverage.total).toBe(1)
    expect(result.context.workMeasures!.decisions.total).toBe(1)
  })

  it('produces no measures when there is no active experiment', async () => {
    const tables = withPeople({ ...baseTables(), work_items: [workItemRow()], decisions: [decisionRow()] })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project)
    expect(result.context.workMeasures).toBeNull()
    expect(result.context.workCriteria).toEqual([])
    // The inventory is still retrieved and citable at project level.
    expect(result.context.workItems).toHaveLength(1)
  })

  it('counts work artifacts as retrieved evidence', async () => {
    const tables = withPeople({ ...baseTables(), work_items: [workItemRow()], decisions: [decisionRow()] })
    const { client } = makeSupabase(tables)
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    // 1 experiment + 1 work item + 1 decision
    expect(result.evidenceItemsRetrieved).toBe(3)
  })

  it('returns an empty inventory rather than failing when the tables are unreadable', async () => {
    const { client } = makeSupabase(baseTables())
    const result = await retrieveProjectEvidence(client, IDS.project, { experimentId: IDS.experiment003 })
    expect(result.context.workItems).toEqual([])
    expect(result.context.decisions).toEqual([])
    expect(result.context.workMeasures!.coverage.total).toBe(0)
    // And the criteria must report NO DATA, never "met".
    expect(result.context.workCriteria.some((c) => c.status === 'met')).toBe(false)
  })
})
