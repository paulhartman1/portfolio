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

  if (!hasAccess) return null
  if (project.proposal_slug !== 'firehouse-2026') notFound()

  return <FirehouseProposalContent />
}
