import { getPortalContext } from '../_lib'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  const { data: comments } = await supabase
    .from('review_comments')
    .select('id, url, comment_text, priority, status, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-6">
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-2">Preview Site</h2>
        <p className="text-white/75 text-sm mb-4">
          Browse your website build, then leave focused feedback with a page path.
        </p>
        {project.url ? (
          <div className="bg-white rounded-lg overflow-hidden" style={{ height: '70vh' }}>
            <iframe src={project.url} className="w-full h-full" title={project.name} />
          </div>
        ) : (
          <div className="bg-white/5 border border-white/20 rounded-lg p-10 text-center">
            <p className="text-white/75">Preview URL is not configured yet.</p>
          </div>
        )}
      </section>

      <aside className="space-y-6">
        <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Leave Feedback</h3>
          <form action="/api/portal/comments" method="POST" className="space-y-3">
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="subdomain" value={subdomain} />
            <div>
              <label className="block text-white/80 text-sm mb-1">Page path</label>
              <input
                name="url"
                defaultValue="/"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-1">Priority</label>
              <select
                name="priority"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900"
                defaultValue="medium"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-1">Comment</label>
              <textarea
                name="comment_text"
                required
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                placeholder="Example: On mobile, this hero copy feels too long."
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold"
            >
              Submit feedback
            </button>
          </form>
        </section>

        <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Recent Feedback</h3>
          <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
            {(comments || []).map((comment) => (
              <div key={comment.id} className="bg-white/5 border border-white/20 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-white/80 text-xs uppercase">{comment.priority}</p>
                  <p className="text-white/70 text-xs uppercase">{comment.status}</p>
                </div>
                <p className="text-white/75 text-xs">{comment.url}</p>
                <p className="text-white text-sm mt-1">{comment.comment_text}</p>
                <p className="text-white/60 text-xs mt-2">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {!comments?.length && <p className="text-white/70 text-sm">No comments yet.</p>}
          </div>
        </section>
      </aside>
    </div>
  )
}
