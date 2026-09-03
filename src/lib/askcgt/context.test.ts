import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, capUtterances } from './context'
import { baseContext, exp003, exp003Context, IDS } from './fixtures'

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

  it('keeps "we do not know" a valid answer', () => {
    expect(buildSystemPrompt()).toMatch(/we do not know/)
  })

  // --- CGT principles as reasoning lenses ---

  it('includes all nine CGT principles', () => {
    const prompt = buildSystemPrompt()
    for (const principle of [
      'Question everything',
      'Know the problem',
      'Make work visible',
      'Work together',
      'Take simple steps',
      'Prefer composition',
      'Validate',
      'Release often',
      'Prefer automation',
    ]) {
      expect(prompt).toContain(principle)
    }
  })

  it('frames principles as lenses rather than a compliance checklist', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/NOT a compliance checklist/)
    expect(prompt).toMatch(/Do not recite all nine/)
    expect(prompt).toMatch(/Do not label everything a violation/)
  })

  it('tells the model principles can conflict and deviation may be justified', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/Principles conflict/)
    expect(prompt).toMatch(/apparent deviation may be justified/)
  })

  it('separates an observed condition from an inferred principle tension', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('OBSERVED CONDITION')
    expect(prompt).toContain('INFERRED PRINCIPLE TENSION')
  })

  it('applies the same scrutiny to CGT and to Paul as to the client', () => {
    expect(buildSystemPrompt()).toMatch(/same scrutiny to CGT and to Paul/)
  })

  // --- adversarial partnership ---

  it('instructs the model to challenge Paul rather than agree', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/consulting partner, not his assistant/)
    expect(prompt).toMatch(/Agreeing with a flawed plan is a failure/)
  })

  it('names the specific consulting failures worth challenging', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/symptom straight to implementation/)
    expect(prompt).toMatch(/familiar or already-available tool/)
    expect(prompt).toMatch(/recorded scope/)
    expect(prompt).toMatch(/missing evidence as confirmation/)
    expect(prompt).toMatch(/Relying excessively on one participant/)
    expect(prompt).toMatch(/can no longer disconfirm the hypothesis/)
  })

  it('treats recorded out-of-scope boundaries as evidence', () => {
    expect(buildSystemPrompt()).toMatch(/out-of-scope boundaries, those boundaries are evidence/)
  })

  it('still requires answering the question while challenging it', () => {
    expect(buildSystemPrompt()).toMatch(/does not mean refusing to answer/)
  })

  // --- evidence quality ---

  it('ranks evidence quality and warns about unreviewed candidates', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('UNREVIEWED MODEL-GENERATED CANDIDATE')
    expect(prompt).toMatch(/machine guess that no human has confirmed/)
    expect(prompt).toMatch(/never let it be the sole support/)
  })

  it('declares experiment definitions and accepted proposals authoritative about intent', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('RECORDED EXPERIMENT DEFINITION')
    expect(prompt).toContain('CLIENT-ACCEPTED PROPOSAL')
  })

  it('advertises exactly the citable evidence types that validation accepts', () => {
    const prompt = buildSystemPrompt()
    for (const type of ['transcript', 'observation', 'marker', 'candidate', 'experiment', 'proposal']) {
      expect(prompt).toContain(`"${type}"`)
    }
  })

  it('warns that ids must be complete and that mismatches are reported to Paul', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/COMPLETE identifier/)
    expect(prompt).toMatch(/Never abbreviate/)
    expect(prompt).toMatch(/will be REJECTED/)
  })

  it('does not force answers into a rigid template', () => {
    expect(buildSystemPrompt()).toMatch(/Do not force your answer into a rigid template/)
  })
})

describe('buildUserPrompt — project level (no active experiment)', () => {
  it('includes the project name and question', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'What did we learn today?' })
    expect(prompt).toContain('Alpine Technology Group')
    expect(prompt).toContain('What did we learn today?')
  })

  it('labels speakers by person name when mapped', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).toContain('Rich: We locate the affected code by memory.')
  })

  it('renders transcript utterance ids verbatim and in full', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).toContain(`[${IDS.utterance1}]`)
    expect(prompt).toContain(`[${IDS.utterance2}]`)
  })

  it('has no ACTIVE EXPERIMENT section when no experiment is supplied', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).not.toContain('ACTIVE EXPERIMENT')
    expect(prompt).toContain('## Experiments in this project')
  })

  it('only contains the transcripts in the provided context', () => {
    const prompt = buildUserPrompt({ ...baseContext(), question: 'q' })
    expect(prompt).not.toContain(IDS.otherTranscript)
  })

  it('does not render a transcript not provided to the context', () => {
    const context = baseContext()
    context.transcripts = []
    const prompt = buildUserPrompt({ ...context, question: 'q' })
    expect(prompt).not.toContain('Rich: We locate the affected code by memory.')
  })
})

// The defect this suite guards: the prompt used to render 'O' + id.slice(0,8)
// while validation compared full UUIDs, so these citations could never survive.
describe('buildUserPrompt — canonical citation identity', () => {
  const prompt = buildUserPrompt({ ...exp003Context(), question: 'q' })

  it('renders FULL observation ids, not abbreviated ones', () => {
    expect(prompt).toContain(`Observation ${IDS.observation}`)
    expect(prompt).not.toContain(`O${IDS.observation.slice(0, 8)}`)
  })

  it('renders FULL marker ids (markers previously had no id at all)', () => {
    expect(prompt).toContain(`Marker ${IDS.marker}`)
  })

  it('renders FULL candidate ids, not abbreviated ones', () => {
    expect(prompt).toContain(`Candidate ${IDS.candidate}`)
    expect(prompt).not.toContain(`C${IDS.candidate.slice(0, 8)}`)
  })

  it('renders FULL experiment ids for the active and other experiments', () => {
    expect(prompt).toContain(`Experiment ${IDS.experiment003}`)
    expect(prompt).toContain(`Experiment ${IDS.experiment001}`)
  })

  it('renders FULL proposal ids', () => {
    expect(prompt).toContain(`Proposal ${IDS.proposal005}`)
  })

  it('never renders a truncated 8-character form of any canonical id', () => {
    for (const id of [IDS.observation, IDS.marker, IDS.candidate, IDS.experiment003, IDS.proposal005]) {
      const truncatedOnly = new RegExp(`[OCE]${id.slice(0, 8)}(?![-0-9a-f])`)
      expect(prompt).not.toMatch(truncatedOnly)
    }
  })
})

describe('buildUserPrompt — evidence quality signals', () => {
  const prompt = buildUserPrompt({ ...exp003Context(), question: 'q' })

  it('labels observations as human-accepted', () => {
    expect(prompt).toMatch(/Human-accepted observations \(reviewed by a person/)
  })

  it('labels markers as recorded by a person during a real conversation', () => {
    expect(prompt).toMatch(/Live session markers \(recorded by a person during a real conversation\)/)
  })

  it('labels unreviewed candidates as machine guesses, not fact', () => {
    expect(prompt).toContain('MACHINE GUESSES, NOT ESTABLISHED FACT')
    expect(prompt).toContain('UNREVIEWED — no human has confirmed this')
  })

  it('attributes a candidate to the model that generated it', () => {
    expect(prompt).toContain('generated by anthropic/claude-sonnet-4-6')
  })

  it('includes dates for observations, markers and candidates', () => {
    expect(prompt).toContain('[recorded 2026-08-19]')
    expect(prompt).toContain('[generated 2026-08-20]')
  })

  it('states a marker with no text records only that something was noticed', () => {
    expect(prompt).toMatch(/records that something was noticed at this moment, not what it was/)
  })
})

describe('buildUserPrompt — Alpine EXP-003 active experiment', () => {
  const prompt = buildUserPrompt({ ...exp003Context(), question: 'What should I do next?' })
  const experiment = exp003()

  it('marks the experiment as the one Paul is viewing', () => {
    expect(prompt).toContain('## ACTIVE EXPERIMENT — this is the experiment Paul is currently viewing')
  })

  it('reaches the prompt with its code and title', () => {
    expect(prompt).toContain('EXP-003')
    expect(prompt).toContain('Make the work visible')
  })

  it('reaches the prompt with its STATUS', () => {
    expect(prompt).toContain('Status: approved')
  })

  it('reaches the prompt with its lifecycle dates', () => {
    expect(prompt).toContain('approved 2026-09-03')
  })

  // Every field named in the requirements must be present.
  it.each([
    ['Primary question', 'sufficiently complete, shared view'],
    ['Problem', 'Christie serves as the primary intake point'],
    ['Hypothesis', 'consistently maintained view'],
    ['Method', 'Ask Christie to identify all Alpine work'],
    ['Success criteria', 'At least 90% of meaningful work'],
    ['Failure criteria', 'remains routinely absent from the inventory'],
  ])('reaches the prompt with %s', (label, snippet) => {
    expect(prompt).toContain(`${label}:`)
    expect(prompt).toContain(snippet)
  })

  it('renders every experiment field label, including the ones that are null', () => {
    for (const label of [
      'Primary question',
      'Problem',
      'Rationale',
      'Hypothesis',
      'Method',
      'Scope',
      'Success criteria',
      'Failure criteria',
      'Stop conditions',
      'Decision rule',
      'Conclusion',
      'Recommendation',
      'Resulting decision',
      'Confidence',
    ]) {
      expect(prompt).toContain(`${label}:`)
    }
  })

  it('marks absent fields honestly rather than omitting them', () => {
    // EXP-003 has no rationale, scope, decision_rule or conclusion.
    expect(prompt).toContain('Rationale: (not recorded in CGT)')
    expect(prompt).toContain('Scope: (not recorded in CGT)')
    expect(prompt).toContain('Decision rule: (not recorded in CGT)')
    expect(prompt).toContain('Conclusion: (not recorded in CGT)')
  })

  it('reaches the prompt with every design field', () => {
    for (const label of [
      'Design — assumptions',
      'Design — unknowns',
      'Design — risks',
      'Design — constraints',
      'Design — security / data-handling constraints',
      'Design — evidence requirements',
      'Design — measures',
      'Design — OUT OF SCOPE',
    ]) {
      expect(prompt).toContain(label)
    }
  })

  // The specific boundary that should stop a premature ClickUp build.
  it('reaches the prompt with the "Selecting or proving a specific tool" boundary', () => {
    expect(prompt).toContain('Selecting or proving a specific tool')
  })

  it('reaches the prompt with the constraint that Christie must validate AI interpretations', () => {
    expect(prompt).toContain('Christie must validate AI-generated interpretations.')
  })

  it('reaches the prompt with the risk that the inventory may look complete but is not', () => {
    expect(prompt).toContain('The inventory may appear complete while meaningful work is still missing.')
  })

  it('omits no field that retrieval provided', () => {
    // Guards against a rendering regression that drops a populated field.
    for (const value of [
      experiment.primary_question,
      experiment.problem,
      experiment.hypothesis,
    ]) {
      expect(prompt).toContain(String(value))
    }
  })

  it('tells the model to treat the active experiment as the subject', () => {
    expect(prompt).toMatch(/treat that experiment as the subject of the question/)
  })

  it('tells the model the recorded boundaries are evidence to challenge against', () => {
    expect(prompt).toMatch(/challenge the question if it conflicts with them/)
  })
})

describe('buildUserPrompt — proposal / approval provenance', () => {
  it('reaches the prompt with the accepted proposal and its dates', () => {
    const prompt = buildUserPrompt({ ...exp003Context(), question: 'q' })
    expect(prompt).toContain('### Approval / proposal provenance for this experiment')
    expect(prompt).toContain('PROP-005')
    expect(prompt).toContain('status accepted')
    expect(prompt).toContain('sent 2026-09-02')
    expect(prompt).toContain('accepted 2026-09-03')
  })

  it('states plainly when no proposal is connected', () => {
    const context = exp003Context()
    context.activeExperimentProposals = []
    const prompt = buildUserPrompt({ ...context, question: 'q' })
    expect(prompt).toContain('No proposal is connected to this experiment in CGT.')
  })

  it('summarizes other experiments separately from the active one', () => {
    const prompt = buildUserPrompt({ ...exp003Context(), question: 'q' })
    expect(prompt).toContain('## Other experiments in this project')
    expect(prompt).toContain('EXP-001')
  })
})

describe('capUtterances', () => {
  it('returns items unchanged when under the cap', () => {
    expect(capUtterances([1, 2, 3], 5)).toEqual([1, 2, 3])
  })

  it('keeps head and tail when over the cap', () => {
    expect(capUtterances([1, 2, 3, 4, 5, 6], 4)).toEqual([1, 2, 5, 6])
  })
})
