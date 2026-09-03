import { AskCgtContext, AskCgtExperiment, AskCgtProposal, AskCgtTranscript } from './retrieve'

/**
 * AskCGT context + prompt construction.
 *
 * Builds a bounded, evidence-oriented prompt for ONE project. It never dumps
 * the database: it renders people, transcripts, observations, markers, and
 * accepted candidates with stable IDs and asks the model to reason over
 * exactly what was retrieved. The model is disposable; the evidence is
 * authoritative.
 *
 * Epistemic rules are enforced in the prompt AND by the validation layer:
 * direct evidence (someone said X) is distinct from inference (this suggests
 * Y) and from unknown (we do not know Z). Model output must never silently
 * become organizational fact — AskCGT answers are not persisted.
 */

/** Max characters of a single utterance's text rendered into the prompt. */
export const UTTERANCE_MAX_CHARS = 240

export function capUtterances<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items
  const head = items.slice(0, Math.ceil(cap / 2))
  const tail = items.slice(-Math.floor(cap / 2))
  return [...head, ...tail]
}

/** Renders a date as a plain ISO day, or an explicit absence marker. */
function renderDate(value: string | null | undefined): string {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'not recorded' : parsed.toISOString().slice(0, 10)
}

/**
 * Renders one experiment field, stating absence explicitly.
 *
 * A field that is simply omitted when null is indistinguishable from a field
 * that does not exist, which invites the model to treat a gap as if it had
 * been considered and left empty. "(not recorded)" is honest and lets the
 * model name the gap as an unknown.
 */
function renderField(label: string, value: string | null | undefined): string {
  if (value === null || value === undefined || !String(value).trim()) {
    return `${label}: (not recorded in CGT)`
  }
  const text = String(value).trim()
  return text.includes('\n') ? `${label}:\n${text.split('\n').map((l) => `    ${l}`).join('\n')}` : `${label}: ${text}`
}

/** Design keys AskCGT renders, in reasoning order. Every key is emitted even when absent. */
const DESIGN_KEYS: Array<{ key: string; label: string }> = [
  { key: 'assumptions', label: 'Design — assumptions' },
  { key: 'unknowns', label: 'Design — unknowns' },
  { key: 'risks', label: 'Design — risks' },
  { key: 'constraints', label: 'Design — constraints' },
  { key: 'security_constraints', label: 'Design — security / data-handling constraints' },
  { key: 'evidence_requirements', label: 'Design — evidence requirements' },
  { key: 'measures', label: 'Design — measures' },
  { key: 'out_of_scope', label: 'Design — OUT OF SCOPE (boundaries this experiment is not testing)' },
]

function renderDesignValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const items = value.map((v) => (typeof v === 'string' ? v.trim() : JSON.stringify(v))).filter(Boolean)
    return items.length ? items.join('\n') : null
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Caps for the work sections, with an explicit marker when applied. */
export const MAX_WORK_ITEMS_RENDERED = 200
export const MAX_DECISIONS_RENDERED = 100
export const MAX_CORRECTIONS_RENDERED = 60

function renderPercent(value: number | null): string {
  return value == null ? 'not computable' : `${Math.round(value * 1000) / 10}%`
}

/**
 * Renders a person reference, keeping "nobody is recorded" distinct from
 * "somebody is recorded but their name could not be resolved".
 *
 * Collapsing the two let a lookup failure render as the factual claim
 * "owner=NOBODY", which is precisely the kind of confident absence AskCGT
 * must never manufacture.
 */
function renderPerson(id: string | null, name: string | null, absent: string): string {
  if (!id) return absent
  return name ?? `person ${id} (name not resolvable in CGT)`
}

/**
 * Renders the derived measures and EXP-003 criteria.
 *
 * These are computed by the same pure functions the admin UI calls, so a
 * number here is the number Paul sees on screen. Criteria carry an explicit
 * 'NO DATA' state: an unmeasured threshold must never read as a satisfied one.
 */
function renderWorkMeasures(input: AskCgtPromptInput): string {
  const measures = input.workMeasures
  if (!measures) return ''
  const lines: string[] = []

  lines.push('## Derived measures for this experiment\'s work inventory')
  lines.push('These are computed from stored records, not estimated. They are the same figures shown in CGT\'s admin UI.')
  lines.push('')
  lines.push(`Items in inventory: ${measures.coverage.total} (${measures.openItems} open, ${measures.wipItems} active, ${measures.stalledItems} waiting/blocked)`)
  lines.push(`Discovered after the initial inventory: ${measures.coverage.discoveredLate} (already-represented share: ${renderPercent(measures.coverage.representedFraction)}; EXP-003 needs >= 90%)`)
  lines.push(`Fully specified (description + owner + next action/dependency): ${measures.completeness.fullySpecified}/${measures.coverage.total} (${renderPercent(measures.completeness.fullySpecifiedFraction)})`)
  lines.push(`Waiting/blocked with NO stated dependency: ${measures.completeness.stalledWithoutStatedReason} — status for these lives outside the shared view`)
  lines.push(`Validation: ${measures.validation.confirmed} confirmed, ${measures.validation.corrected} corrected, ${measures.validation.disputed} disputed, ${measures.validation.unvalidated} unvalidated, ${measures.validation.removed} removed`)
  lines.push(`Items with NO recorded source: ${measures.itemsWithoutEvidence} — these are unsourced assertions`)
  lines.push(
    measures.concentration.topOwnerPersonId
      ? `Ownership concentration: the single largest owner holds ${measures.concentration.topOwnerOpenItems} of ${measures.openItems} open items (${renderPercent(measures.concentration.topOwnerFraction)}); ${measures.concentration.unownedOpenItems} open items have no owner`
      : `Ownership concentration: no open item has a recorded owner (${measures.concentration.unownedOpenItems} unowned)`
  )
  lines.push(`Intake channels observed: ${measures.intake.distinctChannels}${measures.intake.channels.length ? ` (${measures.intake.channels.map((c) => `${c.channel} ${c.items}`).join(', ')})` : ''}; ${measures.intake.informalItems} informal; ${measures.intake.unknownChannelItems} with no channel recorded`)
  lines.push(
    measures.maintenance.daysWithRecordedEffort === 0
      ? 'Maintenance effort: NOTHING LOGGED. The <=15 min/day constraint is unevaluated, not satisfied.'
      : `Maintenance effort: ${measures.maintenance.totalEffortMinutes} min over ${measures.maintenance.daysWithRecordedEffort} day(s); mean ${Math.round((measures.maintenance.meanMinutesPerActiveDay ?? 0) * 10) / 10} min/day; ${measures.maintenance.daysOverFifteenMinutes} day(s) over 15 min`
  )
  lines.push(`Decisions: ${measures.decisions.total} recorded, ${measures.decisions.informedByView} informed by the view, ${measures.decisions.qualifyingInformedByView} qualifying for EXP-003; ${measures.decisions.withoutRationale} with no rationale`)
  lines.push('')

  if (input.workCriteria.length > 0) {
    lines.push('### EXP-003 criteria against stored evidence')
    lines.push('"NO DATA" means the criterion cannot be judged yet. Never treat NO DATA as met.')
    for (const criterion of input.workCriteria) {
      const label = criterion.status === 'met' ? 'MET' : criterion.status === 'not_met' ? 'NOT MET' : 'NO DATA'
      lines.push(`- [${label}] ${criterion.criterion}`)
      lines.push(`    observed: ${criterion.observed}`)
      if (criterion.blockedBy) lines.push(`    blocked by: ${criterion.blockedBy}`)
    }
  }

  return lines.join('\n')
}

/** Renders the work inventory with per-item provenance and completeness gaps. */
function renderWorkItems(input: AskCgtPromptInput): string {
  if (input.workItems.length === 0) return ''
  const lines: string[] = []
  const activeId = input.activeExperiment?.id ?? null

  lines.push('## Work inventory (recorded work items)')
  lines.push('Cite these as type "work_item" using the full id shown. A work item is CGT\'s record that this work exists; it is only as reliable as its recorded source and its validation state.')
  lines.push('')

  const shown = input.workItems.slice(0, MAX_WORK_ITEMS_RENDERED)
  for (const item of shown) {
    const flags: string[] = []
    if (activeId && item.experiment_id !== activeId) flags.push('OTHER EXPERIMENT')
    if (!item.in_initial_inventory) flags.push('DISCOVERED AFTER BASELINE')
    if (item.is_informal) flags.push('INFORMAL — lives in no system')
    if (item.evidenceCount === 0) flags.push('NO RECORDED SOURCE')
    if (item.contradictingEvidenceCount > 0) flags.push(`${item.contradictingEvidenceCount} CONTRADICTING SOURCE(S)`)

    lines.push(`Work item ${item.id} — ${item.code}: ${item.title}`)
    lines.push(
      `    state=${item.state}; owner=${renderPerson(item.owner_person_id, item.ownerName, 'NOBODY RECORDED')}; intake=${item.intake_channel || 'not recorded'}; found via ${item.discovery_method} on ${renderDate(item.discovered_at)}`
    )
    // The reviewer clause is driven by validation_state, not by whether a name
    // resolved, so a corrected item can never read as unreviewed.
    const reviewClause =
      item.validation_state === 'unvalidated'
        ? ' (nobody has reviewed this)'
        : ` by ${renderPerson(item.validated_by_person_id, item.validatedByName, 'an unattributed reviewer')} on ${renderDate(item.validated_at)}`
    lines.push(`    validation=${item.validation_state}${reviewClause}; sources=${item.evidenceCount}`)
    if (item.description) lines.push(`    description: ${item.description}`)
    if (item.next_action) lines.push(`    next action: ${item.next_action}`)
    if (item.blocked_reason) lines.push(`    dependency: ${item.blocked_reason}`)
    if (!item.next_action && !item.blocked_reason) {
      lines.push('    next action: NONE RECORDED — this item\'s status is not in the shared view')
    }
    if (flags.length) lines.push(`    flags: ${flags.join('; ')}`)
  }

  if (input.workItems.length > shown.length) {
    lines.push('')
    lines.push(
      `[TRUNCATED: ${input.workItems.length - shown.length} further work item(s) were retrieved but not rendered. Any count you state about the inventory must come from the derived measures above, not from counting these lines.]`
    )
  }

  return lines.join('\n')
}

/**
 * Renders findings a human reviewed and accepted.
 *
 * These sit between evidence and model output in authority: a person vouched
 * for the interpretation, which an unreviewed candidate never had. But they
 * are still interpretations, so the section states that explicitly and shows
 * the original wording whenever the reviewer edited it — otherwise a later
 * reader cannot tell the model's claim from the human's correction of it.
 */
function renderReviewedFindings(input: AskCgtPromptInput): string {
  if (input.reviewedFindings.length === 0) return ''
  const lines: string[] = []
  lines.push('## Reviewed findings (a human accepted these interpretations)')
  lines.push(
    'These are prior AskCGT conclusions that Paul reviewed and deliberately accepted. A reviewed finding is a HUMAN-VOUCHED INTERPRETATION, not a source fact: it carries more authority than an unreviewed candidate, and less than the primary evidence it cites. It does NOT override contradictory primary evidence — if you find evidence that conflicts with a reviewed finding, say so and cite both.'
  )
  lines.push('Cite these as type "finding" using the full id shown.')
  lines.push('')
  for (const finding of input.reviewedFindings.slice(0, MAX_DECISIONS_RENDERED)) {
    lines.push(
      `Finding ${finding.id}${finding.experimentCode ? ` [${finding.experimentCode}]` : ''} [${finding.epistemicType || 'unclassified'}] [${finding.wasEdited ? 'ACCEPTED WITH EDITS' : 'accepted unchanged'}]`
    )
    lines.push(`    accepted claim: ${finding.statement}`)
    if (finding.wasEdited && finding.proposedStatement) {
      lines.push(`    the model originally proposed: ${finding.proposedStatement}`)
      lines.push('    (the reviewer changed the wording, so the accepted claim above is the human judgment)')
    }
    if (finding.interpretation) lines.push(`    rationale: ${finding.interpretation}`)
    lines.push(
      `    reviewed by ${finding.reviewerName || 'an unnamed reviewer'} on ${renderDate(finding.reviewedAt)}${finding.model ? `; originally proposed by ${finding.provider || 'unknown'}/${finding.model}` : ''}`
    )
    if (finding.citations.length > 0) {
      lines.push(
        `    grounded in: ${finding.citations.map((c) => `${c.type} ${c.id}${c.utteranceIds?.length ? ` (utterances ${c.utteranceIds.join(', ')})` : ''}`).join('; ')}`
      )
    } else {
      lines.push('    grounded in: NO CITATIONS RECORDED')
    }
  }
  return lines.join('\n')
}

/** Renders durable decisions, including what was rejected and what superseded what. */
function renderDecisions(input: AskCgtPromptInput): string {
  if (input.decisions.length === 0) return ''
  const lines: string[] = []
  const activeId = input.activeExperiment?.id ?? null

  lines.push('## Recorded decisions')
  lines.push('Cite these as type "decision" using the full id shown. A decision records what CGT or the client actually settled on, why, and whether it still holds. Only "active" decisions are current: "superseded" and "reversed" ones describe past thinking and must not be presented as current policy.')
  lines.push('')

  const shown = input.decisions.slice(0, MAX_DECISIONS_RENDERED)
  for (const decision of shown) {
    const scope = activeId && decision.experiment_id !== activeId ? ' [OTHER EXPERIMENT]' : ''
    lines.push(`Decision ${decision.id} — ${decision.code} [${decision.status}] [${decision.decision_type}]${scope}`)
    lines.push(
      `    decided ${renderDate(decision.decided_at)}${
        decision.decided_by_person_id
          ? ` by ${renderPerson(decision.decided_by_person_id, decision.decidedByName, '')}`
          : ' (decider not recorded)'
      }; informed by the shared work view: ${decision.informed_by_view ? 'YES' : 'no'}`
    )
    lines.push(`    statement: ${decision.statement}`)
    lines.push(
      decision.rationale
        ? `    rationale: ${decision.rationale}`
        : '    rationale: NONE RECORDED — the reasoning behind this decision was not preserved'
    )
    if (decision.alternatives_considered) {
      lines.push(`    rejected alternatives: ${decision.alternatives_considered}`)
    }
    if (decision.supersedesCode) lines.push(`    supersedes: ${decision.supersedesCode}`)
  }

  if (input.decisions.length > shown.length) {
    lines.push('')
    lines.push(`[TRUNCATED: ${input.decisions.length - shown.length} further decision(s) were retrieved but not rendered.]`)
  }

  return lines.join('\n')
}

/**
 * Renders human review outcomes.
 *
 * A correction or dispute is direct evidence that CGT's interpretation was
 * wrong, which makes it more informative than a confirmation.
 */
function renderWorkCorrections(input: AskCgtPromptInput): string {
  if (input.workCorrections.length === 0) return ''
  const lines: string[] = []
  lines.push('## Human review of the inventory (corrections, disputes, confirmations)')
  lines.push('A correction or dispute is evidence that CGT\'s recorded interpretation was wrong. Weigh these heavily and attribute them to the person named.')
  lines.push('')
  for (const correction of input.workCorrections.slice(0, MAX_CORRECTIONS_RENDERED)) {
    const actor = correction.actorPersonId
      ? renderPerson(correction.actorPersonId, correction.actorName, '')
      : 'an unattributed actor'
    lines.push(
      `- ${renderDate(correction.occurredAt)} ${correction.eventType.toUpperCase()} on ${correction.workItemCode || 'an item'}${correction.workItemTitle ? ` (${correction.workItemTitle})` : ''} by ${actor}${correction.previousValue ? `; previous validation state: ${correction.previousValue}` : ''}${correction.note ? `; note: ${correction.note}` : ''}`
    )
  }
  if (input.workCorrections.length > MAX_CORRECTIONS_RENDERED) {
    lines.push(`[TRUNCATED: ${input.workCorrections.length - MAX_CORRECTIONS_RENDERED} further review event(s) not rendered.]`)
  }
  return lines.join('\n')
}

/**
 * Renders the ACTIVE experiment in full, with its canonical citable ID.
 *
 * Every field retrieved is rendered. Silently omitting retrieved fields
 * (previously problem, method, success/failure criteria, scope, status and the
 * whole design object) hid exactly the material a consultant reasons from —
 * including the experiment's own out-of-scope boundaries.
 */
function renderActiveExperiment(experiment: AskCgtExperiment, proposals: AskCgtProposal[]): string {
  const lines: string[] = []
  lines.push(`## ACTIVE EXPERIMENT — this is the experiment Paul is currently viewing`)
  lines.push(`Cite this experiment as type "experiment" with id ${experiment.id}`)
  lines.push('')
  lines.push(`Experiment ${experiment.id}`)
  lines.push(renderField('Code', experiment.code))
  lines.push(renderField('Title', experiment.title))
  lines.push(renderField('Status', experiment.status))
  lines.push(`Lifecycle: created ${renderDate(experiment.created_at)}; proposed ${renderDate(experiment.proposed_at)}; approved ${renderDate(experiment.approved_at)}; activated ${renderDate(experiment.activated_at)}; completed ${renderDate(experiment.completed_at)}`)
  lines.push(renderField('Primary question', experiment.primary_question))
  lines.push(renderField('Problem', experiment.problem))
  lines.push(renderField('Rationale', experiment.rationale))
  lines.push(renderField('Hypothesis', experiment.hypothesis))
  lines.push(renderField('Method', experiment.method))
  lines.push(renderField('Scope', experiment.scope))
  lines.push(renderField('Success criteria', experiment.success_criteria))
  lines.push(renderField('Failure criteria', experiment.failure_criteria))
  lines.push(renderField('Stop conditions', experiment.stop_conditions))
  lines.push(renderField('Decision rule', experiment.decision_rule))
  lines.push(renderField('Conclusion', experiment.conclusion))
  lines.push(renderField('Recommendation', experiment.recommendation))
  lines.push(renderField('Resulting decision', experiment.resulting_decision))
  lines.push(renderField('Confidence', experiment.confidence))

  for (const { key, label } of DESIGN_KEYS) {
    lines.push(renderField(label, renderDesignValue(experiment.design?.[key])))
  }

  lines.push('')
  lines.push('### Approval / proposal provenance for this experiment')
  if (proposals.length === 0) {
    lines.push('No proposal is connected to this experiment in CGT. Its approval state, if any, comes only from the experiment status and lifecycle dates above.')
  } else {
    for (const proposal of proposals) {
      lines.push(
        `Proposal ${proposal.id} — cite as type "proposal": ${proposal.code || '(no code)'} "${proposal.title || '(untitled)'}" [kind ${proposal.kind || 'unknown'}] status ${proposal.status || 'unknown'}; sent ${renderDate(proposal.sent_at)}; accepted ${renderDate(proposal.accepted_at)}; declined ${renderDate(proposal.declined_at)}`
      )
    }
  }
  return lines.join('\n')
}

function resolveSpeakerLabel(transcriptId: string, speakerKey: string, speakerMaps: AskCgtContext['speakerMaps']): string {
  const match = speakerMaps.find((map) => map.transcriptId === transcriptId && map.providerSpeakerKey === speakerKey)
  return match?.personName || speakerKey
}

function renderTranscript(transcript: AskCgtTranscript, speakerMaps: AskCgtContext['speakerMaps'], label: string): string {
  const lines: string[] = []
  lines.push(`### Transcript ${transcript.id} (${label}) — ${transcript.title}`)
  lines.push(`Source: recorded conversation. Transcript status: ${transcript.status}. Completed: ${renderDate(transcript.completedAt)}.`)
  for (const utterance of transcript.utterances) {
    const speaker = resolveSpeakerLabel(transcript.id, utterance.speakerKey, speakerMaps)
    const text = utterance.text.length > UTTERANCE_MAX_CHARS ? `${utterance.text.slice(0, UTTERANCE_MAX_CHARS)}…` : utterance.text
    lines.push(`[${utterance.id}] ${speaker}: ${text}`)
  }
  return lines.join('\n')
}

export function buildSystemPrompt(): string {
  return [
    'You are AskCGT, CGT\'s evidence-reasoning copilot.',
    '',
    'You answer a question about one organization using ONLY the CGT evidence provided in the user message.',
    'You are NOT a chatbot. You do not have access to CGT\'s database, the internet, or prior conversations. Your entire world is the retrieved evidence below.',
    '',
    'The evidence is authoritative. The model is disposable. Do not invent facts, people, processes, dates, or numbers that are not in the provided evidence.',
    '',
    'Distinguish epistemic states explicitly:',
    '- DIRECT EVIDENCE: something in the evidence itself (a transcript utterance, an accepted observation, a session marker). You can cite it.',
    '- INFERENCE: a conclusion you are drawing from the evidence. Label it as inference and explain the reasoning.',
    '- UNKNOWN: something the evidence does not establish. Saying "we do not know" is a valid, important answer. Do not fill gaps by guessing.',
    '',
    'A statement a person made is evidence that they said it. It is NOT automatically evidence that the statement is objectively true.',
    'A model-generated inference is never organizational fact.',
    '',
    'Be adversarial toward overreach. It is better to say "the evidence does not establish this" than to produce an impressive-sounding answer that the evidence cannot support.',
    '',
    'For every substantive conclusion, cite the specific evidence that supports it. Cite the fewest evidence items that support the claim. If a conclusion conflicts with other evidence, say so and cite both sides.',
    '',
    '## Evidence quality',
    '',
    'Not all evidence carries equal weight. Weigh it accordingly and say which kind you are relying on:',
    '- A RECORDED EXPERIMENT DEFINITION is CGT\'s deliberate, written statement of a problem, method, and boundary. It is authoritative about intent and scope.',
    '- A CLIENT-ACCEPTED PROPOSAL is a commercial commitment. It is authoritative about what was agreed and when.',
    '- A HUMAN-ACCEPTED OBSERVATION has been reviewed by a person. It is the strongest interpretive evidence.',
    '- A HUMAN CORRECTION OR DISPUTE of a CGT record is direct evidence that CGT was wrong. Weigh it above the record it corrects.',
    '- A REVIEWED FINDING is a prior model conclusion that a human examined and accepted. It is a vouched-for INTERPRETATION, not a source fact. It outranks an unreviewed candidate and never outranks the primary evidence it cites; if primary evidence contradicts it, say so and cite both. Where the reviewer edited the wording, the accepted wording is the human judgment and the original is the model\'s.',
    '- A RECORDED DECISION is authoritative about what was settled and why — but only while its status is "active". A "superseded" or "reversed" decision describes past thinking, not current policy.',
    '- A WORK ITEM is CGT\'s record that some work exists. Its reliability depends on two things stated on every item: whether a human has validated it, and whether it has any recorded source. An unvalidated item with no source is an unverified assertion, not established fact.',
    '- A LIVE SESSION MARKER was recorded by a person during a real conversation. It is strong evidence that something was noticed at that moment.',
    '- A TRANSCRIPT UTTERANCE is evidence that a specific person said specific words at a specific time.',
    '- An UNREVIEWED MODEL-GENERATED CANDIDATE is a machine guess that no human has confirmed. It is a hypothesis to test, NOT an established fact. Never treat it as organizational knowledge, and never let it be the sole support for a material conclusion. If you rely on one, say that it is unreviewed.',
    '',
    'Prefer recent evidence over stale evidence when they conflict, and say when you are doing so. Dates are provided; if a date is missing, say the recency is unknown rather than assuming.',
    '',
    '## Measures and thresholds',
    '',
    'Some sections carry derived measures computed from stored records, plus experiment criteria marked MET, NOT MET, or NO DATA.',
    '- Use the derived numbers rather than counting rendered lines yourself. Lists may be truncated; the measures are not.',
    '- NO DATA means the threshold cannot be judged yet. Treating NO DATA as MET is a serious error — it converts an unmeasured hope into a claimed result. Say what would have to be recorded to evaluate it.',
    '- An empty record set is itself a finding. "No work items are recorded" does not mean there is no work; it means CGT cannot see it, and you should say so in exactly those terms.',
    '- Do not present a measure as the outcome of the experiment. A more complete list is not the same as better prioritization; the criteria say which is which.',
    '',
    '## CGT\'s operating principles',
    '',
    'These are the lenses CGT reasons with. They are NOT a compliance checklist:',
    '0. Question everything.',
    '1. Know the problem.',
    '2. Make work visible.',
    '3. Work together.',
    '4. Take simple steps.',
    '5. Prefer composition.',
    '6. Validate.',
    '7. Release often.',
    '8. Prefer automation.',
    '',
    'How to use them:',
    '- Invoke a principle only when it genuinely illuminates the question. Do not recite all nine. Do not label everything a violation.',
    '- When you invoke one, name it, explain WHY it is relevant here, and point to the evidence that makes it relevant.',
    '- Principles conflict. "Take simple steps" and "Prefer automation" often pull in opposite directions; so do "Release often" and "Validate". Name the tension rather than pretending one obviously wins.',
    '- An apparent deviation may be justified by circumstances, a competing goal, a constraint, or insufficient evidence. Say so when that is the better reading.',
    '- Distinguish an OBSERVED CONDITION (the evidence shows this is happening) from an INFERRED PRINCIPLE TENSION (this pattern may conflict with a principle). The first can be cited; the second is your interpretation and must be labeled as inference.',
    '- Apply the same scrutiny to CGT and to Paul as you would to the client. If CGT\'s own behavior, or Paul\'s, appears to conflict with a principle, say so plainly.',
    '',
    '## Challenging Paul',
    '',
    'You are Paul\'s consulting partner, not his assistant. Agreeing with a flawed plan is a failure. When the evidence or the experiment\'s own recorded boundaries conflict with what Paul proposes, say so directly, explain the conflict, cite the evidence, and offer what you would do instead.',
    '',
    'Watch for these specific consulting failures and name them when you see them:',
    '- Jumping from a symptom straight to implementation without establishing the underlying problem.',
    '- Selecting a familiar or already-available tool before the problem is understood.',
    '- Expanding beyond the experiment\'s recorded scope, or quietly converting a learning experiment into an implementation project.',
    '- Treating missing evidence as confirmation ("no one complained, so it is fine").',
    '- Relying excessively on one participant, especially one whose overload is part of the problem being studied.',
    '- Designing or changing a test so that it can no longer disconfirm the hypothesis.',
    '',
    'If the experiment records out-of-scope boundaries, those boundaries are evidence. A proposal that crosses them needs an explicit, reasoned justification — not silent acceptance.',
    '',
    'Challenging Paul does not mean refusing to answer. Answer the question, and include the challenge.',
    '',
    'You must respond ONLY with JSON. The JSON must have this exact shape:',
    '{',
    '  "answer": "the full written answer to the question, distinguishing direct evidence from inference and identifying unknowns",',
    '  "conclusions": [',
    '    {',
    '      "statement": "one substantive conclusion in one precise sentence",',
    '      "kind": "evidence" | "inference" | "unknown",',
    '      "confidence": 0.0 to 1.0,',
    '      "reasoning": "one sentence explaining how the evidence supports or fails to support this",',
    '      "evidence": [ { "type": "transcript" | "observation" | "marker" | "candidate" | "experiment" | "proposal" | "work_item" | "decision" | "finding", "id": "exact full id from the evidence", "utteranceIds": ["exact utterance ids"] } ]',
    '    }',
    '  ],',
    '  "unknowns": ["an important thing the evidence does not tell us"]',
    '}',
    '',
    'Rules:',
    '- Every evidence reference MUST use the COMPLETE identifier exactly as printed in the evidence below, copied character for character. Identifiers are full UUIDs. Never abbreviate, shorten, or reformat an id. Never invent one.',
    '- Cite an "experiment" by the id printed on its "Experiment <id>" line, a "proposal" by its "Proposal <id>" line, a "work_item" by its "Work item <id>" line, and a "decision" by its "Decision <id>" line, and a "finding" by its "Finding <id>" line.',
    '- A citation whose id is not present in the evidence below will be REJECTED and your conclusion will be reported to Paul as ungrounded. Copy ids precisely.',
    '- "evidence" is only for kind "evidence" or "inference"; an "unknown" conclusion may have an empty evidence array.',
    '- When citing a transcript, include the exact utteranceIds that support the point.',
    '- Prefer: "Rich said X (utterance <id>)." over vague prose.',
    '- Answer the question Paul actually asked, in the form the question calls for. Do not force your answer into a rigid template, and do not summarize the meeting unless asked.',
    '- If the evidence cannot answer the question, say so clearly in "answer" and list the specific missing evidence in "unknowns".',
    '- Return {"answer": "...", "conclusions": [], "unknowns": []} only when there is genuinely nothing useful.',
  ].join('\n')
}

export type AskCgtPromptInput = AskCgtContext & {
  question: string
}

export function buildUserPrompt(input: AskCgtPromptInput): string {
  const parts: string[] = []

  parts.push(`# Project: ${input.project.name}`)
  parts.push(`Status: ${input.project.status}`)
  if (input.project.description) parts.push(`Description: ${input.project.description}`)
  parts.push('')

  if (input.people.length > 0) {
    parts.push('## Known people in this project')
    for (const person of input.people) {
      const detail = [person.title, person.company].filter(Boolean).join(' · ')
      parts.push(`- ${person.displayName}${detail ? ` — ${detail}` : ''} (id ${person.id})`)
    }
    parts.push('')
  }

  if (input.transcripts.length > 0) {
    parts.push('## Transcripts')
    for (const transcript of input.transcripts) {
      const label = 'recorded conversation'
      parts.push(renderTranscript(transcript, input.speakerMaps, label))
    }
    parts.push('')
  }

  if (input.observations.length > 0) {
    parts.push('## Human-accepted observations (reviewed by a person — strongest interpretive evidence)')
    parts.push('Cite these as type "observation" using the full id shown.')
    for (const observation of input.observations) {
      parts.push(
        `Observation ${observation.id} (transcript ${observation.transcriptId}${observation.recordingTitle ? `, ${observation.recordingTitle}` : ''}) [confidence ${observation.confidence}] [recorded ${renderDate(observation.created_at)}]: ${observation.statement}`
      )
      if (observation.notes) parts.push(`  note: ${observation.notes}`)
    }
    parts.push('')
  }

  if (input.markers.length > 0) {
    parts.push('## Live session markers (recorded by a person during a real conversation)')
    parts.push('Cite these as type "marker" using the full id shown.')
    for (const marker of input.markers) {
      parts.push(
        `Marker ${marker.id} [${marker.noteType}]${marker.recordingTitle ? ` (${marker.recordingTitle}` : ' ('}@ ${marker.timestampSeconds}s) [recorded ${renderDate(marker.created_at)}]: ${marker.noteText || '(no text captured — the marker records that something was noticed at this moment, not what it was)'}`
      )
    }
    parts.push('')
  }

  if (input.candidates.length > 0) {
    parts.push('## Model-generated intelligence candidates — MACHINE GUESSES, NOT ESTABLISHED FACT')
    parts.push('Each line states its review status. An "unreviewed" candidate has NOT been confirmed by any human: treat it as a hypothesis to test, never as organizational knowledge, and never as the sole support for a material conclusion.')
    parts.push('Cite these as type "candidate" using the full id shown.')
    for (const candidate of input.candidates) {
      const status =
        candidate.status === 'accepted'
          ? 'HUMAN-ACCEPTED'
          : candidate.status === 'rejected'
            ? 'HUMAN-REJECTED — do not rely on this'
            : 'UNREVIEWED — no human has confirmed this'
      parts.push(
        `Candidate ${candidate.id} [${status}] [${candidate.type}] (generated by ${candidate.provider}/${candidate.model}${candidate.confidence != null ? `, self-reported confidence ${candidate.confidence}` : ''}) (transcript ${candidate.transcriptId}${candidate.recordingTitle ? `, ${candidate.recordingTitle}` : ''}) [generated ${renderDate(candidate.created_at)}]: ${candidate.content}`
      )
      if (candidate.reasoningSummary) parts.push(`  model reasoning (also unverified): ${candidate.reasoningSummary}`)
    }
    parts.push('')
  }

  // The active experiment is rendered in full; other experiments in the
  // project get a short form so cross-experiment context exists without
  // flooding the prompt.
  if (input.activeExperiment) {
    parts.push(renderActiveExperiment(input.activeExperiment, input.activeExperimentProposals))
    parts.push('')
  }

  // The artifacts the experiment has actually produced so far. Rendered after
  // the experiment definition (which states intent) and before the other
  // experiments (which are only background), because these records are what
  // the experiment currently knows.
  for (const section of [
    renderReviewedFindings(input),
    renderWorkMeasures(input),
    renderWorkItems(input),
    renderWorkCorrections(input),
    renderDecisions(input),
  ]) {
    if (section) {
      parts.push(section)
      parts.push('')
    }
  }

  // An active experiment with an empty inventory is a materially different
  // situation from one that was never asked about, so it is stated rather
  // than left as an absent section.
  if (input.activeExperiment && input.workItems.length === 0) {
    parts.push('## Work inventory')
    parts.push('EMPTY. No work items have been recorded in CGT for this project. Any claim about what work exists, how much of it there is, who owns it, or what state it is in is therefore NOT supported by CGT evidence.')
    parts.push('')
  }
  if (input.activeExperiment && input.decisions.length === 0) {
    parts.push('## Recorded decisions')
    parts.push('NONE. No decisions have been recorded in CGT for this project. CGT cannot tell you why any prior choice was made.')
    parts.push('')
  }

  const otherExperiments = input.experiments.filter((e) => e.id !== input.activeExperiment?.id)
  if (otherExperiments.length > 0) {
    parts.push(
      input.activeExperiment
        ? '## Other experiments in this project (summary only — for cross-experiment context)'
        : '## Experiments in this project'
    )
    parts.push('Cite these as type "experiment" using the full id shown.')
    for (const experiment of otherExperiments) {
      parts.push(`Experiment ${experiment.id}: ${experiment.code} — ${experiment.title} [status ${experiment.status}]`)
      if (experiment.primary_question) parts.push(`   Question: ${experiment.primary_question}`)
      if (experiment.hypothesis) parts.push(`   Hypothesis: ${experiment.hypothesis}`)
      if (experiment.problem) parts.push(`   Problem: ${experiment.problem}`)
      if (experiment.decision_rule) parts.push(`   Decision rule: ${experiment.decision_rule}`)
      if (experiment.conclusion) parts.push(`   Conclusion: ${experiment.conclusion}`)
      if (experiment.recommendation) parts.push(`   Recommendation: ${experiment.recommendation}`)
      if (experiment.resulting_decision) parts.push(`   Resulting decision: ${experiment.resulting_decision}`)
      parts.push('')
    }
  }

  parts.push('## Question')
  parts.push(input.question)
  parts.push('')
  parts.push('## Instructions')
  parts.push(
    input.activeExperiment
      ? 'Answer the question above using ONLY the evidence in this message. Paul is viewing the ACTIVE EXPERIMENT section — treat that experiment as the subject of the question unless he clearly means something else. Its recorded scope, out-of-scope boundaries, method, and success/failure criteria are evidence about what this experiment is and is not for; use them, and challenge the question if it conflicts with them. Copy citation ids exactly as printed. If the evidence cannot answer the question, say so rather than guessing.'
      : 'Answer the question above using ONLY the evidence in this message. Copy citation ids exactly as printed. If the evidence cannot answer the question, say so rather than guessing.'
  )

  return parts.join('\n')
}