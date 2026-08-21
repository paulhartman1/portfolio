import { notFound } from 'next/navigation'
import { getPortalContext } from '../../_lib'
import AlpineProposalContent from './AlpineProposalContent'

export default async function AlpineCrfProposalPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  if (project.proposal_slug !== 'ai-assisted-crf-analysis') notFound()

  return <AlpineProposalContent />
}
