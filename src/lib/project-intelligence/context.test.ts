import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, ProjectContextInput } from './context'

function baseInput(): ProjectContextInput {
  return {
    project: { id: 'project-alpine', name: 'Alpine', description: 'Inquiry into knowledge transfer.', status: 'active' },
    people: [
      { id: 'person-christie', displayName: 'Christie', company: 'Alpine', title: 'Analyst' },
      { id: 'person-rich', displayName: 'Rich', company: 'Alpine', title: 'Developer' },
    ],
    speakerMaps: [
      { transcriptId: 't-current', providerSpeakerKey: 'speaker-0', personName: 'Rich' },
    ],
    transcripts: [
      {
        id: 't-prior',
        title: 'First interview',
        isCurrent: false,
        utterances: [{ id: 'u-p1', speakerKey: 'speaker-0', text: 'Christie normally does the technical analysis.' }],
      },
      {
        id: 't-current',
        title: 'Second interview',
        isCurrent: true,
        utterances: [{ id: 'u-c1', speakerKey: 'speaker-0', text: 'I usually find the affected code by memory.' }],
      },
    ],
    observations: [
      { id: 'obs-1', transcriptId: 't-prior', statement: 'CRF analysis depends heavily on Christie.', confidence: 'high', notes: null },
    ],
    markers: [],
    inquiryFocus: 'How will work operate as the company changes?',
  }
}

describe('buildSystemPrompt', () => {
  it('mentions every supported candidate type', () => {
    const prompt = buildSystemPrompt()
    for (const type of ['follow_up_question', 'observation', 'contradiction', 'knowledge_gap', 'knowledge_transfer_risk']) {
      expect(prompt).toContain(type)
    }
  })

  it('tells the model it may return nothing useful', () => {
    expect(buildSystemPrompt()).toMatch(/candidates": \[\s*\]|returning zero candidates|Returning zero candidates/)
  })
})

describe('buildUserPrompt', () => {
  it('marks the current interview and labels speakers by person name', () => {
    const prompt = buildUserPrompt(baseInput())
    expect(prompt).toContain('CURRENT INTERVIEW (analyze this)')
    expect(prompt).toContain('Rich: I usually find the affected code by memory.')
  })

  it('lists accepted observations as evidence, not prose', () => {
    const prompt = buildUserPrompt(baseInput())
    expect(prompt).toContain('Oobs-1')
    expect(prompt).toContain('CRF analysis depends heavily on Christie.')
  })

  it('renders evidence utterance ids verbatim', () => {
    const prompt = buildUserPrompt(baseInput())
    expect(prompt).toContain('[u-c1]')
    expect(prompt).toContain('[u-p1]')
  })

  it('only contains the transcripts in the provided input', () => {
    const prompt = buildUserPrompt(baseInput())
    expect(prompt).toContain('t-prior')
    expect(prompt).toContain('t-current')
    expect(prompt).not.toContain('t-from-another-project')
  })

  it('does not render a transcript not provided to the context', () => {
    const input = baseInput()
    input.transcripts = input.transcripts.filter((t) => t.id === 't-current')
    input.observations = []
    const prompt = buildUserPrompt(input)
    expect(prompt).not.toContain('u-p1')
    expect(prompt).not.toContain('### Transcript t-prior')
  })

  it('includes the research focus', () => {
    expect(buildUserPrompt(baseInput())).toContain('How will work operate as the company changes?')
  })
})