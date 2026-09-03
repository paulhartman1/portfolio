'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import {
  DECISION_STATUSES,
  DECISION_STATUS_LABELS,
  DECISION_TYPES,
  DECISION_TYPE_LABELS,
  Decision,
  DecisionStatus,
  DecisionType,
  EXP003_QUALIFYING_DECISION_TYPES,
} from '@/lib/work/types'

/**
 * Durable decision records for one experiment.
 *
 * This is the substrate for answering "why did we decide that?" in a fresh
 * session. Three fields carry most of that weight and are therefore prompted
 * for explicitly rather than left optional in the UI:
 *   * rationale — a decision nobody can later justify is not reusable;
 *   * alternatives_considered — distinguishes a considered tradeoff from an
 *     unexamined default;
 *   * informed_by_view — the EXP-003 measure. It must be an honest claim, so
 *     it defaults to false and is only set deliberately.
 */

type PersonLite = { id: string; display_name: string }

const statusBadge: Record<DecisionStatus, string> = {
  tentative: 'bg-amber-100 text-amber-900 border-amber-300',
  active: 'bg-green-100 text-green-800 border-green-300',
  superseded: 'bg-neutral-100 text-neutral-500 border-neutral-300',
  reversed: 'bg-red-100 text-red-800 border-red-300',
}

export function DecisionsPanel({
  projectId,
  experimentId,
}: {
  projectId: string
  experimentId: string
}) {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [people, setPeople] = useState<PersonLite[]>([])
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [decisionsRes, peopleRes] = await Promise.all([
      supabaseBrowser
        .from('decisions')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('decision_number', { ascending: false }),
      supabaseBrowser.from('project_persons').select('persons(id, display_name)').eq('project_id', projectId),
    ])
    setDecisions((decisionsRes.data || []) as Decision[])
    setPeople(
      ((peopleRes.data || []) as Array<{ persons: PersonLite | PersonLite[] | null }>)
        .map((row) => (Array.isArray(row.persons) ? row.persons[0] : row.persons))
        .filter((p): p is PersonLite => Boolean(p))
    )
  }, [experimentId, projectId])

  useEffect(() => {
    void load()
  }, [load])

  const personName = (id: string | null) =>
    id ? people.find((p) => p.id === id)?.display_name || 'unknown person' : null

  async function patch(id: string, changes: Partial<Decision>) {
    const { error } = await supabaseBrowser.from('decisions').update(changes).eq('id', id)
    setNotice(error ? error.message : '')
    await load()
  }

  /**
   * Supersession is a two-sided change: the new decision points at the old
   * one, and the old one must actually become 'superseded'. Doing only the
   * first would leave two decisions both reading as active.
   */
  async function supersede(newer: Decision, olderId: string) {
    await supabaseBrowser.from('decisions').update({ supersedes_decision_id: olderId }).eq('id', newer.id)
    await supabaseBrowser.from('decisions').update({ status: 'superseded' }).eq('id', olderId)
    await load()
  }

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785]">
          Decisions ({decisions.length})
        </h3>
        <span className="text-xs text-[#6B6785]">
          {decisions.filter((d) => d.informed_by_view).length} informed by the shared view
        </span>
      </div>

      {notice && <p className="mb-2 text-xs text-red-700">{notice}</p>}

      {decisions.length === 0 ? (
        <p className="text-sm text-[#6B6785]">
          No decisions recorded. EXP-003 succeeds only if the view supports at least one real prioritization,
          sequencing, deferral, or WIP decision.
        </p>
      ) : (
        <ul className="space-y-2">
          {decisions.map((decision) => {
            const qualifies = EXP003_QUALIFYING_DECISION_TYPES.includes(decision.decision_type)
            const superseded = decisions.find((d) => d.id === decision.supersedes_decision_id)
            return (
              <li key={decision.id} className="rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-[#6B6785]">{decision.code}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusBadge[decision.status]}`}>
                    {DECISION_STATUS_LABELS[decision.status]}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-white border border-[#E8E4EF] text-[#6B6785]">
                    {DECISION_TYPE_LABELS[decision.decision_type]}
                  </span>
                  {decision.informed_by_view && qualifies && (
                    <span
                      className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800 border border-emerald-300"
                      title="Counts toward the EXP-003 success criterion"
                    >
                      counts for EXP-003
                    </span>
                  )}
                  {decision.informed_by_view && !qualifies && (
                    <span className="px-2 py-0.5 rounded text-xs bg-sky-50 text-sky-800 border border-sky-200">
                      informed by view
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-[#1A0F2E]">{decision.statement}</p>

                {decision.rationale ? (
                  <p className="mt-1 text-xs text-[#6B6785]">Because: {decision.rationale}</p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">
                    No rationale recorded — nobody will be able to justify this later.
                  </p>
                )}

                {decision.alternatives_considered && (
                  <p className="mt-1 text-xs text-[#6B6785]">
                    Rejected: {decision.alternatives_considered}
                  </p>
                )}

                <p className="mt-1 text-xs text-[#6B6785]">
                  {decision.decided_at.slice(0, 10)}
                  {personName(decision.decided_by_person_id) ? ` · ${personName(decision.decided_by_person_id)}` : ''}
                  {superseded ? ` · supersedes ${superseded.code}` : ''}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={decision.status}
                    onChange={(e) => void patch(decision.id, { status: e.target.value as DecisionStatus })}
                    className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
                  >
                    {DECISION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {DECISION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={decision.supersedes_decision_id || ''}
                    onChange={(e) => e.target.value && void supersede(decision, e.target.value)}
                    className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
                  >
                    <option value="">— supersedes… —</option>
                    {decisions
                      .filter((d) => d.id !== decision.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code}
                        </option>
                      ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-[#6B6785]">
                    <input
                      type="checkbox"
                      checked={decision.client_visible}
                      onChange={(e) => void patch(decision.id, { client_visible: e.target.checked })}
                    />
                    Client visible
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {open ? (
        <AddDecisionForm
          projectId={projectId}
          experimentId={experimentId}
          people={people}
          onDone={async () => {
            setOpen(false)
            await load()
          }}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 px-4 py-2 rounded-lg border border-[#290D47]/30 text-sm font-semibold text-[#290D47] hover:bg-[#F8F7F5]"
        >
          + Record decision
        </button>
      )}
    </section>
  )
}

function AddDecisionForm({
  projectId,
  experimentId,
  people,
  onDone,
  onCancel,
}: {
  projectId: string
  experimentId: string
  people: PersonLite[]
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [statement, setStatement] = useState('')
  const [rationale, setRationale] = useState('')
  const [alternatives, setAlternatives] = useState('')
  const [type, setType] = useState<DecisionType>('prioritization')
  const [status, setStatus] = useState<DecisionStatus>('active')
  const [decidedBy, setDecidedBy] = useState('')
  const [informedByView, setInformedByView] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!statement.trim()) return
    setBusy(true)
    setError('')
    const { error: insertError } = await supabaseBrowser.from('decisions').insert({
      project_id: projectId,
      experiment_id: experimentId,
      statement: statement.trim(),
      rationale: rationale.trim() || null,
      alternatives_considered: alternatives.trim() || null,
      decision_type: type,
      status,
      decided_by_person_id: decidedBy || null,
      informed_by_view: informedByView,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    await onDone()
  }

  return (
    <div className="mt-3 rounded-xl border border-[#E8E4EF] bg-white p-3 space-y-2">
      {error && <p className="text-xs text-red-700">{error}</p>}
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        rows={2}
        placeholder="What was decided?"
        className="w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm bg-white text-[#1A0F2E]"
      />
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="Why? (the reasoning a future reader will need)"
        className="w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm bg-white text-[#1A0F2E]"
      />
      <textarea
        value={alternatives}
        onChange={(e) => setAlternatives(e.target.value)}
        rows={2}
        placeholder="What else was considered and rejected?"
        className="w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm bg-white text-[#1A0F2E]"
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DecisionType)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          {DECISION_TYPES.map((t) => (
            <option key={t} value={t}>
              {DECISION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DecisionStatus)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          {DECISION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DECISION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={decidedBy}
          onChange={(e) => setDecidedBy(e.target.value)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          <option value="">— decided by —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs text-[#6B6785]">
        <input type="checkbox" checked={informedByView} onChange={(e) => setInformedByView(e.target.checked)} />
        The shared work inventory actually informed this decision
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 text-xs text-[#6B6785] hover:text-[#290D47]">
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={!statement.trim() || busy}
          className="px-4 py-1.5 rounded bg-[#290D47] text-white text-xs font-semibold disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Record decision'}
        </button>
      </div>
    </div>
  )
}
