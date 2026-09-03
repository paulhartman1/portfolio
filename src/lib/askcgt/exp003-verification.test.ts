import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserPrompt } from './context'
import { exp003Context, IDS } from './fixtures'

/**
 * Alpine EXP-003 verification.
 *
 * Required check for the two questions Paul will actually ask while running
 * this experiment. Invoking the production model would cost tokens and is
 * non-deterministic, so the automated assertion is on the PROMPT: it proves
 * AskCGT receives the specific evidence and instructions from which a grounded
 * answer can be reasoned. It deliberately does NOT assert an answer — nothing
 * about ClickUp or interview sequencing is hardcoded in application logic.
 *
 * These tests fail if a future change stops any of that evidence from reaching
 * the model, which is the regression that would quietly make AskCGT
 * ungrounded again.
 */

const QUESTION_A = 'Based on this experiment and its evidence, what should I do next?'
const QUESTION_B = 'I think we should solve this with ClickUp. What should I build?'

function promptFor(question: string) {
  return {
    system: buildSystemPrompt(),
    user: buildUserPrompt({ ...exp003Context(), question }),
  }
}

describe('EXP-003 Question A — "what should I do next?"', () => {
  const { system, user } = promptFor(QUESTION_A)

  it('asks the question that was asked', () => {
    expect(user).toContain(QUESTION_A)
  })

  // Each of the five things a grounded answer should recognize must be
  // derivable from the prompt.

  it('can determine the experiment is APPROVED', () => {
    expect(user).toContain('Status: approved')
    expect(user).toContain('approved 2026-09-03')
  })

  it('can determine approval came from an accepted proposal', () => {
    expect(user).toContain('PROP-005')
    expect(user).toContain('status accepted')
    expect(user).toContain('accepted 2026-09-03')
  })

  it('can determine the method BEGINS with identifying the work Christie knows about', () => {
    const methodIndex = user.indexOf('Ask Christie to identify all Alpine work')
    expect(methodIndex).toBeGreaterThan(-1)
    // The interview step must precede the inventory and pilot steps so
    // sequence is recoverable, not just presence.
    const inventoryIndex = user.indexOf('Combine the findings into one work inventory')
    const pilotIndex = user.indexOf('two-week pilot')
    expect(inventoryIndex).toBeGreaterThan(methodIndex)
    expect(pilotIndex).toBeGreaterThan(methodIndex)
  })

  it('can determine the inventory and pilot are LATER steps', () => {
    expect(user).toContain('Combine the findings into one work inventory')
    expect(user).toContain('two-week pilot')
    expect(user).toContain('Have Christie review and correct the inventory')
  })

  it('can determine AI-generated interpretations require Christie\'s validation', () => {
    expect(user).toContain('Christie must validate AI-generated interpretations.')
  })

  it('can determine whether the interview has already happened, from session evidence', () => {
    // Transcripts, markers and their dates are present, so "has this already
    // happened?" is answerable rather than assumed.
    expect(user).toContain('## Transcripts')
    expect(user).toContain(`### Transcript ${IDS.transcript}`)
    expect(user).toMatch(/Completed: \d{4}-\d{2}-\d{2}/)
    expect(user).toContain('## Live session markers')
  })

  it('has the success criteria needed to judge what "done" means', () => {
    expect(user).toContain('At least 90% of meaningful work')
    expect(user).toContain('15 minutes of deliberate administrative effort')
  })

  it('is told to distinguish evidence from inference from unknown', () => {
    expect(system).toContain('DIRECT EVIDENCE')
    expect(system).toContain('INFERENCE')
    expect(system).toContain('UNKNOWN')
  })

  it('is told it may answer that CGT does not know', () => {
    expect(system).toMatch(/Saying "we do not know" is a valid, important answer/)
  })

  it('can cite the experiment itself for a claim about next steps', () => {
    expect(user).toContain(`Cite this experiment as type "experiment" with id ${IDS.experiment003}`)
  })
})

describe('EXP-003 Question B — "solve this with ClickUp, what should I build?"', () => {
  const { system, user } = promptFor(QUESTION_B)

  it('asks the question that was asked', () => {
    expect(user).toContain(QUESTION_B)
  })

  it('can determine that selecting or proving a specific tool is OUT OF SCOPE', () => {
    expect(user).toContain('Design — OUT OF SCOPE')
    expect(user).toContain('Selecting or proving a specific tool')
  })

  it('labels the out-of-scope section as a boundary, not a neutral field', () => {
    expect(user).toContain('OUT OF SCOPE (boundaries this experiment is not testing)')
  })

  it('is instructed to treat recorded out-of-scope boundaries as evidence', () => {
    expect(system).toMatch(/out-of-scope boundaries, those boundaries are evidence/)
    expect(system).toMatch(/needs an explicit, reasoned justification — not silent acceptance/)
  })

  it('can determine what the experiment is actually testing', () => {
    expect(user).toContain('sufficiently complete, shared view')
    expect(user).toContain('deliberate decisions about priorities and work in progress')
    expect(user).toContain('Hypothesis:')
  })

  it('can determine the inventory does not yet exist, so an implementation is premature', () => {
    // The method's first step is still the interview, and there is no
    // conclusion or resulting decision recorded.
    expect(user).toContain('Ask Christie to identify all Alpine work')
    expect(user).toContain('Conclusion: (not recorded in CGT)')
    expect(user).toContain('Resulting decision: (not recorded in CGT)')
  })

  it('is instructed to challenge selecting a familiar tool before understanding the problem', () => {
    expect(system).toMatch(/Selecting a familiar or already-available tool before the problem is understood/)
  })

  it('is instructed to challenge converting a learning experiment into an implementation project', () => {
    expect(system).toMatch(/quietly converting a learning experiment into an implementation project/)
  })

  it('is instructed to challenge jumping from symptom to implementation', () => {
    expect(system).toMatch(/Jumping from a symptom straight to implementation/)
  })

  it('is instructed not to simply agree with Paul', () => {
    expect(system).toMatch(/Agreeing with a flawed plan is a failure/)
    expect(system).toMatch(/consulting partner, not his assistant/)
  })

  it('is told to answer the question while still challenging it', () => {
    expect(system).toMatch(/does not mean refusing to answer/)
    expect(user).toMatch(/challenge the question if it conflicts with them/)
  })

  it('can reason about ClickUp as a LATER candidate, because success criteria name it as an evidence source', () => {
    expect(user).toContain('ClickUp')
    expect(user).toContain('At least 90% of meaningful work identified through Outlook, ClickUp')
  })

  it('does not contain any hardcoded instruction about ClickUp specifically', () => {
    // ClickUp appears only as client evidence, never as application logic.
    expect(system).not.toContain('ClickUp')
  })

  it('can determine who is over-relied upon, via the problem statement', () => {
    expect(user).toContain('Christie serves as the primary intake point')
    expect(system).toMatch(/Relying excessively on one participant/)
  })
})

describe('EXP-003 — principle lenses are available for both questions', () => {
  const { system } = promptFor(QUESTION_A)

  it('provides the principles most relevant to this experiment', () => {
    for (const principle of ['Know the problem', 'Make work visible', 'Work together', 'Take simple steps', 'Validate']) {
      expect(system).toContain(principle)
    }
  })

  it('does not require reciting every principle', () => {
    expect(system).toMatch(/Do not recite all nine/)
  })

  it('allows a justified deviation rather than forcing a violation verdict', () => {
    expect(system).toMatch(/apparent deviation may be justified/)
    expect(system).toMatch(/Principles conflict/)
  })

  it('permits scrutiny of CGT and Paul, not only Alpine', () => {
    expect(system).toMatch(/same scrutiny to CGT and to Paul/)
  })
})

describe('EXP-003 — unreviewed candidates cannot masquerade as fact', () => {
  const { system, user } = promptFor(QUESTION_A)

  it('marks the unreviewed candidate as unconfirmed in the evidence', () => {
    expect(user).toContain('UNREVIEWED — no human has confirmed this')
  })

  it('forbids an unreviewed candidate being the sole support for a conclusion', () => {
    expect(system).toMatch(/never let it be the sole support for a material conclusion/)
  })

  it('still distinguishes the human-accepted observation as stronger', () => {
    expect(user).toContain('Human-accepted observations')
    expect(user).toContain(`Observation ${IDS.observation}`)
  })
})
