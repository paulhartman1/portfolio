import Link from 'next/link'
import { getPortalContext } from './_lib'

function formatHumanDate(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  const [{ data: comments }, { data: approvals }, { data: updates }] = await Promise.all([
    supabase
      .from('review_comments')
      .select('status')
      .eq('project_id', project.id),
    supabase
      .from('project_approvals')
      .select('id, title, status, due_at')
      .eq('project_id', project.id)
      .order('due_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('project_updates')
      .select('id, title, body, created_at')
      .eq('project_id', project.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const openComments = comments?.filter((c) => c.status !== 'resolved').length ?? 0
  const pendingApprovals = (approvals || []).filter((a) => a.status === 'pending')
  const pendingApproval = pendingApprovals[0]
  const recentForClient = (updates || []).slice(0, 3)

  // Current focus comes from projects.description when set. Do not invent from latest activity.
  const currentFocus = project.description?.trim() || ''
  const hasCurrentWorkSource = Boolean(currentFocus)

  // Fetch actionable proposals (status = 'sent')
  const { data: actionableProposals } = await supabase
    .from('proposals')
    .select(`
      id,
      title,
      current_version:proposal_versions!current_version_id(
        presentation_route
      )
    `)
    .eq('project_id', project.id)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false, nullsFirst: false })

  const showWorkingSite = Boolean(project.url)
  const showReviewFeedback = openComments > 0
  const hasActionableProposal = (actionableProposals?.length ?? 0) > 0
  const needsClientAction = Boolean(pendingApproval) || hasActionableProposal
  const hasContextualActions = showWorkingSite || showReviewFeedback

  const contextualLink =
    'text-sm font-medium text-[#290D47] underline underline-offset-2 hover:opacity-80'

  return (
    <div className="max-w-2xl space-y-10">
      {/* Attention: dominant only when action is required */}
      {needsClientAction ? (
        <section className="rounded-xl border border-[#290D47]/15 bg-white px-5 py-6 sm:px-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6785]">
            Action needed
          </p>
          
          {/* Pending approval takes priority */}
          {pendingApproval ? (
            <>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1A0F2E] sm:text-3xl">
                {pendingApproval.title}
              </h2>
              <p className="mt-3 text-base text-[#1A0F2E]/90 leading-relaxed">
                We need your decision before this part of our work can move forward
                {pendingApprovals.length > 1
                  ? ` (${pendingApprovals.length} decisions waiting).`
                  : '.'}
              </p>
              {pendingApproval.due_at && (
                <p className="mt-2 text-sm text-[#6B6785]">
                  Due {formatHumanDate(pendingApproval.due_at)}
                </p>
              )}
              <Link
                href={`/portal/${subdomain}/approvals`}
                className="mt-5 inline-flex px-5 py-3 rounded-lg bg-[#00F5E4] text-[#1A0F2E] text-sm font-semibold hover:opacity-90"
              >
                Review decision{pendingApprovals.length > 1 ? 's' : ''}
              </Link>
            </>
          ) : hasActionableProposal && actionableProposals ? (
            /* Actionable proposal when no pending approval */
            <>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1A0F2E] sm:text-3xl">
                {actionableProposals.length > 1
                  ? 'Review proposals'
                  : actionableProposals[0].title
                }
              </h2>
              <p className="mt-3 text-base text-[#1A0F2E]/90 leading-relaxed">
                {actionableProposals.length > 1
                  ? `You have ${actionableProposals.length} proposals awaiting your review.`
                  : 'Please review the proposal and let us know if you have questions or would like to proceed.'
                }
              </p>
              {actionableProposals.map(proposal => {
                const version = Array.isArray(proposal.current_version) 
                  ? proposal.current_version[0] 
                  : proposal.current_version
                return (
                  <Link
                    key={proposal.id}
                    href={`/portal/${subdomain}/proposal/${version?.presentation_route ?? ''}`}
                    className="mt-5 inline-flex px-5 py-3 rounded-lg bg-[#00F5E4] text-[#1A0F2E] text-sm font-semibold hover:opacity-90"
                  >
                    {actionableProposals.length > 1
                      ? `Review: ${proposal.title}`
                      : 'Review proposal'
                    }
                  </Link>
                )
              })}
            </>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-[#6B6785]">
          <span className="text-[#290D47]" aria-hidden="true">
            ✓
          </span>{' '}
          You&apos;re caught up
        </p>
      )}

      {/* Primary orientation: current focus + next + related actions */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-[#1A0F2E] sm:text-2xl">
          Current focus
        </h2>

        {hasCurrentWorkSource ? (
          <p className="mt-3 text-base text-[#1A0F2E] leading-relaxed">{currentFocus}</p>
        ) : (
          <p className="mt-3 text-base text-[#6B6785] leading-relaxed">
            We&apos;ll describe what we&apos;re working on together here when it&apos;s set.
          </p>
        )}

        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6B6785]">Next</h3>
          {needsClientAction && pendingApproval ? (
            <p className="mt-2 text-base text-[#1A0F2E] leading-relaxed">
              Your decision on &ldquo;{pendingApproval.title}&rdquo;. After that, we&apos;ll name the
              following step here.
            </p>
          ) : (
            <p className="mt-2 text-base text-[#6B6785] leading-relaxed">
              We&apos;ll post the next milestone or touchpoint when it&apos;s clear.
            </p>
          )}
        </div>

        {hasContextualActions && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
            {showWorkingSite && project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className={contextualLink}
              >
                Open working site
              </a>
            )}
            {showReviewFeedback && (
              <Link href={`/portal/${subdomain}/preview`} className={contextualLink}>
                Review feedback ({openComments} open)
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Secondary: recent feed */}
      <section className="border-t border-[#E8E4EF] pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785]">
            Recent
          </h2>
          <Link
            href={`/portal/${subdomain}/updates`}
            className="text-xs font-medium text-[#6B6785] underline underline-offset-2 hover:text-[#290D47]"
          >
            Full activity
          </Link>
        </div>

        {recentForClient.length > 0 ? (
          <ul className="mt-4 divide-y divide-[#E8E4EF]">
            {recentForClient.map((update) => (
              <li key={update.id} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-[#1A0F2E]">
                    {update.title || 'Update'}
                  </p>
                  <time
                    dateTime={update.created_at}
                    className="text-xs text-[#6B6785] shrink-0"
                  >
                    {formatHumanDate(update.created_at)}
                  </time>
                </div>
                {update.body && (
                  <p className="mt-1 text-sm text-[#6B6785] line-clamp-2 leading-relaxed">
                    {update.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[#6B6785]">No activity posted yet.</p>
        )}
      </section>
    </div>
  )
}
