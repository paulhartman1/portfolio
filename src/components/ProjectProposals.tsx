'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import { slugify, uniqueSlug } from '@/lib/experiments/slug'
import {
  Proposal,
  ProposalKind,
  PROPOSAL_KINDS,
  PROPOSAL_KIND_LABELS,
  PROPOSAL_STATUS_LABELS,
  proposalStatusBadgeClasses,
} from '@/lib/proposals/types'

type ProposalRow = Pick<
  Proposal,
  'id' | 'code' | 'title' | 'kind' | 'status'
>

export default function ProjectProposals({ projectId }: { projectId: string }) {
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ProposalKind>('execution')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabaseBrowser
      .from('proposals')
      .select('id, code, title, kind, status')
      .eq('project_id', projectId)
      .order('proposal_number', { ascending: true })
    if (error) {
      console.error('Error loading proposals:', error)
      setError('Could not load proposals.')
    } else {
      setProposals((data as ProposalRow[]) || [])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  async function createProposal() {
    if (!title.trim()) return
    setCreating(true)
    setError('')
    try {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser()

      const { data: existingRows } = await supabaseBrowser
        .from('proposals')
        .select('slug')
        .eq('project_id', projectId)
      const existing = (existingRows || []).map((r) => r.slug as string)
      const slug = uniqueSlug(slugify(title.trim()), existing)

      const { data, error } = await supabaseBrowser
        .from('proposals')
        .insert({
          project_id: projectId,
          title: title.trim(),
          slug,
          kind,
          status: 'draft',
          owner_id: user?.id ?? null,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single()

      if (error) throw error
      window.location.href = `/admin/proposals/${data.id}`
    } catch (err) {
      console.error('Error creating proposal:', err)
      setError(err instanceof Error ? err.message : 'Failed to create proposal')
      setCreating(false)
    }
  }

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1A0F2E]">Proposals</h2>
          <p className="text-[#6B6785] text-sm">
            What work are we asking the client to authorize?
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="px-4 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] text-sm font-semibold hover:opacity-90"
        >
          + New Proposal
        </button>
      </div>

      {showNew && (
        <div className="mb-5 rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] p-4">
          <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="Discovery engagement — Q3"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785] focus:outline-none focus:border-[#290D47]"
          />
          <label className="block text-sm font-medium text-[#1A0F2E] mt-3 mb-1">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProposalKind)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
          >
            {PROPOSAL_KINDS.map((k) => (
              <option key={k} value={k}>{PROPOSAL_KIND_LABELS[k]}</option>
            ))}
          </select>
          <p className="text-[#6B6785] text-xs mt-2">
            Execution = agreed work. Experiment/Program = authorize one or more
            inquiries. You can link experiments on the next screen.
          </p>
          {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowNew(false)
                setTitle('')
                setError('')
              }}
              className="px-4 py-2 rounded-lg border border-[#E8E4EF] text-[#6B6785] text-sm hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={createProposal}
              disabled={creating || !title.trim()}
              className="px-4 py-2 rounded-lg bg-[#290D47] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create proposal'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[#6B6785] text-sm py-4">Loading proposals...</p>
      ) : proposals.length === 0 ? (
        <p className="text-[#6B6785] text-sm py-4">No proposals yet.</p>
      ) : (
        <div className="space-y-2">
          {proposals.map((p) => (
            <Link
              key={p.id}
              href={`/admin/proposals/${p.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] px-4 py-3 hover:border-[#290D47]/30"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#6B6785]">{p.code}</span>
                  <span className="font-semibold text-[#1A0F2E] truncate">{p.title}</span>
                </div>
                <span className="text-xs text-[#6B6785] capitalize">{PROPOSAL_KIND_LABELS[p.kind]}</span>
              </div>
              <span
                className={`shrink-0 px-2 py-1 rounded text-xs font-semibold uppercase border ${proposalStatusBadgeClasses(
                  p.status
                )}`}
              >
                {PROPOSAL_STATUS_LABELS[p.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
