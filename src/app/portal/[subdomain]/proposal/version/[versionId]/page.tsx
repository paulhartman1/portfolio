import { notFound } from 'next/navigation'
import { getPortalContext } from '../../../_lib'
import StandardProposalContent from '@/components/proposals/StandardProposalContent'

type Experiment = {
  id: string
  code: string
  title: string
  slug: string
}

type Proposal = {
  id: string
  title: string
  amount: number
  timeline: string
  deposit_amount: number | null
  stripe_payment_link_url: string | null
  project_id: string
}

type VersionData = {
  id: string
  proposal_id: string
  proposals: Proposal
}

export default async function DynamicProposalPage({
  params,
}: {
  params: Promise<{ subdomain: string; versionId: string }>
}) {
  const { subdomain, versionId } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  // Fetch the specific version and its parent proposal
  const { data, error: versionError } = await supabase
    .from('proposal_versions')
    .select(`
      id,
      proposal_id,
      proposals:proposal_id (
        id,
        title,
        amount,
        timeline,
        deposit_amount,
        stripe_payment_link_url,
        project_id
      )
    `)
    .eq('id', versionId)
    .single()

  if (versionError || !data) {
    console.error('Error loading proposal version:', versionError)
    notFound()
  }

  // Cast the joined data to our defined type
  const version = data as unknown as VersionData
  const proposal = version.proposals

  // Security check: ensure the proposal belongs to the project in this subdomain
  if (proposal.project_id !== project.id) {
    notFound()
  }

  // Fetch linked experiments
  const { data: experimentLinks } = await supabase
    .from('proposal_experiments')
    .select(`
      experiment_id,
      experiments:experiment_id (
        id,
        code,
        title,
        slug
      )
    `)
    .eq('proposal_id', proposal.id)

  const experiments = (experimentLinks || [])
    .map((link: { experiments: Experiment | Experiment[] | null }) => {
      const exp = link.experiments
      return (Array.isArray(exp) ? exp[0] : exp) as Experiment
    })
    .filter((exp): exp is Experiment => Boolean(exp && exp.slug))

  return (
    <StandardProposalContent
      title={proposal.title}
      amount={Number(proposal.amount)}
      timeline={proposal.timeline}
      experiments={experiments}
      stripeUrl={proposal.stripe_payment_link_url}
      depositAmount={proposal.deposit_amount ? Number(proposal.deposit_amount) : null}
      subdomain={subdomain}
    />
  )
}
