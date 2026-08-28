import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPortalContext } from '../../../_lib'
import type { Experiment, ExperimentCondition } from '@/lib/experiments/types'

// Client-facing proposal for an Experiment, rendered dynamically from the
// experiment record. This composes the existing proposal infrastructure
// (a proposals row + proposal_versions row with presentation_route
// `experiment/<slug>`) without hand-authoring a React file per experiment.

const DESIGN_LABELS: Record<string, string> = {
  measures: 'What we will measure',
  evidence_requirements: 'What evidence will count',
  assumptions: 'Assumptions',
  unknowns: 'Open unknowns',
  risks: 'Risks',
  constraints: 'Constraints',
  security_constraints: 'Security & data handling',
  out_of_scope: 'Out of scope',
}

function Block({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B6785]">{label}</h2>
      <p className="mt-2 text-base text-[#1A0F2E] leading-relaxed whitespace-pre-wrap">{value}</p>
    </section>
  )
}

export default async function ExperimentProposalPage({
  params,
}: {
  params: Promise<{ subdomain: string; slug: string }>
}) {
  const { subdomain, slug } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)
  if (!hasAccess) return null

  const { data: experiment } = await supabase
    .from('experiments')
    .select('*')
    .eq('project_id', project.id)
    .eq('slug', slug)
    .maybeSingle<Experiment>()

  if (!experiment) notFound()

  const { data: conditions } = await supabase
    .from('experiment_conditions')
    .select('*')
    .eq('experiment_id', experiment.id)
    .order('sort_order')

  const design = (experiment.design || {}) as Record<string, unknown>
  const designEntries = Object.entries(DESIGN_LABELS).filter(
    ([key]) => typeof design[key] === 'string' && (design[key] as string).trim()
  )

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <Link
          href={`/portal/${subdomain}`}
          className="text-sm text-[#6B6785] underline underline-offset-2 hover:text-[#290D47]"
        >
          ← Back to overview
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-sm text-[#6B6785]">{experiment.code}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B6785]">
            Proposed experiment
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1A0F2E]">
          {experiment.title}
        </h1>
      </div>

      {experiment.primary_question && (
        <section className="rounded-xl border border-[#290D47]/15 bg-white px-6 py-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6785]">
            What we&apos;re trying to learn
          </p>
          <p className="mt-2 text-xl font-medium text-[#1A0F2E] leading-relaxed">
            {experiment.primary_question}
          </p>
        </section>
      )}

      <Block label="Why we're asking" value={experiment.problem} />
      <Block label="Rationale" value={experiment.rationale} />
      <Block label="What we currently believe (hypothesis)" value={experiment.hypothesis} />
      <Block label="How we'll test it" value={experiment.method} />
      <Block label="Scope" value={experiment.scope} />

      {conditions && conditions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B6785]">
            Conditions
          </h2>
          <ul className="mt-3 space-y-2">
            {(conditions as ExperimentCondition[]).map((c) => (
              <li key={c.id} className="rounded-lg border border-[#E8E4EF] bg-white px-4 py-3">
                <span className="font-mono text-xs bg-[#F8F7F5] border border-[#E8E4EF] rounded px-1.5 py-0.5 mr-2">
                  {c.label}
                </span>
                <span className="font-medium text-[#1A0F2E]">{c.name}</span>
                {c.description && (
                  <p className="mt-1 text-sm text-[#6B6785]">{c.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Block label="Success criteria" value={experiment.success_criteria} />
      <Block label="Failure criteria" value={experiment.failure_criteria} />
      <Block label="Stop conditions" value={experiment.stop_conditions} />

      {designEntries.length > 0 && (
        <div className="space-y-8">
          {designEntries.map(([key, label]) => (
            <Block key={key} label={label} value={design[key] as string} />
          ))}
        </div>
      )}

      <Block label="Decision rule" value={experiment.decision_rule} />

      <section className="border-t border-[#E8E4EF] pt-8">
        <p className="text-sm text-[#6B6785]">
          Questions or ready to proceed?{' '}
          <Link
            href={`/portal/${subdomain}/messages`}
            className="text-[#290D47] underline underline-offset-2 hover:opacity-80"
          >
            Send us a message
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
