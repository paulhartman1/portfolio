import { beforeEach, describe, expect, it } from 'vitest'
import { AskCgtReviewError, acceptConclusion, parseCitations } from './review'
import { makeStubSupabase, Row, Stub } from './test-supabase'
import { IDS } from './fixtures'
import { retrieveProjectEvidence } from './retrieve'
import { buildUserPrompt } from './context'

/**
 * Human review of AskCGT conclusions.
 *
 * The property under test throughout: acceptance turns a proposed
 * interpretation into a REVIEWED FINDING linked to evidence — never into
 * evidence itself — and it only happens when a human deliberately does it,
 * against citations that are still valid at the moment of acceptance.
 */

const REVIEWER = 'aaaa1111-2222-4333-8444-555566667777'
const OTHER_EXPERIMENT = IDS.experiment001

function experimentRow(overrides: Row = {}): Row {
  return {
    id: IDS.experiment003,
    project_id: IDS.project,
    code: 'EXP-003',
    slug: 'make-the-work-visible',
    title: 'Make the work visible',
    status: 'approved',
    primary_question: 'Can Alpine maintain a shared view of its work?',
    problem: 'Christie is the primary intake point.',
    hypothesis: 'A shared view enables deliberate WIP decisions.',
    rationale: null,
    method: 'Ask Christie to identify all work.',
    success_criteria: '90% coverage; 15 minutes per day; one real decision.',
    failure_criteria: 'Work routinely absent.',
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
    projects: [
      { id: IDS.project, name: 'Alpine Technology Group', description: null, status: 'active' },
      { id: IDS.otherProject, name: 'Rush N Dush', description: null, status: 'active' },
    ],
    project_persons: [],
    persons: [],
    profiles: [{ id: REVIEWER, display_name: 'Paul Hartman', email: 'paul@example.com' }],
    engagement_recordings: [{ id: IDS.recording, project_id: IDS.project, title: 'Christie convo' }],
    engagement_transcripts: [
      {
        id: IDS.transcript,
        recording_id: IDS.recording,
        status: 'complete',
        completed_at: '2026-08-19T00:00:00Z',
        utterances: [
          { id: IDS.utterance1, transcript: 'Everything comes through me.', provider_speaker_key: 'speaker-0' },
        ],
      },
    ],
    engagement_session_notes: [
      { id: IDS.marker, recording_id: IDS.recording, note_type: 'friction', note_text: 'intake overload', timestamp_seconds: 12, created_at: null },
    ],
    transcript_observations: [],
    project_intelligence_candidates: [],
    engagement_transcript_speaker_clusters: [],
    experiments: [experimentRow(), experimentRow({ id: OTHER_EXPERIMENT, code: 'EXP-001', title: 'CRF', status: 'active' })],
    proposal_experiments: [],
    work_items: [],
    decisions: [],
    work_item_events: [],
    evidence_links: [],
    experiment_findings: [],
  }
}

function baseRequest(stub: Stub, overrides: Partial<Parameters<typeof acceptConclusion>[0]> = {}) {
  return {
    supabase: stub.client,
    reviewerId: REVIEWER,
    projectId: IDS.project,
    experimentId: IDS.experiment003,
    proposedStatement: 'EXP-003 lacks explicit decision criteria because its decision_rule field is null.',
    acceptedStatement: 'EXP-003 lacks explicit decision criteria because its decision_rule field is null.',
    proposedInterpretation: 'The decision_rule column is empty.',
    acceptedInterpretation: 'The decision_rule column is empty.',
    epistemicType: 'inference' as const,
    proposedConfidence: 0.7,
    citations: [{ type: 'experiment' as const, id: IDS.experiment003 }],
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    ...overrides,
  }
}

let stub: Stub
beforeEach(() => {
  stub = makeStubSupabase(baseTables())
})

describe('accepting an unchanged conclusion', () => {
  it('creates a reviewed finding attributed to the reviewer', async () => {
    const result = await acceptConclusion(baseRequest(stub))
    expect(result.reviewStatus).toBe('accepted')
    expect(result.wasEdited).toBe(false)

    const finding = stub.tables.experiment_findings[0]
    expect(finding.origin).toBe('askcgt')
    expect(finding.reviewed_by).toBe(REVIEWER)
    expect(finding.reviewed_at).toBeTruthy()
    expect(finding.project_id).toBe(IDS.project)
    expect(finding.experiment_id).toBe(IDS.experiment003)
  })

  it('preserves model provenance and numeric confidence', async () => {
    await acceptConclusion(baseRequest(stub))
    const finding = stub.tables.experiment_findings[0]
    expect(finding.model).toBe('claude-sonnet-4-6')
    expect(finding.provider).toBe('anthropic')
    expect(finding.proposed_confidence).toBe(0.7)
    expect(finding.epistemic_type).toBe('inference')
  })

  // Accepting that a claim reasonably interprets the evidence is NOT the same
  // as judging that it supports the hypothesis.
  it('does not assert that the finding supports the hypothesis', async () => {
    await acceptConclusion(baseRequest(stub))
    expect(stub.tables.experiment_findings[0].supports_hypothesis).toBeUndefined()
  })

  it('records the statement identically in both columns when unedited', async () => {
    await acceptConclusion(baseRequest(stub))
    const finding = stub.tables.experiment_findings[0]
    expect(finding.statement).toBe(finding.proposed_statement)
  })
})

describe('editing and accepting', () => {
  const edited = 'EXP-003 has measurable criteria but does not state how mixed results are adjudicated.'

  it('marks the review as accepted_edited', async () => {
    const result = await acceptConclusion(baseRequest(stub, { acceptedStatement: edited }))
    expect(result.reviewStatus).toBe('accepted_edited')
    expect(result.wasEdited).toBe(true)
  })

  // The core preservation requirement.
  it('preserves BOTH the model proposal and the accepted wording', async () => {
    await acceptConclusion(baseRequest(stub, { acceptedStatement: edited }))
    const finding = stub.tables.experiment_findings[0]
    expect(finding.proposed_statement).toBe(
      'EXP-003 lacks explicit decision criteria because its decision_rule field is null.'
    )
    expect(finding.statement).toBe(edited)
    expect(finding.statement).not.toBe(finding.proposed_statement)
  })

  it('preserves both the proposed and accepted rationale', async () => {
    await acceptConclusion(
      baseRequest(stub, { acceptedStatement: edited, acceptedInterpretation: 'Adjudication rule is absent.' })
    )
    const finding = stub.tables.experiment_findings[0]
    expect(finding.proposed_interpretation).toBe('The decision_rule column is empty.')
    expect(finding.interpretation).toBe('Adjudication rule is absent.')
  })

  it('treats a rationale-only change as an edit without changing review_status', async () => {
    const result = await acceptConclusion(baseRequest(stub, { acceptedInterpretation: 'Different rationale.' }))
    // The statement is unchanged, so the committed claim is unchanged.
    expect(result.reviewStatus).toBe('accepted')
    expect(result.wasEdited).toBe(true)
  })

  it('rejects an empty accepted statement', async () => {
    await expect(acceptConclusion(baseRequest(stub, { acceptedStatement: '   ' }))).rejects.toThrow(
      /cannot be empty/
    )
    expect(stub.tables.experiment_findings).toHaveLength(0)
  })
})

describe('citations are preserved as canonical typed references', () => {
  it('stores each citation with its full id and correct typed column', async () => {
    await acceptConclusion(
      baseRequest(stub, {
        citations: [
          { type: 'experiment', id: IDS.experiment003 },
          { type: 'transcript', id: IDS.transcript, utteranceIds: [IDS.utterance1] },
          { type: 'marker', id: IDS.marker },
        ],
      })
    )
    const links = stub.tables.evidence_links
    expect(links).toHaveLength(3)

    const byKind = Object.fromEntries(links.map((l) => [l.source_kind, l]))
    expect(byKind.experiment.source_experiment_id).toBe(IDS.experiment003)
    expect(byKind.transcript_utterance.source_transcript_id).toBe(IDS.transcript)
    expect(byKind.transcript_utterance.source_utterance_ids).toEqual([IDS.utterance1])
    expect(byKind.session_marker.source_marker_id).toBe(IDS.marker)
  })

  it('links every citation to the created finding', async () => {
    const result = await acceptConclusion(
      baseRequest(stub, {
        citations: [
          { type: 'experiment', id: IDS.experiment003 },
          { type: 'marker', id: IDS.marker },
        ],
      })
    )
    expect(result.citationsPersisted).toBe(2)
    for (const link of stub.tables.evidence_links) {
      expect(link.subject_finding_id).toBe(result.findingId)
    }
  })

  it('never truncates an identifier', async () => {
    await acceptConclusion(baseRequest(stub))
    const stored = String(stub.tables.evidence_links[0].source_experiment_id)
    expect(stored).toBe(IDS.experiment003)
    expect(stored).toHaveLength(36)
  })

  it('accepts a conclusion that cites nothing, without inventing citations', async () => {
    const result = await acceptConclusion(baseRequest(stub, { citations: [] }))
    expect(result.citationsPersisted).toBe(0)
    expect(stub.tables.evidence_links).toHaveLength(0)
    expect(stub.tables.experiment_findings).toHaveLength(1)
  })
})

describe('citation validation refuses to silently drop references', () => {
  it('rejects a fabricated citation and writes nothing', async () => {
    const promise = acceptConclusion(
      baseRequest(stub, { citations: [{ type: 'observation', id: '00000000-0000-4000-8000-000000000000' }] })
    )
    await expect(promise).rejects.toBeInstanceOf(AskCgtReviewError)
    await expect(promise).rejects.toThrow(/no longer valid/)
    expect(stub.tables.experiment_findings).toHaveLength(0)
    expect(stub.tables.evidence_links).toHaveLength(0)
  })

  it('rejects a citation belonging to another project', async () => {
    stub.tables.experiments.push(
      experimentRow({ id: 'cccc0000-0000-4000-8000-000000000001', project_id: IDS.otherProject, code: 'RND-001' })
    )
    await expect(
      acceptConclusion(
        baseRequest(stub, { citations: [{ type: 'experiment', id: 'cccc0000-0000-4000-8000-000000000001' }] })
      )
    ).rejects.toThrow(/no longer valid/)
    expect(stub.tables.experiment_findings).toHaveLength(0)
  })

  it('rejects an utterance that does not belong to the cited transcript', async () => {
    await expect(
      acceptConclusion(
        baseRequest(stub, {
          citations: [
            { type: 'transcript', id: IDS.transcript, utteranceIds: ['99999999-9999-4999-8999-999999999999'] },
          ],
        })
      )
    ).rejects.toThrow(/no longer valid/)
  })

  it('reports which citations failed rather than only how many', async () => {
    try {
      await acceptConclusion(
        baseRequest(stub, { citations: [{ type: 'marker', id: '11110000-0000-4000-8000-000000000000' }] })
      )
      throw new Error('expected rejection')
    } catch (error) {
      const reviewError = error as AskCgtReviewError
      expect(reviewError.code).toBe('invalid_citations')
      expect(reviewError.details?.rejected).toEqual([
        { type: 'marker', id: '11110000-0000-4000-8000-000000000000' },
      ])
    }
  })

  // Evidence that vanished between analysis and acceptance must stop the
  // write, not quietly produce a less-grounded finding.
  it('stops acceptance when a previously valid citation has become unavailable', async () => {
    stub.tables.engagement_session_notes = []
    await expect(
      acceptConclusion(baseRequest(stub, { citations: [{ type: 'marker', id: IDS.marker }] }))
    ).rejects.toThrow(/no longer valid/)
    expect(stub.tables.experiment_findings).toHaveLength(0)
  })
})

describe('authorization and ownership', () => {
  it('refuses an experiment belonging to another project', async () => {
    stub.tables.experiments = [experimentRow({ project_id: IDS.otherProject })]
    const promise = acceptConclusion(baseRequest(stub))
    await expect(promise).rejects.toThrow(/does not belong to this project/)
    expect(stub.tables.experiment_findings).toHaveLength(0)
  })

  it('refuses when the experiment is not readable at all', async () => {
    stub.tables.experiments = []
    await expect(acceptConclusion(baseRequest(stub))).rejects.toThrow(/Experiment not found/)
  })

  it('refuses when the project is not readable (RLS denial)', async () => {
    stub.tables.projects = []
    await expect(acceptConclusion(baseRequest(stub))).rejects.toThrow(/Project not found/)
  })

  it('requires a reviewer identity', async () => {
    await expect(acceptConclusion(baseRequest(stub, { reviewerId: '' }))).rejects.toThrow(/reviewer identity/)
    expect(stub.tables.experiment_findings).toHaveLength(0)
  })

  it('requires an experiment: a finding cannot be project-only', async () => {
    await expect(acceptConclusion(baseRequest(stub, { experimentId: '' }))).rejects.toThrow(/experimentId is required/)
  })

  it('rejects an unknown epistemic type', async () => {
    await expect(
      acceptConclusion(baseRequest(stub, { epistemicType: 'fact' as unknown as 'inference' }))
    ).rejects.toThrow(/Unknown epistemic type/)
  })
})

describe('idempotency and write integrity', () => {
  it('does not create a duplicate finding for the same proposal', async () => {
    await acceptConclusion(baseRequest(stub))
    await expect(acceptConclusion(baseRequest(stub))).rejects.toThrow(/already been accepted/)
    expect(stub.tables.experiment_findings).toHaveLength(1)
  })

  it('allows the same proposal to be accepted for a different experiment', async () => {
    await acceptConclusion(baseRequest(stub))
    await acceptConclusion(baseRequest(stub, { experimentId: OTHER_EXPERIMENT }))
    expect(stub.tables.experiment_findings).toHaveLength(2)
  })

  // A finding that survives while its citations do not would read as grounded
  // when it is not.
  it('rolls the finding back when its citations cannot be stored', async () => {
    stub.failWrites.add('evidence_links')
    await expect(acceptConclusion(baseRequest(stub))).rejects.toThrow(/evidence references could not be stored/)
    expect(stub.tables.experiment_findings).toHaveLength(0)
  })

  it('reports a failed finding write as a failure, never as success', async () => {
    stub.failWrites.add('experiment_findings')
    const promise = acceptConclusion(baseRequest(stub))
    await expect(promise).rejects.toBeInstanceOf(AskCgtReviewError)
    await expect(promise).rejects.toThrow(/Could not save the finding/)
  })
})

describe('parseCitations rejects malformed client input', () => {
  it('drops entries with unknown types or missing ids', () => {
    expect(
      parseCitations([
        { type: 'observation', id: IDS.observation },
        { type: 'nonsense', id: 'x' },
        { type: 'marker' },
        null,
        'string',
      ])
    ).toEqual([{ type: 'observation', id: IDS.observation }])
  })

  it('deduplicates identical references', () => {
    const parsed = parseCitations([
      { type: 'marker', id: IDS.marker },
      { type: 'marker', id: IDS.marker },
    ])
    expect(parsed).toHaveLength(1)
  })

  it('returns nothing for a non-array payload', () => {
    expect(parseCitations({ type: 'marker', id: IDS.marker })).toEqual([])
    expect(parseCitations(null)).toEqual([])
  })

  it('caps the number of citations', () => {
    const many = Array.from({ length: 50 }, (_, index) => ({
      type: 'marker',
      id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
    }))
    expect(parseCitations(many).length).toBeLessThanOrEqual(20)
  })
})

describe('accepted findings return in later experiment-scoped retrieval', () => {
  it('is retrieved and labeled as a reviewed finding, not as evidence', async () => {
    const accepted = await acceptConclusion(
      baseRequest(stub, {
        acceptedStatement:
          'EXP-003 contains substantial measurable success and failure criteria, but does not state how mixed results should be adjudicated.',
      })
    )

    const fresh = await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    expect(fresh.context.reviewedFindings).toHaveLength(1)

    const finding = fresh.context.reviewedFindings[0]
    expect(finding.id).toBe(accepted.findingId)
    expect(finding.wasEdited).toBe(true)
    expect(finding.reviewerName).toBe('Paul Hartman')

    const prompt = buildUserPrompt({ ...fresh.context, question: 'What do we know?' })
    expect(prompt).toContain('## Reviewed findings (a human accepted these interpretations)')
    expect(prompt).toContain('HUMAN-VOUCHED INTERPRETATION, not a source fact')
    // It must never be filed under an evidence heading.
    expect(prompt).not.toContain('Human-accepted observations')
  })

  it('shows both the accepted wording and the model original when edited', async () => {
    await acceptConclusion(baseRequest(stub, { acceptedStatement: 'A narrower claim.' }))
    const fresh = await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    const prompt = buildUserPrompt({ ...fresh.context, question: 'q' })

    expect(prompt).toContain('accepted claim: A narrower claim.')
    expect(prompt).toContain('the model originally proposed: EXP-003 lacks explicit decision criteria')
    expect(prompt).toContain('ACCEPTED WITH EDITS')
  })

  it('keeps the underlying citations reachable', async () => {
    await acceptConclusion(
      baseRequest(stub, {
        citations: [
          { type: 'experiment', id: IDS.experiment003 },
          { type: 'transcript', id: IDS.transcript, utteranceIds: [IDS.utterance1] },
        ],
      })
    )
    const fresh = await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    const finding = fresh.context.reviewedFindings[0]
    expect(finding.citations.map((c) => c.type).sort()).toEqual(['experiment', 'transcript'])

    const prompt = buildUserPrompt({ ...fresh.context, question: 'q' })
    expect(prompt).toContain(`grounded in: experiment ${IDS.experiment003}`)
    expect(prompt).toContain(IDS.utterance1)
  })

  it('makes the finding citable, so later reasoning can reference it', async () => {
    const accepted = await acceptConclusion(baseRequest(stub))
    const fresh = await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    expect(fresh.allowed.findings.has(accepted.findingId)).toBe(true)
  })

  it('tells the model a reviewed finding never overrides contradictory evidence', async () => {
    await acceptConclusion(baseRequest(stub))
    const fresh = await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    const prompt = buildUserPrompt({ ...fresh.context, question: 'q' })
    expect(prompt).toMatch(/does NOT override contradictory primary evidence/)
  })

  it('excludes manually written findings from the AskCGT review set', async () => {
    stub.tables.experiment_findings.push({
      id: 'dddd0000-0000-4000-8000-000000000001',
      project_id: IDS.project,
      experiment_id: IDS.experiment003,
      statement: 'A finding Paul typed himself.',
      origin: 'manual',
      review_status: 'accepted',
    })
    const fresh = await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    expect(fresh.context.reviewedFindings).toHaveLength(0)
  })
})

describe('unreviewed conclusions stay ephemeral', () => {
  it('writes nothing when no acceptance occurs', async () => {
    await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    expect(stub.tables.experiment_findings).toHaveLength(0)
    expect(stub.tables.evidence_links).toHaveLength(0)
  })

  it('performs no insert during retrieval', async () => {
    await retrieveProjectEvidence(stub.client, IDS.project, { experimentId: IDS.experiment003 })
    expect(stub.queries.filter((q) => q.op === 'insert')).toHaveLength(0)
  })
})
