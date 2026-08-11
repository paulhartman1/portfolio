import { describe, expect, it } from 'vitest'
import { AllowedIds, parseModelResponse, validateCandidate } from './validation'

const allowed: AllowedIds = {
  transcripts: new Set(['t-current', 't-prior']),
  utterancesByTranscript: new Map([
    ['t-current', new Set(['u1', 'u2', 'u3'])],
    ['t-prior', new Set(['u-a', 'u-b'])],
  ]),
}

function validCandidate() {
  return {
    type: 'observation',
    content: 'The code affected by a CRF appears to be located by tribal knowledge.',
    reasoningSummary: 'Rich describes locating affected code by live memory.',
    confidence: 0.83,
    evidence: [{ transcriptId: 't-current', utteranceIds: ['u1', 'u3'], role: 'supporting' }],
    relatedHypothesisIds: [],
  }
}

describe('validateCandidate', () => {
  it('accepts a valid candidate', () => {
    const candidate = validateCandidate(validCandidate(), allowed)
    expect(candidate).not.toBeNull()
    expect(candidate?.type).toBe('observation')
    expect(candidate?.confidence).toBe(0.83)
    expect(candidate?.evidence).toHaveLength(1)
  })

  it('rejects unknown types', () => {
    expect(validateCandidate({ ...validCandidate(), type: 'summary' }, allowed)).toBeNull()
  })

  it('rejects empty content', () => {
    expect(validateCandidate({ ...validCandidate(), content: '   ' }, allowed)).toBeNull()
  })

  it('drops evidence referencing a transcript outside the project', () => {
    const candidate = validateCandidate({
      ...validCandidate(),
      evidence: [
        { transcriptId: 't-other-project', utteranceIds: ['sneaky'], role: 'supporting' },
        { transcriptId: 't-current', utteranceIds: ['u2'], role: 'supporting' },
      ],
    }, allowed)
    expect(candidate).not.toBeNull()
    expect(candidate?.evidence).toHaveLength(1)
    expect(candidate?.evidence[0].transcriptId).toBe('t-current')
  })

  it('drops utterance ids that do not exist in the given transcript', () => {
    const candidate = validateCandidate({
      ...validCandidate(),
      evidence: [{ transcriptId: 't-current', utteranceIds: ['u1', 'u-not-real'], role: 'supporting' }],
    }, allowed)
    expect(candidate?.evidence[0].utteranceIds).toEqual(['u1'])
  })

  it('drops an evidence entry with no valid utterance ids', () => {
    const candidate = validateCandidate({
      ...validCandidate(),
      evidence: [{ transcriptId: 't-current', utteranceIds: ['u-not-real'], role: 'supporting' }],
    }, allowed)
    expect(candidate?.evidence).toEqual([])
  })

  it('clamps confidence into [0,1] and rounds', () => {
    const low = validateCandidate({ ...validCandidate(), confidence: -0.4 }, allowed)
    expect(low?.confidence).toBe(0)
    const high = validateCandidate({ ...validCandidate(), confidence: 1.7 }, allowed)
    expect(high?.confidence).toBe(1)
    const choppy = validateCandidate({ ...validCandidate(), confidence: 0.33333 }, allowed)
    expect(choppy?.confidence).toBe(0.33)
  })

  it('defaults confidence to 0.5 when missing or malformed', () => {
    expect(validateCandidate({ ...validCandidate(), confidence: undefined }, allowed)?.confidence).toBe(0.5)
    expect(validateCandidate({ ...validCandidate(), confidence: 'nope' }, allowed)?.confidence).toBe(0.5)
  })

  it('allows a candidate with no evidence at all', () => {
    const candidate = validateCandidate({ ...validCandidate(), evidence: [] }, allowed)
    expect(candidate?.evidence).toEqual([])
  })
})

describe('parseModelResponse', () => {
  it('parses an array payload', () => {
    const result = parseModelResponse([validCandidate()], allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.candidates).toHaveLength(1)
  })

  it('parses a { candidates: [...] } wrapper', () => {
    const result = parseModelResponse({ candidates: [validCandidate()] }, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.candidates).toHaveLength(1)
  })

  it('returns ok:false for a structure with no candidate array', () => {
    const result = parseModelResponse({ content: 'hello' }, allowed)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false for a scalar payload', () => {
    expect(parseModelResponse('not json at all', allowed).ok).toBe(false)
    expect(parseModelResponse(42, allowed).ok).toBe(false)
  })

  it('drops malformed candidates but keeps valid ones', () => {
    const result = parseModelResponse([
      validCandidate(),
      { type: 'not-a-type', content: 'junk' },
      { type: 'observation', content: '' },
    ], allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.candidates).toHaveLength(1)
  })

  it('caps the number of candidates', () => {
    const many = Array.from({ length: 12 }, () => validCandidate())
    const result = parseModelResponse(many, allowed)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.candidates).toHaveLength(8)
  })

  it('accepts an empty candidate array (nothing useful)', () => {
    expect(parseModelResponse({ candidates: [] }, allowed).ok).toBe(true)
    expect(parseModelResponse([], allowed).ok).toBe(true)
  })
})