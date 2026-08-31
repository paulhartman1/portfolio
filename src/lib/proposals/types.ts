// Shared Proposal domain types and constants.
//
// A Proposal authorizes work. It may authorize agreed execution (0
// experiments), a single inquiry (1 experiment), or a program of inquiries
// (N experiments). The Proposal is NOT the Experiment: experiments endure;
// proposals record what was presented and authorized. The relationship is
// many-to-many via proposal_experiments.

export const PROPOSAL_STATUSES = ['draft', 'sent', 'accepted', 'declined'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_KINDS = ['execution', 'experiment', 'program'] as const
export type ProposalKind = (typeof PROPOSAL_KINDS)[number]

export interface Proposal {
  id: string
  project_id: string
  proposal_number: number
  code: string
  slug: string
  title: string
  kind: ProposalKind
  status: ProposalStatus
  owner_id: string | null
  amount: number | null
  currency: string
  timeline: string | null
  terms: string | null
  current_version_id: string | null
  accepted_version_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
  accepted_at: string | null
  declined_at: string | null
}

export interface ProposalVersion {
  id: string
  proposal_id: string
  version_number: number
  presentation_route: string
  sent_at: string | null
  created_at: string
  created_by: string | null
}

export interface ProposalExperimentLink {
  id: string
  proposal_id: string
  experiment_id: string
  sort_order: number
  note: string | null
  created_at: string
}

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
}

export const PROPOSAL_KIND_LABELS: Record<ProposalKind, string> = {
  execution: 'Execution',
  experiment: 'Experiment',
  program: 'Program',
}

// Suggest a kind from the number of linked experiments. Explicitly overridable
// by the operator (an execution proposal may still cite an experiment).
export function suggestKind(experimentCount: number): ProposalKind {
  if (experimentCount >= 2) return 'program'
  if (experimentCount === 1) return 'experiment'
  return 'execution'
}

export function proposalStatusBadgeClasses(status: ProposalStatus): string {
  switch (status) {
    case 'accepted':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'sent':
      return 'bg-cyan-100 text-cyan-900 border-cyan-200'
    case 'declined':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export function formatAmount(amount: number | null, currency: string): string | null {
  if (amount == null) return null
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}
