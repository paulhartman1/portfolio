import { CANDIDATE_TYPES, CandidateType } from './types'

/**
 * Project Context Builder.
 *
 * Assembles a bounded, evidence-oriented prompt for ONE project. It never
 * dumps the database: it renders people, observations, hypotheses-relevant
 * evidence, and transcript utterances with stable IDs, and trusts the model to
 * reason, never to invent facts.
 */

export type SpeakerMap = {
  transcriptId: string
  providerSpeakerKey: string
  personName: string | null
}

export type ContextUtterance = {
  id: string
  speakerKey: string
  text: string
}

export type ContextTranscript = {
  id: string
  title: string | null
  isCurrent: boolean
  utterances: ContextUtterance[]
}

export type ContextObservation = {
  id: string
  transcriptId: string
  statement: string
  confidence: string
  notes: string | null
}

export type ContextMarker = {
  transcriptId: string | null
  recordingTitle: string | null
  noteType: string
  noteText: string | null
}

export type ProjectContextInput = {
  project: { id: string; name: string; description: string | null; status: string }
  people: Array<{ id: string; displayName: string; company: string | null; title: string | null }>
  speakerMaps: SpeakerMap[]
  transcripts: ContextTranscript[]
  observations: ContextObservation[]
  markers: ContextMarker[]
  inquiryFocus: string | null
}

const TYPE_GUIDANCE: Record<CandidateType, string> = {
  follow_up_question: 'A question that would materially increase CGT understanding of the system. Avoid mere conversational questions that just keep someone talking.',
  observation: 'A potentially important observation about how the work actually happens.',
  contradiction: 'A tension where this interview conflicts with earlier evidence or another person mention of the same process.',
  knowledge_gap: 'Something we still do not know, such as who can perform a task when a named person is unavailable.',
  knowledge_transfer_risk: 'A responsibility likely to become unowned because it relies on one person or undocumented knowledge.',
}

export function buildSystemPrompt(): string {
  return [
    'You are CGT Project Intelligence, an inquiry copilot for organizational inquiry.',
    '',
    'You analyze one project interview against what CGT already knows about that project.',
    'You are NOT a chatbot. You do not summarize the meeting. You surface specific, evidence-grounded insights an interviewer could use.',
    '',
    'The evidence is authoritative. The model is disposable. Do not invent facts, people, or processes that are not in the provided context. Do not repeat context as if it were new knowledge. If you have nothing useful, return an empty list.',
    '',
    'Notice especially:',
    '- Assumptions: statements presented as obvious but unsupported.',
    '- Process gaps: "we usually...", "it depends...", "someone handles..." with no defined owner.',
    '- Hidden decisions: individual judgment that does not exist in documented process.',
    '- Friction: workarounds, repetition, waiting, manual translation, copy/paste, unclear ownership, interruptions.',
    '- Tribal knowledge: successful execution depending on knowing something not captured in the system.',
    '- Contradictions: one process description conflicting with another.',
    '- Ownership gaps: responsibilities likely to become unowned as someone\'s role changes.',
    '- Missing failure paths: happy-path descriptions without the exceptions.',
    '- Hypothesis evidence: statements that strengthen, weaken, or complicate existing hypotheses.',
    '- Useful follow-up questions: questions that would materially increase understanding.',
    '',
    'You must respond ONLY with JSON.',
    'The JSON must have the shape:',
    '{',
    '  "candidates": [',
    '    {',
    '      "type": "follow_up_question" | "observation" | "contradiction" | "knowledge_gap" | "knowledge_transfer_risk",',
    '      "content": "the suggestion in one precise sentence",',
    '      "reasoningSummary": "why CGT thinks this, naming people and process elements, no fabricated detail",',
    '      "confidence": 0.0 to 1.0,',
    '      "evidence": [ { "transcriptId": "...", "utteranceIds": ["..."], "role": "context" | "supporting" | "contradicting" } ],',
    '      "relatedHypothesisIds": []',
    '    }',
    '  ]',
    '}',
    '',
    'Candidate types and when to use each:',
    ...CANDIDATE_TYPES.map((type) => `- ${type}: ${TYPE_GUIDANCE[type]}`),
    '',
    'Rules:',
    '- Every candidate MUST reference real utterance IDs verbatim from the transcripts provided. Use "transcriptId" + "utteranceIds" exactly as given. Never write your own transcript text.',
    '- Cite the fewest utterances that support the insight; prefer the current interview.',
    '- Prefer: "Hypothesis H12: ... Supporting: O8, O19. Contradicting: O27." over prose novel.',
    '- A contradictory/complicating candidate should reference both the current utterance and the earlier evidence it conflicts with.',
    '- If nothing is worth flagging, return {"candidates": []}. Returning zero candidates is a valid, desirable answer.',
    '',
    'You cannot mark anything as fact. You produce candidates for a human to review.',
  ].filter((line) => line !== undefined).join('\n')
}

const SPEAKER_LABEL_MAX = 240

export function buildUserPrompt(input: ProjectContextInput): string {
  const parts: string[] = []

  parts.push(`# Project: ${input.project.name}`)
  parts.push(`Status: ${input.project.status}`)
  if (input.project.description) parts.push(`Description: ${input.project.description}`)
  parts.push('')

  if (input.inquiryFocus) {
    parts.push(`## Research focus (set by the interviewer):`)
    parts.push(input.inquiryFocus)
    parts.push('')
  }

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
      const tag = transcript.isCurrent ? 'CURRENT INTERVIEW (analyze this)' : 'earlier interview'
      parts.push(`### Transcript ${transcript.id} (${tag}) — ${transcript.title || 'untitled'}`)
      for (const utterance of transcript.utterances) {
        const label = resolveSpeakerLabel(transcript.id, utterance.speakerKey, input.speakerMaps)
        const text = utterance.text.length > SPEAKER_LABEL_MAX ? `${utterance.text.slice(0, SPEAKER_LABEL_MAX)}…` : utterance.text
        parts.push(`[${utterance.id}] ${label}: ${text}`)
      }
      parts.push('')
    }
  }

  if (input.observations.length > 0) {
    parts.push('## Accepted observations (human-reviewed evidence)')
    for (const observation of input.observations) {
      const line = `O${observation.id.slice(0, 8)} (transcript ${observation.transcriptId}) [confidence ${observation.confidence}]: ${observation.statement}`
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

  parts.push('## Instructions')
  parts.push('Return your structured JSON. Use only utterance IDs present above and only transcript IDs present above. If the interview added nothing worth knowing, return {"candidates":[]}.')

  return parts.join('\n')
}

function resolveSpeakerLabel(transcriptId: string, speakerKey: string, speakerMaps: SpeakerMap[]): string {
  const match = speakerMaps.find((map) => map.transcriptId === transcriptId && map.providerSpeakerKey === speakerKey)
  return match?.personName ? match.personName : speakerKey
}