import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { contextMock, fromMock, filters } = vi.hoisted(() => ({
  contextMock: vi.fn(),
  fromMock: vi.fn(),
  filters: [] as string[],
}))

vi.mock('./_lib', () => ({ getPortalContext: contextMock }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

type QueryResult = { data: unknown; error: { message: string } | null }
type Proposal = { id: string; title: string; current_version: unknown }
type Link = { experiment_id: string }
type Experiment = { id: string; code: string; title: string; slug: string; status: string }

function query(result: QueryResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'order', 'limit', 'in']) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }
  builder.filter = vi.fn((_: string, operator: string, value: string) => {
    filters.push(`${operator}:${value}`)
    return builder
  })
  builder.then = vi.fn((resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(result)))
  return builder
}

const project = {
  id: 'project-alpine',
  description: 'Improve intake workflow',
  url: null,
}

function setup({
  proposals = [], links = [], experiments = [], experimentError = null,
}: {
  proposals?: Proposal[]
  links?: Link[]
  experiments?: Experiment[]
  experimentError?: { message: string } | null
} = {}) {
  filters.length = 0
  contextMock.mockResolvedValue({ project, supabase: {}, hasAccess: true })
  fromMock.mockImplementation((table: string) => {
    if (table === 'proposals') return query({ data: proposals, error: null })
    if (table === 'proposal_experiments') return query({ data: links, error: null })
    if (table === 'experiments') return query({ data: experiments, error: experimentError })
    if (table === 'review_comments') return query({ data: [], error: null })
    if (table === 'project_approvals') return query({ data: [], error: null })
    return query({ data: [], error: null })
  })
  return { supabase: { from: fromMock } }
}

const experiment = (overrides = {}) => ({
  id: 'exp-003', code: 'EXP-003', title: 'AI-assisted CRF analysis',
  slug: 'ai-assisted-crf-analysis', status: 'approved', ...overrides,
})

describe('ClientPortalPage experiments', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('React', React)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('does not emit an exclusion filter when no experiments are covered', async () => {
    const { supabase } = setup({ experiments: [experiment()] })
    contextMock.mockResolvedValue({ project, supabase, hasAccess: true })
    const { default: Page } = await import('./page')
    render(await Page({ params: Promise.resolve({ subdomain: 'alpine' }) }))
    expect(filters).toEqual([])
    expect(screen.getByText('AI-assisted CRF analysis')).toBeInTheDocument()
  })

  it('serializes and deduplicates covered experiment IDs for PostgREST', async () => {
    const { supabase } = setup({
      proposals: [{ id: 'proposal-1', title: 'Proposal', current_version: null }],
      links: [{ experiment_id: 'exp-003' }, { experiment_id: 'exp-003' }, { experiment_id: 'exp-004' }],
      experiments: [experiment()],
    })
    contextMock.mockResolvedValue({ project, supabase, hasAccess: true })
    const { default: Page } = await import('./page')
    render(await Page({ params: Promise.resolve({ subdomain: 'alpine' }) }))
    expect(filters).toEqual(['not.in:(exp-003,exp-004)'])
  })

  it('logs experiment query failures without rendering database details', async () => {
    const { supabase } = setup({ experimentError: { message: 'secret database detail' } })
    contextMock.mockResolvedValue({ project, supabase, hasAccess: true })
    const { default: Page } = await import('./page')
    render(await Page({ params: Promise.resolve({ subdomain: 'alpine' }) }))
    expect(console.error).toHaveBeenCalledWith('Error loading portal experiments:', 'secret database detail')
    expect(screen.queryByText('secret database detail')).not.toBeInTheDocument()
  })

  it('keeps an approved experiment visible and distinct from the caught-up action state', async () => {
    const { supabase } = setup({ experiments: [experiment()] })
    contextMock.mockResolvedValue({ project, supabase, hasAccess: true })
    const { default: Page } = await import('./page')
    render(await Page({ params: Promise.resolve({ subdomain: 'alpine' }) }))
    expect(screen.getByText("You're caught up")).toBeInTheDocument()
    expect(screen.getAllByText('AI-assisted CRF analysis')).toHaveLength(1)
  })

  it('keeps a sent proposal action and does not duplicate its linked experiment', async () => {
    const { supabase } = setup({
      proposals: [{ id: 'proposal-1', title: 'Review this', current_version: { presentation_route: 'review' } }],
      links: [{ experiment_id: 'exp-003' }],
      // The database applies the exclusion filter, so the linked row is not
      // returned through the read-only experiment query.
      experiments: [],
    })
    contextMock.mockResolvedValue({ project, supabase, hasAccess: true })
    const { default: Page } = await import('./page')
    render(await Page({ params: Promise.resolve({ subdomain: 'alpine' }) }))
    expect(screen.getByText('Review proposal')).toBeInTheDocument()
    expect(screen.queryByText('AI-assisted CRF analysis')).not.toBeInTheDocument()
  })
})
