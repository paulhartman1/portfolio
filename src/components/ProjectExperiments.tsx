'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import { slugify, uniqueSlug } from '@/lib/experiments/slug'
import {
  Experiment,
  STATUS_LABELS,
  statusBadgeClasses,
} from '@/lib/experiments/types'

type ExperimentRow = Pick<
  Experiment,
  'id' | 'code' | 'title' | 'status' | 'primary_question' | 'created_at'
>

export default function ProjectExperiments({
  projectId,
}: {
  projectId: string
}) {
  const [experiments, setExperiments] = useState<ExperimentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [question, setQuestion] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabaseBrowser
      .from('experiments')
      .select('id, code, title, status, primary_question, created_at')
      .eq('project_id', projectId)
      .order('experiment_number', { ascending: true })

    if (error) {
      console.error('Error loading experiments:', error)
      setError('Could not load experiments.')
    } else {
      setExperiments((data as ExperimentRow[]) || [])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  async function createExperiment() {
    if (!title.trim() && !question.trim()) return
    setCreating(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser()

      // Ensure a unique slug within the project.
      const { data: existingRows } = await supabaseBrowser
        .from('experiments')
        .select('slug')
        .eq('project_id', projectId)
      const existing = (existingRows || []).map((r) => r.slug as string)
      const base = slugify(title.trim() || question.trim())
      const slug = uniqueSlug(base, existing)

      const finalTitle =
        title.trim() || question.trim().replace(/\?+$/, '').slice(0, 80)

      const { data, error } = await supabaseBrowser
        .from('experiments')
        .insert({
          project_id: projectId,
          title: finalTitle,
          slug,
          primary_question: question.trim() || null,
          status: 'draft',
          created_by: user?.id ?? null,
          owner_id: user?.id ?? null,
        })
        .select('id')
        .single()

      if (error) throw error

      // Land the operator directly in the inquiry, not a list.
      window.location.href = `/admin/experiments/${data.id}`
    } catch (err) {
      console.error('Error creating experiment:', err)
      setError(err instanceof Error ? err.message : 'Failed to create experiment')
      setCreating(false)
    }
  }

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1A0F2E]">Experiments</h2>
          <p className="text-[#6B6785] text-sm">
            What are we trying to learn on this engagement?
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="px-4 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] text-sm font-semibold hover:opacity-90"
        >
          + New Experiment
        </button>
      </div>

      {showNew && (
        <div className="mb-5 rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] p-4">
          <label className="block text-sm font-medium text-[#1A0F2E] mb-1">
            What are we trying to learn?
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            autoFocus
            placeholder="e.g. Can an AI agent obtain sufficient implementation context to reason about the system while staying within a safe boundary?"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785] resize-none focus:outline-none focus:border-[#290D47]"
          />
          <label className="block text-sm font-medium text-[#1A0F2E] mt-3 mb-1">
            Short title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="AI Access to Implementation Context"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785] focus:outline-none focus:border-[#290D47]"
          />
          <p className="text-[#6B6785] text-xs mt-2">
            Start with the question. You&apos;ll develop the hypothesis, method,
            evidence, and decision rule on the next screen.
          </p>
          {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowNew(false)
                setQuestion('')
                setTitle('')
                setError('')
              }}
              className="px-4 py-2 rounded-lg border border-[#E8E4EF] text-[#6B6785] text-sm hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={createExperiment}
              disabled={creating || (!title.trim() && !question.trim())}
              className="px-4 py-2 rounded-lg bg-[#290D47] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Start experiment'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[#6B6785] text-sm py-4">Loading experiments...</p>
      ) : experiments.length === 0 ? (
        <p className="text-[#6B6785] text-sm py-4">
          No experiments yet. Frame the first thing you want to learn.
        </p>
      ) : (
        <div className="space-y-2">
          {experiments.map((exp) => (
            <Link
              key={exp.id}
              href={`/admin/experiments/${exp.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] px-4 py-3 hover:border-[#290D47]/30"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#6B6785]">
                    {exp.code}
                  </span>
                  <span className="font-semibold text-[#1A0F2E] truncate">
                    {exp.title}
                  </span>
                </div>
                {exp.primary_question && (
                  <p className="text-xs text-[#6B6785] truncate mt-0.5">
                    {exp.primary_question}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 px-2 py-1 rounded text-xs font-semibold uppercase border ${statusBadgeClasses(
                  exp.status
                )}`}
              >
                {STATUS_LABELS[exp.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
