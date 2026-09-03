'use client'

import { useState } from 'react'

type Conclusion = {
  statement: string
  kind: 'evidence' | 'inference' | 'unknown'
  confidence: number
  reasoning: string | null
  evidence: Array<{ type: string; id: string; utteranceIds?: string[] }>
}

type AskCgtResponse = {
  answer: {
    answer: string
    conclusions: Conclusion[]
    unknowns: string[]
  }
  usage: {
    provider: string
    model: string
    promptTokens: number | null
    completionTokens: number | null
    totalTokens: number | null
    durationMs: number
    evidenceItemsRetrieved: number
  }
  citations?: {
    submitted: number
    accepted: number
    rejected: number
  }
}

type AskState = 'idle' | 'asking' | 'done' | 'error'

const kindStyles: Record<Conclusion['kind'], { badge: string; label: string }> = {
  evidence: { badge: 'bg-green-100 text-green-800', label: 'Direct evidence' },
  inference: { badge: 'bg-purple-100 text-purple-800', label: 'Inference' },
  unknown: { badge: 'bg-amber-100 text-amber-800', label: 'Unknown' },
}

export function AskCgt({
  projectId,
  projectName,
  experimentId,
  experimentLabel,
  placeholder,
}: {
  projectId: string
  projectName: string
  /** When set, AskCGT treats this experiment as the subject of the question. */
  experimentId?: string
  /** Display label for the active experiment, e.g. "EXP-003 Make the work visible". */
  experimentLabel?: string
  placeholder?: string
}) {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<AskState>('idle')
  const [result, setResult] = useState<AskCgtResponse | null>(null)
  const [error, setError] = useState('')

  async function ask() {
    const trimmed = question.trim()
    if (!trimmed || state === 'asking') return
    setState('asking')
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/admin/askcgt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // experimentId is sent explicitly rather than left for the model to
        // infer from the question text or the experiment's title.
        body: JSON.stringify(experimentId ? { projectId, experimentId, question: trimmed } : { projectId, question: trimmed }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'AskCGT failed')
      setResult(payload as AskCgtResponse)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AskCGT failed')
      setState('error')
    }
  }

  return (
    <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#1A0F2E]">Ask CGT</h2>
        {experimentId ? (
          <p className="text-[#6B6785] text-sm">
            Reasoning about{' '}
            <span className="font-medium text-[#1A0F2E]">{experimentLabel || 'this experiment'}</span>{' '}
            — its full definition, scope and boundaries, approval provenance, and {projectName}&apos;s
            evidence. AskCGT will challenge a framing that conflicts with the experiment.
          </p>
        ) : (
          <p className="text-[#6B6785] text-sm">
            Ask a question about {projectName}. Answers reason over the evidence CGT already has
            for this project and cite the underlying sources.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <textarea
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value)
            if (state !== 'idle') setState('idle')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              void ask()
            }
          }}
          placeholder={
            placeholder ||
            (experimentId
              ? 'e.g. Based on this experiment and its evidence, what should I do next? (Ctrl/Cmd+Enter to ask)'
              : "e.g. What did we learn from today's conversation that confirms, contradicts, or changes our understanding of Alpine? (Ctrl/Cmd+Enter to ask)")
          }
          className="w-full px-4 py-3 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785] resize-none focus:outline-none focus:border-[#290D47] disabled:opacity-50"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void ask()}
            disabled={!question.trim() || state === 'asking'}
            className="px-6 py-2 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:hover:opacity-50"
          >
            {state === 'asking' ? 'Asking CGT…' : 'Ask'}
          </button>
        </div>
      </div>

      {state === 'error' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {state === 'done' && result && (
        <div className="mt-4 space-y-4">
          {result.citations && result.citations.rejected > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-semibold">
                {result.citations.rejected} of {result.citations.submitted} citations were rejected.
              </span>{' '}
              AskCGT referenced evidence that is not in the retrieved set, so any conclusion below
              with no evidence chips is less grounded than its wording suggests. Treat those
              conclusions as unsupported.
            </div>
          )}

          <div className="rounded-lg border border-[#E8E4EF] bg-[#F8F7F5] p-4">
            <p className="text-[#1A0F2E] whitespace-pre-wrap text-sm leading-relaxed">{result.answer.answer}</p>
          </div>

          {result.answer.conclusions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#1A0F2E] mb-2">Conclusions</h3>
              <div className="space-y-2">
                {result.answer.conclusions.map((conclusion, index) => {
                  const style = kindStyles[conclusion.kind]
                  return (
                    <div key={index} className="rounded-lg border border-[#E8E4EF] bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-semibold ${style.badge}`}>{style.label}</span>
                        <span className="text-xs text-[#6B6785]">confidence {conclusion.confidence.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-[#1A0F2E]">{conclusion.statement}</p>
                      {conclusion.reasoning && (
                        <p className="mt-1 text-xs text-[#6B6785]">{conclusion.reasoning}</p>
                      )}
                      {conclusion.evidence.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {conclusion.evidence.map((ref, refIndex) => (
                            <span
                              key={refIndex}
                              // Chips are abbreviated for readability only; the
                              // full canonical id is preserved in the tooltip.
                              title={`${ref.type} ${ref.id}${ref.utteranceIds?.length ? `\nutterances: ${ref.utteranceIds.join(', ')}` : ''}`}
                              className="px-2 py-0.5 rounded bg-[#F8F7F5] border border-[#E8E4EF] text-xs text-[#6B6785] font-mono"
                            >
                              {ref.type}:{ref.id.slice(0, 8)}
                              {ref.utteranceIds && ref.utteranceIds.length > 0
                                ? ` · ${ref.utteranceIds.slice(0, 4).join(', ')}${ref.utteranceIds.length > 4 ? ` +${ref.utteranceIds.length - 4}` : ''}`
                                : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        conclusion.kind !== 'unknown' && (
                          <p className="mt-2 text-xs font-medium text-amber-700">
                            No evidence cited — this conclusion is not grounded in retrieved evidence.
                          </p>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result.answer.unknowns.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#1A0F2E] mb-2">Important unknowns</h3>
              <ul className="list-disc list-inside space-y-1">
                {result.answer.unknowns.map((unknown, index) => (
                  <li key={index} className="text-sm text-[#6B6785]">{unknown}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-[#E8E4EF] pt-2 text-xs text-[#6B6785]">
            {result.usage.provider}/{result.usage.model} ·{' '}
            {result.usage.promptTokens != null && result.usage.completionTokens != null
              ? `${result.usage.totalTokens ?? 0} tokens (in ${result.usage.promptTokens}, out ${result.usage.completionTokens})`
              : 'token usage unavailable'} ·{' '}
            {(result.usage.durationMs / 1000).toFixed(1)}s · {result.usage.evidenceItemsRetrieved} evidence items retrieved
          </div>
        </div>
      )}
    </section>
  )
}