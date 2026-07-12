import { notFound } from 'next/navigation'
import { getPortalContext } from '../../_lib'
import FirehouseProposalContent from './FirehouseProposalContent'

export default async function FirehouseProposalPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, hasAccess } = await getPortalContext(subdomain)

  // Layout handles access denial UI
  if (!hasAccess) return null
  
  // Verify this project uses this proposal
  if (project.proposal_slug !== 'firehouse-2026-v2') notFound()

  return <FirehouseProposalContent />
}
