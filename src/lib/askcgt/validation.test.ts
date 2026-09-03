import { describe, expect, it } from 'vitest'
import { AskCgtAllowedIds } from './retrieve'
import { validateAnswer } from './validation'

const allowed: AskCgtAllowedIds = {
  transcripts: new Set(['t-alpine-1', 't-alpine-2']),
  utterancesByTranscript: new Map([
    ['t-alpine-1', new Set(['u1', 'u2', 'u3'])],
    ['t-alpine-2', new Set(['u-a', 'u-b'])],
  ]),
  observations: new Set(['obs-1']),
  markers: new Set(['marker-1']),
  candidates: new Set(['cand-1']),
  experiments: new Set([]),
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
        evidence: [{ type: 'transcript', id: 't-alpine-1', utteranceIds: ['u1', 'u3'] }],
      },
      {
        statement: 'The CRF workflow may break if Rich leaves.',
        kind: 'inference',
        confidence: 0.6,
        reasoning: 'Inferred from the knowledge-transfer risk candidate.',
        evidence: [{ type: 'candidate', id: 'cand-1' }],
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
    answer.conclusions[0].evidence[0].utteranceIds = ['u1', 'u-not-real']
    const result = validateAnswer(answer, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.answer.conclusions[0].evidence[0].utteranceIds).toEqual(['u1'])
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
    answer.conclusions[1].evidence.push({ type: 'observation', id: 'obs-1' })
    answer.conclusions[1].evidence.push({ type: 'marker', id: 'marker-1' })
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