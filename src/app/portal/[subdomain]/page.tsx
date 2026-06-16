import Link from 'next/link'
import { getPortalContext } from './_lib'

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
      .limit(3),
  ])

  const openComments = comments?.filter((c) => c.status !== 'resolved').length ?? 0
  const resolvedComments = comments?.filter((c) => c.status === 'resolved').length ?? 0
  const pendingApproval = approvals?.find((a) => a.status === 'pending')

  return (
    <div className="space-y-6">
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex flex-wrap justify-between gap-4 items-center">
          <div>
            <p className="text-white/70 text-sm mb-1">Project phase</p>
            <h2 className="text-2xl font-semibold text-white capitalize">{project.status}</h2>
            <p className="text-white/80 mt-2">
              {pendingApproval
                ? 'Your project is moving. We are waiting on your next approval.'
                : 'Your project is on track. No immediate action needed right now.'}
            </p>
          </div>
          <Link
            href={`/portal/${subdomain}/preview`}
            className="px-5 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform"
          >
            Open Preview
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <p className="text-white/70 text-sm">Open feedback</p>
          <p className="text-white text-3xl font-bold mt-1">{openComments}</p>
          <p className="text-white/70 text-sm mt-2">{resolvedComments} resolved comments</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <p className="text-white/70 text-sm">Approvals waiting</p>
          <p className="text-white text-3xl font-bold mt-1">
            {approvals?.filter((a) => a.status === 'pending').length ?? 0}
          </p>
          <p className="text-white/70 text-sm mt-2">Only decisions that require your input</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <p className="text-white/70 text-sm">Latest update</p>
          <p className="text-white text-sm mt-2 line-clamp-3">
            {updates?.[0]?.title || updates?.[0]?.body || 'No updates yet'}
          </p>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Action Required</h3>
          {pendingApproval ? (
            <div>
              <p className="text-white">{pendingApproval.title}</p>
              <p className="text-white/70 text-sm mt-1">
                Due:{' '}
                {pendingApproval.due_at
                  ? new Date(pendingApproval.due_at).toLocaleDateString()
                  : 'No deadline'}
              </p>
              <Link
                href={`/portal/${subdomain}/approvals`}
                className="inline-block mt-4 px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
              >
                Review approvals
              </Link>
            </div>
          ) : (
            <p className="text-white/80">You are all caught up. We’ll notify you when we need input.</p>
          )}
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Recent Updates</h3>
          <div className="space-y-3">
            {(updates || []).map((update) => (
              <div key={update.id} className="bg-white/5 border border-white/20 rounded-lg p-3">
                <p className="text-white font-medium">{update.title || 'Studio update'}</p>
                <p className="text-white/80 text-sm mt-1 line-clamp-2">{update.body}</p>
                <p className="text-white/60 text-xs mt-2">
                  {new Date(update.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <Link
            href={`/portal/${subdomain}/updates`}
            className="inline-block mt-4 text-white/90 hover:text-white underline text-sm"
          >
            View all updates
          </Link>
        </div>
      </section>
    </div>
  )
}
