import { getPortalContext } from '../_lib'

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  const { data: approvals } = await supabase
    .from('project_approvals')
    .select('id, title, details, status, due_at, responded_at, response_note')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  const pendingApprovals = approvals?.filter((a) => a.status === 'pending') || []
  const completedApprovals = approvals?.filter((a) => a.status !== 'pending') || []

  return (
    <div className="space-y-6">
      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-[#1A0F2E]">Decisions</h2>
        <p className="text-[#6B6785] mt-2">
          Structured choices that need your input. Approve or request changes so our work can move
          forward. Conversation belongs in Messages; this page is only for decisions with a clear
          state.
        </p>
      </section>

      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[#1A0F2E] mb-4">
          Waiting on you ({pendingApprovals.length})
        </h3>
        <div className="space-y-4">
          {pendingApprovals.map((approval) => (
            <div key={approval.id} className="bg-[#F8F7F5] border border-[#E8E4EF] rounded-xl p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-[#1A0F2E] font-semibold">{approval.title}</p>
                  {approval.details && (
                    <p className="text-[#6B6785] text-sm mt-1">{approval.details}</p>
                  )}
                  <p className="text-[#6B6785] text-xs mt-2">
                    Due:{' '}
                    {approval.due_at ? new Date(approval.due_at).toLocaleDateString() : 'No deadline'}
                  </p>
                </div>
              </div>
              <form action="/api/portal/approvals/respond" method="POST" className="mt-4 space-y-3">
                <input type="hidden" name="approval_id" value={approval.id} />
                <input type="hidden" name="subdomain" value={subdomain} />
                <textarea
                  name="response_note"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E]"
                  placeholder="Optional note"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approved"
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="changes_requested"
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700"
                  >
                    Request changes
                  </button>
                </div>
              </form>
            </div>
          ))}
          {!pendingApprovals.length && (
            <p className="text-[#6B6785]">No decisions are waiting on you right now.</p>
          )}
        </div>
      </section>

      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[#1A0F2E] mb-4">Decided</h3>
        <div className="space-y-3">
          {completedApprovals.map((approval) => (
            <div key={approval.id} className="bg-[#F8F7F5] border border-[#E8E4EF] rounded-xl p-4">
              <p className="text-[#1A0F2E] font-medium">{approval.title}</p>
              <p className="text-[#6B6785] text-sm mt-1 capitalize">
                Status: {approval.status.replace('_', ' ')}
              </p>
              {approval.response_note && (
                <p className="text-[#6B6785] text-sm mt-1">Note: {approval.response_note}</p>
              )}
              {approval.responded_at && (
                <p className="text-[#6B6785] text-xs mt-2">
                  {new Date(approval.responded_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
          {!completedApprovals.length && (
            <p className="text-[#6B6785]">No decisions recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
