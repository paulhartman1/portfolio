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
            Firehouse stays on WordPress. Staff keep the editing access they have today. Nothing about how the team updates the site changes as a result of this project.
          </p>
          <p>
            What changes is how the site looks and how visitors move through it. CGT will implement the design direction Elaine and the executive committee laid out in the July 9 click-through map — the navigation order, the section layouts, the button treatments, the color and typography decisions — as a modern, responsive WordPress site.
          </p>
          <p>
            This is a design and presentation project. It is deliberately not a rebuild of the site&apos;s underlying content structure, and it is not a replacement for WordPress.
          </p>
        </>
      ),
    },
    {
      title: 'Why the Fee Differs',
      content: (
        <>
          <h2>Why the Fee Differs from the Earlier Quote</h2>
          <p>
            The July 10 pilot was quoted at $2,000, described at the time as a discount against a normal range of $4,000–6,000. That discount was offered as a first step toward the larger platform engagement, and it applied to work on a system CGT had already spent months building. The board has since chosen a different direction, so both the discount and the reusable groundwork no longer apply.
          </p>
          <p>
            This proposal covers different work on a different platform. The design direction carries over; none of the underlying build does. Implementing the July 9 map inside Firehouse&apos;s existing WordPress installation means starting from that installation, with its current theme, page builder, and content.
          </p>
          <p>
            CGT&apos;s prior volunteer work is not billed in this proposal and is not being recovered through it.
          </p>
        </>
      ),
    },
    {
      title: 'What CGT Found',
      content: (
        <>
          <h2>What CGT Found</h2>
          <p>
            CGT reviewed the current WordPress environment before quoting: the theme and child theme, plugin inventory, editing stack, page inventory, representative content, and the external systems Firehouse relies on. That review is included with this proposal whether or not Firehouse proceeds.
          </p>
          <ul>
            <li><strong>The theme is a customized setup.</strong> The site runs Beyond Child on the Beyond parent theme. Customization like this is normal, but it means theme work has to be tested on a copy of the site first.</li>
            <li><strong>The site is built with WPBakery Page Builder.</strong> Nearly every page depends on it. WPBakery appears to be included with the current theme rather than licensed to Firehouse directly, and the installed version is 7.8 against a current release of 9.0. This is the most important technical fact about the site, and it determines how the work has to be sequenced.</li>
            <li><strong>Content and layout are stored together.</strong> On most pages, text and images live inside layout code. This is why editing feels harder than it should. This project improves that on the pages it touches; it does not resolve it site-wide.</li>
            <li><strong>There is about a decade of accumulated content.</strong> 93 pages, 77 published, with several duplicated concepts and some pages carrying multiple years of an annual event in the same place.</li>
            <li><strong>The events plugins are empty.</strong> The Events Calendar and Event Tickets are installed and active but hold no event records. Firehouse&apos;s events live in Google Calendar. CGT does not recommend investing in the unused WordPress event system.</li>
            <li><strong>Nothing here indicates the site is broken or unsafe.</strong> Outdated software and lapsed plugin licenses are maintenance items. They are noted because they affect planning, not because they represent an emergency.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'What This Project Is',
      content: (
        <>
          <h2>What This Project Is</h2>
          <p>
            A refresh of the public-facing design, implementing the board&apos;s approved direction:
          </p>
          <ul>
            <li>The navigation order agreed in the July 9 map: <strong>Exhibits, Education, Events, Ceramics, Membership, Support</strong></li>
            <li>A redesigned homepage with the section layouts described in the map</li>
            <li>The button treatment requested: squared corners rather than rounded, black text on white backgrounds, Firehouse orange reserved for section titles</li>
            <li>Photo-based buttons in the Exhibits and Ceramics sections</li>
            <li>Arrow-based browsing where a section has more items than fit cleanly</li>
            <li>A search icon in the header</li>
            <li>The footer structure specified in the map: About, Resources, Support, newsletter signup, address, social links, and SCFD acknowledgement</li>
            <li>Consistent styling applied across the site, so existing pages inherit the new look</li>
          </ul>
          <p>
            Existing pages that are not individually rebuilt will still take on the new theme&apos;s typography, color, spacing, and responsive behavior.
          </p>

          <h2 style={{ marginTop: '2em' }}>What This Project Is Not</h2>
          <ul>
            <li>Not a rebuild of the remaining pages beyond the priority set</li>
            <li>Not a restructuring of how content is organized behind the scenes</li>
            <li>Not a removal of WPBakery from legacy pages</li>
            <li>Not a new events, membership, or e-commerce system</li>
            <li>Not a replacement for Sawyer, PayPal, Square, Google Calendar, Google Forms, or any other system currently in use</li>
          </ul>
          <p>
            Those systems continue to work exactly as they do now.
          </p>
        </>
      ),
    },
    {
      title: 'Protecting the Existing Site',
      content: (
        <>
          <h2>Protecting the Existing Site</h2>
          <p>
            Because WPBakery appears to be tied to the current theme, changing the theme carries a real risk: if the page builder becomes unavailable, pages built with it can stop displaying correctly.
          </p>
          <p>
            CGT will manage this by purchasing an independent WPBakery license for Firehouse, installing it before any theme work begins, and verifying on a staging copy that existing pages still render. <strong>The license cost is included in the project fee.</strong> After this, the page builder belongs to Firehouse rather than to the theme.
          </p>
          <p>
            All work happens on a staging copy. The live site is backed up before anything is deployed and is not touched until Firehouse approves the launch.
          </p>
        </>
      ),
    },
    {
      title: 'Scope (1–4)',
      content: (
        <>
          <h2>Scope of Work</h2>
          <h3>1. Setup and Safety</h3>
          <ul>
            <li>Staging copy of the live site</li>
            <li>Full backup before any change</li>
            <li>Independent WPBakery license purchased and installed</li>
            <li>Verification that existing pages render correctly before proceeding</li>
          </ul>

          <h3>2. Theme Selection and Foundation</h3>
          <ul>
            <li>Recommendation of a modern, actively maintained theme suited to the approved design direction, presented for approval</li>
            <li>Installation and configuration on staging</li>
            <li>Review of existing child-theme customizations so current functionality is preserved</li>
            <li>Firehouse typography, color, and spacing applied site-wide</li>
          </ul>

          <h3>3. Homepage</h3>
          <p>The homepage is rebuilt to the July 9 map, including:</p>
          <ul>
            <li>Section order and hierarchy as specified</li>
            <li>Section layouts for Exhibits, Education, Events, Ceramics, Membership, and Support</li>
            <li>Button styling per the approved treatment</li>
            <li>Arrow-based browsing where the map calls for it</li>
            <li>Header with search icon</li>
            <li>Responsive behavior across phone, tablet, and desktop</li>
          </ul>

          <h3>4. Navigation and Footer</h3>
          <ul>
            <li>Primary navigation implemented in the approved order</li>
            <li>Mobile navigation</li>
            <li>Footer implemented to the structure in the map</li>
            <li>Newsletter signup placement (destination to be confirmed by Firehouse)</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Scope (5–9)',
      content: (
        <>
          <h2>Scope of Work (continued)</h2>
          <h3>5. Priority Pages</h3>
          <p>
            CGT will rebuild and clean up <strong>10 pages</strong>, selected together with Firehouse from analytics after the theme is approved. Expected candidates include the main landing pages for the six navigation sections plus the highest-traffic program and support pages.
          </p>
          <p>
            For these pages, work includes layout rebuild in the new design, correction of outdated or contradictory information, and image handling.
          </p>
          <p>
            Remaining pages keep their current structure and inherit the new site-wide styling.
          </p>
          <p>
            If a selected page turns out to contain several years of layered historical content, CGT will flag it before starting and agree an approach with Firehouse rather than absorbing an open-ended rebuild.
          </p>

          <h3>6. Editing Access</h3>
          <p>
            Staff keep the WordPress editing access they have today. Everything currently editable — member portfolios, shop products, exhibit photos, page content — remains editable by Firehouse staff without developer involvement, exactly as now.
          </p>

          <h3>7. Accessibility, Mobile, and Performance</h3>
          <p>Applied to the new theme, homepage, and the 10 priority pages:</p>
          <ul>
            <li>Semantic page structure and heading order</li>
            <li>Keyboard-accessible navigation</li>
            <li>Color contrast review</li>
            <li>Image alternative text support</li>
            <li>Responsive layouts tested at representative phone, tablet, and desktop sizes</li>
            <li>Image optimization and reduction of unnecessary front-end weight where practical</li>
          </ul>
          <p>
            WCAG 2.2 Level AA is used as a working target for implementation practice. This is not a legal compliance certification.
          </p>

          <h3>8. Testing and Launch</h3>
          <ul>
            <li>Testing across current browsers and common phone sizes</li>
            <li>Verification that existing forms, donation links, and shop functionality still work</li>
            <li>Preservation of existing web addresses so search rankings and external links are not lost</li>
            <li>Redirects for any address that intentionally changes</li>
            <li>Launch coordinated at a time Firehouse chooses</li>
          </ul>

          <h3>9. Training and Handoff</h3>
          <ul>
            <li>One 90-minute staff training session, recorded</li>
            <li>Written reference notes for common editing tasks</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Revisions & Boundaries',
      content: (
        <>
          <h2>Revisions</h2>
          <p>
            One consolidated round of revisions is included, gathered after Firehouse reviews the staging site.
          </p>
          <p>
            The July 9 map serves as the approved design direction. Changes consistent with it are part of the project. New sections, new page types, or a change in overall direction fall outside this scope and can be quoted separately.
          </p>

          <h2 style={{ marginTop: '2em' }}>Scope Boundaries and Assumptions</h2>
          <ul>
            <li><strong>WordPress remains.</strong> The board&apos;s decision is respected. This project does not replace WordPress.</li>
            <li><strong>Page rebuilds are bounded.</strong> Ten pages are individually rebuilt. The other pages inherit the new styling but are not reconstructed.</li>
            <li><strong>Existing systems are preserved, not re-engineered.</strong> Sawyer, PayPal, Square, Google Calendar, Google Forms, WooCommerce, and other current tools continue to operate as they do today. Custom API work is not included.</li>
            <li><strong>Artist and member work is presentation only.</strong> The existing member gallery is restyled. No membership management, approval, or billing system is included, and Elaine&apos;s current ability to add member portfolios is unchanged.</li>
            <li><strong>Events use Google Calendar.</strong> The website presents events; Google Calendar remains the source of truth. No new event system is built.</li>
            <li><strong>Firehouse provides:</strong> WordPress and hosting administrator access, Google Analytics access, logo and brand files, confirmation of the newsletter destination, a single named decision-maker, and feedback within 5 business days at each review point.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Timeline & Payment',
      content: (
        <>
          <h2>Acceptance Criteria</h2>
          <p>The project is complete when:</p>
          <ul>
            <li>The approved theme is installed and configured on the live site</li>
            <li>The homepage matches the approved design direction</li>
            <li>Navigation and footer are implemented as specified</li>
            <li>The 10 agreed priority pages are rebuilt and reviewed</li>
            <li>Existing pages display correctly under the new theme</li>
            <li>Staff editing access is confirmed working</li>
            <li>Existing forms, donation links, and shop functionality are verified</li>
            <li>Mobile, accessibility, and performance checks are complete</li>
            <li>One round of revisions has been completed</li>
            <li>Firehouse has approved launch</li>
          </ul>

          <div className="phase-box">
            <p className="investment">Fixed Project Fee: $5,500</p>
            <table style={{ width: '100%', marginTop: '1em' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5em' }}>Stage</th>
                  <th style={{ textAlign: 'right', padding: '0.5em' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5em' }}>On acceptance — work begins after payment</td>
                  <td style={{ textAlign: 'right', padding: '0.5em' }}><strong>$2,750</strong></td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5em' }}>On approval of theme and homepage direction</td>
                  <td style={{ textAlign: 'right', padding: '0.5em' }}><strong>$1,650</strong></td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5em' }}>At launch and handoff</td>
                  <td style={{ textAlign: 'right', padding: '0.5em' }}><strong>$1,100</strong></td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: '1em' }}>
              The fee is fixed. It changes only if Firehouse requests work outside this scope, and only by written agreement in advance.
            </p>
          </div>

          <h3>Estimated Duration</h3>
          <p className="timeline">5–7 weeks from project start.</p>
          <table style={{ width: '100%', marginTop: '1em' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5em' }}>Week</th>
                <th style={{ textAlign: 'left', padding: '0.5em' }}>Tasks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.5em' }}>1</td>
                <td style={{ padding: '0.5em' }}>Setup, staging, backups, WPBakery license, analytics review, priority page selection</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5em' }}>2</td>
                <td style={{ padding: '0.5em' }}>Theme recommendation and approval</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5em' }}>3–4</td>
                <td style={{ padding: '0.5em' }}>Homepage, navigation, footer, site-wide styling</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5em' }}>4–5</td>
                <td style={{ padding: '0.5em' }}>Priority pages, accessibility, performance</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5em' }}>6</td>
                <td style={{ padding: '0.5em' }}>Firehouse review and consolidated revisions</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5em' }}>7</td>
                <td style={{ padding: '0.5em' }}>Launch and training</td>
              </tr>
            </tbody>
          </table>
          <p>
            Firehouse has noted that launch is likely best after ArtWalk in September. CGT can schedule the project to land accordingly.
          </p>
        </>
      ),
    },
    {
      title: 'After Launch & Later Phases',
      content: (
        <>
          <h2>After Launch</h2>
          <p>
            <strong>30 days of stabilization</strong> is included. CGT will correct defects in delivered work at no additional charge. New requests are not defects and can be scoped separately.
          </p>
          <p>
            <strong>Ongoing care — optional, $250/month, month to month:</strong>
          </p>
          <ul>
            <li>WordPress core, theme, and plugin updates, tested before applying</li>
            <li>Weekly offsite backups</li>
            <li>Uptime and security monitoring</li>
            <li>Up to 1 hour of content edits or small changes per month</li>
            <li>Priority response</li>
            <li>A short quarterly note on the site&apos;s condition</li>
          </ul>
          <p>
            Most of the conditions described in &quot;What CGT Found&quot; accumulate in the absence of routine maintenance rather than from any single decision.
          </p>

          <h2 style={{ marginTop: '2em' }}>Later Phases — Quoted Separately</h2>
          <p>Available once this work is live, if Firehouse finds them valuable:</p>
          <ul>
            <li>Rebuilding the remaining pages in the new design</li>
            <li>Retiring WPBakery in favor of WordPress&apos;s modern block editor</li>
            <li>Consolidating duplicate pages and reorganizing site-wide content structure</li>
            <li>Structured content types for Exhibitions, Programs, and Artists, so annual events no longer stack inside a single page</li>
            <li>Automatic event display from Google Calendar</li>
            <li>Consolidating the multiple form systems currently installed</li>
            <li>Review or rework of the WooCommerce shop</li>
            <li>New photography or written content</li>
          </ul>

          <h2 style={{ marginTop: '2em' }}>Why the Recommendation Changed</h2>
          <p>
            The earlier proposal responded to a broad set of requested capabilities and assumed a new administrative system would be needed to support them.
          </p>
          <p>
            The board has since made clear that staying on WordPress, and keeping staff able to update the site directly, is itself a requirement. CGT reviewed the existing WordPress installation against that requirement and found it can be met.
          </p>
          <p>
            The recommendation changed because the understanding of the requirement changed.
          </p>
        </>
      ),
    },
    {
      title: 'Next Steps',
      content: (
        <>
          <h2>Next Steps</h2>
          <ol>
            <li>Approve the proposal and fee.</li>
            <li>Confirm the specific issues the board wants addressed, so they can be verified at launch.</li>
            <li>Provide WordPress, hosting, and analytics access.</li>
            <li>Agree the 10 priority pages.</li>
            <li>Begin implementation.</li>
          </ol>
          <p style={{ marginTop: '2em' }}>
            Questions are welcome before anything is signed, including questions about whether this is the right starting point. CGT is happy to join a board meeting to walk through the direction.
          </p>

          <div style={{ marginTop: '4em', paddingTop: '2em', borderTop: '2px solid #ecf0f1' }}>
            <p><strong>Common Ground Technology LLC</strong></p>
            <p>Paul Hartman — paul@loveondev.com</p>
          </div>
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

        .proposal-container ul,
        .proposal-container ol {
          margin: 0.5em 0 1em 0;
          padding-left: 1.5em;
        }

        .proposal-container li {
          margin: 0.25em 0;
        }

        .proposal-container table {
          border-collapse: collapse;
        }

        .proposal-container th {
          border-bottom: 2px solid #bdc3c7;
          font-weight: bold;
        }

        .proposal-container td {
          border-bottom: 1px solid #ecf0f1;
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
        <h1>Firehouse Art Center — Website Refresh</h1>
        <div className="subtitle">Proposal (v5)</div>
        <div style={{ marginTop: '3em' }}>
          <p className="meta">
            <strong>Client:</strong> Firehouse Art Center
          </p>
          <p className="meta">
            <strong>Contact:</strong> Elaine Waterman, Executive Director
          </p>
          <p className="meta">
            <strong>Project:</strong> Design-led refresh of the public website, on WordPress
          </p>
          <p className="meta">
            <strong>Fixed Price:</strong> $5,500
          </p>
          <p className="meta">
            <strong>Estimated Duration:</strong> 5–7 weeks
          </p>
          <p className="meta" style={{ marginTop: '2em' }}>
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
