import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/recordings/_lib'

/**
 * POST /api/admin/experiments/[id]/propose
 *
 * Generates a client-facing Proposal for an Experiment using the existing
 * proposal infrastructure. The Proposal is NOT the Experiment: the Experiment
 * endures as the operational object; the Proposal records what was presented
 * for authorization.
 *
 * Effects:
 *  - creates a `proposals` row (experiment_id set, project_id = experiment's)
 *  - creates a `proposal_versions` row pointing at the dynamic experiment
 *    proposal renderer (presentation_route = `experiment/<slug>`)
 *  - marks the proposal `sent` so the client can see it (mirrors proposal RLS)
 *  - flips the experiment to `proposed` and stamps proposed_at
 *
 * Re-proposing an already-proposed experiment adds a new proposal version to
 * the existing proposal rather than overwriting the authorization trail.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const { supabase, user } = admin

  const { data: experiment, error: expError } = await supabase
    .from('experiments')
    .select('id, project_id, code, title, slug, status')
    .eq('id', id)
    .single()

  if (expError || !experiment) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  }

  const presentationRoute = `experiment/${experiment.slug}`
  const proposalTitle = `${experiment.code}: ${experiment.title}`

  // Reuse an existing proposal for this experiment if present; otherwise
  // create one. This preserves the authorization trail across revisions.
  const { data: existingProposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('experiment_id', experiment.id)
    .maybeSingle()

  let proposalId = existingProposal?.id as string | undefined

  if (!proposalId) {
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .insert({
        project_id: experiment.project_id,
        experiment_id: experiment.id,
        title: proposalTitle,
        status: 'draft',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (propError || !proposal) {
      return NextResponse.json(
        { error: propError?.message || 'Failed to create proposal' },
        { status: 500 }
      )
    }
    proposalId = proposal.id
  }

  // Next version number for this proposal.
  const { data: versions } = await supabase
    .from('proposal_versions')
    .select('version_number')
    .eq('proposal_id', proposalId)
    .order('version_number', { ascending: false })
    .limit(1)

  const nextVersion = (versions?.[0]?.version_number ?? 0) + 1
  const now = new Date().toISOString()

  const { data: version, error: versionError } = await supabase
    .from('proposal_versions')
    .insert({
      proposal_id: proposalId,
      version_number: nextVersion,
      presentation_route: presentationRoute,
      sent_at: now,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (versionError || !version) {
    return NextResponse.json(
      { error: versionError?.message || 'Failed to create proposal version' },
      { status: 500 }
    )
  }

  const { error: updateProposalError } = await supabase
    .from('proposals')
    .update({
      current_version_id: version.id,
      status: 'sent',
      sent_at: now,
    })
    .eq('id', proposalId)

  if (updateProposalError) {
    return NextResponse.json({ error: updateProposalError.message }, { status: 500 })
  }

  const experimentPatch: Record<string, unknown> = { status: 'proposed' }
  if (experiment.status === 'draft') experimentPatch.proposed_at = now

  const { error: updateExpError } = await supabase
    .from('experiments')
    .update(experimentPatch)
    .eq('id', experiment.id)

  if (updateExpError) {
    return NextResponse.json({ error: updateExpError.message }, { status: 500 })
  }

  return NextResponse.json({
    proposalId,
    versionId: version.id,
    presentationRoute,
    status: 'proposed',
  })
}
