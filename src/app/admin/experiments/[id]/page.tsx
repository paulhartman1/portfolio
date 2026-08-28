'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'
import {
  Confidence,
  Experiment,
  ExperimentCondition,
  ExperimentFinding,
  ExperimentLink,
  EXPERIMENT_RELATIONS,
  EXPERIMENT_STATUSES,
  ExperimentRelation,
  ExperimentStatus,
  RELATION_LABELS,
  STATUS_LABELS,
  statusBadgeClasses,
} from '@/lib/experiments/types'

type ProjectLite = { id: string; name: string; subdomain: string | null }

type SessionRow = {
  id: string
  title: string
  session_type: string
  experiment_id: string | null
  created_at: string
}

type ObservationRow = {
  id: string
  statement: string
  confidence: string
  transcript_id: string
  experiment_id: string | null
}

type ProposalRow = {
  id: string
  title: string
  status: string
  current_version: { presentation_route: string } | { presentation_route: string }[] | null
}

// Loose design fields stored inside experiments.design (JSON).
const DESIGN_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'measures', label: 'Measures', placeholder: 'What will we measure? (one per line)' },
  { key: 'evidence_requirements', label: 'Evidence requirements', placeholder: 'What evidence will count?' },
  { key: 'assumptions', label: 'Assumptions', placeholder: 'What are we assuming?' },
  { key: 'unknowns', label: 'Unknowns', placeholder: 'What do we not yet know?' },
  { key: 'risks', label: 'Risks', placeholder: 'What could go wrong?' },
  { key: 'constraints', label: 'Constraints', placeholder: 'Operational constraints' },
  { key: 'security_constraints', label: 'Security / data-handling constraints', placeholder: 'e.g. read-only access only' },
  { key: 'out_of_scope', label: 'Out of scope', placeholder: 'What this experiment is NOT testing' },
]

export default function ExperimentDetailPage() {
  const params = useParams()
  const experimentId = params.id as string

  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [project, setProject] = useState<ProjectLite | null>(null)
  const [conditions, setConditions] = useState<ExperimentCondition[]>([])
  const [links, setLinks] = useState<ExperimentLink[]>([])
  const [findings, setFindings] = useState<ExperimentFinding[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [observations, setObservations] = useState<ObservationRow[]>([])
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [otherExperiments, setOtherExperiments] = useState<Experiment[]>([])

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Editable form state (spine + design).
  const [form, setForm] = useState<Record<string, string>>({})
  const [confidence, setConfidence] = useState<Confidence | ''>('')

  const load = useCallback(async () => {
    setStatus('loading')
    const { data: exp, error } = await supabaseBrowser
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .single<Experiment>()

    if (error || !exp) {
      console.error('Error loading experiment:', error)
      setStatus('error')
      return
    }
    setExperiment(exp)
    setConfidence((exp.confidence as Confidence) || '')

    const design = (exp.design || {}) as Record<string, unknown>
    setForm({
      primary_question: exp.primary_question || '',
      problem: exp.problem || '',
      rationale: exp.rationale || '',
      hypothesis: exp.hypothesis || '',
      method: exp.method || '',
      scope: exp.scope || '',
      success_criteria: exp.success_criteria || '',
      failure_criteria: exp.failure_criteria || '',
      stop_conditions: exp.stop_conditions || '',
      decision_rule: exp.decision_rule || '',
      recommendation: exp.recommendation || '',
      resulting_decision: exp.resulting_decision || '',
      conclusion: exp.conclusion || '',
      ...Object.fromEntries(
        DESIGN_FIELDS.map((f) => [
          `design.${f.key}`,
          typeof design[f.key] === 'string' ? (design[f.key] as string) : '',
        ])
      ),
    })

    const [
      { data: proj },
      { data: cond },
      { data: lnk },
      { data: find },
      { data: props },
      { data: others },
    ] = await Promise.all([
      supabaseBrowser.from('projects').select('id, name, subdomain').eq('id', exp.project_id).single(),
      supabaseBrowser.from('experiment_conditions').select('*').eq('experiment_id', experimentId).order('sort_order'),
      supabaseBrowser.from('experiment_links').select('*').eq('experiment_id', experimentId).order('created_at'),
      supabaseBrowser.from('experiment_findings').select('*').eq('experiment_id', experimentId).order('created_at'),
      supabaseBrowser
        .from('proposals')
        .select('id, title, status, current_version:proposal_versions!current_version_id(presentation_route)')
        .eq('experiment_id', experimentId),
      supabaseBrowser
        .from('experiments')
        .select('*')
        .eq('project_id', exp.project_id)
        .neq('id', experimentId)
        .order('experiment_number'),
    ])

    setProject((proj as ProjectLite) || null)
    setConditions((cond as ExperimentCondition[]) || [])
    setLinks((lnk as ExperimentLink[]) || [])
    setFindings((find as ExperimentFinding[]) || [])
    setProposals((props as ProposalRow[]) || [])
    setOtherExperiments((others as Experiment[]) || [])

    // Sessions for the project (link candidates + linked).
    const { data: sess } = await supabaseBrowser
      .from('engagement_recordings')
      .select('id, title, session_type, experiment_id, created_at')
      .eq('project_id', exp.project_id)
      .order('created_at', { ascending: false })
    setSessions((sess as SessionRow[]) || [])

    // Observations for the project: recordings -> transcripts -> observations.
    const recordingIds = ((sess as SessionRow[]) || []).map((s) => s.id)
    if (recordingIds.length > 0) {
      const { data: transcripts } = await supabaseBrowser
        .from('engagement_transcripts')
        .select('id')
        .in('recording_id', recordingIds)
      const transcriptIds = (transcripts || []).map((t) => t.id as string)
      if (transcriptIds.length > 0) {
        const { data: obs } = await supabaseBrowser
          .from('transcript_observations')
          .select('id, statement, confidence, transcript_id, experiment_id')
          .in('transcript_id', transcriptIds)
          .order('created_at', { ascending: false })
        setObservations((obs as ObservationRow[]) || [])
      } else {
        setObservations([])
      }
    } else {
      setObservations([])
    }

    setStatus('ready')
  }, [experimentId])

  useEffect(() => {
    load()
  }, [load])

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function saveSpine() {
    if (!experiment) return
    setSaving(true)
    setNotice('')

    const design: Record<string, string> = {}
    for (const f of DESIGN_FIELDS) {
      const v = form[`design.${f.key}`]?.trim()
      if (v) design[f.key] = v
    }

    const update = {
      primary_question: form.primary_question?.trim() || null,
      problem: form.problem?.trim() || null,
      rationale: form.rationale?.trim() || null,
      hypothesis: form.hypothesis?.trim() || null,
      method: form.method?.trim() || null,
      scope: form.scope?.trim() || null,
      success_criteria: form.success_criteria?.trim() || null,
      failure_criteria: form.failure_criteria?.trim() || null,
      stop_conditions: form.stop_conditions?.trim() || null,
      decision_rule: form.decision_rule?.trim() || null,
      recommendation: form.recommendation?.trim() || null,
      resulting_decision: form.resulting_decision?.trim() || null,
      conclusion: form.conclusion?.trim() || null,
      confidence: confidence || null,
      design,
    }

    const { error } = await supabaseBrowser
      .from('experiments')
      .update(update)
      .eq('id', experiment.id)

    if (error) {
      console.error('Error saving experiment:', error)
      setNotice('Could not save.')
    } else {
      setNotice('Saved.')
      setExperiment({ ...experiment, ...update } as Experiment)
    }
    setSaving(false)
  }

  async function updateStatus(newStatus: ExperimentStatus) {
    if (!experiment) return
    const patch: Partial<Experiment> = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'approved' && !experiment.approved_at) patch.approved_at = now
    if (newStatus === 'active' && !experiment.activated_at) patch.activated_at = now
    if (newStatus === 'completed' && !experiment.completed_at) patch.completed_at = now

    const { error } = await supabaseBrowser
      .from('experiments')
      .update(patch)
      .eq('id', experiment.id)
    if (error) {
      alert('Could not update status: ' + error.message)
      return
    }
    setExperiment({ ...experiment, ...patch })
  }

  async function propose() {
    if (!experiment) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/experiments/${experiment.id}/propose`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to propose')
      }
      await load()
      setNotice('Proposal created and experiment marked as proposed.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to propose')
    } finally {
      setSaving(false)
    }
  }

  async function toggleSessionLink(session: SessionRow) {
    const linked = session.experiment_id === experimentId
    const { error } = await supabaseBrowser
      .from('engagement_recordings')
      .update({ experiment_id: linked ? null : experimentId })
      .eq('id', session.id)
    if (error) {
      alert('Could not update session link: ' + error.message)
      return
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id ? { ...s, experiment_id: linked ? null : experimentId } : s
      )
    )
  }

  async function toggleObservationLink(obs: ObservationRow) {
    const linked = obs.experiment_id === experimentId
    const { error } = await supabaseBrowser
      .from('transcript_observations')
      .update({ experiment_id: linked ? null : experimentId })
      .eq('id', obs.id)
    if (error) {
      alert('Could not update observation link: ' + error.message)
      return
    }
    setObservations((prev) =>
      prev.map((o) =>
        o.id === obs.id ? { ...o, experiment_id: linked ? null : experimentId } : o
      )
    )
  }

  const linkedSessions = useMemo(
    () => sessions.filter((s) => s.experiment_id === experimentId),
    [sessions, experimentId]
  )
  const linkedObservations = useMemo(
    () => observations.filter((o) => o.experiment_id === experimentId),
    [observations, experimentId]
  )

  if (status === 'loading') {
    return <div className="text-[#6B6785] text-center py-12">Loading experiment...</div>
  }
  if (status === 'error' || !experiment) {
    return (
      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#1A0F2E] mb-2">Experiment not found</h1>
        <Link href="/admin/projects" className="text-[#290D47] hover:opacity-80">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link
          href={`/admin/projects/${experiment.project_id}`}
          className="text-[#6B6785] hover:text-[#290D47] text-sm"
        >
          ← Back to {project?.name || 'project'}
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="font-mono text-sm text-[#6B6785]">{experiment.code}</span>
          <h1 className="text-3xl font-bold text-[#1A0F2E]">{experiment.title}</h1>
          <span
            className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${statusBadgeClasses(
              experiment.status
            )}`}
          >
            {STATUS_LABELS[experiment.status]}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Main inquiry column */}
        <div className="space-y-6">
          <Field label="What are we trying to learn?" value={form.primary_question} onChange={(v) => setField('primary_question', v)} rows={3} big />
          <Group title="Why are we asking?">
            <Field label="Observed problem / condition" value={form.problem} onChange={(v) => setField('problem', v)} />
            <Field label="Rationale" value={form.rationale} onChange={(v) => setField('rationale', v)} />
          </Group>
          <Group title="What do we currently believe?">
            <Field label="Hypothesis" value={form.hypothesis} onChange={(v) => setField('hypothesis', v)} />
          </Group>
          <Group title="How are we testing it?">
            <Field label="Method / protocol" value={form.method} onChange={(v) => setField('method', v)} />
            <Field label="Scope" value={form.scope} onChange={(v) => setField('scope', v)} />
            <Field label="Success criteria" value={form.success_criteria} onChange={(v) => setField('success_criteria', v)} />
            <Field label="Failure criteria" value={form.failure_criteria} onChange={(v) => setField('failure_criteria', v)} />
            <Field label="Stop conditions" value={form.stop_conditions} onChange={(v) => setField('stop_conditions', v)} />
            <ConditionsEditor
              experimentId={experimentId}
              conditions={conditions}
              onChange={setConditions}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              {DESIGN_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={form[`design.${f.key}`]}
                  onChange={(v) => setField(`design.${f.key}`, v)}
                  placeholder={f.placeholder}
                />
              ))}
            </div>
          </Group>

          <Group title="What evidence do we have?">
            <EvidencePicker
              linkedSessions={linkedSessions}
              allSessions={sessions}
              onToggleSession={toggleSessionLink}
              linkedObservations={linkedObservations}
              allObservations={observations}
              onToggleObservation={toggleObservationLink}
            />
          </Group>

          <Group title="What have we learned?">
            <FindingsEditor
              experimentId={experimentId}
              findings={findings}
              onChange={setFindings}
            />
            <Field label="Conclusion" value={form.conclusion} onChange={(v) => setField('conclusion', v)} />
            <div>
              <label className="block text-sm font-medium text-[#1A0F2E] mb-1">Confidence</label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as Confidence | '')}
                className="px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
              >
                <option value="">—</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </Group>

          <Group title="What decision follows?">
            <Field label="Decision rule" value={form.decision_rule} onChange={(v) => setField('decision_rule', v)} rows={3} placeholder="If X, then we do Y..." />
            <Field label="Recommendation" value={form.recommendation} onChange={(v) => setField('recommendation', v)} />
            <Field label="Resulting decision" value={form.resulting_decision} onChange={(v) => setField('resulting_decision', v)} />
          </Group>

          <div className="sticky bottom-4 flex items-center justify-end gap-3 bg-white/80 backdrop-blur rounded-xl border border-[#E8E4EF] px-4 py-3">
            {notice && (
              <span className={`text-sm ${notice === 'Saved.' ? 'text-green-700' : 'text-red-700'}`}>
                {notice}
              </span>
            )}
            <button
              onClick={saveSpine}
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
            {experiment.status === 'draft' && (
              <button
                onClick={propose}
                disabled={saving}
                className="w-full px-4 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] text-sm font-semibold hover:opacity-90 disabled:opacity-50 mb-3"
              >
                Propose Experiment
              </button>
            )}
            {experiment.status === 'proposed' && (
              <button onClick={() => updateStatus('approved')} className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:opacity-90 mb-3">
                Mark Approved
              </button>
            )}
            {experiment.status === 'approved' && (
              <button onClick={() => updateStatus('active')} className="w-full px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:opacity-90 mb-3">
                Activate
              </button>
            )}
            {experiment.status === 'active' && (
              <button onClick={() => updateStatus('completed')} className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:opacity-90 mb-3">
                Mark Completed
              </button>
            )}
            <label className="block text-xs text-[#6B6785] mb-1">Set status</label>
            <select
              value={experiment.status}
              onChange={(e) => updateStatus(e.target.value as ExperimentStatus)}
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm"
            >
              {EXPERIMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </section>

          <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785] mb-3">
              Proposals
            </h3>
            {proposals.length === 0 ? (
              <p className="text-sm text-[#6B6785]">No proposal yet.</p>
            ) : (
              <ul className="space-y-2">
                {proposals.map((p) => {
                  const v = Array.isArray(p.current_version) ? p.current_version[0] : p.current_version
                  return (
                    <li key={p.id} className="text-sm">
                      <span className="font-medium text-[#1A0F2E]">{p.title}</span>{' '}
                      <span className="text-[#6B6785]">({p.status})</span>
                      {project?.subdomain && v?.presentation_route && (
                        <a
                          href={`/portal/${project.subdomain}/proposal/${v.presentation_route}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[#290D47] hover:opacity-80 text-xs break-all"
                        >
                          View proposal
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <LineageEditor
            experimentId={experimentId}
            links={links}
            conditions={conditions}
            otherExperiments={otherExperiments}
            onChange={setLinks}
          />
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  rows = 2,
  placeholder,
  big,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  big?: boolean
}) {
  return (
    <div>
      <label className={`block font-medium text-[#1A0F2E] mb-1 ${big ? 'text-base' : 'text-sm'}`}>
        {label}
      </label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785] resize-y focus:outline-none focus:border-[#290D47]"
      />
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-[#1A0F2E]">{title}</h2>
      {children}
    </section>
  )
}

function ConditionsEditor({
  experimentId,
  conditions,
  onChange,
}: {
  experimentId: string
  conditions: ExperimentCondition[]
  onChange: (c: ExperimentCondition[]) => void
}) {
  const [label, setLabel] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [adding, setAdding] = useState(false)

  async function add() {
    if (!name.trim()) return
    setAdding(true)
    const nextLabel = label.trim() || String.fromCharCode(65 + conditions.length)
    const { data, error } = await supabaseBrowser
      .from('experiment_conditions')
      .insert({
        experiment_id: experimentId,
        label: nextLabel,
        name: name.trim(),
        description: description.trim() || null,
        sort_order: conditions.length,
      })
      .select('*')
      .single()
    setAdding(false)
    if (error) {
      alert('Could not add condition: ' + error.message)
      return
    }
    onChange([...conditions, data as ExperimentCondition])
    setLabel('')
    setName('')
    setDescription('')
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser.from('experiment_conditions').delete().eq('id', id)
    if (error) {
      alert('Could not remove: ' + error.message)
      return
    }
    onChange(conditions.filter((c) => c.id !== id))
  }

  return (
    <div className="rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] p-4">
      <p className="text-sm font-medium text-[#1A0F2E] mb-2">Conditions</p>
      {conditions.length > 0 && (
        <ul className="space-y-2 mb-3">
          {conditions.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <span>
                <span className="font-mono text-xs bg-white border border-[#E8E4EF] rounded px-1.5 py-0.5 mr-2">
                  {c.label}
                </span>
                <span className="font-medium text-[#1A0F2E]">{c.name}</span>
                {c.description && <span className="text-[#6B6785]"> — {c.description}</span>}
              </span>
              <button onClick={() => remove(c.id)} className="text-xs text-red-600 hover:text-red-500 shrink-0">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid sm:grid-cols-[4rem_1fr] gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="A"
          className="px-2 py-1.5 rounded-lg bg-white border border-[#E8E4EF] text-sm"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Condition name (e.g. CRF + historical precedent)"
          className="px-2 py-1.5 rounded-lg bg-white border border-[#E8E4EF] text-sm"
        />
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional description"
        className="w-full mt-2 px-2 py-1.5 rounded-lg bg-white border border-[#E8E4EF] text-sm"
      />
      <button
        onClick={add}
        disabled={adding || !name.trim()}
        className="mt-2 px-3 py-1.5 rounded-lg bg-[#290D47] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {adding ? 'Adding...' : 'Add condition'}
      </button>
    </div>
  )
}

function EvidencePicker({
  linkedSessions,
  allSessions,
  onToggleSession,
  linkedObservations,
  allObservations,
  onToggleObservation,
}: {
  linkedSessions: SessionRow[]
  allSessions: SessionRow[]
  onToggleSession: (s: SessionRow) => void
  linkedObservations: ObservationRow[]
  allObservations: ObservationRow[]
  onToggleObservation: (o: ObservationRow) => void
}) {
  const unlinkedSessions = allSessions.filter((s) => !linkedSessions.includes(s))
  const unlinkedObservations = allObservations.filter((o) => !linkedObservations.includes(o))
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[#1A0F2E] mb-2">Sessions (execution)</p>
        {linkedSessions.length === 0 && (
          <p className="text-xs text-[#6B6785] mb-2">No sessions linked yet.</p>
        )}
        <ul className="space-y-1">
          {linkedSessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm rounded-lg bg-[#F8F7F5] border border-[#E8E4EF] px-3 py-2">
              <span className="truncate">{s.title} <span className="text-[#6B6785]">· {s.session_type}</span></span>
              <button onClick={() => onToggleSession(s)} className="text-xs text-red-600 hover:text-red-500 shrink-0">Unlink</button>
            </li>
          ))}
        </ul>
        {unlinkedSessions.length > 0 && (
          <select
            onChange={(e) => {
              const s = allSessions.find((x) => x.id === e.target.value)
              if (s) onToggleSession(s)
              e.target.value = ''
            }}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm"
            defaultValue=""
          >
            <option value="">+ Link an existing session…</option>
            {unlinkedSessions.map((s) => (
              <option key={s.id} value={s.id}>{s.title} · {s.session_type}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-[#1A0F2E] mb-2">Observations (evidence)</p>
        {linkedObservations.length === 0 && (
          <p className="text-xs text-[#6B6785] mb-2">No observations linked yet.</p>
        )}
        <ul className="space-y-1">
          {linkedObservations.map((o) => (
            <li key={o.id} className="flex items-start justify-between text-sm rounded-lg bg-[#F8F7F5] border border-[#E8E4EF] px-3 py-2 gap-2">
              <span className="min-w-0"><span className="line-clamp-2">{o.statement}</span> <span className="text-[#6B6785] text-xs">({o.confidence})</span></span>
              <button onClick={() => onToggleObservation(o)} className="text-xs text-red-600 hover:text-red-500 shrink-0">Unlink</button>
            </li>
          ))}
        </ul>
        {unlinkedObservations.length > 0 && (
          <select
            onChange={(e) => {
              const o = allObservations.find((x) => x.id === e.target.value)
              if (o) onToggleObservation(o)
              e.target.value = ''
            }}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm"
            defaultValue=""
          >
            <option value="">+ Link an existing observation…</option>
            {unlinkedObservations.map((o) => (
              <option key={o.id} value={o.id}>{o.statement.slice(0, 80)}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

function FindingsEditor({
  experimentId,
  findings,
  onChange,
}: {
  experimentId: string
  findings: ExperimentFinding[]
  onChange: (f: ExperimentFinding[]) => void
}) {
  const [statement, setStatement] = useState('')
  const [supports, setSupports] = useState<'supports' | 'refutes' | 'inconclusive'>('inconclusive')
  const [adding, setAdding] = useState(false)

  async function add() {
    if (!statement.trim()) return
    setAdding(true)
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser()
    const { data, error } = await supabaseBrowser
      .from('experiment_findings')
      .insert({
        experiment_id: experimentId,
        statement: statement.trim(),
        supports_hypothesis: supports,
        created_by: user?.id ?? null,
      })
      .select('*')
      .single()
    setAdding(false)
    if (error) {
      alert('Could not add finding: ' + error.message)
      return
    }
    onChange([...findings, data as ExperimentFinding])
    setStatement('')
    setSupports('inconclusive')
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser.from('experiment_findings').delete().eq('id', id)
    if (error) {
      alert('Could not remove: ' + error.message)
      return
    }
    onChange(findings.filter((f) => f.id !== id))
  }

  return (
    <div className="rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] p-4">
      <p className="text-sm font-medium text-[#1A0F2E] mb-2">Findings</p>
      {findings.length > 0 && (
        <ul className="space-y-2 mb-3">
          {findings.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-2 text-sm">
              <span>
                <span className="font-medium text-[#1A0F2E]">{f.statement}</span>{' '}
                <span className="text-xs text-[#6B6785]">[{f.supports_hypothesis}]</span>
              </span>
              <button onClick={() => remove(f.id)} className="text-xs text-red-600 hover:text-red-500 shrink-0">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        rows={2}
        placeholder="What did this experiment reveal?"
        className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm resize-y"
      />
      <div className="mt-2 flex items-center gap-2">
        <select
          value={supports}
          onChange={(e) => setSupports(e.target.value as 'supports' | 'refutes' | 'inconclusive')}
          className="px-2 py-1.5 rounded-lg bg-white border border-[#E8E4EF] text-sm"
        >
          <option value="supports">Supports hypothesis</option>
          <option value="refutes">Refutes hypothesis</option>
          <option value="inconclusive">Inconclusive</option>
        </select>
        <button
          onClick={add}
          disabled={adding || !statement.trim()}
          className="px-3 py-1.5 rounded-lg bg-[#290D47] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add finding'}
        </button>
      </div>
    </div>
  )
}

function LineageEditor({
  experimentId,
  links,
  conditions,
  otherExperiments,
  onChange,
}: {
  experimentId: string
  links: ExperimentLink[]
  conditions: ExperimentCondition[]
  otherExperiments: Experiment[]
  onChange: (l: ExperimentLink[]) => void
}) {
  const [relation, setRelation] = useState<ExperimentRelation>('derived_from')
  const [targetType, setTargetType] = useState<'external' | 'experiment' | 'condition'>('external')
  const [note, setNote] = useState('')
  const [targetExperimentId, setTargetExperimentId] = useState('')
  const [targetConditionId, setTargetConditionId] = useState('')
  const [adding, setAdding] = useState(false)

  const conditionsForSelected = useMemo(() => {
    // For linking to another experiment's condition we'd need its conditions;
    // here we only support this experiment's own conditions + free text for
    // cross-experiment conditions (kept simple by design).
    return conditions
  }, [conditions])

  async function add() {
    setAdding(true)
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser()

    const row: Record<string, unknown> = {
      experiment_id: experimentId,
      relation,
      target_type: targetType,
      created_by: user?.id ?? null,
    }
    if (targetType === 'experiment') {
      if (!targetExperimentId) {
        setAdding(false)
        alert('Pick a target experiment.')
        return
      }
      row.target_id = targetExperimentId
      if (note.trim()) row.note = note.trim()
    } else if (targetType === 'condition') {
      if (!targetConditionId) {
        setAdding(false)
        alert('Pick a target condition.')
        return
      }
      row.target_condition_id = targetConditionId
      if (note.trim()) row.note = note.trim()
    } else {
      if (!note.trim()) {
        setAdding(false)
        alert('Add a description for this link.')
        return
      }
      row.note = note.trim()
    }

    const { data, error } = await supabaseBrowser
      .from('experiment_links')
      .insert(row)
      .select('*')
      .single()
    setAdding(false)
    if (error) {
      alert('Could not add link: ' + error.message)
      return
    }
    onChange([...links, data as ExperimentLink])
    setNote('')
    setTargetExperimentId('')
    setTargetConditionId('')
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser.from('experiment_links').delete().eq('id', id)
    if (error) {
      alert('Could not remove: ' + error.message)
      return
    }
    onChange(links.filter((l) => l.id !== id))
  }

  function describeTarget(l: ExperimentLink): string {
    if (l.target_type === 'experiment' && l.target_id) {
      const exp = otherExperiments.find((e) => e.id === l.target_id)
      return exp ? `${exp.code} ${exp.title}` : 'experiment'
    }
    if (l.target_type === 'condition' && l.target_condition_id) {
      const c = conditions.find((x) => x.id === l.target_condition_id)
      const label = c ? `Condition ${c.label}` : 'condition'
      return l.note ? `${label} — ${l.note}` : label
    }
    return l.note || l.target_type
  }

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785] mb-3">
        Lineage &amp; relationships
      </h3>
      {links.length === 0 ? (
        <p className="text-sm text-[#6B6785] mb-3">No relationships yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {links.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-2 text-sm">
              <span>
                <span className="text-[#6B6785]">{RELATION_LABELS[l.relation]}</span>{' '}
                <span className="text-[#1A0F2E]">{describeTarget(l)}</span>
              </span>
              <button onClick={() => remove(l.id)} className="text-xs text-red-600 hover:text-red-500 shrink-0">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-[#E8E4EF] pt-3">
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value as ExperimentRelation)}
          className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm"
        >
          {EXPERIMENT_RELATIONS.map((r) => (
            <option key={r} value={r}>{RELATION_LABELS[r]}</option>
          ))}
        </select>
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value as 'external' | 'experiment' | 'condition')}
          className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm"
        >
          <option value="external">Free text / observation</option>
          <option value="experiment">Another experiment</option>
          <option value="condition">A condition (this experiment)</option>
        </select>

        {targetType === 'experiment' && (
          <select
            value={targetExperimentId}
            onChange={(e) => setTargetExperimentId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm"
          >
            <option value="">Select experiment…</option>
            {otherExperiments.map((e) => (
              <option key={e.id} value={e.id}>{e.code} {e.title}</option>
            ))}
          </select>
        )}

        {targetType === 'condition' && (
          <select
            value={targetConditionId}
            onChange={(e) => setTargetConditionId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm"
          >
            <option value="">Select condition…</option>
            {conditionsForSelected.map((c) => (
              <option key={c.id} value={c.id}>Condition {c.label} — {c.name}</option>
            ))}
          </select>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            targetType === 'external'
              ? 'e.g. Observation: Christie manually supplies context'
              : 'Optional note'
          }
          className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-sm"
        />
        <button
          onClick={add}
          disabled={adding}
          className="w-full px-3 py-2 rounded-lg bg-[#290D47] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add relationship'}
        </button>
      </div>
    </section>
  )
}
