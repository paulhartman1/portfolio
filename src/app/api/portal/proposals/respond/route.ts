import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

/**
 * POST /api/portal/proposals/respond
 *
 * Client accepts or declines a sent proposal. Authorization is proven by
 * reading the proposal under the client's RLS session: the SELECT policy only
 * exposes `sent`/`accepted`/`declined` proposals on the client's own projects.
 * If (and only if) that read returns a `sent` proposal, we perform the state
 * change with the service-role client. This keeps clients with ZERO direct
 * write access to the proposals table while still letting them respond.
 * On acceptance we also advance any linked experiments proposed -> approved.
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const proposalId = String(formData.get('proposal_id') || '')
  const decision = String(formData.get('decision') || '')
  const subdomain = String(formData.get('subdomain') || '')
  const backTo = String(formData.get('back_to') || `/portal/${subdomain}`)

  const isAccept = decision === 'accepted'
  const isDecline = decision === 'declined'

  if (!proposalId || !subdomain || (!isAccept && !isDecline)) {
    return NextResponse.redirect(new URL(`/portal/${subdomain}`, request.url))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL(`/auth/login?redirect=${encodeURIComponent(backTo)}`, request.url)
    )
  }

  // Authorization gate: the client's RLS SELECT only exposes proposals on
  // their own projects, and only in sent/accepted/declined status. Requiring a
  // `sent` row here proves membership AND respondable state.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, current_version_id, status')
    .eq('id', proposalId)
    .maybeSingle()

  if (!proposal || proposal.status !== 'sent') {
    return NextResponse.redirect(new URL(backTo, request.url))
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status: decision }
  if (isAccept) {
    patch.accepted_at = now
    patch.accepted_version_id = proposal.current_version_id
  } else {
    patch.declined_at = now
  }

  const service = createServiceRoleClient()

  // Re-check status server-side to avoid a double-submit race, then mutate.
  const { data: updated, error } = await service
    .from('proposals')
    .update(patch)
    .eq('id', proposalId)
    .eq('status', 'sent')
    .select('id')

  if (error || !updated || updated.length === 0) {
    return NextResponse.redirect(new URL(backTo, request.url))
  }

  // On acceptance, advance linked experiments (draft/proposed -> approved).
  // "draft" is included because an experiment's status column can drift out
  // of sync with the proposal that authorizes it (e.g. manually reverted);
  // acceptance of the proposal is the authoritative signal either way.
  if (isAccept) {
    try {
      const { data: linkRows } = await service
        .from('proposal_experiments')
        .select('experiment_id')
        .eq('proposal_id', proposalId)
      const experimentIds = (linkRows || []).map((r) => r.experiment_id as string)
      if (experimentIds.length > 0) {
        await service
          .from('experiments')
          .update({ status: 'approved', approved_at: now })
          .in('id', experimentIds)
          .in('status', ['draft', 'proposed'])
      }
    } catch (e) {
      // Non-fatal: the proposal is accepted regardless; experiment advancement
      // can be retried by an admin.
      console.error('Failed to advance experiments after acceptance:', e)
    }
  }

  return NextResponse.redirect(new URL(backTo, request.url))
}
