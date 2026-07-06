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
      title: 'Overview',
      content: (
        <>
      <h2>Executive Summary</h2>

      <p>
        The Firehouse Art Center has built an outstanding reputation as one of Longmont&apos;s most
        important cultural organizations. Its website should reflect that same level of excellence.
      </p>

      <p>
        Today, visitors encounter multiple disconnected systems to donate, register for classes,
        learn about exhibitions, purchase tickets, and engage with the organization. While each
        system serves a purpose, together they create a fragmented experience for visitors and
        additional administrative work for staff.
      </p>

      <p>
        This proposal recommends replacing the current website with a modern digital platform built
        specifically for the Firehouse. Rather than attempting to solve every problem at once,
        development is divided into manageable phases that provide immediate value while creating a
        foundation for future growth.
      </p>

      <p className="emphasis">The objective is not simply to build a better website.</p>

      <p className="emphasis">
        The objective is to create a platform that supports the Firehouse&apos;s mission for years to
        come.
      </p>

      <h2>The Opportunity</h2>

      <p>
        A visitor inspired to support the Firehouse should not have to navigate multiple websites,
        different payment systems, or inconsistent experiences.
      </p>

      <p>
        Likewise, staff should not have to manage several independent tools to accomplish everyday
        work.
      </p>

      <p>The proposed platform will provide:</p>

      <ul>
        <li>One consistent online experience</li>
        <li>Easier content management</li>
        <li>Simplified administration</li>
        <li>Improved accessibility</li>
        <li>Mobile-friendly design</li>
        <li>Secure online donations</li>
        <li>A foundation for future online services</li>
        <li>Ownership of your website and data</li>
      </ul>

      <p>
        Rather than replacing systems every few years, this platform is designed to evolve alongside
        the organization.
      </p>

      <h2>Why a Phased Approach?</h2>

      <p>Digital transformation projects are most successful when delivered incrementally.</p>

      <p>
        Each phase produces a complete, usable product while reducing risk, allowing feedback, and
        spreading investment over time.
      </p>

      <p>
        <strong>The Firehouse maintains complete control over whether to continue after each phase.</strong>
      </p>
        </>
      ),
    },
    {
      title: 'Phase One',
      content: (
        <>
      <h2>Phase One</h2>
      <h3>Modern Website Foundation</h3>

      <div className="phase-box">
        <p className="investment">Investment: $4,500</p>
        <p className="timeline">
          Estimated Timeline: Approximately four weeks following approval and receipt of required
          content.
        </p>
      </div>

      <h3>Phase One Includes</h3>

      <h3>Public Website</h3>
      <p>A completely redesigned website that reflects the quality of the Firehouse Art Center.</p>
      <p>
        <strong>Including:</strong>
      </p>
      <ul>
        <li>Home page</li>
        <li>About</li>
        <li>Mission</li>
        <li>Staff</li>
        <li>Board</li>
        <li>Volunteer information</li>
        <li>Contact information</li>
        <li>Responsive design</li>
        <li>Search engine optimization</li>
        <li>Accessibility improvements</li>
      </ul>

      <h3>Donations</h3>
      <p>A secure online donation experience powered by Stripe.</p>
      <p>
        <strong>Including:</strong>
      </p>
      <ul>
        <li>Online giving</li>
        <li>Suggested giving levels</li>
        <li>Donation confirmations</li>
        <li>Tax receipts</li>
        <li>Administrative reporting</li>
      </ul>

      <h3>Events & Exhibitions</h3>
      <p>Staff-managed pages for:</p>
      <ul>
        <li>Current exhibitions</li>
        <li>Upcoming events</li>
        <li>Exhibition details</li>
        <li>Event information</li>
        <li>Images</li>
        <li>Easy updates without technical knowledge</li>
      </ul>

      <h3>Artist Membership Applications</h3>
      <p>
        Online applications allowing artists to submit information directly through the website.
      </p>
      <p>
        <strong>Staff can:</strong>
      </p>
      <ul>
        <li>Review submissions</li>
        <li>Approve applications</li>
        <li>Communicate with applicants</li>
        <li>Maintain membership records</li>
      </ul>

      <h3>Administration</h3>
      <p>
        Secure administrative tools allowing Firehouse staff to update website content without
        requiring developer assistance.
      </p>

      <h3>Launch Services</h3>
      <ul>
        <li>Content migration</li>
        <li>Testing</li>
        <li>Deployment</li>
        <li>Staff training</li>
        <li>Launch support</li>
      </ul>

      <h3>Phase One Result</h3>
      <p>At completion, the Firehouse will have:</p>
      <ul>
        <li>
          <span className="checkmark">✓</span> A modern website
        </li>
        <li>
          <span className="checkmark">✓</span> Secure online donations
        </li>
        <li>
          <span className="checkmark">✓</span> Staff-managed events and exhibitions
        </li>
        <li>
          <span className="checkmark">✓</span> Online membership applications
        </li>
        <li>
          <span className="checkmark">✓</span> A scalable technical foundation
        </li>
      </ul>
        </>
      ),
    },
    {
      title: 'Phase Two',
      content: (
        <>
      <h2>Phase Two</h2>
      <h3>Expanded Visitor Experience</h3>

      <div className="phase-box">
        <p className="investment">Investment: $5,500</p>
      </div>

      <p>
        Phase Two builds on the new platform by improving how visitors discover and engage with
        programs.
      </p>

      <p>
        <strong>Planned enhancements include:</strong>
      </p>
      <ul>
        <li>Site search</li>
        <li>Gallery management</li>
        <li>Education catalog</li>
        <li>Community groups</li>
        <li>Enhanced administration</li>
        <li>Additional content tools</li>
      </ul>
        </>
      ),
    },
    {
      title: 'Phase Three',
      content: (
        <>
      <h2>Phase Three</h2>
      <h3>Complete Digital Platform</h3>

      <div className="phase-box">
        <p className="investment">Investment: $6,000</p>
      </div>

      <p>
        The final phase transforms the website into a comprehensive digital platform supporting
        daily operations.
      </p>

      <p>
        <strong>Potential capabilities include:</strong>
      </p>
      <ul>
        <li>Online class registration</li>
        <li>Event registration</li>
        <li>Ceramics shop</li>
        <li>Studio services</li>
        <li>Vendor applications</li>
        <li>Advanced calendar</li>
        <li>Additional workflow automation</li>
      </ul>
        </>
      ),
    },
    {
      title: 'Investment & Support',
      content: (
        <>
      <h2>Investment Summary</h2>

      <table>
        <thead>
          <tr>
            <th>Phase</th>
            <th>Investment</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Modern Website Foundation</td>
            <td>$4,500</td>
          </tr>
          <tr>
            <td>Expanded Visitor Experience</td>
            <td>$5,500</td>
          </tr>
          <tr>
            <td>Complete Digital Platform</td>
            <td>$6,000</td>
          </tr>
        </tbody>
      </table>

      <p>
        <strong>Each phase is approved independently.</strong>
      </p>
      <p>
        <strong>There is no commitment beyond the completion of any individual phase.</strong>
      </p>

      <h2>Ongoing Support</h2>

      <p>
        Following launch, Common Ground Technology can continue supporting the platform through a
        monthly maintenance agreement.
      </p>

      <p>
        <strong>Typical services include:</strong>
      </p>
      <ul>
        <li>Security updates</li>
        <li>Performance monitoring</li>
        <li>Content assistance</li>
        <li>Feature enhancements</li>
        <li>Technical support</li>
      </ul>

      <p>Support plans can be tailored to the Firehouse&apos;s needs following Phase One.</p>
        </>
      ),
    },
    {
      title: 'Why Common Ground',
      content: (
        <>
      <h2>Why Common Ground Technology?</h2>

      <p>
        Technology should support an organization&apos;s mission—not become another challenge to manage.
      </p>

      <p>
        My background is in software engineering, where long-term maintainability, reliability, and
        thoughtful design are as important as appearance.
      </p>

      <p>Rather than relying on pre-built templates or page builders, I build systems that are:</p>
      <ul>
        <li>Secure</li>
        <li>Maintainable</li>
        <li>Flexible</li>
        <li>Accessible</li>
        <li>Designed for long-term growth</li>
      </ul>

      <p>
        <strong>Most importantly, I work collaboratively.</strong>
      </p>

      <p>
        The Firehouse team brings expertise in arts programming and community engagement.
      </p>

      <p>
        My role is to provide the technical expertise needed to translate that vision into a
        platform that serves artists, visitors, members, donors, volunteers, and staff alike.
      </p>

      <h2>Success Looks Like...</h2>

      <p>
        <strong>Six months after launch:</strong>
      </p>
      <ul>
        <li>Visitors can easily discover events, exhibitions, and programs.</li>
        <li>Donors complete gifts without leaving the Firehouse website.</li>
        <li>Staff confidently update content without relying on outside developers.</li>
        <li>The website accurately reflects the professionalism and creativity of the organization.</li>
        <li>Technology becomes an asset instead of an obstacle.</li>
      </ul>

      <h2>Next Steps</h2>

      <p>
        <strong>Following board approval of Phase One:</strong>
      </p>
      <ol>
        <li>Finalize project agreement</li>
        <li>Confirm project timeline</li>
        <li>Begin content migration</li>
        <li>Complete development</li>
        <li>Staff review and training</li>
        <li>Launch the new Firehouse website</li>
      </ol>

      <h2>Closing</h2>

      <p className="closing">Thank you for considering this proposal.</p>

      <p className="closing">
        The Firehouse Art Center has served the Longmont community for decades by fostering
        creativity, education, and connection.
      </p>

      <p className="closing">
        I appreciate the opportunity to help build a digital platform that reflects that mission and
        provides a foundation for the organization&apos;s next chapter.
      </p>

      <div className="contact-info">
        <p>
          Paul Hartman
          <br />
          Common Ground Technology LLC
          <br />
          paul@loveondev.com
        </p>
      </div>
        </>
      ),
    }
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

        .phase-box h3 {
          margin-top: 0;
          color: #2c3e50;
        }

        .investment {
          font-size: 14pt;
          font-weight: bold;
          color: #27ae60;
          margin: 0.5em 0;
        }

        .timeline {
          font-size: 10pt;
          color: #7f8c8d;
          font-style: italic;
        }

        .proposal-container table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
        }

        .proposal-container th,
        .proposal-container td {
          padding: 0.75em;
          text-align: left;
          border-bottom: 1px solid #bdc3c7;
        }

        .proposal-container th {
          background: #ecf0f1;
          font-weight: bold;
          color: #2c3e50;
        }

        .checkmark {
          color: #27ae60;
          font-weight: bold;
        }

        .emphasis {
          font-style: italic;
          color: #34495e;
        }

        .closing {
          margin-top: 2em;
          font-style: italic;
        }

        .contact-info {
          margin-top: 3em;
          text-align: center;
          color: #7f8c8d;
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
          min-height: 28rem;
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
        <h1>Digital Transformation Proposal</h1>
        <div className="subtitle">A Modern Website & Unified Digital Platform</div>
        <div className="subtitle">Firehouse Art Center</div>

        <div style={{ marginTop: '3em' }}>
          <p className="meta">
            <strong>Prepared for:</strong> Firehouse Art Center Board of Directors
          </p>
          <p className="meta">
            <strong>Prepared by:</strong> Paul Hartman
          </p>
          <p className="meta">Common Ground Technology LLC</p>
          <p className="meta">July 2026</p>
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
