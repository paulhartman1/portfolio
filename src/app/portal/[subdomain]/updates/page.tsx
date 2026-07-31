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
    <div className="space-y-6">
      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white">Activity</h2>
        <p className="text-white/75 mt-2">
          A chronological record of our engagement — milestones, notes from CGT, and other history.
          For conversation, use Messages. For choices that need a yes/no or sign-off, use Decisions.
        </p>
      </section>

      <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Timeline</h3>
        <div className="space-y-4">
          {(updates || []).map((update) => (
            <article key={update.id} className="bg-white/5 border border-white/20 rounded-xl p-4">
              <div className="flex gap-2 flex-wrap mb-2">
                {update.author_role && update.author_role !== 'github' && (
                  <span className="px-2 py-1 rounded bg-white/15 text-white/90 text-xs uppercase">
                    {update.author_role}
                  </span>
                )}
                {update.requires_client_action && (
                  <span className="px-2 py-1 rounded bg-amber-500/30 text-amber-100 text-xs uppercase">
                    Related to a decision
                  </span>
                )}
              </div>
              <p className="text-white font-medium">{update.title || 'Update'}</p>
              <p className="text-white/85 text-sm mt-1 whitespace-pre-wrap">{update.body}</p>
              <p className="text-white/60 text-xs mt-3">
                {new Date(update.created_at).toLocaleString()}
              </p>
            </article>
          ))}
          {!updates?.length && (
            <p className="text-white/70 text-sm">No activity yet. We&apos;ll post updates here as work progresses.</p>
          )}
        </div>
      </section>
    </div>
  )
}
