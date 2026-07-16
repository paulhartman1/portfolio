'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'

type ProposalPage = {
  title: string
  content: ReactNode
}

export default function RushNDushNovationProposalContent() {
  const [pageIndex, setPageIndex] = useState(0)

  const pages: ProposalPage[] = [
    {
      title: 'Overview',
      content: (
        <>
          <h2>Rush N Dush — Novation Calculator Draft Proposal</h2>
          <p>
            This draft proposal outlines the first production-ready design and implementation direction for
            the new Novation Calculator experience in the Rush N Dush admin workflow.
          </p>
          <p>
            The goal is to help Dashaun quickly evaluate property viability, negotiate confidently, and save
            analysis context directly against each property record.
          </p>

          <h3>Design Direction (Based on Attached Mockups)</h3>
          <ul>
            <li>Single-screen analysis workflow with high visual clarity</li>
            <li>Property context on the left, live deal summary on the right</li>
            <li>Financial inputs grouped for speed and consistency</li>
            <li>Immediate MAO / profit feedback without navigation overhead</li>
            <li>Strong mobile-first behavior with progressive desktop enhancement</li>
          </ul>

          <h3>Business Outcome</h3>
          <p>
            By pairing the property record with an opinionated financial analysis interface, the team can
            reduce decision time, keep assumptions visible, and improve offer quality across deals.
          </p>
        </>
      ),
    },
    {
      title: 'Scope',
      content: (
        <>
          <h2>Proposed Scope</h2>
          <h3>1) Property Analysis Surface</h3>
          <ul>
            <li>Property summary block (address, basic facts, source)</li>
            <li>Financial input panel with editable and defaulted values</li>
            <li>Negotiation notes field tied to property record</li>
          </ul>

          <h3>2) Deal Summary Panel</h3>
          <ul>
            <li>Maximum Allowable Offer (MAO)</li>
            <li>Estimated net profit</li>
            <li>Cash required, margin, and ROI snapshot</li>
            <li>Deal health badge (example: Good Deal)</li>
          </ul>

          <h3>3) Save + Persistence</h3>
          <ul>
            <li>Save analysis action on the property</li>
            <li>Novation-related fields persisted for reuse</li>
            <li>Foundation for future document/contract generation</li>
          </ul>

          <h3>4) Guardrails</h3>
          <ul>
            <li>Feature flag controlled rollout (`properties`)</li>
            <li>Responsive behavior validated for phone and desktop</li>
            <li>Incremental delivery with minimal risk changes</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Delivery Plan',
      content: (
        <>
          <h2>Draft Delivery Plan</h2>
          <h3>Phase A — Foundation (Complete / In Progress)</h3>
          <ul>
            <li>Properties admin route and map surface</li>
            <li>Novation calculator fields and save endpoint</li>
            <li>Feature flag scaffolding</li>
          </ul>

          <h3>Phase B — UX Refinement (Current Design Cycle)</h3>
          <ul>
            <li>Apply final design tokens and spacing rhythm from mockups</li>
            <li>Tune input defaults and visual hierarchy</li>
            <li>Improve empty/loading/error states for operator confidence</li>
          </ul>

          <h3>Phase C — Decision Support Enhancements</h3>
          <ul>
            <li>Scenario comparisons (optional in next iteration)</li>
            <li>Calculation history model (optional, when needed)</li>
            <li>Contract/document prefill integration planning</li>
          </ul>

          <h3>Acceptance Criteria (Draft)</h3>
          <ul>
            <li>Dashaun can open a property and run a full analysis in one pass</li>
            <li>MAO and profitability update live as inputs change</li>
            <li>Analysis can be saved and retrieved without data loss</li>
            <li>Workflow is usable on mobile-first layouts</li>
          </ul>

          <p>
            This proposal is a working draft and can be revised as design feedback is finalized.
          </p>
        </>
      ),
    },
  ]

  const currentPage = pages[pageIndex]

  const goToPage = (nextPageIndex: number) => {
    setPageIndex(nextPageIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="proposal-container">
      <style jsx global>{`
        body {
          background: #f5f3ee;
        }
        .proposal-container {
          font-family: Georgia, serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #2c3e50;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem;
          background: #f5f3ee;
        }
        .proposal-container h2 {
          font-size: 18pt;
          font-weight: normal;
          margin: 1.5em 0 0.75em 0;
          color: #34495e;
          border-bottom: 1px solid #bdc3c7;
          padding-bottom: 0.25em;
        }
        .proposal-container h3 {
          font-size: 14pt;
          font-weight: bold;
          margin: 1.25em 0 0.5em 0;
          color: #2c3e50;
        }
        .proposal-container p {
          margin: 0 0 1em 0;
          text-align: justify;
        }
        .proposal-container ul {
          margin: 0.5em 0 1em 0;
          padding-left: 1.5em;
        }
        .proposal-container li {
          margin: 0.25em 0;
        }
        .title-section {
          text-align: center;
          margin: 3rem 0;
          padding: 2rem 0;
          border-bottom: 2px solid #ecf0f1;
        }
        .title-section h1 {
          font-size: 32pt;
          margin: 0 0 0.25em 0;
          color: #1a1a1a;
          line-height: 1.2;
          font-weight: normal;
        }
        .subtitle {
          font-size: 18pt;
          color: #7f8c8d;
          margin: 0 0 1em 0;
        }
        .meta {
          font-size: 11pt;
          color: #7f8c8d;
          margin: 0.25em 0;
        }
        .proposal-navigation {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin: 1.5rem 0;
          padding: 1rem 0;
          border-top: 1px solid #d8d2c6;
          border-bottom: 1px solid #d8d2c6;
        }
        .proposal-progress {
          color: #7f8c8d;
          font-size: 10pt;
          text-align: center;
        }
        .proposal-nav-button {
          border: 1px solid #cfc7b8;
          background: #fffaf0;
          color: #34495e;
          cursor: pointer;
          font-family: Georgia, serif;
          border-radius: 999px;
          padding: 0.55rem 1rem;
          min-width: 6.5rem;
        }
        .proposal-nav-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .proposal-page-content {
          min-height: 24rem;
        }
      `}</style>

      <div className="title-section">
        <h1>Novation Calculator Proposal</h1>
        <div className="subtitle">Rush N Dush</div>
        <p className="meta">
          Prepared by Paul Hartman · Common Ground Technology LLC
          <br />
          Draft Version · {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="proposal-navigation" aria-label="Proposal pagination">
        <button
          type="button"
          onClick={() => goToPage(pageIndex - 1)}
          disabled={pageIndex === 0}
          className="proposal-nav-button"
        >
          Previous
        </button>
        <div className="proposal-progress">
          <strong>{currentPage.title}</strong>
          <br />
          Section {pageIndex + 1} of {pages.length}
        </div>
        <button
          type="button"
          onClick={() => goToPage(pageIndex + 1)}
          disabled={pageIndex === pages.length - 1}
          className="proposal-nav-button"
        >
          Next
        </button>
      </div>

      <div className="proposal-page-content">{currentPage.content}</div>
    </div>
  )
}
