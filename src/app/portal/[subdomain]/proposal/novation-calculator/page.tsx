import { notFound } from 'next/navigation'
import { getPortalContext } from '../../_lib'
import RushNDushNovationProposalContent from './RushNDushNovationProposalContent'

export default async function NovationCalculatorProposalPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null
  if (project.proposal_slug !== 'novation-calculator') notFound()

  return <RushNDushNovationProposalContent />
}
