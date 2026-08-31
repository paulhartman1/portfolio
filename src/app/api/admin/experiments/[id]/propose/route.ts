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

  // Reuse an existing single-experiment proposal for this experiment if
  // present; otherwise create one. This preserves the authorization trail
  // across revisions (new versions), rather than spawning duplicate proposals.
  const { data: existingLink } = await supabase
    .from('proposal_experiments')
    .select('proposal_id, proposal:proposals!inner(id, kind)')
    .eq('experiment_id', experiment.id)
    .limit(1)
    .maybeSingle()

  const existingProposal = existingLink?.proposal as
    | { id: string; kind: string }
    | { id: string; kind: string }[]
    | null
    | undefined
  const existingProposalResolved = Array.isArray(existingProposal)
    ? existingProposal[0]
    : existingProposal

  // Only auto-reuse a proposal that is itself experiment-shaped (not a program
  // or execution proposal that merely references this experiment).
  let proposalId =
    existingProposalResolved && existingProposalResolved.kind === 'experiment'
      ? existingProposalResolved.id
      : undefined

  if (!proposalId) {
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .insert({
        project_id: experiment.project_id,
        title: proposalTitle,
        kind: 'experiment',
        status: 'draft',
        owner_id: user.id,
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

    const { error: linkError } = await supabase
      .from('proposal_experiments')
      .insert({ proposal_id: proposalId, experiment_id: experiment.id })

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }
  }

  const now = new Date().toISOString()

  // presentation_route is globally unique (one route belongs to one
  // proposal). Our dynamic experiment route is deterministic
  // (`experiment/<slug>`) and always renders the experiment's CURRENT state
  // live — it is not a frozen snapshot the way a static proposal page is.
  // So re-proposing the same experiment (including after an admin manually
  // reverts status back to draft) must NOT attempt to mint a second version
  // with an identical route; it should reuse the existing one.
  const { data: existingVersion } = await supabase
    .from('proposal_versions')
    .select('id, version_number')
    .eq('proposal_id', proposalId)
    .eq('presentation_route', presentationRoute)
    .maybeSingle()

  let version = existingVersion as { id: string; version_number: number } | null

  if (!version) {
    const { data: versions } = await supabase
      .from('proposal_versions')
      .select('version_number')
      .eq('proposal_id', proposalId)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersion = (versions?.[0]?.version_number ?? 0) + 1

    const { data: created, error: versionError } = await supabase
      .from('proposal_versions')
      .insert({
        proposal_id: proposalId,
        version_number: nextVersion,
        presentation_route: presentationRoute,
        sent_at: now,
        created_by: user.id,
      })
      .select('id, version_number')
      .single()

    if (versionError || !created) {
      return NextResponse.json(
        { error: versionError?.message || 'Failed to create proposal version' },
        { status: 500 }
      )
    }
    version = created
  } else {
    // Re-sending the same presentation: refresh sent_at on the existing version.
    await supabase.from('proposal_versions').update({ sent_at: now }).eq('id', version.id)
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
