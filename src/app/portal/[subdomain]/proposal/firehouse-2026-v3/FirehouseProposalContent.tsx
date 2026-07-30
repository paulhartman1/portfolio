'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'

type ProposalPage = {
  title: string
  content: ReactNode
}

export default function FirehouseProposalContent() {
  const [pageIndex, setPageIndex] = useState(0)

  const pages: ProposalPage[] = [
    {
      title: 'Executive Summary',
      content: (
        <>
          <h2>Executive Summary</h2>
          <p>
            Firehouse will retain WordPress as its content management system. CGT will modernize
            the public website within WordPress to improve maintainability, navigation,
            performance, accessibility practices, and the staff editing experience while preserving
            existing operational systems where they continue to serve Firehouse effectively.
          </p>
          <p>
            This project is not a custom replacement for WordPress, and it is more than a cosmetic
            theme change. The recommended approach is a bounded WordPress modernization that keeps
            the platform Firehouse already knows while simplifying the structures that make the
            current site difficult to maintain.
          </p>

          <h3>What CGT Found</h3>
          <ul>
            <li>Beyond Child on Beyond parent theme</li>
            <li>Heavy legacy use of Classic Editor + WPBakery/Visual Composer shortcodes</li>
            <li>93 observed WordPress pages including historical/overlapping content</li>
            <li>Content and presentation frequently intertwined in legacy pages</li>
            <li>External systems remain core for events, forms, registrations, and payments</li>
          </ul>

          <h3>Problems Behind the Findings</h3>
          <ul>
            <li>Legacy editing patterns increase staff update effort and inconsistency risk.</li>
            <li>Content/presentation coupling makes routine edits fragile.</li>
            <li>Mixed historical/current pages increase stale or conflicting information risk.</li>
            <li>Layered dependencies raise maintenance complexity and regression risk.</li>
            <li>One-for-one rebuild of all historical content is not cost-effective for this scope.</li>
          </ul>

          <h3>Practical Diagnosis</h3>
          <p>
            The maintainability problem is primarily accumulated structure and editing debt, not
            WordPress itself. A cosmetic theme change alone would leave those constraints in place.
          </p>
          <p className="emphasis">
            Recommended path: bounded WordPress modernization that preserves familiar workflows and
            effective existing systems while improving structure, presentation, and editing clarity.
          </p>
        </>
      ),
    },
    {
      title: 'Scope (1–4)',
      content: (
        <>
          <h2>Scope of Work (1–4)</h2>
          <h3>1. WordPress & Content Audit</h3>
          <p>
            Audit and implementation mapping across theme dependencies, plugins, content
            structures, navigation, integrations, and representative mobile/accessibility/performance
            issues. Elements classified as Keep / Improve / Replace / Retire.
          </p>

          <h3>2. Information Architecture & Navigation</h3>
          <p>
            Reorganize around visitor needs and Firehouse priorities (Exhibitions, Events,
            Artists/Members, Education, Programs, Membership, Donate, Shop/Services, Visit, About).
            Existing pages are source material, not one-for-one rebuild requirements.
          </p>

          <h3>3. Modern WordPress Foundation</h3>
          <p>
            Replace or substantially modernize presentation foundations with responsive templates,
            visual hierarchy, reusable sections/components, and manageable editing patterns.
            Existing operational systems and staff workflows will be preserved where effective.
          </p>

          <h3>4. Homepage Redesign</h3>
          <p>
            Rebuild homepage around current priorities and visitor pathways; final composition
            follows approved IA and available content.
          </p>
        </>
      ),
    },
    {
      title: 'Scope (5–9)',
      content: (
        <>
          <h2>Scope of Work (5–9)</h2>
          <h3>5. Reusable Content & Page Structures</h3>
          <p>
            Add structure where repetition justifies it (informational, program, exhibition,
            artist/member, event, initiative, and landing/index patterns).
          </p>

          <h3>6. Priority Content Migration & Cleanup</h3>
          <p>
            Migrate and clean priority launch content representing approximately 25 standard
            existing pages. This does not include full reconstruction of all historical content.
          </p>

          <h3>7. Artists / Members</h3>
          <p>
            Improve public artist/member presentation and discovery. This does not include custom
            membership management, approvals, billing, or CRM workflows.
          </p>

          <h3>8. Exhibitions & Events</h3>
          <p>
            Improve visibility and presentation while continuing to use systems of record such as
            Google Calendar and Sawyer where effective.
          </p>

          <h3>9. Existing Tools & Integrations</h3>
          <p>
            Preserve/reconnect relevant systems through configuration, linking, embedding, or
            existing supported plugins. Custom API development and major new app logic are outside
            fixed scope unless separately approved.
          </p>
        </>
      ),
    },
    {
      title: 'Scope (10–13) + Commercials',
      content: (
        <>
          <h2>Scope of Work (10–13)</h2>
          <h3>10. Site Search</h3>
          <p>
            Functional public-site search using WordPress-native capabilities appropriate to
            selected content.
          </p>
          <h3>11. Accessibility, Mobile Use & Performance</h3>
          <p>
            Apply contemporary accessibility/responsive practices to rebuilt templates and migrated
            launch content (WCAG 2.2 Level AA target for implementation practices; no legal
            certification).
          </p>
          <h3>12. Testing & Launch</h3>
          <p>
            Test major affected page types/workflows, backup before deployment, and validate post
            launch.
          </p>
          <h3>13. Training & Handoff</h3>
          <p>
            Includes one 60–90 minute session plus concise written reference notes.
          </p>

          <h3>Timeline & Payment</h3>
          <div className="phase-box">
            <p className="investment">Fixed Project Fee: $5,500</p>
            <p>50% ($2,750) start, 30% ($1,650) after IA/template approval, 20% ($1,100) at launch.</p>
            <p className="timeline">Estimated duration: 5–7 weeks from project start.</p>
          </div>

          <h3>Stabilization</h3>
          <p>
            30 days post-launch stabilization for defects in delivered scope. New features/content
            changes are scoped separately.
          </p>
        </>
      ),
    },
    {
      title: 'What We Found',
      content: (
        <>
          <h2>What We Found</h2>
          <p>
            This section summarizes direct observations from CGT&apos;s preliminary WordPress review and
            explains the basis for the modernization recommendation.
          </p>

          <h3>Current Environment</h3>
          <ul>
            <li>Beyond Child theme on Beyond parent theme</li>
            <li>Classic Editor + WPBakery / Visual Composer shortcodes + inline styling + raw HTML</li>
            <li>Plugin inventory in the mid-30s installed, most active</li>
            <li>External tools already used for calendars, forms, payments, registrations, and ecommerce</li>
          </ul>

          <h3>Content & Structure</h3>
          <ul>
            <li>93 WordPress pages observed across current, draft, historical, and overlapping material</li>
            <li>Legacy pages frequently mix content, layout, historical data, and external links</li>
            <li>Intentional migration and clearer IA are needed over one-for-one recreation</li>
          </ul>

          <h3>Events & Systems of Record</h3>
          <ul>
            <li>Event plugin infrastructure exists; no active event records observed during review</li>
            <li>Operational workflows continue to rely on external systems like Google Calendar</li>
            <li>Modernization should preserve effective systems of record rather than duplicate them</li>
          </ul>

          <h3>Practical Diagnosis</h3>
          <p>See the earlier Practical Diagnosis section for the implementation conclusion.</p>
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

        .proposal-container h1 {
          font-size: 28pt;
          font-weight: normal;
          margin: 2em 0 0.5em 0;
          color: #1a1a1a;
          line-height: 1.2;
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
        }

        .subtitle {
          font-size: 18pt;
          color: #7f8c8d;
          margin: 0 0 2em 0;
        }

        .meta {
          font-size: 11pt;
          color: #7f8c8d;
          margin: 0.25em 0;
        }

        .phase-box {
          background: #ecf0f1;
          padding: 1em;
          margin: 1em 0;
          border-left: 4px solid #3498db;
        }

        .investment {
          font-size: 14pt;
          font-weight: bold;
          color: #27ae60;
          margin: 0.25em 0;
        }

        .timeline {
          font-size: 10pt;
          color: #7f8c8d;
          font-style: italic;
          margin: 0;
        }

        .emphasis {
          font-style: italic;
          color: #34495e;
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
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .proposal-nav-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .proposal-nav-button:not(:disabled):hover {
          background: #f0eadf;
          border-color: #b8ae9c;
        }

        .proposal-page-content {
          min-height: 26rem;
        }

        @media print {
          body {
            background: white;
          }

          .proposal-container {
            max-width: 100%;
            padding: 0;
            background: white;
          }

          .proposal-navigation {
            display: none;
          }

          .proposal-page-content {
            min-height: 0;
          }
        }
      `}</style>

      <div className="title-section">
        <h1>WordPress Modernization Proposal (v3)</h1>
        <div className="subtitle">Firehouse Art Center</div>
        <div style={{ marginTop: '3em' }}>
          <p className="meta">
            <strong>Prepared for:</strong> Firehouse Art Center Board of Directors
          </p>
          <p className="meta">
            <strong>Prepared by:</strong> Paul Hartman
          </p>
          <p className="meta">Common Ground Technology LLC</p>
        </div>
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
    </div>
  )
}
