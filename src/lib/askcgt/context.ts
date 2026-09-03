import { AskCgtContext, AskCgtTranscript } from './retrieve'

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

export const UTTERANCE_MAX_CHARS = 500
const SPEAKER_LABEL_MAX = 240

export function capUtterances<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items
  const head = items.slice(0, Math.ceil(cap / 2))
  const tail = items.slice(-Math.floor(cap / 2))
  return [...head, ...tail]
}

function resolveSpeakerLabel(transcriptId: string, speakerKey: string, speakerMaps: AskCgtContext['speakerMaps']): string {
  const match = speakerMaps.find((map) => map.transcriptId === transcriptId && map.providerSpeakerKey === speakerKey)
  return match?.personName || speakerKey
}

function renderTranscript(transcript: AskCgtTranscript, speakerMaps: AskCgtContext['speakerMaps'], label: string): string {
  const lines: string[] = []
  lines.push(`### Transcript ${transcript.id} (${label}) — ${transcript.title}`)
  if (transcript.status !== 'complete') lines.push(`Status: ${transcript.status}`)
  for (const utterance of transcript.utterances) {
    const speaker = resolveSpeakerLabel(transcript.id, utterance.speakerKey, speakerMaps)
    const text = utterance.text.length > SPEAKER_LABEL_MAX ? `${utterance.text.slice(0, SPEAKER_LABEL_MAX)}…` : utterance.text
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
    'You must respond ONLY with JSON. The JSON must have this exact shape:',
    '{',
    '  "answer": "the full written answer to the question, distinguishing direct evidence from inference and identifying unknowns",',
    '  "conclusions": [',
    '    {',
    '      "statement": "one substantive conclusion in one precise sentence",',
    '      "kind": "evidence" | "inference" | "unknown",',
    '      "confidence": 0.0 to 1.0,',
    '      "reasoning": "one sentence explaining how the evidence supports or fails to support this",',
    '      "evidence": [ { "type": "transcript" | "observation" | "marker" | "candidate", "id": "exact id from the evidence", "utteranceIds": ["exact utterance ids"] } ]',
    '    }',
    '  ],',
    '  "unknowns": ["an important thing the evidence does not tell us"]',
    '}',
    '',
    'Rules:',
    '- Every evidence reference MUST use exact IDs verbatim from the provided evidence. Never write your own transcript text or invented IDs.',
    '- "evidence" is only for kind "evidence" or "inference"; an "unknown" conclusion may have an empty evidence array.',
    '- When citing a transcript, include the exact utteranceIds that support the point.',
    '- Prefer: "Rich said X (utterance u123)." over vague prose.',
    '- Answer the question asked. Do not summarize the meeting unless the question asks for a summary.',
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
    parts.push('## Accepted observations (human-reviewed or AI-candidate knowledge)')
    for (const observation of input.observations) {
      const line = `O${observation.id.slice(0, 8)} (transcript ${observation.transcriptId}${observation.recordingTitle ? `, ${observation.recordingTitle}` : ''}) [confidence ${observation.confidence}]: ${observation.statement}`
      parts.push(line)
      if (observation.notes) parts.push(`  note: ${observation.notes}`)
    }
    parts.push('')
  }

  if (input.markers.length > 0) {
    parts.push('## Session markers (questions, friction, decisions, observations, actions)')
    for (const marker of input.markers) {
      parts.push(`- [${marker.noteType}]${marker.recordingTitle ? ` ${marker.recordingTitle}` : ''}: ${marker.noteText || '(no text)'}`)
    }
    parts.push('')
  }

  if (input.candidates.length > 0) {
    parts.push('## Project intelligence candidates (model-generated, may be unreviewed)')
    for (const candidate of input.candidates) {
      const status = candidate.status === 'accepted' ? 'accepted' : candidate.status === 'rejected' ? 'rejected' : 'unreviewed candidate'
      const line = `C${candidate.id.slice(0, 8)} [${status}] [${candidate.type}] (transcript ${candidate.transcriptId}${candidate.recordingTitle ? `, ${candidate.recordingTitle}` : ''}): ${candidate.content}`
      parts.push(line)
      if (candidate.reasoningSummary) parts.push(`  reasoning: ${candidate.reasoningSummary}`)
    }
    parts.push('')
  }

  if (input.experiments.length > 0) {
    parts.push('## Experiments')
    for (const experiment of input.experiments) {
      parts.push(`E${experiment.id.slice(0, 8)}: ${experiment.title} (${experiment.code})`)
      if (experiment.primary_question) parts.push(`   Question: ${experiment.primary_question}`)
      if (experiment.hypothesis) parts.push(`   Hypothesis: ${experiment.hypothesis}`)
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
  parts.push('Answer using ONLY the evidence above. Return your structured JSON. Use only IDs present above. If the evidence cannot answer the question, say so rather than guessing.')

  return parts.join('\n')
}