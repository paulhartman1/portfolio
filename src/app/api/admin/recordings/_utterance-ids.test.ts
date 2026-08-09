import { describe, expect, it } from 'vitest'
import { reconcileUtteranceIds } from './_utterance-ids'

describe('reconcileUtteranceIds', () => {
  it('mints IDs for a fresh transcript', () => {
    const result = reconcileUtteranceIds([{ start: 1, end: 2, speaker: 0, transcript: 'Hello' }], null)
    expect(result[0].id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('preserves exact utterance IDs during retranscription', () => {
    const previous = [{ id: '11111111-1111-1111-1111-111111111111', start: 1, end: 2, speaker: 0, transcript: 'Hello' }]
    const result = reconcileUtteranceIds([{ start: 1, end: 2, speaker: 0, transcript: 'Hello' }], previous)
    expect(result[0].id).toBe(previous[0].id)
  })

  it('uses each duplicate prior ID once', () => {
    const previous = [
      { id: '11111111-1111-1111-1111-111111111111', start: 1, end: 2, speaker: 0, transcript: 'Same' },
      { id: '22222222-2222-2222-2222-222222222222', start: 1, end: 2, speaker: 0, transcript: 'Same' },
    ]
    const result = reconcileUtteranceIds([
      { start: 1, end: 2, speaker: 0, transcript: 'Same' },
      { start: 1, end: 2, speaker: 0, transcript: 'Same' },
    ], previous)
    expect(result.map((utterance) => utterance.id)).toEqual([previous[0].id, previous[1].id])
  })

  it('mints a new ID when the utterance changes', () => {
    const previous = [{ id: '11111111-1111-1111-1111-111111111111', start: 1, end: 2, speaker: 0, transcript: 'Old' }]
    const result = reconcileUtteranceIds([{ start: 1, end: 2, speaker: 0, transcript: 'New' }], previous)
    expect(result[0].id).not.toBe(previous[0].id)
  })
})
