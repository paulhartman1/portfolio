export const CANDIDATE_TYPES = [
  'follow_up_question',
  'observation',
  'contradiction',
  'knowledge_gap',
  'knowledge_transfer_risk',
  'action_item',
] as const

export type CandidateType = (typeof CANDIDATE_TYPES)[number]

export const EVIDENCE_ROLES = ['context', 'supporting', 'contradicting'] as const
export type EvidenceRole = (typeof EVIDENCE_ROLES)[number]

export type CandidateStatus = 'candidate' | 'accepted' | 'rejected'

export type EvidenceRef = {
  transcriptId: string
  utteranceIds: string[]
  role: EvidenceRole
}

export type AiCandidateInput = {
  type: CandidateType
  content: string
  reasoningSummary: string
  confidence: number
  evidence: EvidenceRef[]
  relatedHypothesisIds: string[]
}

export type CandidateEvidenceRow = {
  id: string
  candidate_id: string
  transcript_id: string
  utterance_ids: string[]
  role: EvidenceRole
  created_at: string
}

export type CandidateRow = {
  id: string
  project_id: string
  transcript_id: string
  type: CandidateType
  content: string
  reasoning_summary: string | null
  confidence: number | null
  provider: string
  model: string
  status: CandidateStatus
  accepted_observation_id: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  evidence: CandidateEvidenceRow[]
}

export const DEFAULT_OLLAMA_MODEL = 'qwen3:8b'
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'

/** Provider-agnostic chat message passed to any inference provider. */
export type ProviderMessage = { role: 'system' | 'user' | 'assistant'; content: string }