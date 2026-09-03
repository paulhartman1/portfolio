'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import {
  DISCOVERY_METHODS,
  DISCOVERY_METHOD_LABELS,
  DiscoveryMethod,
  EVIDENCE_ROLES,
  EVIDENCE_SOURCE_KIND_LABELS,
  EvidenceLink,
  EvidenceRole,
  INTAKE_CHANNELS,
  IntakeChannel,
  VALIDATION_STATE_LABELS,
  ValidationState,
  WORK_STATES,
  WORK_STATE_LABELS,
  WorkItem,
  WorkItemEvent,
  WorkState,
} from '@/lib/work/types'
import { Decision } from '@/lib/work/types'
import { computeWorkMeasures, evaluateExp003Criteria } from '@/lib/work/measures'

/**
 * The work inventory for one experiment.
 *
 * Writes go directly through the RLS-enforced browser client, matching the
 * existing admin pages. The audit trail (discovered / state_changed /
 * owner_changed / next_action_changed / corrected / confirmed / disputed) is
 * produced by database triggers, so this component deliberately does NOT
 * write those event types — doing so would double-count. It only writes the
 * judgement events the database cannot infer: notes and effort-bearing
 * inventory events.
 */

type PersonLite = { id: string; display_name: string }

const stateBadge: Record<WorkState, string> = {
  requested: 'bg-slate-100 text-slate-700 border-slate-300',
  planned: 'bg-sky-100 text-sky-800 border-sky-300',
  committed: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  active: 'bg-green-100 text-green-800 border-green-300',
  waiting: 'bg-amber-100 text-amber-900 border-amber-300',
  blocked: 'bg-red-100 text-red-800 border-red-300',
  done: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  dropped: 'bg-neutral-100 text-neutral-500 border-neutral-300',
}

const validationBadge: Record<ValidationState, string> = {
  unvalidated: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-green-50 text-green-800 border-green-200',
  corrected: 'bg-purple-50 text-purple-800 border-purple-200',
  disputed: 'bg-red-50 text-red-800 border-red-200',
  removed: 'bg-neutral-100 text-neutral-500 border-neutral-300',
}

function pct(value: number | null): string {
  return value == null ? '—' : `${Math.round(value * 1000) / 10}%`
}

export function WorkInventory({
  projectId,
  experimentId,
}: {
  projectId: string
  experimentId: string
}) {
  const [items, setItems] = useState<WorkItem[]>([])
  const [events, setEvents] = useState<WorkItemEvent[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [links, setLinks] = useState<EvidenceLink[]>([])
  const [people, setPeople] = useState<PersonLite[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [notice, setNotice] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [itemsRes, eventsRes, decisionsRes, peopleRes] = await Promise.all([
      supabaseBrowser
        .from('work_items')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('item_number', { ascending: true }),
      supabaseBrowser
        .from('work_item_events')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('occurred_at', { ascending: false }),
      supabaseBrowser
        .from('decisions')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('decision_number', { ascending: true }),
      supabaseBrowser.from('project_persons').select('persons(id, display_name)').eq('project_id', projectId),
    ])

    if (itemsRes.error) {
      setStatus('error')
      setNotice(itemsRes.error.message)
      return
    }

    const loadedItems = (itemsRes.data || []) as WorkItem[]
    setItems(loadedItems)
    setEvents((eventsRes.data || []) as WorkItemEvent[])
    setDecisions((decisionsRes.data || []) as Decision[])
    setPeople(
      ((peopleRes.data || []) as Array<{ persons: PersonLite | PersonLite[] | null }>)
        .map((row) => (Array.isArray(row.persons) ? row.persons[0] : row.persons))
        .filter((p): p is PersonLite => Boolean(p))
    )

    // Evidence links are fetched per subject so provenance coverage is real
    // rather than assumed.
    const ids = loadedItems.map((i) => i.id)
    if (ids.length > 0) {
      const { data } = await supabaseBrowser.from('evidence_links').select('*').in('subject_work_item_id', ids)
      setLinks((data || []) as EvidenceLink[])
    } else {
      setLinks([])
    }
    setStatus('ready')
  }, [experimentId, projectId])

  useEffect(() => {
    void load()
  }, [load])

  const personName = useCallback(
    (id: string | null) => (id ? people.find((p) => p.id === id)?.display_name || 'unknown person' : null),
    [people]
  )

  const measures = useMemo(
    () =>
      computeWorkMeasures({
        workItems: items,
        events,
        decisions,
        workItemIdsWithEvidence: new Set(
          links.map((l) => l.subject_work_item_id).filter((id): id is string => Boolean(id))
        ),
      }),
    [items, events, decisions, links]
  )
  const criteria = useMemo(() => evaluateExp003Criteria(measures), [measures])

  async function patchItem(id: string, patch: Partial<WorkItem>) {
    const { error } = await supabaseBrowser.from('work_items').update(patch).eq('id', id)
    if (error) setNotice(error.message)
    else setNotice('')
    await load()
  }

  async function validate(item: WorkItem, state: ValidationState, personId: string | null) {
    if (!personId) {
      setNotice('Choose who validated this item — attribution is the point of validation.')
      return
    }
    // validated_at is required by a CHECK constraint: a validation with no
    // date is not auditable.
    await patchItem(item.id, {
      validation_state: state,
      validated_at: new Date().toISOString(),
      validated_by_person_id: personId,
    })
  }

  if (status === 'loading') {
    return <p className="text-sm text-[#6B6785]">Loading work inventory…</p>
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{notice}</div>
      )}

      <MeasuresPanel measures={measures} criteria={criteria} personName={personName} />

      <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785]">
            Work inventory ({measures.coverage.total})
          </h3>
          <span className="text-xs text-[#6B6785]">
            {measures.openItems} open · {measures.wipItems} in progress · {measures.stalledItems} waiting/blocked
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-[#6B6785]">
            Nothing recorded yet. The experiment&apos;s method starts by asking Christie to identify the work she
            already knows about.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const itemLinks = links.filter((l) => l.subject_work_item_id === item.id)
              const isOpen = expanded === item.id
              return (
                <li key={item.id} className="rounded-xl border border-[#E8E4EF] bg-[#F8F7F5] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-[#6B6785]">{item.code}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${stateBadge[item.state]}`}>
                      {WORK_STATE_LABELS[item.state]}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${validationBadge[item.validation_state]}`}
                      title={
                        item.validated_by_person_id
                          ? `by ${personName(item.validated_by_person_id)}`
                          : 'not yet validated by anyone'
                      }
                    >
                      {VALIDATION_STATE_LABELS[item.validation_state]}
                    </span>
                    {!item.in_initial_inventory && (
                      <span
                        className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-900 border border-orange-300"
                        title="Discovered after the initial inventory was agreed"
                      >
                        found late
                      </span>
                    )}
                    {item.is_informal && (
                      <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-900 border border-yellow-300">
                        informal
                      </span>
                    )}
                    {itemLinks.length === 0 && (
                      <span
                        className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-200"
                        title="No source evidence recorded. EXP-003 requires preserving the source of each item."
                      >
                        no source
                      </span>
                    )}
                    <span className="flex-1 min-w-[12rem] text-sm font-medium text-[#1A0F2E]">{item.title}</span>
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="text-xs text-[#290D47] hover:opacity-70"
                    >
                      {isOpen ? 'Close' : 'Edit'}
                    </button>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B6785]">
                    <span>Owner: {personName(item.owner_person_id) || <em>nobody</em>}</span>
                    <span>Intake: {item.intake_channel || 'not recorded'}</span>
                    <span>Found via: {DISCOVERY_METHOD_LABELS[item.discovery_method]}</span>
                    <span>Sources: {itemLinks.length}</span>
                  </div>

                  {item.next_action ? (
                    <p className="mt-1 text-xs text-[#1A0F2E]">Next: {item.next_action}</p>
                  ) : item.blocked_reason ? (
                    <p className="mt-1 text-xs text-[#1A0F2E]">Dependency: {item.blocked_reason}</p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700">
                      No next action or dependency recorded — its status lives outside this view.
                    </p>
                  )}

                  {isOpen && (
                    <ItemEditor
                      item={item}
                      people={people}
                      links={itemLinks}
                      onPatch={(patch) => patchItem(item.id, patch)}
                      onValidate={(state, personId) => validate(item, state, personId)}
                      onChanged={load}
                      projectId={projectId}
                      experimentId={experimentId}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <AddItemForm projectId={projectId} experimentId={experimentId} people={people} onAdded={load} />
      </section>

      <EffortLogger projectId={projectId} experimentId={experimentId} events={events} onLogged={load} />
    </div>
  )
}

// --------------------------------------------------------------------------

function MeasuresPanel({
  measures,
  criteria,
  personName,
}: {
  measures: ReturnType<typeof computeWorkMeasures>
  criteria: ReturnType<typeof evaluateExp003Criteria>
  personName: (id: string | null) => string | null
}) {
  const statusStyle = {
    met: 'bg-green-100 text-green-800 border-green-300',
    not_met: 'bg-red-100 text-red-800 border-red-300',
    unevaluated: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  } as const

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785] mb-3">
        Measures &amp; criteria
      </h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat label="Items" value={String(measures.coverage.total)} sub={`${measures.coverage.discoveredLate} found late`} />
        <Stat
          label="Already represented"
          value={pct(measures.coverage.representedFraction)}
          sub="90% needed"
        />
        <Stat
          label="Fully specified"
          value={pct(measures.completeness.fullySpecifiedFraction)}
          sub={`${measures.completeness.stalledWithoutStatedReason} stalled w/o reason`}
        />
        <Stat
          label="Validated"
          value={pct(measures.validation.reviewedFraction)}
          sub={`${measures.validation.corrected} corrected · ${measures.validation.disputed} disputed`}
        />
        <Stat
          label="Intake channels"
          value={String(measures.intake.distinctChannels)}
          sub={`${measures.intake.informalItems} informal · ${measures.intake.unknownChannelItems} unrecorded`}
        />
        <Stat
          label="Owner concentration"
          value={pct(measures.concentration.topOwnerFraction)}
          sub={
            measures.concentration.topOwnerPersonId
              ? `${personName(measures.concentration.topOwnerPersonId)} holds ${measures.concentration.topOwnerOpenItems} open`
              : 'no owners recorded'
          }
        />
        <Stat
          label="Maintenance"
          value={
            measures.maintenance.meanMinutesPerActiveDay == null
              ? '—'
              : `${Math.round(measures.maintenance.meanMinutesPerActiveDay * 10) / 10} min/day`
          }
          sub={`${measures.maintenance.daysOverFifteenMinutes} day(s) over 15 min`}
        />
        <Stat
          label="Decisions from view"
          value={String(measures.decisions.qualifyingInformedByView)}
          sub={`of ${measures.decisions.total} recorded`}
        />
      </div>

      {measures.itemsWithoutEvidence > 0 && measures.coverage.total > 0 && (
        <p className="mb-3 text-xs text-red-700">
          {measures.itemsWithoutEvidence} of {measures.coverage.total} items have no recorded source. EXP-003
          requires preserving the source of each item.
        </p>
      )}

      <ul className="space-y-1">
        {criteria.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded border font-semibold shrink-0 ${statusStyle[c.status]}`}>
              {c.status === 'met' ? 'MET' : c.status === 'not_met' ? 'NOT MET' : 'NO DATA'}
            </span>
            <span className="text-[#1A0F2E]">
              {c.criterion}
              <span className="block text-[#6B6785]">
                {c.observed}
                {c.blockedBy ? ` — ${c.blockedBy}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#E8E4EF] bg-[#F8F7F5] p-3">
      <p className="text-xs text-[#6B6785]">{label}</p>
      <p className="text-lg font-semibold text-[#1A0F2E]">{value}</p>
      {sub && <p className="text-[0.7rem] text-[#6B6785]">{sub}</p>}
    </div>
  )
}

// --------------------------------------------------------------------------

function ItemEditor({
  item,
  people,
  links,
  onPatch,
  onValidate,
  onChanged,
  projectId,
  experimentId,
}: {
  item: WorkItem
  people: PersonLite[]
  links: EvidenceLink[]
  onPatch: (patch: Partial<WorkItem>) => Promise<void>
  onValidate: (state: ValidationState, personId: string | null) => Promise<void>
  onChanged: () => Promise<void>
  projectId: string
  experimentId: string
}) {
  const [nextAction, setNextAction] = useState(item.next_action || '')
  const [blockedReason, setBlockedReason] = useState(item.blocked_reason || '')
  const [description, setDescription] = useState(item.description || '')
  const [validator, setValidator] = useState(item.validated_by_person_id || '')

  return (
    <div className="mt-3 space-y-3 border-t border-[#E8E4EF] pt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-[#6B6785]">
          State
          <select
            value={item.state}
            onChange={(e) => void onPatch({ state: e.target.value as WorkState })}
            className="mt-1 w-full px-2 py-1 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
          >
            {WORK_STATES.map((s) => (
              <option key={s} value={s}>
                {WORK_STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#6B6785]">
          Owner
          <select
            value={item.owner_person_id || ''}
            onChange={(e) => void onPatch({ owner_person_id: e.target.value || null })}
            className="mt-1 w-full px-2 py-1 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
          >
            <option value="">— nobody —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#6B6785]">
          Intake channel
          <select
            value={item.intake_channel || ''}
            onChange={(e) => void onPatch({ intake_channel: (e.target.value || null) as IntakeChannel | null })}
            className="mt-1 w-full px-2 py-1 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
          >
            <option value="">— not recorded —</option>
            {INTAKE_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs text-[#6B6785]">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (item.description || '') && void onPatch({ description: description || null })}
          rows={2}
          className="mt-1 w-full px-2 py-1 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[#6B6785]">
          Next action
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            onBlur={() => nextAction !== (item.next_action || '') && void onPatch({ next_action: nextAction || null })}
            className="mt-1 w-full px-2 py-1 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
          />
        </label>
        <label className="text-xs text-[#6B6785]">
          Dependency / blocked reason
          <input
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            onBlur={() =>
              blockedReason !== (item.blocked_reason || '') && void onPatch({ blocked_reason: blockedReason || null })
            }
            className="mt-1 w-full px-2 py-1 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[#6B6785]">
          Validated by
          <select
            value={validator}
            onChange={(e) => setValidator(e.target.value)}
            className="mt-1 block px-2 py-1 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
          >
            <option value="">— choose —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        {(['confirmed', 'corrected', 'disputed', 'removed'] as ValidationState[]).map((state) => (
          <button
            key={state}
            onClick={() => void onValidate(state, validator || null)}
            className="px-3 py-1 rounded border border-[#E8E4EF] bg-white text-xs font-medium text-[#1A0F2E] hover:bg-[#F8F7F5]"
          >
            {VALIDATION_STATE_LABELS[state]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-xs text-[#6B6785]">
          <input
            type="checkbox"
            checked={item.is_informal}
            onChange={(e) => void onPatch({ is_informal: e.target.checked })}
          />
          Informal
        </label>
        <label className="flex items-center gap-1 text-xs text-[#6B6785]">
          <input
            type="checkbox"
            checked={item.client_visible}
            onChange={(e) => void onPatch({ client_visible: e.target.checked })}
          />
          Client visible
        </label>
      </div>

      <EvidenceEditor
        workItemId={item.id}
        links={links}
        projectId={projectId}
        experimentId={experimentId}
        onChanged={onChanged}
      />
    </div>
  )
}

// --------------------------------------------------------------------------

type SourceOption = { value: string; label: string; kind: string }

function EvidenceEditor({
  workItemId,
  links,
  projectId,
  onChanged,
}: {
  workItemId: string
  links: EvidenceLink[]
  projectId: string
  experimentId: string
  onChanged: () => Promise<void>
}) {
  const [options, setOptions] = useState<SourceOption[]>([])
  const [selected, setSelected] = useState('')
  const [externalLabel, setExternalLabel] = useState('')
  const [role, setRole] = useState<EvidenceRole>('supporting')
  const [excerpt, setExcerpt] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadOptions() {
      // Only sources that actually belong to this project may be offered.
      const { data: recordings } = await supabaseBrowser
        .from('engagement_recordings')
        .select('id, title')
        .eq('project_id', projectId)
      const recordingIds = (recordings || []).map((r) => r.id)
      const titles = new Map((recordings || []).map((r) => [r.id, r.title as string]))

      const [transcriptsRes, markersRes, candidatesRes] = await Promise.all([
        recordingIds.length
          ? supabaseBrowser.from('engagement_transcripts').select('id, recording_id').in('recording_id', recordingIds)
          : Promise.resolve({ data: [] as Array<{ id: string; recording_id: string }> }),
        recordingIds.length
          ? supabaseBrowser
              .from('engagement_session_notes')
              .select('id, recording_id, note_type, note_text')
              .in('recording_id', recordingIds)
          : Promise.resolve({ data: [] as Array<{ id: string; recording_id: string; note_type: string; note_text: string | null }> }),
        supabaseBrowser
          .from('project_intelligence_candidates')
          .select('id, type, content, status')
          .eq('project_id', projectId),
      ])

      const transcriptIds = ((transcriptsRes.data || []) as Array<{ id: string }>).map((t) => t.id)
      const { data: observations } = transcriptIds.length
        ? await supabaseBrowser
            .from('transcript_observations')
            .select('id, statement')
            .in('transcript_id', transcriptIds)
        : { data: [] as Array<{ id: string; statement: string }> }

      if (cancelled) return

      const next: SourceOption[] = [
        ...((transcriptsRes.data || []) as Array<{ id: string; recording_id: string }>).map((t) => ({
          value: `transcript_utterance:${t.id}`,
          label: `Transcript — ${titles.get(t.recording_id) || 'recording'}`,
          kind: 'transcript_utterance',
        })),
        ...((observations || []) as Array<{ id: string; statement: string }>).map((o) => ({
          value: `observation:${o.id}`,
          label: `Observation — ${o.statement.slice(0, 60)}`,
          kind: 'observation',
        })),
        ...((markersRes.data || []) as Array<{ id: string; note_type: string; note_text: string | null }>).map((m) => ({
          value: `session_marker:${m.id}`,
          label: `Marker [${m.note_type}] — ${(m.note_text || 'no text').slice(0, 50)}`,
          kind: 'session_marker',
        })),
        ...((candidatesRes.data || []) as Array<{ id: string; type: string; content: string; status: string }>).map(
          (c) => ({
            value: `intelligence_candidate:${c.id}`,
            label: `Candidate [${c.status}] ${c.type} — ${c.content.slice(0, 45)}`,
            kind: 'intelligence_candidate',
          })
        ),
      ]
      setOptions(next)
    }
    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function addLink() {
    setBusy(true)
    const base = {
      subject_work_item_id: workItemId,
      role,
      excerpt_text: excerpt.trim() || null,
    }
    let payload: Record<string, unknown>

    if (selected === 'external') {
      if (!externalLabel.trim()) {
        setBusy(false)
        return
      }
      payload = { ...base, source_kind: 'external', source_label: externalLabel.trim() }
    } else {
      const [kind, id] = selected.split(':')
      if (!kind || !id) {
        setBusy(false)
        return
      }
      const column = {
        transcript_utterance: 'source_transcript_id',
        observation: 'source_observation_id',
        session_marker: 'source_marker_id',
        intelligence_candidate: 'source_candidate_id',
      }[kind]
      if (!column) {
        setBusy(false)
        return
      }
      payload = { ...base, source_kind: kind, [column]: id }
    }

    const { error } = await supabaseBrowser.from('evidence_links').insert(payload)
    setBusy(false)
    if (!error) {
      setSelected('')
      setExternalLabel('')
      setExcerpt('')
      await onChanged()
    }
  }

  return (
    <div className="rounded-lg border border-[#E8E4EF] bg-white p-3">
      <p className="text-xs font-semibold text-[#1A0F2E] mb-2">Source evidence ({links.length})</p>
      {links.length === 0 ? (
        <p className="text-xs text-red-700 mb-2">
          No source recorded. This item is an unsourced assertion.
        </p>
      ) : (
        <ul className="mb-2 space-y-1">
          {links.map((link) => (
            <li key={link.id} className="flex items-start gap-2 text-xs text-[#6B6785]">
              <span className="px-1.5 py-0.5 rounded bg-[#F8F7F5] border border-[#E8E4EF] shrink-0">
                {link.role}
              </span>
              <span className="flex-1">
                {EVIDENCE_SOURCE_KIND_LABELS[link.source_kind]}
                {link.source_label ? ` — ${link.source_label}` : ''}
                {link.excerpt_text ? ` — “${link.excerpt_text}”` : ''}
              </span>
              <button
                onClick={async () => {
                  await supabaseBrowser.from('evidence_links').delete().eq('id', link.id)
                  await onChanged()
                }}
                className="text-red-600 hover:opacity-70"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E] max-w-xs"
        >
          <option value="">— add a source —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="external">External source (not in CGT)…</option>
        </select>
        {selected === 'external' && (
          <input
            value={externalLabel}
            onChange={(e) => setExternalLabel(e.target.value)}
            placeholder="e.g. Christie's ClickUp export, 2026-09-04"
            className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
          />
        )}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as EvidenceRole)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          {EVIDENCE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="excerpt (optional)"
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        />
        <button
          onClick={() => void addLink()}
          disabled={!selected || busy}
          className="px-3 py-1 rounded bg-[#290D47] text-white text-xs font-semibold disabled:opacity-40"
        >
          Add source
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------

function AddItemForm({
  projectId,
  experimentId,
  people,
  onAdded,
}: {
  projectId: string
  experimentId: string
  people: PersonLite[]
  onAdded: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [state, setState] = useState<WorkState>('requested')
  const [owner, setOwner] = useState('')
  const [channel, setChannel] = useState('')
  const [method, setMethod] = useState<DiscoveryMethod>('christie_interview')
  const [inBaseline, setInBaseline] = useState(true)
  const [nextAction, setNextAction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    if (!title.trim()) return
    setBusy(true)
    setError('')
    const { error: insertError } = await supabaseBrowser.from('work_items').insert({
      project_id: projectId,
      experiment_id: experimentId,
      title: title.trim(),
      state,
      owner_person_id: owner || null,
      intake_channel: channel || null,
      discovery_method: method,
      in_initial_inventory: inBaseline,
      next_action: nextAction.trim() || null,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTitle('')
    setNextAction('')
    setOwner('')
    setChannel('')
    await onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 px-4 py-2 rounded-lg border border-[#290D47]/30 text-sm font-semibold text-[#290D47] hover:bg-[#F8F7F5]"
      >
        + Add work item
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-[#E8E4EF] bg-white p-3 space-y-2">
      {error && <p className="text-xs text-red-700">{error}</p>}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What is the work?"
        className="w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm bg-white text-[#1A0F2E]"
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={state}
          onChange={(e) => setState(e.target.value as WorkState)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          {WORK_STATES.map((s) => (
            <option key={s} value={s}>
              {WORK_STATE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          <option value="">— owner —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          <option value="">— intake channel —</option>
          {INTAKE_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as DiscoveryMethod)}
          className="px-2 py-1 rounded border border-[#E8E4EF] text-xs bg-white text-[#1A0F2E]"
        >
          {DISCOVERY_METHODS.map((m) => (
            <option key={m} value={m}>
              Found via: {DISCOVERY_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <input
        value={nextAction}
        onChange={(e) => setNextAction(e.target.value)}
        placeholder="Next action or dependency"
        className="w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm bg-white text-[#1A0F2E]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-[#6B6785]">
          <input type="checkbox" checked={inBaseline} onChange={(e) => setInBaseline(e.target.checked)} />
          Was in the initial inventory
        </label>
        <span className="text-xs text-[#6B6785]">
          Uncheck for work discovered after the baseline was agreed.
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setOpen(false)} className="px-3 py-1 text-xs text-[#6B6785] hover:text-[#290D47]">
            Cancel
          </button>
          <button
            onClick={() => void add()}
            disabled={!title.trim() || busy}
            className="px-4 py-1.5 rounded bg-[#290D47] text-white text-xs font-semibold disabled:opacity-40"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------

function EffortLogger({
  projectId,
  experimentId,
  events,
  onLogged,
}: {
  projectId: string
  experimentId: string
  events: WorkItemEvent[]
  onLogged: () => Promise<void>
}) {
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)

  const effortEvents = events.filter((e) => e.effort_minutes != null)

  async function log() {
    const parsed = Number(minutes)
    if (!Number.isFinite(parsed) || parsed < 0) return
    setBusy(true)
    await supabaseBrowser.from('work_item_events').insert({
      project_id: projectId,
      experiment_id: experimentId,
      // Inventory-wide: no work_item_id, permitted by the scope constraint.
      event_type: reviewed ? 'inventory_reviewed' : 'inventory_maintained',
      effort_minutes: parsed,
      note: note.trim() || null,
    })
    setBusy(false)
    setMinutes('')
    setNote('')
    await onLogged()
  }

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B6785] mb-1">
        Maintenance effort
      </h3>
      <p className="text-xs text-[#6B6785] mb-3">
        Deliberate administrative time only, excluding doing the work itself. EXP-003 fails above 15 minutes per
        working day, and that threshold cannot be judged unless it is logged.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          inputMode="decimal"
          placeholder="minutes"
          className="w-24 px-2 py-1 rounded border border-[#E8E4EF] text-sm bg-white text-[#1A0F2E]"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="what was done"
          className="flex-1 min-w-[12rem] px-2 py-1 rounded border border-[#E8E4EF] text-sm bg-white text-[#1A0F2E]"
        />
        <label className="flex items-center gap-1 text-xs text-[#6B6785]">
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
          Review session
        </label>
        <button
          onClick={() => void log()}
          disabled={!minutes.trim() || busy}
          className="px-4 py-1.5 rounded bg-[#290D47] text-white text-xs font-semibold disabled:opacity-40"
        >
          Log effort
        </button>
      </div>

      {effortEvents.length > 0 && (
        <ul className="mt-3 space-y-1">
          {effortEvents.slice(0, 8).map((e) => (
            <li key={e.id} className="text-xs text-[#6B6785]">
              {e.occurred_at.slice(0, 10)} — {e.effort_minutes} min
              {e.note ? ` · ${e.note}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
