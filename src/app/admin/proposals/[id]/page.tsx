'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'
import {
  Proposal,
  ProposalKind,
  ProposalStatus,
  ProposalVersion,
  PROPOSAL_KINDS,
  PROPOSAL_KIND_LABELS,
  PROPOSAL_STATUS_LABELS,
  proposalStatusBadgeClasses,
  suggestKind,
} from '@/lib/proposals/types'

type ProjectLite = { id: string; name: string; subdomain: string | null }
type ExperimentLite = {
  id: string
  code: string
  title: string
  status: string
  slug: string
}
type LinkRow = { id: string; experiment_id: string }

export default function ProposalDetailPage() {
  const params = useParams()
  const proposalId = params.id as string

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [project, setProject] = useState<ProjectLite | null>(null)
  const [versions, setVersions] = useState<ProposalVersion[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])
  const [projectExperiments, setProjectExperiments] = useState<ExperimentLite[]>([])

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Editable fields.
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ProposalKind>('execution')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('usd')
  const [timeline, setTimeline] = useState('')
  const [terms, setTerms] = useState('')
  const [newRoute, setNewRoute] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    const { data: prop, error } = await supabaseBrowser
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single<Proposal>()

    if (error || !prop) {
      console.error('Error loading proposal:', error)
      setLoadState('error')
      return
    }
    setProposal(prop)
    setTitle(prop.title)
    setKind(prop.kind)
    setAmount(prop.amount != null ? String(prop.amount) : '')
    setCurrency(prop.currency || 'usd')
    setTimeline(prop.timeline || '')
    setTerms(prop.terms || '')

    const [{ data: proj }, { data: vers }, { data: lnk }, { data: exps }] = await Promise.all([
      supabaseBrowser.from('projects').select('id, name, subdomain').eq('id', prop.project_id).single(),
      supabaseBrowser.from('proposal_versions').select('*').eq('proposal_id', proposalId).order('version_number'),
      supabaseBrowser.from('proposal_experiments').select('id, experiment_id').eq('proposal_id', proposalId),
      supabaseBrowser
        .from('experiments')
        .select('id, code, title, status, slug')
        .eq('project_id', prop.project_id)
        .order('experiment_number'),
    ])

    setProject((proj as ProjectLite) || null)
    setVersions((vers as ProposalVersion[]) || [])
    setLinks((lnk as LinkRow[]) || [])
    setProjectExperiments((exps as ExperimentLite[]) || [])
    setLoadState('ready')
  }, [proposalId])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!proposal) return
    setSaving(true)
    setNotice('')
    const parsedAmount = amount.trim() === '' ? null : Number(amount)
    if (parsedAmount != null && Number.isNaN(parsedAmount)) {
      setNotice('Amount must be a number.')
      setSaving(false)
      return
    }
    const update = {
      title: title.trim(),
      kind,
      amount: parsedAmount,
      currency: currency.trim() || 'usd',
      timeline: timeline.trim() || null,
      terms: terms.trim() || null,
    }
    const { error } = await supabaseBrowser.from('proposals').update(update).eq('id', proposal.id)
    if (error) {
      setNotice(error.message)
    } else {
      setNotice('Saved.')
      setProposal({ ...proposal, ...update } as Proposal)
    }
    setSaving(false)
  }

  async function addVersion() {
    if (!proposal) return
    const nextNumber = (versions[versions.length - 1]?.version_number ?? 0) + 1
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser()

    // Insert first with a placeholder route so we get a version id back,
    // then patch the route to point at the generic renderer (or the
    // admin-provided override for bespoke/experiment pages).
    const { data, error } = await supabaseBrowser
      .from('proposal_versions')
      .insert({
        proposal_id: proposal.id,
        version_number: nextNumber,
        presentation_route: 'pending',
        created_by: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) {
      alert('Could not add version: ' + error.message)
      return
    }

    const finalRoute = newRoute.trim() || `version/${data.id}`
    const { error: routeError } = await supabaseBrowser
      .from('proposal_versions')
      .update({ presentation_route: finalRoute })
      .eq('id', data.id)
    if (routeError) {
      alert('Could not finalize version route: ' + routeError.message)
      return
    }
    const finalizedVersion = { ...data, presentation_route: finalRoute } as ProposalVersion

    // Newest version becomes current.
    await supabaseBrowser
      .from('proposals')
      .update({ current_version_id: finalizedVersion.id })
      .eq('id', proposal.id)
    setVersions([...versions, finalizedVersion])
    setProposal({ ...proposal, current_version_id: finalizedVersion.id })
    setNewRoute('')
  }

  async function setCurrentVersion(versionId: string) {
    if (!proposal) return
    const { error } = await supabaseBrowser
      .from('proposals')
      .update({ current_version_id: versionId })
      .eq('id', proposal.id)
    if (error) {
      alert(error.message)
      return
    }
    setProposal({ ...proposal, current_version_id: versionId })
  }

  async function updateStatus(newStatus: ProposalStatus) {
    if (!proposal) return
    if (newStatus === 'sent' && !proposal.current_version_id) {
      alert('Add a version (presentation) before sending.')
      return
    }
    const now = new Date().toISOString()
    const patch: Partial<Proposal> = { status: newStatus }
    if (newStatus === 'sent' && !proposal.sent_at) patch.sent_at = now
    if (newStatus === 'draft' && proposal.status === 'sent') patch.sent_at = null
    if (newStatus === 'accepted') {
      patch.accepted_at = now
      patch.accepted_version_id = proposal.current_version_id
    }
    if (newStatus === 'declined') patch.declined_at = now

    const { error } = await supabaseBrowser.from('proposals').update(patch).eq('id', proposal.id)
    if (error) {
      alert(error.message)
      return
    }
    setProposal({ ...proposal, ...patch })
  }

  async function toggleExperiment(exp: ExperimentLite) {
    if (!proposal) return
    const existing = links.find((l) => l.experiment_id === exp.id)
    if (existing) {
      const { error } = await supabaseBrowser.from('proposal_experiments').delete().eq('id', existing.id)
      if (error) {
        alert(error.message)
        return
      }
      setLinks(links.filter((l) => l.id !== existing.id))
    } else {
      const { data, error } = await supabaseBrowser
        .from('proposal_experiments')
        .insert({ proposal_id: proposal.id, experiment_id: exp.id, sort_order: links.length })
        .select('id, experiment_id')
        .single()
      if (error) {
        alert(error.message)
        return
      }
      setLinks([...links, data as LinkRow])
    }
  }

  if (loadState === 'loading') {
    return <div className="text-[#6B6785] text-center py-12">Loading proposal...</div>
  }
  if (loadState === 'error' || !proposal) {
    return (
      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#1A0F2E] mb-2">Proposal not found</h1>
        <Link href="/admin/projects" className="text-[#290D47] hover:opacity-80">
          Back to projects
        </Link>
      </div>
    )
  }

  const linkedIds = new Set(links.map((l) => l.experiment_id))
  const suggested = suggestKind(links.length)

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link
          href={`/admin/projects/${proposal.project_id}`}
          className="text-[#6B6785] hover:text-[#290D47] text-sm"
        >
          ← Back to {project?.name || 'project'}
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="font-mono text-sm text-[#6B6785]">{proposal.code}</span>
          <h1 className="text-3xl font-bold text-[#1A0F2E]">{proposal.title}</h1>
          <span
            className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${proposalStatusBadgeClasses(
              proposal.status
            )}`}
          >
            {PROPOSAL_STATUS_LABELS[proposal.status]}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Details */}
          <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-[#1A0F2E]">Details</h2>
            <div>
              <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Kind</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ProposalKind)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
                >
                  {PROPOSAL_KINDS.map((k) => (
                    <option key={k} value={k}>{PROPOSAL_KIND_LABELS[k]}</option>
                  ))}
                </select>
                {suggested !== kind && (
                  <p className="text-xs text-[#6B6785] mt-1">
                    {links.length} experiment{links.length === 1 ? '' : 's'} linked — suggested:{' '}
                    <button className="underline" onClick={() => setKind(suggested)}>
                      {PROPOSAL_KIND_LABELS[suggested]}
                    </button>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Commercial terms */}
          <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-[#1A0F2E]">Commercial terms</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Amount</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="5000"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Currency</label>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Timeline</label>
                <input
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  placeholder="6 weeks"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Terms</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                placeholder="Payment schedule, scope boundaries, assumptions…"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm resize-y"
              />
            </div>
          </section>

          {/* Linked experiments */}
          <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#1A0F2E] mb-3">Experiments</h2>
            <p className="text-sm text-[#6B6785] mb-3">
              Which inquiries does this proposal authorize? (None = a pure
              execution proposal.)
            </p>
            {projectExperiments.length === 0 ? (
              <p className="text-sm text-[#6B6785]">No experiments on this project yet.</p>
            ) : (
              <ul className="space-y-2">
                {projectExperiments.map((exp) => {
                  const linked = linkedIds.has(exp.id)
                  return (
                    <li
                      key={exp.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#E8E4EF] bg-[#F8F7F5] px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-xs text-[#6B6785] mr-2">{exp.code}</span>
                        <span className="text-sm text-[#1A0F2E]">{exp.title}</span>
                        <span className="text-xs text-[#6B6785]"> · {exp.status}</span>
                      </span>
                      <button
                        onClick={() => toggleExperiment(exp)}
                        className={`text-xs font-semibold shrink-0 ${
                          linked ? 'text-red-600 hover:text-red-500' : 'text-[#290D47] hover:opacity-80'
                        }`}
                      >
                        {linked ? 'Unlink' : 'Link'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="sticky bottom-4 flex items-center justify-end gap-3 bg-white/80 backdrop-blur rounded-xl border border-[#E8E4EF] px-4 py-3">
            {notice && (
              <span className={`text-sm ${notice === 'Saved.' ? 'text-green-700' : 'text-red-700'}`}>
                {notice}
              </span>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785] mb-3">
              Lifecycle
            </h3>
            {proposal.status === 'draft' && (
              <button onClick={() => updateStatus('sent')} className="w-full px-4 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] text-sm font-semibold hover:opacity-90 mb-3">
                Send to client
              </button>
            )}
            {proposal.status === 'sent' && (
              <div className="space-y-2 mb-3">
                <button onClick={() => updateStatus('draft')} className="w-full px-4 py-2 rounded-lg bg-[#FFB400] text-[#1A0F2E] text-sm font-semibold hover:opacity-90">
                  Revert to draft
                </button>
                <button onClick={() => updateStatus('accepted')} className="w-full px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:opacity-90">
                  Mark Accepted
                </button>
                <button onClick={() => updateStatus('declined')} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:opacity-90">
                  Mark Declined
                </button>
              </div>
            )}
            {(proposal.status === 'accepted' || proposal.status === 'declined') && (
              <button onClick={() => updateStatus('sent')} className="w-full px-4 py-2 rounded-lg border border-[#E8E4EF] text-[#6B6785] text-sm hover:bg-[#F8F7F5] mb-3">
                Reopen (mark Sent)
              </button>
            )}
          </section>

          <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785] mb-3">
              Versions (presentation)
            </h3>
            {versions.length === 0 ? (
              <p className="text-sm text-[#6B6785] mb-3">No versions yet.</p>
            ) : (
              <ul className="space-y-2 mb-3">
                {versions.map((v) => (
                  <li key={v.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#1A0F2E]">v{v.version_number}</span>
                      {proposal.current_version_id === v.id ? (
                        <span className="text-xs text-green-700 font-semibold">current</span>
                      ) : (
                        <button onClick={() => setCurrentVersion(v.id)} className="text-xs text-[#290D47] hover:opacity-80">
                          Make current
                        </button>
                      )}
                    </div>
                    {project?.subdomain && (
                      <a
                        href={`/portal/${project.subdomain}/proposal/${v.presentation_route}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[#290D47] hover:opacity-80 text-xs break-all"
                      >
                        {v.presentation_route}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <label className="block text-xs text-[#6B6785] mb-1">
              Add version — custom route (optional)
            </label>
            <input
              value={newRoute}
              onChange={(e) => setNewRoute(e.target.value)}
              placeholder="Leave blank for standard proposal page"
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm mb-2"
            />
            <p className="text-[#6B6785] text-xs mb-2">
              Leave blank to use the standard proposal page (scope, pricing, linked
              experiments, and the Stripe deposit link — auto-generated). Only set a
              custom route to point at a bespoke page, e.g.{' '}
              <code>experiment/&lt;slug&gt;</code> or a hand-built folder name.
            </p>
            <button
              onClick={addVersion}
              className="w-full px-3 py-2 rounded-lg bg-[#290D47] text-white text-xs font-semibold hover:opacity-90"
            >
              Add version
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
