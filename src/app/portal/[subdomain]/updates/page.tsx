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
    .select('id, title, body, author_role, requires_client_action, created_at')
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
                <span className="px-2 py-1 rounded bg-white/15 text-white/90 text-xs uppercase">
                  {update.author_role}
                </span>
                {update.requires_client_action && (
                  <span className="px-2 py-1 rounded bg-amber-500/30 text-amber-100 text-xs uppercase">
                    Action needed
                  </span>
                )}
              </div>
              <p className="text-white font-medium">{update.title || 'Project update'}</p>
              <p className="text-white/85 text-sm mt-1 whitespace-pre-wrap">{update.body}</p>
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
