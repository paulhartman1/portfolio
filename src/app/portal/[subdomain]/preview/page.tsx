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
    .select('id, url, comment_text, priority, status, created_at, x_position, y_position, viewport_width')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  const previewUrl = project.url || `https://${subdomain}.loveondev.com`
  const openComments = comments?.filter((c) => c.status !== 'resolved').length ?? 0
  const resolvedComments = comments?.filter((c) => c.status === 'resolved').length ?? 0

  return (
    <div className="space-y-6">
      {/* Preview Site Link */}
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold text-white mb-2">Preview Your Site</h2>
        <p className="text-white/80 mb-4">
          Visit your live preview site to browse naturally and leave feedback using the review widget.
          The widget lets you drop pins anywhere on any page to mark changes or issues.
        </p>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform"
        >
          Open {project.name} Site
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </section>

      {/* Feedback Stats */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <p className="text-white/70 text-sm">Open feedback</p>
          <p className="text-white text-3xl font-bold mt-1">{openComments}</p>
          <p className="text-white/70 text-sm mt-2">Items waiting for your review</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-5">
          <p className="text-white/70 text-sm">Resolved</p>
          <p className="text-white text-3xl font-bold mt-1">{resolvedComments}</p>
          <p className="text-white/70 text-sm mt-2">Completed feedback items</p>
        </div>
      </section>

      {/* Recent Comments */}
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Feedback</h3>
        {comments && comments.length > 0 ? (
          <div className="space-y-3">
            {comments.slice(0, 10).map((comment) => (
              <div key={comment.id} className="bg-white/5 border border-white/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                      comment.priority === 'high' ? 'bg-red-100 text-red-800' :
                      comment.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {comment.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                      comment.status === 'new' ? 'bg-blue-100 text-blue-800' :
                      comment.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {comment.status}
                    </span>
                  </div>
                  <p className="text-white/60 text-xs">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-white text-sm mb-2">{comment.comment_text}</p>
                <p className="text-white/60 text-xs">Page: {comment.url}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/70 text-sm">
            No feedback yet. Visit your site and use the review widget (💬 button) to leave comments.
          </p>
        )}
      </section>
    </div>
  )
}
