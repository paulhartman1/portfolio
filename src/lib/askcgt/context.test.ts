import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, capUtterances } from './context'
import { AskCgtContext } from './retrieve'

function baseContext(): AskCgtContext {
  return {
    project: { id: 'project-alpine', name: 'Alpine Technology Group', description: 'Software consultancy.', status: 'active' },
    people: [
      { id: 'person-christie', displayName: 'Christie', company: 'Alpine', title: 'Analyst' },
      { id: 'person-rich', displayName: 'Rich', company: 'Alpine', title: 'Developer' },
    ],
    speakerMaps: [
      { transcriptId: 't-alpine-1', providerSpeakerKey: 'speaker-0', personName: 'Rich' },
      { transcriptId: 't-alpine-1', providerSpeakerKey: 'speaker-1', personName: 'Paul' },
    ],
    transcripts: [
      {
        id: 't-alpine-1',
        recordingId: 'rec-1',
        title: 'Rich convo',
        status: 'complete',
        completedAt: '2026-08-19T00:00:00Z',
        utterances: [
          { id: 'u1', start: 0, end: 5, speakerKey: 'speaker-0', text: 'We locate the affected code by memory.' },
          { id: 'u2', start: 5, end: 10, speakerKey: 'speaker-1', text: 'No written process?' },
        ],
      },
    ],
    observations: [
      {
        id: 'obs-1',
        transcriptId: 't-alpine-1',
        recordingTitle: 'Rich convo',
        statement: 'CRF analysis depends heavily on tribal knowledge.',
        confidence: 'high',
        notes: null,
        created_at: '2026-08-19T00:00:00Z',
      },
    ],
    markers: [
      {
        id: 'marker-1',
        recordingId: 'rec-1',
        recordingTitle: 'Rich convo',
        noteType: 'friction',
        noteText: null,
        timestampSeconds: 52,
      },
    ],
    candidates: [
      {
        id: 'cand-1',
        transcriptId: 't-alpine-1',
        recordingTitle: 'Rich convo',
        type: 'knowledge_transfer_risk',
        content: 'Rich is the sole owner of CRF analysis.',
        reasoningSummary: 'He described locating code from memory.',
        confidence: 0.93,
        status: 'accepted',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        evidence: [{ transcript_id: 't-alpine-1', utterance_ids: ['u1'], role: 'supporting' }],
      },
    ],
    experiments: [
      {
        id: 'exp-1',
        code: 'EXP-001',
        slug: 'exp-001',
        title: 'User onboarding experiment',
        status: 'proposed',
        primary_question: 'How can we improve user onboarding?',
        problem: null,
        hypothesis: 'A guided tour will reduce time to value.',
        rationale: null,
        method: 'A/B test with and without guided tour',
        success_criteria: 'Reduced time to first value action',
        failure_criteria: 'No improvement in time to value',
        stop_conditions: null,
        scope: null,
        decision_rule: 'If success criteria met, proceed with full rollout',
        conclusion: null,
        recommendation: null,
        resulting_decision: null,
        confidence: null,
        design: {},
      },
    ],
  }
}

describe('buildSystemPrompt', () => {
  it('tells the model evidence is authoritative and the model is disposable', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/evidence is authoritative/)
    expect(prompt).toMatch(/model is disposable/)
  })

  it('requires distinguishing evidence from inference from unknown', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('DIRECT EVIDENCE')
    expect(prompt).toContain('INFERENCE')
    expect(prompt).toContain('UNKNOWN')
  })

  it('reminds the model that a statement is evidence it was said, not that it is true', () => {
    expect(buildSystemPrompt()).toMatch(/evidence that they said it/)
  })

  it('requires JSON-only output with the AskCGT shape', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('"answer"')
    expect(prompt).toContain('"conclusions"')
    expect(prompt).toContain('"unknowns"')
    expect(prompt).toContain('respond ONLY with JSON')
  })

  it('asks the model to be adversarial toward overreach', () => {
    expect(buildSystemPrompt()).toMatch(/does not establish this/)
  })
})

describe('buildUserPrompt', () => {
  it('includes the project name and question', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'What did we learn today?' })
    expect(prompt).toContain('Alpine Technology Group')
    expect(prompt).toContain('What did we learn today?')
  })

  it('labels speakers by person name when mapped', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).toContain('Rich: We locate the affected code by memory.')
  })

  it('renders transcript utterance ids verbatim', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).toContain('[u1]')
    expect(prompt).toContain('[u2]')
  })

  it('renders observations, markers, and candidates with stable ids', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).toContain('CRF analysis depends heavily on tribal knowledge.')
    expect(prompt).toContain('knowledge_transfer_risk')
    expect(prompt).toContain('Ccand-1')
    expect(prompt).toContain('Oobs-1')
  })

  it('only contains the transcripts in the provided context', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).not.toContain('t-from-another-project')
  })

  it('does not render a transcript not provided to the context', () => {
    const context = baseContext()
    context.transcripts = context.transcripts.filter((t) => t.id === 't-other')
    const prompt = buildUserPrompt({ ...context, question: 'q' })
    expect(prompt).not.toContain('Rich: We locate the affected code by memory.')
  })
})

describe('capUtterances', () => {
  it('returns items unchanged when under the cap', () => {
    expect(capUtterances([1, 2, 3], 5)).toEqual([1, 2, 3])
  })

  it('keeps head and tail when over the cap', () => {
    const capped = capUtterances([1, 2, 3, 4, 5, 6], 4)
    expect(capped).toEqual([1, 2, 5, 6])
  })
})