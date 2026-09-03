import { describe, expect, it } from 'vitest'
import { AskCgtAllowedIds } from './retrieve'
import { validateAnswer } from './validation'
import { IDS } from './fixtures'

// Full UUIDs on purpose. Short ids previously made abbreviation defects
// invisible to these tests.
const T1 = IDS.transcript
const T2 = IDS.otherTranscript
const U1 = IDS.utterance1
const U2 = IDS.utterance2
const U3 = '44444444-4444-4444-8444-444444444443'

const allowed: AskCgtAllowedIds = {
  transcripts: new Set([T1, T2]),
  utterancesByTranscript: new Map([
    [T1, new Set([U1, U2, U3])],
    [T2, new Set(['44444444-4444-4444-8444-44444444444a', '44444444-4444-4444-8444-44444444444b'])],
  ]),
  observations: new Set([IDS.observation]),
  markers: new Set([IDS.marker]),
  candidates: new Set([IDS.candidate]),
  experiments: new Set([IDS.experiment003]),
  proposals: new Set([IDS.proposal005]),
  workItems: new Set([IDS.workItem1]),
  decisions: new Set([IDS.decision1]),
  findings: new Set([IDS.finding1]),
}

type RawEvidence = { type: string; id: string; utteranceIds?: string[] }
type RawConclusion = {
  statement: string
  kind: string
  confidence: number
  reasoning: string | null
  evidence: RawEvidence[]
}
type RawAnswer = {
  answer: string
  conclusions: RawConclusion[]
  unknowns: string[]
}

function validAnswer(): RawAnswer {
  return {
    answer: 'Rich described how CRF analysis depends on tribal knowledge.',
    conclusions: [
      {
        statement: 'Rich said affected code is located by memory.',
        kind: 'evidence',
        confidence: 0.9,
        reasoning: 'Directly stated in transcript 1.',
        evidence: [{ type: 'transcript', id: T1, utteranceIds: [U1, U3] }],
      },
      {
        statement: 'The CRF workflow may break if Rich leaves.',
        kind: 'inference',
        confidence: 0.6,
        reasoning: 'Inferred from the knowledge-transfer risk candidate.',
        evidence: [{ type: 'candidate', id: IDS.candidate }],
      },
    ],
    unknowns: ['Who else can perform CRF analysis when Rich is unavailable?'],
  }
}

describe('validateAnswer', () => {
  it('accepts a valid answer', () => {
    const result = validateAnswer(validAnswer(), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.answer).toContain('Rich described')
      expect(result.answer.conclusions).toHaveLength(2)
      expect(result.answer.unknowns).toHaveLength(1)
    }
  })

  it('requires an answer payload object', () => {
    expect(validateAnswer(null, allowed).ok).toBe(false)
    expect(validateAnswer('string', allowed).ok).toBe(false)
    expect(validateAnswer(42, allowed).ok).toBe(false)
  })

  it('requires answer text', () => {
    expect(validateAnswer({ answer: '   ' }, allowed).ok).toBe(false)
    expect(validateAnswer({}, allowed).ok).toBe(false)
  })

  it('drops evidence references outside the allowed project', () => {
    const answer = validAnswer()
    answer.conclusions[0].evidence.push({ type: 'transcript', id: 't-rushndush', utteranceIds: ['sneaky'] })
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions[0].evidence).toHaveLength(1)
  })

  it('drops utterance ids that do not exist in the allowed transcript', () => {
    const answer = validAnswer()
    answer.conclusions[0].evidence[0].utteranceIds = [U1, 'u-not-real']
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions[0].evidence[0].utteranceIds).toEqual([U1])
  })

  it('drops evidence entries with unknown types or ids', () => {
    const answer = validAnswer()
    answer.conclusions[0].evidence.push({ type: 'observation', id: 'obs-not-allowed' })
    answer.conclusions[0].evidence.push({ type: 'article', id: 'anything' })
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions[0].evidence).toHaveLength(1)
  })

  it('allows valid observation/marker/candidate references', () => {
    const answer = validAnswer()
    answer.conclusions[1].evidence.push({ type: 'observation', id: IDS.observation })
    answer.conclusions[1].evidence.push({ type: 'marker', id: IDS.marker })
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions[1].evidence).toHaveLength(3)
  })

  it('rejects conclusions with unknown kinds', () => {
    const answer = validAnswer()
    answer.conclusions.push({ statement: 'x', kind: 'opinion', confidence: 0.5, reasoning: null, evidence: [] })
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions).toHaveLength(2)
  })

  it('rejects conclusions with empty statements', () => {
    const answer = validAnswer()
    answer.conclusions.push({ statement: '', kind: 'evidence', confidence: 0.5, reasoning: null, evidence: [] })
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions).toHaveLength(2)
  })

  it('caps the number of conclusions', () => {
    const answer = validAnswer()
    for (let i = 0; i < 15; i++) {
      answer.conclusions.push({
        statement: `conclusion ${i}`,
        kind: 'inference',
        confidence: 0.5,
        reasoning: null,
        evidence: [],
      })
    }
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions).toHaveLength(12)
  })

  it('caps unknowns and drops empty strings', () => {
    const answer = validAnswer()
    answer.unknowns = ['a', '', 'b', ...Array.from({ length: 25 }, (_, i) => `u${i}`)]
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.unknowns).toHaveLength(20)
  })

  it('clamps confidence into [0,1]', () => {
    const answer = validAnswer()
    answer.conclusions[0].confidence = 1.4
    answer.conclusions[1].confidence = -0.2
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.conclusions[0].confidence).toBe(1)
      expect(result.answer.conclusions[1].confidence).toBe(0)
    }
  })

  it('accepts an answer with no conclusions or unknowns', () => {
    const result = validateAnswer({ answer: 'The evidence does not establish that.', conclusions: [], unknowns: [] }, allowed)
    expect(result.ok).toBe(true)
  })
})
// The core defect this suite guards: before the citation-identity repair, the
// prompt rendered abbreviated ids while the allow-list held full UUIDs, so
// every observation/marker/candidate citation was dropped, and experiments and
// proposals were not citable types at all.
describe('validateAnswer — full-UUID citations survive for every citable type', () => {
  function answerCiting(evidence: RawEvidence[]): RawAnswer {
    return {
      answer: 'Grounded answer.',
      conclusions: [
        {
          statement: 'A conclusion citing one evidence item.',
          kind: 'evidence',
          confidence: 0.9,
          reasoning: 'Cited directly.',
          evidence,
        },
      ],
      unknowns: [],
    }
  }

  it.each([
    ['transcript utterance', { type: 'transcript', id: T1, utteranceIds: [U1] }],
    ['observation', { type: 'observation', id: IDS.observation }],
    ['marker', { type: 'marker', id: IDS.marker }],
    ['candidate', { type: 'candidate', id: IDS.candidate }],
    ['experiment', { type: 'experiment', id: IDS.experiment003 }],
    ['proposal', { type: 'proposal', id: IDS.proposal005 }],
    ['work item', { type: 'work_item', id: IDS.workItem1 }],
    ['decision', { type: 'decision', id: IDS.decision1 }],
  ])('accepts a %s citation using its full canonical id', (_label, ref) => {
    const result = validateAnswer(answerCiting([ref as RawEvidence]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.conclusions[0].evidence).toHaveLength(1)
      expect(result.answer.conclusions[0].evidence[0].id).toBe((ref as RawEvidence).id)
      expect(result.citations.rejected).toBe(0)
    }
  })

  it('accepts all six types together in one conclusion', () => {
    const result = validateAnswer(
      answerCiting([
        { type: 'transcript', id: T1, utteranceIds: [U1] },
        { type: 'observation', id: IDS.observation },
        { type: 'marker', id: IDS.marker },
        { type: 'candidate', id: IDS.candidate },
        { type: 'experiment', id: IDS.experiment003 },
        { type: 'proposal', id: IDS.proposal005 },
        { type: 'work_item', id: IDS.workItem1 },
        { type: 'decision', id: IDS.decision1 },
      ]),
      allowed
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.conclusions[0].evidence).toHaveLength(8)
      expect(result.citations).toEqual({ submitted: 8, accepted: 8, rejected: 0 })
    }
  })

  it('rejects a work item id that was not retrieved', () => {
    const result = validateAnswer(answerCiting([{ type: 'work_item', id: IDS.workItem2 }]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.conclusions[0].evidence).toHaveLength(0)
      expect(result.citations.rejected).toBe(1)
    }
  })

  it('rejects a decision id that was not retrieved', () => {
    const result = validateAnswer(answerCiting([{ type: 'decision', id: IDS.decision2 }]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations.rejected).toBe(1)
  })

  // A work item id must not be accepted just because it is a valid uuid of
  // some other citable type.
  it('does not let a decision id satisfy a work_item citation', () => {
    const result = validateAnswer(answerCiting([{ type: 'work_item', id: IDS.decision1 }]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations.rejected).toBe(1)
  })

  // An abbreviated id is exactly what the old prompt produced.
  it.each([
    ['observation', 'observation', IDS.observation],
    ['candidate', 'candidate', IDS.candidate],
    ['experiment', 'experiment', IDS.experiment003],
  ])('rejects an abbreviated 8-character %s id', (_label, type, fullId) => {
    const result = validateAnswer(answerCiting([{ type, id: fullId.slice(0, 8) }]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.conclusions[0].evidence).toHaveLength(0)
      expect(result.citations.rejected).toBe(1)
    }
  })

  it('rejects a prefixed id such as the old O<uuid> rendering', () => {
    const result = validateAnswer(answerCiting([{ type: 'observation', id: `O${IDS.observation}` }]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations.rejected).toBe(1)
  })

  it('rejects a fabricated proposal id', () => {
    const result = validateAnswer(
      answerCiting([{ type: 'proposal', id: '00000000-0000-4000-8000-000000000000' }]),
      allowed
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.conclusions[0].evidence).toHaveLength(0)
      expect(result.citations.rejected).toBe(1)
    }
  })

  it('rejects an experiment id from another project even when well-formed', () => {
    const result = validateAnswer(answerCiting([{ type: 'experiment', id: IDS.experiment001 }]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations.rejected).toBe(1)
  })

  it('rejects an unknown evidence type', () => {
    const result = validateAnswer(answerCiting([{ type: 'decision', id: IDS.observation }]), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations.rejected).toBe(1)
  })
})

describe('validateAnswer — citation audit is visible to the caller', () => {
  it('reports zero rejections for a fully grounded answer', () => {
    const result = validateAnswer(validAnswer(), allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations).toEqual({ submitted: 2, accepted: 2, rejected: 0 })
  })

  it('counts partial loss within a single conclusion', () => {
    const answer = validAnswer()
    answer.conclusions[0].evidence.push({ type: 'observation', id: 'not-a-real-id' })
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations).toEqual({ submitted: 3, accepted: 2, rejected: 1 })
  })

  it('reports total loss so an ungrounded conclusion cannot look grounded', () => {
    const answer = validAnswer()
    answer.conclusions = [
      {
        statement: 'A confident claim supported by nothing that exists.',
        kind: 'evidence',
        confidence: 0.95,
        reasoning: 'Cites two invented ids.',
        evidence: [
          { type: 'observation', id: '12121212-1212-4121-8121-121212121212' },
          { type: 'marker', id: '13131313-1313-4131-8131-131313131313' },
        ],
      },
    ]
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.answer.conclusions[0].evidence).toHaveLength(0)
      expect(result.citations).toEqual({ submitted: 2, accepted: 0, rejected: 2 })
    }
  })

  it('reports no submissions when the model cites nothing', () => {
    const result = validateAnswer({ answer: 'We do not know.', conclusions: [], unknowns: ['everything'] }, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.citations).toEqual({ submitted: 0, accepted: 0, rejected: 0 })
  })
})
