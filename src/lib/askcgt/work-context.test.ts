import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserPrompt } from './context'
import { exp003Context, exp003ContextWithWork, IDS } from './fixtures'

/**
 * How the stored EXP-003 artifacts reach AskCGT.
 *
 * The central property under test is honesty about absence: an empty
 * inventory must read as "CGT cannot see the work", never as "there is no
 * work", and an unmeasured threshold must never read as satisfied.
 */

const withWork = () => buildUserPrompt({ ...exp003ContextWithWork(), question: 'What should I do next?' })
const empty = () => buildUserPrompt({ ...exp003Context(), question: 'What should I do next?' })

describe('empty inventory is stated, not silently omitted', () => {
  const prompt = empty()

  it('says the inventory is empty', () => {
    expect(prompt).toContain('## Work inventory')
    expect(prompt).toContain('EMPTY. No work items have been recorded in CGT for this project.')
  })

  // The distinction that stops a fabricated answer.
  it('says an empty inventory does not support claims about what work exists', () => {
    expect(prompt).toMatch(/Any claim about what work exists[\s\S]*is therefore NOT supported by CGT evidence/)
  })

  it('says no decisions are recorded and CGT cannot explain prior choices', () => {
    expect(prompt).toContain('NONE. No decisions have been recorded')
    expect(prompt).toContain('CGT cannot tell you why any prior choice was made.')
  })

  it('renders no measures section when there is nothing to measure', () => {
    expect(prompt).not.toContain('Items in inventory:')
  })
})

describe('work items reach the prompt with provenance and gaps', () => {
  const prompt = withWork()

  it('renders each item with its full canonical id', () => {
    for (const id of [IDS.workItem1, IDS.workItem2, IDS.workItem3]) {
      expect(prompt).toContain(`Work item ${id}`)
    }
  })

  it('states the citation type and instruction for work items', () => {
    expect(prompt).toContain('Cite these as type "work_item" using the full id shown')
  })

  it('renders state, owner, intake channel and discovery method', () => {
    expect(prompt).toContain('state=active; owner=Christie; intake=email; found via christie_interview')
  })

  it('names the person who validated an item and when', () => {
    expect(prompt).toContain('validation=confirmed by Christie on 2026-09-05')
  })

  it('says plainly when nobody has reviewed an item', () => {
    expect(prompt).toContain('(nobody has reviewed this)')
  })

  it('flags an item with no recorded source as an unsourced assertion', () => {
    expect(prompt).toContain('NO RECORDED SOURCE')
  })

  it('flags contradicting sources on an item', () => {
    expect(prompt).toContain('1 CONTRADICTING SOURCE(S)')
  })

  it('flags work discovered after the baseline', () => {
    expect(prompt).toContain('DISCOVERED AFTER BASELINE')
  })

  it('flags informal work that lives in no system', () => {
    expect(prompt).toContain('INFORMAL — lives in no system')
  })

  it('says when an item has no next action, rather than omitting the field', () => {
    expect(prompt).toContain("next action: NONE RECORDED — this item's status is not in the shared view")
  })

  it('reports unowned work as NOBODY rather than blank', () => {
    expect(prompt).toContain('owner=NOBODY')
  })
})

describe('derived measures reach the prompt', () => {
  const prompt = withWork()

  it('states the inventory totals and WIP breakdown', () => {
    expect(prompt).toContain('## Derived measures for this experiment\'s work inventory')
    expect(prompt).toContain('Items in inventory: 3')
  })

  it('states that measures come from stored records and match the admin UI', () => {
    expect(prompt).toMatch(/computed from stored records, not estimated/)
  })

  it('reports late discovery against the 90% threshold', () => {
    expect(prompt).toContain('Discovered after the initial inventory: 1')
    expect(prompt).toContain('EXP-003 needs >= 90%')
  })

  it('reports stalled items with no stated dependency', () => {
    expect(prompt).toMatch(/Waiting\/blocked with NO stated dependency: 2/)
  })

  it('reports items with no recorded source', () => {
    expect(prompt).toContain('Items with NO recorded source: 1')
  })

  it('reports ownership concentration in Christie\'s direction', () => {
    expect(prompt).toMatch(/Ownership concentration: the single largest owner holds 2 of 3 open items/)
  })

  it('reports intake fragmentation', () => {
    expect(prompt).toMatch(/Intake channels observed: 3/)
  })

  it('reports maintenance effort that has been logged', () => {
    expect(prompt).toMatch(/Maintenance effort: 9 min over 1 day\(s\)/)
  })

  // Truncation must never be silent, and counts must come from measures.
  it('tells the model to trust the measures over counting rendered lines', () => {
    expect(buildSystemPrompt()).toMatch(/Use the derived numbers rather than counting rendered lines yourself/)
  })
})

describe('EXP-003 criteria reach the prompt with an explicit NO DATA state', () => {
  const prompt = withWork()

  it('renders the criteria block', () => {
    expect(prompt).toContain('### EXP-003 criteria against stored evidence')
  })

  it('warns that NO DATA must not be read as met', () => {
    expect(prompt).toContain('Never treat NO DATA as met.')
    expect(buildSystemPrompt()).toMatch(/Treating NO DATA as MET is a serious error/)
  })

  it('marks the coverage criterion NOT MET at 2 of 3 items', () => {
    expect(prompt).toMatch(/\[NOT MET\].*90% of meaningful work/)
  })

  it('marks the qualifying-decision criterion MET and cites the count', () => {
    expect(prompt).toMatch(/\[MET\].*prioritization, sequencing, deferral, or WIP decision/)
    expect(prompt).toContain('1 qualifying decision(s) informed by the view')
  })

  it('marks Christie\'s subjective rating NO DATA and states why', () => {
    expect(prompt).toMatch(/\[NO DATA\].*rates the view at least 4\/5/)
    expect(prompt).toContain('no durable representation of a participant rating')
  })

  it('states what must be recorded before an unevaluated criterion can be judged', () => {
    expect(prompt).toContain('blocked by:')
  })
})

describe('decisions reach the prompt with rationale, alternatives and status', () => {
  const prompt = withWork()

  it('renders each decision with its full canonical id', () => {
    expect(prompt).toContain(`Decision ${IDS.decision1}`)
    expect(prompt).toContain(`Decision ${IDS.decision2}`)
  })

  it('states the citation type for decisions', () => {
    expect(prompt).toContain('Cite these as type "decision" using the full id shown')
  })

  it('renders the statement and rationale', () => {
    expect(prompt).toContain('Defer the invoice export bug until the vendor responds.')
    expect(prompt).toContain('rationale: It is blocked externally')
  })

  it('renders rejected alternatives so a tradeoff is distinguishable from a default', () => {
    expect(prompt).toContain('rejected alternatives: Considered escalating to the vendor immediately')
  })

  it('flags a decision whose reasoning was never preserved', () => {
    expect(prompt).toContain('rationale: NONE RECORDED — the reasoning behind this decision was not preserved')
  })

  it('marks whether the shared view actually informed the decision', () => {
    expect(prompt).toContain('informed by the shared work view: YES')
    expect(prompt).toContain('informed by the shared work view: no')
  })

  // Continuity: a superseded decision must not read as current policy.
  it('renders decision status and warns superseded decisions are not current', () => {
    expect(prompt).toContain('[superseded] [tool_selection]')
    expect(prompt).toMatch(/must not be presented as current policy/)
  })
})

describe('human corrections are surfaced as the strongest evidence', () => {
  const prompt = withWork()

  it('renders the correction with its actor and the item it corrected', () => {
    expect(prompt).toContain('## Human review of the inventory')
    expect(prompt).toContain('CORRECTED on WORK-002')
    expect(prompt).toContain('by Christie')
  })

  it('carries the correction note explaining what CGT got wrong', () => {
    expect(prompt).toContain('Christie says this is blocked on the vendor, not on her.')
  })

  it('tells the model a correction is evidence CGT was wrong', () => {
    expect(prompt).toMatch(/A correction or dispute is evidence that CGT's recorded interpretation was wrong/)
    expect(buildSystemPrompt()).toMatch(/direct evidence that CGT was wrong. Weigh it above the record it corrects/)
  })
})

describe('system prompt evidence tiers cover the new artifact types', () => {
  const system = buildSystemPrompt()

  it('describes a work item\'s reliability as depending on validation and source', () => {
    expect(system).toContain('A WORK ITEM is CGT\'s record that some work exists.')
    expect(system).toMatch(/An unvalidated item with no source is an unverified assertion, not established fact/)
  })

  it('describes a recorded decision as authoritative only while active', () => {
    expect(system).toMatch(/A RECORDED DECISION is authoritative about what was settled and why/)
    expect(system).toMatch(/only while its status is "active"/)
  })

  it('advertises work_item and decision as citable types', () => {
    expect(system).toContain('"work_item"')
    expect(system).toContain('"decision"')
  })

  it('states where to copy work item and decision ids from', () => {
    expect(system).toMatch(/a "work_item" by its "Work item <id>" line/)
    expect(system).toMatch(/a "decision" by its "Decision <id>" line/)
  })

  it('warns that an empty record set is a finding about CGT, not about the world', () => {
    expect(system).toMatch(/does not mean there is no work; it means CGT cannot see it/)
  })

  // Guards the exact failure mode EXP-003 warns about in its own risks.
  it('warns that a more complete list is not the same as better prioritization', () => {
    expect(system).toMatch(/A more complete list is not the same as better prioritization/)
  })
})

describe('cross-experiment scoping in the rendered inventory', () => {
  it('marks items and decisions belonging to another experiment', () => {
    const context = exp003ContextWithWork()
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    context.workItems = context.workItems.map((item, index) =>
      index === 0 ? { ...item, experiment_id: other } : item
    )
    context.decisions = context.decisions.map((decision, index) =>
      index === 0 ? { ...decision, experiment_id: other } : decision
    )
    const prompt = buildUserPrompt({ ...context, question: 'q' })
    expect(prompt).toContain('OTHER EXPERIMENT')
    expect(prompt).toContain('[OTHER EXPERIMENT]')
  })
})

/**
 * Regression: a person-name lookup failure must never render as absence.
 *
 * Found by live verification against Alpine. Christie is referenced by work
 * items but is NOT in project_persons for that project, so the name map
 * missed her and the prompt printed "owner=NOBODY" and "(nobody has reviewed
 * this)" for an item that had both an owner and a recorded correction. That
 * converts a lookup failure into a confident false claim.
 */
describe('unresolved person names never render as absence', () => {
  function contextWithUnresolvedOwner() {
    const context = exp003ContextWithWork()
    context.workItems = context.workItems.map((item) =>
      item.id === IDS.workItem1
        ? { ...item, ownerName: null, validatedByName: null } // ids still set
        : item
    )
    return context
  }

  it('does not claim NOBODY when an owner id is present but unresolved', () => {
    const prompt = buildUserPrompt({ ...contextWithUnresolvedOwner(), question: 'q' })
    expect(prompt).toContain(`owner=person ${IDS.personChristie} (name not resolvable in CGT)`)
    expect(prompt).not.toMatch(new RegExp(`${IDS.workItem1}[\\s\\S]{0,200}owner=NOBODY`))
  })

  it('distinguishes a genuinely unowned item from an unresolved one', () => {
    const prompt = buildUserPrompt({ ...contextWithUnresolvedOwner(), question: 'q' })
    // WORK-003 truly has owner_person_id === null.
    expect(prompt).toContain('owner=NOBODY RECORDED')
  })

  it('never says "nobody has reviewed this" for a validated item', () => {
    const prompt = buildUserPrompt({ ...contextWithUnresolvedOwner(), question: 'q' })
    // WORK-001 is confirmed and WORK-002 corrected; only WORK-003 is unvalidated.
    expect(prompt.match(/\(nobody has reviewed this\)/g) || []).toHaveLength(1)
    expect(prompt).toContain('validation=confirmed by person')
  })

  it('drives the reviewer clause from validation_state, not from name resolution', () => {
    const context = exp003ContextWithWork()
    context.workItems = context.workItems.map((item) =>
      item.id === IDS.workItem2 ? { ...item, validatedByName: null, validated_by_person_id: null } : item
    )
    const prompt = buildUserPrompt({ ...context, question: 'q' })
    // Corrected but with no recorded reviewer: still not "unreviewed".
    expect(prompt).toContain('validation=corrected by an unattributed reviewer')
  })

  it('marks a decision with no recorded decider distinctly from an unresolved one', () => {
    const prompt = buildUserPrompt({ ...exp003ContextWithWork(), question: 'q' })
    expect(prompt).toContain('(decider not recorded)')
  })

  it('does not attribute a correction to a name it could not resolve', () => {
    const context = exp003ContextWithWork()
    context.workCorrections = context.workCorrections.map((c) => ({ ...c, actorName: null }))
    const prompt = buildUserPrompt({ ...context, question: 'q' })
    expect(prompt).toContain(`by person ${IDS.personChristie} (name not resolvable in CGT)`)
    expect(prompt).not.toContain('by an unattributed actor')
  })
})
