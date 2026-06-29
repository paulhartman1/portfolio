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
      .select('id, title, body, created_at, author_role, commit_url')
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
          <a
            href={project.url || `https://${subdomain}.loveondev.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform"
          >
            Open Preview Site
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
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
                {update.author_role === 'github' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-500/50 text-slate-100 text-xs uppercase font-semibold mb-2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    GitHub
                  </span>
                )}
                <p className="text-white font-medium">{update.title || 'Studio update'}</p>
                <p className="text-white/80 text-sm mt-1 line-clamp-2">{update.body}</p>
                {update.commit_url && (
                  <a
                    href={update.commit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs text-blue-200 hover:text-blue-100"
                  >
                    View commit
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
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
