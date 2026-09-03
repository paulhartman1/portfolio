'use client'

import { useState } from 'react'

/**
 * Human review of ONE AskCGT conclusion.
 *
 * The epistemic contract the UI must make visible:
 *   Source material remains evidence.
 *   An AskCGT conclusion is a proposed interpretation.
 *   Accepting it creates a reviewed FINDING linked to evidence —
 *   it does not turn the interpretation into a source fact.
 *
 * Nothing here is persisted until Paul presses Accept. A challenge produces a
 * revised proposal that is equally uncommitted.
 */

export type ReviewConclusion = {
  statement: string
  kind: 'evidence' | 'inference' | 'unknown'
  confidence: number
  reasoning: string | null
  evidence: Array<{ type: string; id: string; utteranceIds?: string[] }>
}

type Disposition = 'retained' | 'narrowed' | 'revised' | 'withdrawn'

type Reconsidered = {
  disposition: Disposition
  assessment: string
  revised: ReviewConclusion | null
  remainingUncertainty: string[]
  citations: { submitted: number; accepted: number; rejected: number }
}

type Committed = {
  findingId: string
  reviewStatus: 'accepted' | 'accepted_edited'
  citationsPersisted: number
}

const dispositionStyles: Record<Disposition, { badge: string; label: string; blurb: string }> = {
  retained: {
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    label: 'Retained',
    blurb: 'AskCGT stands by the original claim.',
  },
  narrowed: {
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    label: 'Narrowed',
    blurb: 'The claim was too broad; a smaller version survives.',
  },
  revised: {
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    label: 'Revised',
    blurb: 'The substance of the claim changed.',
  },
  withdrawn: {
    badge: 'bg-red-100 text-red-800 border-red-300',
    label: 'Withdrawn',
    blurb: 'AskCGT no longer supports this claim. There is nothing to accept.',
  },
}

export function AskCgtConclusionReview({
  conclusion,
  projectId,
  experimentId,
  model,
  provider,
}: {
  conclusion: ReviewConclusion
  projectId: string
  experimentId: string
  model?: string
  provider?: string
}) {
  const [mode, setMode] = useState<'idle' | 'editing' | 'challenging'>('idle')
  const [busy, setBusy] = useState<null | 'accepting' | 'challenging'>(null)
  const [error, setError] = useState('')
  const [committed, setCommitted] = useState<Committed | null>(null)

  const [editedStatement, setEditedStatement] = useState(conclusion.statement)
  const [editedReasoning, setEditedReasoning] = useState(conclusion.reasoning || '')
  const [challenge, setChallenge] = useState('')
  const [reconsidered, setReconsidered] = useState<Reconsidered | null>(null)

  // Once a revision exists, it — not the original — is what gets reviewed.
  const active = reconsidered?.revised ?? conclusion
  const isWithdrawn = reconsidered?.disposition === 'withdrawn'

  async function accept(statement: string, reasoning: string | null) {
    if (busy || committed) return
    setBusy('accepting')
    setError('')
    try {
      const response = await fetch('/api/admin/askcgt/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          experimentId,
          // The model's wording is always the proposal of record, even after a
          // challenge: the revision is what AskCGT proposed most recently.
          proposedStatement: active.statement,
          acceptedStatement: statement,
          proposedInterpretation: active.reasoning,
          acceptedInterpretation: reasoning,
          epistemicType: active.kind,
          proposedConfidence: active.confidence,
          citations: active.evidence,
          model,
          provider,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        // Never show success on a failed write.
        throw new Error(payload.error || 'Could not save the finding')
      }
      setCommitted(payload as Committed)
      setMode('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the finding')
    } finally {
      setBusy(null)
    }
  }

  async function submitChallenge() {
    const trimmed = challenge.trim()
    if (!trimmed || busy) return
    setBusy('challenging')
    setError('')
    setReconsidered(null)
    try {
      const response = await fetch('/api/admin/askcgt/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          experimentId,
          originalStatement: conclusion.statement,
          originalKind: conclusion.kind,
          originalCitations: conclusion.evidence,
          challenge: trimmed,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Reconsideration failed')
      const next = payload as Reconsidered
      setReconsidered(next)
      setEditedStatement(next.revised?.statement ?? '')
      setEditedReasoning(next.revised?.reasoning ?? '')
      setMode('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconsideration failed')
    } finally {
      setBusy(null)
    }
  }

  // --- committed -----------------------------------------------------------
  if (committed) {
    return (
      <div className="mt-2 rounded-lg border border-green-300 bg-green-50 p-2.5">
        <p className="text-xs font-semibold text-green-900">
          Saved as a reviewed finding
          {committed.reviewStatus === 'accepted_edited' ? ' (with your edits)' : ''}.
        </p>
        <p className="mt-0.5 text-[0.7rem] text-green-800">
          Recorded as your reviewed interpretation, linked to {committed.citationsPersisted} citation
          {committed.citationsPersisted === 1 ? '' : 's'}. It is not stored as source evidence, and it is
          internal until you share it with the client.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2 border-t border-[#E8E4EF] pt-2">
      {error && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</div>
      )}

      {/* --- reconsidered result ------------------------------------------ */}
      {reconsidered && (
        <div className="mb-2 rounded-lg border border-[#E8E4EF] bg-[#FBFAFF] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded border text-xs font-semibold ${dispositionStyles[reconsidered.disposition].badge}`}
            >
              {dispositionStyles[reconsidered.disposition].label}
            </span>
            <span className="text-xs text-[#6B6785]">{dispositionStyles[reconsidered.disposition].blurb}</span>
            <span className="ml-auto text-[0.7rem] uppercase tracking-wide text-[#6B6785]">
              still uncommitted
            </span>
          </div>

          <p className="mt-2 text-xs text-[#1A0F2E]">{reconsidered.assessment}</p>

          {reconsidered.revised ? (
            <div className="mt-2 rounded border border-[#E8E4EF] bg-white p-2">
              <p className="text-[0.7rem] uppercase tracking-wide text-[#6B6785]">Revised conclusion</p>
              <p className="mt-0.5 text-sm text-[#1A0F2E]">{reconsidered.revised.statement}</p>
              {reconsidered.revised.reasoning && (
                <p className="mt-1 text-xs text-[#6B6785]">{reconsidered.revised.reasoning}</p>
              )}
              {reconsidered.revised.evidence.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {reconsidered.revised.evidence.map((ref, index) => (
                    <span
                      key={index}
                      title={`${ref.type} ${ref.id}`}
                      className="px-1.5 py-0.5 rounded bg-[#F8F7F5] border border-[#E8E4EF] text-[0.7rem] font-mono text-[#6B6785]"
                    >
                      {ref.type}:{ref.id.slice(0, 8)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs font-medium text-red-800">
              Nothing is offered for acceptance. A withdrawn claim cannot be saved as a finding.
            </p>
          )}

          {reconsidered.remainingUncertainty.length > 0 && (
            <div className="mt-2">
              <p className="text-[0.7rem] uppercase tracking-wide text-[#6B6785]">Still uncertain</p>
              <ul className="list-disc list-inside">
                {reconsidered.remainingUncertainty.map((item, index) => (
                  <li key={index} className="text-xs text-[#6B6785]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reconsidered.citations.rejected > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              {reconsidered.citations.rejected} citation(s) in the revision were rejected as invalid.
            </p>
          )}
        </div>
      )}

      {/* --- edit form ----------------------------------------------------- */}
      {mode === 'editing' && !isWithdrawn && (
        <div className="mb-2 rounded-lg border border-[#E8E4EF] bg-white p-3 space-y-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-[#6B6785]">
              AskCGT proposed (kept on record, not overwritten)
            </p>
            <p className="mt-0.5 text-xs italic text-[#6B6785]">{active.statement}</p>
          </div>
          <label className="block text-xs text-[#1A0F2E]">
            Wording to commit
            <textarea
              value={editedStatement}
              onChange={(event) => setEditedStatement(event.target.value)}
              rows={3}
              className="mt-1 w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
            />
          </label>
          <label className="block text-xs text-[#1A0F2E]">
            Rationale
            <textarea
              value={editedReasoning}
              onChange={(event) => setEditedReasoning(event.target.value)}
              rows={2}
              className="mt-1 w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
            />
          </label>
          <p className="text-[0.7rem] text-[#6B6785]">
            This will be saved as <strong>your</strong> reviewed interpretation, citing the same{' '}
            {active.evidence.length} evidence reference{active.evidence.length === 1 ? '' : 's'}.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMode('idle')}
              className="px-3 py-1 text-xs text-[#6B6785] hover:text-[#290D47]"
            >
              Cancel
            </button>
            <button
              onClick={() => void accept(editedStatement, editedReasoning.trim() || null)}
              disabled={!editedStatement.trim() || busy !== null}
              className="px-4 py-1.5 rounded bg-[#290D47] text-white text-xs font-semibold disabled:opacity-40"
            >
              {busy === 'accepting' ? 'Saving…' : 'Save as reviewed finding'}
            </button>
          </div>
        </div>
      )}

      {/* --- challenge form ------------------------------------------------ */}
      {mode === 'challenging' && (
        <div className="mb-2 rounded-lg border border-[#E8E4EF] bg-white p-3 space-y-2">
          <label className="block text-xs text-[#1A0F2E]">
            What is wrong with this conclusion?
            <textarea
              value={challenge}
              onChange={(event) => setChallenge(event.target.value)}
              rows={4}
              placeholder="e.g. The experiment already has measurable success and failure criteria. A null decision_rule field does not establish that decision criteria are absent. Re-evaluate against the complete experiment record."
              className="mt-1 w-full px-2 py-1.5 rounded border border-[#E8E4EF] text-sm text-[#1A0F2E] bg-white"
            />
          </label>
          <p className="text-[0.7rem] text-[#6B6785]">
            AskCGT re-examines this one claim against the full experiment record. Nothing is saved.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMode('idle')}
              className="px-3 py-1 text-xs text-[#6B6785] hover:text-[#290D47]"
            >
              Cancel
            </button>
            <button
              onClick={() => void submitChallenge()}
              disabled={!challenge.trim() || busy !== null}
              className="px-4 py-1.5 rounded bg-[#290D47] text-white text-xs font-semibold disabled:opacity-40"
            >
              {busy === 'challenging' ? 'Reconsidering…' : 'Send challenge'}
            </button>
          </div>
        </div>
      )}

      {/* --- actions -------------------------------------------------------- */}
      {mode === 'idle' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-[#6B6785]">
            {reconsidered ? 'Revision — not saved' : 'Proposed — not saved'}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={() => void accept(active.statement, active.reasoning)}
              disabled={busy !== null || isWithdrawn}
              title={isWithdrawn ? 'AskCGT withdrew this claim — there is nothing to accept' : undefined}
              className="px-3 py-1 rounded border border-[#290D47]/30 bg-white text-xs font-semibold text-[#290D47] hover:bg-[#F8F7F5] disabled:opacity-40"
            >
              {busy === 'accepting' ? 'Saving…' : 'Accept as finding'}
            </button>
            <button
              onClick={() => {
                setEditedStatement(active.statement)
                setEditedReasoning(active.reasoning || '')
                setMode('editing')
              }}
              disabled={busy !== null || isWithdrawn}
              className="px-3 py-1 rounded border border-[#E8E4EF] bg-white text-xs font-medium text-[#1A0F2E] hover:bg-[#F8F7F5] disabled:opacity-40"
            >
              Edit and accept
            </button>
            <button
              onClick={() => setMode('challenging')}
              disabled={busy !== null}
              className="px-3 py-1 rounded border border-[#E8E4EF] bg-white text-xs font-medium text-[#1A0F2E] hover:bg-[#F8F7F5] disabled:opacity-40"
            >
              {reconsidered ? 'Challenge again' : 'Challenge'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
