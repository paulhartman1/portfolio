import { getPortalContext } from '../_lib'

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  const { data: updates } = await supabase
    .from('project_updates')
    .select('id, title, body, author_role, requires_client_action, created_at, commit_sha, commit_url')
    .eq('project_id', project.id)
    .eq('is_internal', false)
    .order('created_at', { ascending: false })

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 h-fit">
        <h2 className="text-xl font-semibold text-white mb-2">Send a note</h2>
        <p className="text-white/75 text-sm mb-4">
          Ask a question or share clarification without leaving the portal.
        </p>
        <form action="/api/portal/updates/create" method="POST" className="space-y-3">
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="subdomain" value={subdomain} />
          <div>
            <label className="block text-white/80 text-sm mb-1">Title (optional)</label>
            <input
              name="title"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              placeholder="Question about homepage CTA"
            />
          </div>
          <div>
            <label className="block text-white/80 text-sm mb-1">Message</label>
            <textarea
              name="body"
              rows={4}
              required
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              placeholder="Share your note here..."
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold"
          >
            Post note
          </button>
        </form>
      </section>

      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Project timeline</h3>
        <div className="space-y-4">
          {(updates || []).map((update) => (
            <article key={update.id} className="bg-white/5 border border-white/20 rounded-xl p-4">
              <div className="flex gap-2 flex-wrap mb-2">
                {update.author_role === 'github' ? (
                  <span className="px-2 py-1 rounded bg-slate-500/50 text-slate-100 text-xs uppercase font-semibold flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    GitHub
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded bg-white/15 text-white/90 text-xs uppercase">
                    {update.author_role}
                  </span>
                )}
                {update.requires_client_action && (
                  <span className="px-2 py-1 rounded bg-amber-500/30 text-amber-100 text-xs uppercase">
                    Action needed
                  </span>
                )}
              </div>
              <p className="text-white font-medium">{update.title || 'Project update'}</p>
              <p className="text-white/85 text-sm mt-1 whitespace-pre-wrap">{update.body}</p>
              {update.commit_url && (
                <a
                  href={update.commit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-200 hover:text-blue-100"
                >
                  View commit on GitHub
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              <p className="text-white/60 text-xs mt-3">
                {new Date(update.created_at).toLocaleString()}
              </p>
            </article>
          ))}
          {!updates?.length && (
            <p className="text-white/70 text-sm">No updates yet. We’ll post progress here.</p>
          )}
        </div>
      </section>
    </div>
  )
}
