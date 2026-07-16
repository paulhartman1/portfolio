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
      title: 'Offer',
      content: (
        <>
          <h2>Novation Calculator Proposal</h2>
          <p>
            This is a focused build to help RushNDush Logistics, LLC evaluate deals faster, save better assumptions,
            and move from “property review” to “offer confidence” in one workflow.
          </p>

          <div className="offer-box">
            <h3>Investment</h3>
            <p className="headline">$500 flat</p>
            <p>~20 hours total development + testing</p>
            <p className="fine-print">
              This is a discounted rate. If RushNDush Logistics, LLC is happy with the outcome, I’d appreciate warm referrals.
            </p>
          </div>

          <h3>What RushNDush Logistics, LLC Gets</h3>
          <ul>
            <li>Cleaner property-level analysis flow built for real acquisition decisions</li>
            <li>Live MAO/profit feedback while editing key assumptions</li>
            <li>A “save analysis” path that keeps deal context on the property</li>
            <li>A foundation for next-step contract/document generation workflows</li>
          </ul>

          <h3>Value Proposition</h3>
          <p>
            If this tool shortens decision time by even a few minutes per lead, and improves offer quality across
            active opportunities, it pays for itself quickly through better conversion and cleaner negotiations.
          </p>
        </>
      ),
    },
    {
      title: 'Design Preview',
      content: (
        <>
          <h2>Design Preview</h2>
          <p>
            The UI direction is intentionally operator-first: fast scanability, clear risk/profit signals, and
            minimal clicks between “input” and “decision.”
          </p>

          <ul>
            <li>Property summary and financial inputs are grouped for fast entry and review.</li>
            <li>Deal summary panel keeps MAO, net profit, and key ratios visible at all times.</li>
            <li>Default-value indicators support quick starts while preserving override flexibility.</li>
            <li>Negotiation notes remain attached to the same analysis workflow for context retention.</li>
          </ul>
          <p>The following screenshots illustrate the concept of the proposed design:</p>
          <img src="/Screenshot from 2026-07-16 14-35-32.png" alt="Novation Calculator Preview" style={{ maxWidth: '100%' }} />
          <img src="/Screenshot from 2026-07-16 14-48-34.png" alt="Novation Calculator Preview" style={{ maxWidth: '50%' }} />
          <img src="/Screenshot from 2026-07-16 14-48-47.png" alt="Novation Calculator Preview" style={{ maxWidth: '50%' }} />
          <img src="/Screenshot from 2026-07-16 14-49-03.png" alt="Novation Calculator Preview" style={{ maxWidth: '50%' }} />
        </>
      ),
    },
    {
      title: 'Delivery Terms',
      content: (
        <>
          <h2>Delivery Terms</h2>

          <h3>Scope Included in This Offer</h3>
          <ul>
            <li>Finalize this screen-level experience from current designs</li>
            <li>Wire all core novation inputs/outputs and save behavior</li>
            <li>Mobile-first QA + desktop polish</li>
            <li>Validation pass and deployment-ready handoff</li>
          </ul>

          <h3>Estimated Effort</h3>
          <ul>
            <li>Development + UI integration: ~14–16 hours</li>
            <li>Testing and refinements: ~4–6 hours</li>
            <li>Total: ~20 hours</li>
          </ul>

          <h3>Commercial Terms</h3>
          <ul>
            <li>Fixed fee: <strong>$500</strong></li>
            <li>
              Referral request: <strong>warm referrals from RushNDush Logistics, LLC</strong> after successful delivery and adoption
            </li>
          </ul>

          <h3>Success Criteria</h3>
          <ul>
            <li>RushNDush Logistics, LLC can evaluate a property in one flow without spreadsheet switching</li>
            <li>MAO/profit update in real time from editable assumptions</li>
            <li>Analysis saves reliably and is available for follow-up negotiation/document steps</li>
          </ul>

          <p className="close">
            If approved, this can start immediately and ship in small validated steps.
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
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1rem;
          background: #f5f3ee;
        }
        .proposal-container h2 {
          font-size: 20pt;
          font-weight: normal;
          margin: 1.25em 0 0.7em 0;
          color: #2b3f57;
          border-bottom: 1px solid #c9cfd6;
          padding-bottom: 0.3em;
        }
        .proposal-container h3 {
          font-size: 14pt;
          font-weight: bold;
          margin: 1.1em 0 0.45em 0;
          color: #2c3e50;
        }
        .proposal-container p {
          margin: 0 0 1em 0;
        }
        .proposal-container ul {
          margin: 0.45em 0 1em 0;
          padding-left: 1.5em;
        }
        .proposal-container li {
          margin: 0.25em 0;
        }
        .title-section {
          text-align: center;
          margin: 2.5rem 0 2rem 0;
          padding: 1.5rem 0;
          border-bottom: 2px solid #ecf0f1;
        }
        .title-section h1 {
          font-size: 34pt;
          margin: 0;
          font-weight: normal;
          color: #1a1a1a;
        }
        .subtitle {
          margin-top: 0.65rem;
          font-size: 16pt;
          color: #6f7f90;
        }
        .meta {
          margin-top: 1rem;
          color: #7f8c8d;
          font-size: 10.5pt;
        }
        .offer-box {
          border: 1px solid #d9d0bf;
          background: #fff8ea;
          border-left: 4px solid #c5912f;
          padding: 1rem;
          margin: 1rem 0 1.25rem 0;
        }
        .offer-box .headline {
          font-size: 22pt;
          font-weight: bold;
          color: #1f3550;
          margin: 0.1rem 0 0.35rem 0;
        }
        .offer-box .fine-print {
          color: #674f27;
          font-weight: bold;
          margin-top: 0.35rem;
        }
        .close {
          margin-top: 1.5rem;
          font-style: italic;
        }
        .proposal-navigation {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin: 1.5rem 0;
          padding: 0.9rem 0;
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
      `}</style>

      <div className="title-section">
        <h1>Novation Calculator Proposal</h1>
        <div className="subtitle">RushNDush Logistics, LLC</div>
        <p className="meta">
          Prepared by Paul Hartman · Common Ground Technology LLC
          <br />
          Version · {new Date().toLocaleDateString()}
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

      <div>{currentPage.content}</div>
    </div>
  )
}