'use client'

import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'
import { useParams } from 'next/navigation'

type ProposalPage = {
  title: string
  content: ReactNode
}

type AppendixIssue = {
  currentBehavior: string
  expectedOutcome: string
}

type ChecklistItemStatus = 'complete' | 'needed' | 'waiting'

type ClientResponsibility = {
  text: string
  status: ChecklistItemStatus
}

export default function FirehouseProposalContent() {
  const params = useParams()
  const subdomain = params?.subdomain as string
  const [pageIndex, setPageIndex] = useState(0)
  const [appendixIssues, setAppendixIssues] = useState<AppendixIssue[]>([
    { currentBehavior: '', expectedOutcome: '' },
    { currentBehavior: '', expectedOutcome: '' },
    { currentBehavior: '', expectedOutcome: '' },
    { currentBehavior: '', expectedOutcome: '' },
    { currentBehavior: '', expectedOutcome: '' },
  ])
  const [clientResponsibilities, setClientResponsibilities] = useState<ClientResponsibility[]>([
    { text: 'current WordPress administrator access', status: 'needed' },
    { text: 'hosting/server access necessary to safely stage, back up, and deploy the project', status: 'needed' },
    { text: 'access or cooperation necessary for affected third-party systems', status: 'needed' },
    { text: 'information about existing plugin and service licenses where relevant', status: 'needed' },
    { text: 'the list of reported issues for Appendix A', status: 'needed' },
    { text: 'theme suggestions (up to 3, or CGT will recommend)', status: 'needed' },
    { text: 'identification of the 10 priority pages', status: 'needed' },
    { text: 'timely review and approval of project decisions', status: 'needed' },
    { text: 'final content, images, and organizational decisions required for the agreed pages', status: 'needed' },
  ])
  const [priorityPages, setPriorityPages] = useState<string[]>(Array(10).fill(''))
  const [themeSuggestions, setThemeSuggestions] = useState<string[]>(Array(3).fill(''))
  const [isApproved, setIsApproved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Load existing form data on mount
  useEffect(() => {
    const loadFormData = async () => {
      const { data: project } = await supabaseBrowser
        .from('projects')
        .select('proposal_form_data')
        .eq('subdomain', subdomain)
        .single()

      if (project?.proposal_form_data?.appendix_a_issues) {
        setAppendixIssues(project.proposal_form_data.appendix_a_issues)
      }
      if (project?.proposal_form_data?.client_responsibilities) {
        const saved = project.proposal_form_data.client_responsibilities
        // If saved data has old structure (8 items), migrate to new structure (9 items with theme)
        if (saved.length === 8) {
          const migrated = [
            saved[0], // WordPress access
            saved[1], // hosting/server access
            saved[2], // third-party systems
            saved[3], // plugin licenses
            saved[4], // Appendix A
            { text: 'theme suggestions (up to 3, or CGT will recommend)', status: 'needed' as ChecklistItemStatus }, // NEW
            saved[5], // 10 priority pages
            saved[6], // timely review
            saved[7], // final content
          ]
          setClientResponsibilities(migrated)
        } else {
          setClientResponsibilities(saved)
        }
      }
      if (project?.proposal_form_data?.priority_pages) {
        setPriorityPages(project.proposal_form_data.priority_pages)
      }
      if (project?.proposal_form_data?.theme_suggestions) {
        setThemeSuggestions(project.proposal_form_data.theme_suggestions)
      }
      if (project?.proposal_form_data?.approval?.accepted) {
        setIsApproved(true)
      }
    }

    if (subdomain) {
      loadFormData()
    }
  }, [subdomain])

  const updateIssue = (index: number, field: keyof AppendixIssue, value: string) => {
    const updated = [...appendixIssues]
    updated[index][field] = value
    setAppendixIssues(updated)
  }

  const updatePriorityPage = (index: number, value: string) => {
    const updated = [...priorityPages]
    updated[index] = value
    setPriorityPages(updated)
    
    // Auto-update the client responsibility checklist for priority pages
    const filledCount = updated.filter(p => p.trim() !== '').length
    const priorityPagesIndex = 6 // "identification of the 10 priority pages" is at index 6
    const responsibilitiesUpdated = [...clientResponsibilities]
    
    if (filledCount === 0) {
      responsibilitiesUpdated[priorityPagesIndex].status = 'needed'
    } else if (filledCount < 10) {
      responsibilitiesUpdated[priorityPagesIndex].status = 'waiting'
    } else {
      responsibilitiesUpdated[priorityPagesIndex].status = 'complete'
    }
    
    setClientResponsibilities(responsibilitiesUpdated)
  }

  const updateThemeSuggestion = (index: number, value: string) => {
    const updated = [...themeSuggestions]
    updated[index] = value
    setThemeSuggestions(updated)
    
    // Auto-update the client responsibility checklist for theme suggestions
    const filledCount = updated.filter(t => t.trim() !== '').length
    const themeSuggestionsIndex = 5 // "theme suggestions" is at index 5
    const responsibilitiesUpdated = [...clientResponsibilities]
    
    if (filledCount === 0) {
      responsibilitiesUpdated[themeSuggestionsIndex].status = 'needed'
    } else {
      responsibilitiesUpdated[themeSuggestionsIndex].status = 'complete'
    }
    
    setClientResponsibilities(responsibilitiesUpdated)
  }

  const toggleResponsibilityStatus = async (index: number) => {
    const updated = [...clientResponsibilities]
    const current = updated[index].status
    // Cycle through: needed → waiting → complete → needed
    updated[index].status = 
      current === 'needed' ? 'waiting' :
      current === 'waiting' ? 'complete' : 'needed'
    setClientResponsibilities(updated)
    
    // Auto-save on status change
    setIsSaving(true)
    const { error } = await supabaseBrowser
      .from('projects')
      .update({
        proposal_form_data: {
          appendix_a_issues: appendixIssues,
          client_responsibilities: updated, // Use the updated array
          priority_pages: priorityPages,
          theme_suggestions: themeSuggestions
        }
      })
      .eq('subdomain', subdomain)

    if (!error) {
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const saveFormData = async () => {
    setIsSaving(true)
    
    const { error } = await supabaseBrowser
      .from('projects')
      .update({
        proposal_form_data: {
          appendix_a_issues: appendixIssues,
          client_responsibilities: clientResponsibilities,
          priority_pages: priorityPages,
          theme_suggestions: themeSuggestions
        }
      })
      .eq('subdomain', subdomain)

    if (!error) {
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const pages: ProposalPage[] = [
    {
      title: 'The Project',
      content: (
        <>
          <h2>The Project</h2>
          <p>
            Firehouse Art Center has decided to retain WordPress and replace its current theme with a more modern foundation.
          </p>
          <p>
            Common Ground Technology will implement that change while protecting the existing website, resolving the specific technical issues identified for this project, and improving the parts of the site most important to Firehouse staff and visitors.
          </p>
          <p>
            This is intentionally a bounded project.
          </p>
          <p>
            It is <strong>not</strong> a replacement for WordPress, and it is <strong>not</strong> a rebuild of the custom platform previously explored.
          </p>
          <p>
            It is also more than installing a theme and changing colors.
          </p>
          <p>
            CGT&apos;s preliminary review found that much of the current site&apos;s layout is stored in legacy WPBakery page-builder content rather than in the theme itself. Changing the theme can therefore affect the visual frame of the site — navigation, typography, header, footer, colors, spacing, and related presentation — without automatically redesigning the content inside every existing page.
          </p>
          <p>
            This proposal accounts for that distinction.
          </p>
        </>
      ),
    },
    {
      title: 'What a New Theme Changes',
      content: (
        <>
          <h2>What a New Theme Changes — and What It Doesn&apos;t</h2>
          <p>
            This section matters more than the price, and CGT would rather set expectations now than at launch.
          </p>
          <p>
            A WordPress theme controls the <strong>frame</strong> around the site: the header, the navigation, the footer, typography, base colors, and overall styling. A new theme will visibly modernize all of that.
          </p>
          <p>
            Individual page layouts are a different matter. Firehouse&apos;s pages were built with a page builder called WPBakery, and the layout of each page — its rows, columns, spacing, and image placement — is stored inside the page itself rather than in the theme. <strong>Changing the theme does not change those layouts.</strong>
          </p>

          <h3>In practical terms, after this project:</h3>
          <ul>
            <li>The site will have a new header, navigation, footer, fonts, and colors</li>
            <li>Pages will pick up the new typography and color palette</li>
            <li>The arrangement of content within each existing page will stay broadly as it is now</li>
            <li>The specific issues Firehouse identified will be investigated and resolved</li>
          </ul>

          <p>
            What a new theme will <strong>not</strong> do is produce the redesigned page layouts from the concept site Firehouse has been reviewing. Those layouts were purpose-built. Reproducing that look inside WordPress would mean rebuilding the homepage and main section pages as new designed layouts — a larger piece of work, noted at the end of this proposal, that Firehouse can consider separately if the visual result matters more than the timeline or budget.
          </p>
          <p>
            CGT is stating this plainly so Firehouse can decide with a clear picture of the outcome.
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
            CGT reviewed the current WordPress environment before quoting — theme and child theme, plugins, editing stack, page inventory, and the external systems Firehouse uses. That review is included whether or not Firehouse proceeds.
          </p>
          <ul>
            <li><strong>The theme is customized.</strong> The site runs Beyond Child on the Beyond parent theme, so a theme change has to be tested on a copy of the site before it goes near the live one.</li>
            <li><strong>The site depends on WPBakery Page Builder.</strong> It appears to be included with the current theme rather than licensed to Firehouse directly, and the installed version is 7.8 against a current release of 9.0. This is the central technical risk in the project.</li>
            <li><strong>There are 77 published pages</strong> spanning content from multiple years.</li>
            <li><strong>Multiple external systems are in use.</strong> Firehouse uses Google Calendar, Sawyer, payment tools, forms, ecommerce, email marketing, and other services.</li>
            <li><strong>The site uses Classic Editor.</strong> WordPress&apos;s current block-editing experience is not active.</li>
            <li><strong>Significant plugin inventory</strong> with some licensing or update concerns.</li>
            <li><strong>On the plugin problem:</strong> Firehouse&apos;s understanding is that the current theme won&apos;t accept certain plugins. Themes don&apos;t generally block plugins. The likely causes are the PHP version, a conflict with the current editor configuration, or the outdated page builder. The specific issues Firehouse identified as motivating the theme change will be investigated and resolved as part of this project.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Protecting the Existing Site',
      content: (
        <>
          <h2>Protecting the Existing Site</h2>
          <p>
            Because WPBakery appears to be tied to the current theme, changing the theme carries real risk: if the page builder becomes unavailable, pages built with it can stop displaying correctly.
          </p>
          <p>
            CGT will purchase an independent WPBakery license for Firehouse, install it before any theme work begins, and confirm on a staging copy that pages still render. <strong>The license cost is included in the fee.</strong> After this, the page builder belongs to Firehouse rather than to the theme.
          </p>
          <p>
            All work happens on a staging copy. The live site is backed up first and is not touched until Firehouse approves the launch.
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
            <li>Confirmation that existing pages render correctly before proceeding</li>
          </ul>

          <h3>2. Theme Selection, Installation & Configuration</h3>
          <p>
            CGT will install and configure a modern WordPress theme appropriate for Firehouse&apos;s existing site and operational needs.
          </p>
          <p>Work includes:</p>
          <ul>
            <li>theme installation and configuration</li>
            <li>Firehouse branding</li>
            <li>typography</li>
            <li>color and visual hierarchy</li>
            <li>header and primary navigation</li>
            <li>footer</li>
            <li>buttons and calls to action</li>
            <li>responsive behavior</li>
            <li>mobile navigation</li>
            <li>general site-wide presentation settings</li>
          </ul>
          <p>
            The selected implementation will prioritize maintainability and compatibility with Firehouse&apos;s existing WordPress environment.
          </p>

          <h3>3. WPBakery Continuity</h3>
          <p>
            The current site relies extensively on WPBakery content.
          </p>
          <p>
            CGT will provide and configure an independent WPBakery license so that continued operation and updates are not unnecessarily dependent on the retiring Beyond theme.
          </p>
          <p>
            WPBakery will <strong>not</strong> be removed from all existing content under this project.
          </p>

          <h3>4. Reported Technical Issues</h3>
          <p>
            The specific issues Firehouse identified as motivating the theme change will be investigated and resolved as part of the project.
          </p>
          <p>
            These issues will be agreed in <strong>Appendix A</strong> before project commencement.
          </p>
          <p>
            Only issues included in the agreed Appendix A are included in the fixed project fee.
          </p>
        </>
      ),
    },
    {
      title: 'Scope (5–9)',
      content: (
        <>
          <h2>Scope of Work (continued)</h2>
          <h3>5. Published-Page Verification</h3>
          <p>
            Following the theme change, CGT will review all <strong>77 currently published WordPress pages</strong> for problems introduced or exposed by the transition.
          </p>
          <p>
            CGT will correct transition-related defects necessary to leave those existing published pages functional.
          </p>
          <p>
            This verification is <strong>not</strong> a redesign of all 77 pages.
          </p>

          <h3>6. Ten Priority Pages</h3>
          <p>
            Firehouse and CGT will identify up to <strong>10 priority pages</strong> to receive a more complete design and cleanup pass.
          </p>
          <p>
            These pages will be brought into the new visual system rather than merely verified for compatibility.
          </p>
          <p>Work may include:</p>
          <ul>
            <li>layout cleanup</li>
            <li>clearer visual hierarchy</li>
            <li>typography</li>
            <li>spacing</li>
            <li>image presentation</li>
            <li>buttons and calls to action</li>
            <li>content organization</li>
            <li>responsive behavior</li>
            <li>accessibility improvements</li>
            <li>removal of unnecessary legacy presentation markup where practical</li>
          </ul>

          <h3>7. Existing Tools & Services</h3>
          <p>
            Where affected by this project, CGT will preserve or reconnect existing functionality using supported configuration, links, embeds, or plugins as appropriate.
          </p>
          <p>This may include existing:</p>
          <ul>
            <li>Google Calendar workflows</li>
            <li>Sawyer links or integrations</li>
            <li>forms</li>
            <li>donation tools</li>
            <li>WooCommerce functionality</li>
            <li>PayPal and Square connections</li>
            <li>newsletter/email tools</li>
            <li>analytics</li>
            <li>other existing third-party services</li>
          </ul>

          <h3>8. Mobile, Accessibility & Performance</h3>
          <p>
            CGT will apply current responsive and accessibility practices to the new theme implementation and the 10 priority pages.
          </p>
          <p>Work includes representative review of:</p>
          <ul>
            <li>mobile, tablet, and desktop layouts</li>
            <li>navigation usability</li>
            <li>semantic structure</li>
            <li>keyboard navigation</li>
            <li>color contrast</li>
            <li>image alternative-text support</li>
            <li>responsive images and layouts</li>
            <li>unnecessary front-end overhead where reasonably addressable within this project</li>
          </ul>
          <p>
            WCAG 2.2 Level AA principles will inform implementation. This work is not a legal certification of ADA or WCAG compliance.
          </p>

          <h3>9. Testing & Launch</h3>
          <p>Before launch, CGT will perform a final review including:</p>
          <ul>
            <li>theme behavior</li>
            <li>navigation</li>
            <li>the 77-page verification pass</li>
            <li>the 10 priority pages</li>
            <li>Appendix A issues</li>
            <li>representative mobile layouts</li>
            <li>affected forms and external integrations</li>
            <li>affected donation or purchase pathways</li>
            <li>representative accessibility and performance checks</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Theme Selection',
      content: (
        <>
          <h2>Theme Selection</h2>
          <p>
            Firehouse may provide up to three WordPress theme suggestions for consideration.
          </p>
          <p>
            CGT will evaluate those themes for compatibility with the existing WordPress installation, WPBakery content, required plugins, responsive behavior, accessibility, maintainability, and other technical requirements of the project.
          </p>
          <p>
            CGT reserves the right to reject any suggested theme that presents material technical, compatibility, maintenance, or implementation concerns.
          </p>
          <p>
            If none of Firehouse&apos;s suggested themes are suitable, CGT will recommend an appropriate alternative for Firehouse&apos;s review.
          </p>
          <p>
            Once a theme is approved, changing to a different theme will be considered a change in scope and may require additional fees and schedule adjustments.
          </p>
        </>
      ),
    },
    {
      title: 'Theme Suggestions',
      content: (
        <>
          <h2>Suggest WordPress Themes</h2>
          <p>
            You may provide up to <strong>three WordPress theme suggestions</strong> for CGT to evaluate. CGT will assess each theme for compatibility with your existing WordPress installation, WPBakery content, plugins, responsive behavior, accessibility, and maintainability.
          </p>
          <p style={{ fontSize: '10pt', color: '#7f8c8d', marginBottom: '1.5em' }}>
            Please provide the theme name and/or URL. If none of your suggestions are technically suitable, CGT will recommend an appropriate alternative.
          </p>
          
          <div style={{ display: 'grid', gap: '1em' }}>
            {themeSuggestions.map((theme, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.75em' }}>
                <div
                  style={{
                    minWidth: '2.5em',
                    height: '2.5em',
                    borderRadius: '50%',
                    background: theme ? '#3498db' : '#ecf0f1',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '11pt',
                  }}
                >
                  {index + 1}
                </div>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => updateThemeSuggestion(index, e.target.value)}
                  placeholder={`Theme suggestion ${index + 1} (optional)`}
                  style={{
                    flex: 1,
                    padding: '0.75em',
                    fontFamily: 'Georgia, serif',
                    fontSize: '11pt',
                    border: '1px solid #d8d2c6',
                    borderRadius: '4px',
                    background: '#fffaf0',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5em', display: 'flex', alignItems: 'center', gap: '1em' }}>
            <button
              onClick={saveFormData}
              disabled={isSaving}
              style={{
                padding: '0.5em 1.5em',
                fontFamily: 'Georgia, serif',
                fontSize: '11pt',
                background: isSaving ? '#95a5a6' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Theme Suggestions'}
            </button>
            {lastSaved && (
              <span style={{ fontSize: '10pt', color: '#7f8c8d', fontStyle: 'italic' }}>
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div style={{ marginTop: '1.5em', padding: '1em', background: '#fff3cd', borderRadius: '4px', borderLeft: '4px solid #f39c12' }}>
            <p style={{ margin: 0, fontSize: '10pt', color: '#2c3e50' }}>
              <strong>Note:</strong> Theme suggestions are optional. All fields may be left blank if you prefer CGT to recommend a theme directly.
            </p>
          </div>
        </>
      ),
    },
    {
      title: 'Staff Training',
      content: (
        <>
          <h2>Staff Training & Handoff</h2>
          <p>
            CGT will provide one staff training session of approximately 60–90 minutes covering the site&apos;s revised editing and maintenance workflow.
          </p>
          <p>Training will focus on the areas staff need for routine operation, including:</p>
          <ul>
            <li>editing pages</li>
            <li>updating images</li>
            <li>maintaining priority content</li>
            <li>navigating the revised WordPress environment</li>
            <li>avoiding unnecessary reintroduction of legacy layout complexity</li>
          </ul>
          <p>
            Concise reference documentation for common editing tasks will also be provided.
          </p>
          <p>
            The goal is for Firehouse staff to continue making normal content updates without needing CGT to perform routine edits.
          </p>
        </>
      ),
    },
    {
      title: 'Priority Pages',
      content: (
        <>
          <h2>Select Your 10 Priority Pages</h2>
          <p>
            As part of the project, up to <strong>10 priority pages</strong> will receive a more complete design and cleanup pass. Please identify which pages you&apos;d like prioritized.
          </p>
          <p style={{ fontSize: '10pt', color: '#7f8c8d', marginBottom: '0.5em' }}>
            Provide the page title or URL path for each page. These will receive layout cleanup, improved typography, better visual hierarchy, and accessibility improvements.
          </p>
          
          {(() => {
            const filledCount = priorityPages.filter(p => p.trim() !== '').length
            const getProgressColor = () => {
              if (filledCount === 0) return '#e74c3c'
              if (filledCount < 10) return '#f39c12'
              return '#27ae60'
            }
            const getProgressText = () => {
              if (filledCount === 0) return 'No pages selected yet'
              if (filledCount < 10) return `${filledCount} of 10 pages selected`
              return 'All 10 pages selected ✓'
            }
            
            return (
              <div style={{
                marginBottom: '1.5em',
                padding: '0.75em 1em',
                background: '#f8f9fa',
                borderRadius: '4px',
                border: `2px solid ${getProgressColor()}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: 'bold', color: getProgressColor() }}>
                  {getProgressText()}
                </span>
                <div style={{ display: 'flex', gap: '0.25em' }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '1.5em',
                        height: '1.5em',
                        borderRadius: '2px',
                        background: i < filledCount ? '#27ae60' : '#ecf0f1',
                        transition: 'background 0.2s'
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })()}
          
          <div style={{ display: 'grid', gap: '1em' }}>
            {priorityPages.map((page, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.75em' }}>
                <div
                  style={{
                    minWidth: '2em',
                    height: '2em',
                    borderRadius: '50%',
                    background: page ? '#27ae60' : '#ecf0f1',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '10pt',
                  }}
                >
                  {index + 1}
                </div>
                <input
                  type="text"
                  value={page}
                  onChange={(e) => updatePriorityPage(index, e.target.value)}
                  placeholder={`Page ${index + 1} (e.g., "Homepage" or "/about")`}
                  style={{
                    flex: 1,
                    padding: '0.75em',
                    fontFamily: 'Georgia, serif',
                    fontSize: '11pt',
                    border: '1px solid #d8d2c6',
                    borderRadius: '4px',
                    background: '#fffaf0',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5em', display: 'flex', alignItems: 'center', gap: '1em' }}>
            <button
              onClick={saveFormData}
              disabled={isSaving}
              style={{
                padding: '0.5em 1.5em',
                fontFamily: 'Georgia, serif',
                fontSize: '11pt',
                background: isSaving ? '#95a5a6' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Priority Pages'}
            </button>
            {lastSaved && (
              <span style={{ fontSize: '10pt', color: '#7f8c8d', fontStyle: 'italic' }}>
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div style={{ marginTop: '1.5em', padding: '1em', background: '#e8f5e9', borderRadius: '4px', borderLeft: '4px solid #27ae60' }}>
            <p style={{ margin: 0, fontSize: '10pt', color: '#2c3e50' }}>
              <strong>Note:</strong> You can save partially filled lists and come back to complete them later. Pages marked with a green circle have been entered.
            </p>
          </div>
        </>
      ),
    },
    {
      title: 'Out of Scope',
      content: (
        <>
          <h2>What This Project Does Not Include</h2>
          <p>
            To keep the project predictable for both Firehouse and CGT, the following are outside the $4,000 fixed scope:
          </p>
          <ul>
            <li>redesigning or rebuilding all 77 published pages</li>
            <li>remediation of all historical, draft, private, duplicated, or obsolete content</li>
            <li>complete removal of WPBakery</li>
            <li>rebuilding the previously demonstrated custom Firehouse platform</li>
            <li>a new membership-management system</li>
            <li>a new event-management or registration system</li>
            <li>rebuilding Sawyer functionality</li>
            <li>rebuilding Google Calendar functionality</li>
            <li>new ecommerce functionality</li>
            <li>significant WooCommerce redevelopment</li>
            <li>custom API development</li>
            <li>replacement of existing third-party operational systems</li>
            <li>ongoing content entry or routine site maintenance after the stabilization period</li>
            <li>technical problems not identified in Appendix A or caused by this project</li>
          </ul>
          <p style={{ marginTop: '1.5em' }}>
            Additional work can be evaluated and quoted separately if Firehouse determines it would be valuable.
          </p>
        </>
      ),
    },
    {
      title: 'Client Responsibilities',
      content: (
        <>
          <h2>Client Responsibilities</h2>
          <p>Firehouse will provide:</p>
          <div style={{ marginTop: '1em' }}>
            {clientResponsibilities.map((item, index) => {
              const getIcon = (status: ChecklistItemStatus) => {
                if (status === 'complete') return '✓'
                if (status === 'waiting') return '⏳'
                return '?'
              }
              const getColor = (status: ChecklistItemStatus) => {
                if (status === 'complete') return '#27ae60'
                if (status === 'waiting') return '#f39c12'
                return '#e74c3c'
              }
              const getLabel = (status: ChecklistItemStatus) => {
                if (status === 'complete') return 'Complete'
                if (status === 'waiting') return 'Waiting'
                return 'Needed'
              }
              
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75em',
                    marginBottom: '0.75em',
                    padding: '0.5em',
                    background: '#fffaf0',
                    borderRadius: '4px',
                    border: '1px solid #ecf0f1',
                  }}
                >
                  <button
                    onClick={() => toggleResponsibilityStatus(index)}
                    style={{
                      minWidth: '2.5em',
                      height: '2.5em',
                      borderRadius: '4px',
                      border: '2px solid',
                      borderColor: getColor(item.status),
                      background: 'white',
                      color: getColor(item.status),
                      fontSize: '16pt',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title={`Click to change status (currently: ${getLabel(item.status)})`}
                  >
                    {getIcon(item.status)}
                  </button>
                  <div style={{ flex: 1, paddingTop: '0.4em' }}>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: '11pt' }}>
                      {item.text}
                    </span>
                    <div style={{ fontSize: '9pt', color: '#7f8c8d', marginTop: '0.25em' }}>
                      Status: {getLabel(item.status)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ marginTop: '1em', fontSize: '10pt', color: '#7f8c8d', fontStyle: 'italic' }}>
            Click each item to cycle through: ? Needed → ⏳ Waiting → ✓ Complete
          </p>
          <p>
            The project schedule begins once the access required to perform the work safely has been verified.
          </p>
          <p>
            Delays in access, content, approvals, or third-party cooperation may affect the project schedule.
          </p>

          <h3 style={{ marginTop: '2em' }}>Hosting Access Assumption</h3>
          <p>
            This proposal assumes CGT can obtain the hosting, server, database, and related access necessary to safely back up, stage, test, and deploy the existing WordPress site. CGT has previously requested this access, but it has not yet been established. If recovering or replacing the existing hosting infrastructure requires additional investigation, vendor coordination, account recovery, migration, or infrastructure setup, that work is outside this proposal and will be scoped separately before proceeding.
          </p>
        </>
      ),
    },
    {
      title: 'Investment',
      content: (
        <>

          <div className="phase-box">
            <p className="investment">Fixed Project Fee: $4,000</p>
            <table style={{ width: '100%', marginTop: '1em' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5em' }}>Stage</th>
                  <th style={{ textAlign: 'right', padding: '0.5em' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5em' }}>50% — Due upon acceptance and before project work begins</td>
                  <td style={{ textAlign: 'right', padding: '0.5em' }}><strong>$2,000</strong></td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5em' }}>50% — Due at production launch and handoff</td>
                  <td style={{ textAlign: 'right', padding: '0.5em' }}><strong>$2,000</strong></td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: '1em' }}>
              Third-party software or service costs other than the WPBakery license specifically included in this proposal are not included unless explicitly identified in writing.
            </p>
          </div>

          <h3 style={{ marginTop: '2em' }}>Estimated Schedule</h3>
          <p>
            The project is expected to require approximately <strong>4–6 weeks</strong> from project start.
          </p>
          <p>
            The schedule assumes timely access, selection of the 10 priority pages, agreement on Appendix A, and reasonable turnaround on client reviews and decisions.
          </p>
        </>
      ),
    },
    {
      title: 'After Launch',
      content: (
        <>
          <h2>Post-Launch Stabilization</h2>
          <p>
            The project includes <strong>30 days of post-launch stabilization</strong>.
          </p>
          <p>
            During this period, CGT will correct defects in functionality delivered under this proposal at no additional charge.
          </p>
          <p>
            A defect is a failure of the agreed work to operate as intended.
          </p>
          <p>
            New features, new content, redesign requests, newly identified pre-existing problems, or changes in requirements are not considered defects and may be quoted separately.
          </p>

          <h3 style={{ marginTop: '2em' }}>Optional WordPress Care</h3>
          <p>
            After stabilization, Firehouse may elect ongoing WordPress care for:
          </p>
          <div className="phase-box" style={{ marginTop: '1em' }}>
            <p className="investment">$250/month</p>
          </div>
          <p style={{ marginTop: '1em' }}>The care plan may include:</p>
          <ul>
            <li>routine WordPress core updates</li>
            <li>theme and plugin updates</li>
            <li>review of update-related compatibility issues</li>
            <li>routine site-health review</li>
            <li>minor maintenance related to the delivered implementation</li>
            <li>coordination with Firehouse when an update requires work outside routine maintenance</li>
          </ul>
          <p>
            New features, substantial content work, redesign, third-party platform work, and repairs unrelated to routine WordPress maintenance are not included.
          </p>
          <p>
            The care plan is optional and may be established under a separate ongoing-services agreement.
          </p>
        </>
      ),
    },
    {
      title: 'Platform Note',
      content: (
        <>
          <h2>A Note About the Earlier Platform Proposal</h2>
          <p>
            The earlier proposal responded to a broader set of requested capabilities and explored replacing portions of Firehouse&apos;s existing digital environment with custom software.
          </p>
          <p>
            Firehouse has since clarified an important requirement: <strong>WordPress should remain the website&apos;s content-management system.</strong>
          </p>
          <p>
            CGT&apos;s subsequent review found that the site&apos;s immediate needs can be addressed without replacing WordPress.
          </p>
          <p>
            The recommendation changed because the understanding of the problem changed.
          </p>
          <p style={{ marginTop: '1.5em' }}>
            This proposal therefore focuses on modernizing and stabilizing the system Firehouse already uses rather than replacing it.
          </p>
        </>
      ),
    },
    {
      title: 'Next Steps',
      content: (
        <>
          <h2>Next Steps</h2>
          <p>To begin:</p>
          <ol>
            <li>Firehouse approves this proposal and project fee.</li>
            <li>Firehouse and CGT complete <strong>Appendix A — Reported Issues</strong>.</li>
            <li>Firehouse identifies the <strong>10 priority pages</strong>.</li>
            <li>Required WordPress, hosting, and relevant service access is verified.</li>
            <li>The initial payment is made.</li>
            <li>CGT establishes the implementation environment and begins work.</li>
          </ol>

          <h3 style={{ marginTop: '3em' }}>Appendix A — Reported Issues</h3>
          <p>
            The following issues must be agreed before project commencement to be included within the fixed project scope.
          </p>
          <table style={{ width: '100%', marginTop: '1em', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5em', width: '10%', borderBottom: '2px solid #bdc3c7' }}>Issue</th>
                <th style={{ textAlign: 'left', padding: '0.5em', width: '45%', borderBottom: '2px solid #bdc3c7' }}>Current Behavior</th>
                <th style={{ textAlign: 'left', padding: '0.5em', width: '45%', borderBottom: '2px solid #bdc3c7' }}>Expected Outcome</th>
              </tr>
            </thead>
            <tbody>
              {appendixIssues.map((issue, index) => (
                <tr key={index}>
                  <td style={{ padding: '0.5em', verticalAlign: 'top', borderBottom: '1px solid #ecf0f1', fontWeight: 'bold' }}>
                    {index + 1}.
                  </td>
                  <td style={{ padding: '0.5em', borderBottom: '1px solid #ecf0f1' }}>
                    <textarea
                      value={issue.currentBehavior}
                      onChange={(e) => updateIssue(index, 'currentBehavior', e.target.value)}
                      placeholder="Describe the current behavior or problem..."
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '0.5em',
                        fontFamily: 'Georgia, serif',
                        fontSize: '10pt',
                        border: '1px solid #d8d2c6',
                        borderRadius: '4px',
                        resize: 'vertical',
                        background: '#fffaf0',
                      }}
                    />
                  </td>
                  <td style={{ padding: '0.5em', borderBottom: '1px solid #ecf0f1' }}>
                    <textarea
                      value={issue.expectedOutcome}
                      onChange={(e) => updateIssue(index, 'expectedOutcome', e.target.value)}
                      placeholder="Describe the expected outcome..."
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '0.5em',
                        fontFamily: 'Georgia, serif',
                        fontSize: '10pt',
                        border: '1px solid #d8d2c6',
                        borderRadius: '4px',
                        resize: 'vertical',
                        background: '#fffaf0',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '1em', display: 'flex', alignItems: 'center', gap: '1em' }}>
            <button
              onClick={saveFormData}
              disabled={isSaving}
              style={{
                padding: '0.5em 1.5em',
                fontFamily: 'Georgia, serif',
                fontSize: '11pt',
                background: isSaving ? '#95a5a6' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Issues'}
            </button>
            {lastSaved && (
              <span style={{ fontSize: '10pt', color: '#7f8c8d', fontStyle: 'italic' }}>
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p style={{ marginTop: '1em', fontSize: '10pt', color: '#7f8c8d' }}>
            Additional issues may be added before proposal acceptance by mutual agreement.
          </p>
          <p style={{ fontSize: '10pt', color: '#7f8c8d' }}>
            Problems identified after project commencement that fall outside this list and are not caused by the work delivered under this proposal are outside the fixed project scope.
          </p>

          <h3 style={{ marginTop: '3em' }}>Acceptance</h3>
          <p>
            By approving this proposal, Firehouse Art Center authorizes Common Ground Technology LLC to perform the work described above for a fixed project fee of <strong>$4,000</strong>, subject to the scope, assumptions, exclusions, and responsibilities stated in this proposal.
          </p>

          <div style={{ marginTop: '2em', padding: '2em', background: '#e8f5e9', borderRadius: '8px', border: '2px solid #27ae60', textAlign: 'center' }}>
            <p style={{ margin: '0 0 1em 0', fontSize: '12pt', fontWeight: 'bold', color: '#27ae60' }}>
              Ready to proceed?
            </p>
            <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
              {!isApproved && (
                <button
                  onClick={async () => {
                  if (confirm('Are you ready to accept this proposal and authorize Common Ground Technology to begin work?')) {
                    setIsSaving(true)
                    
                    // Save approval to projects.proposal_form_data.approval
                    const { error: projectError } = await supabaseBrowser
                      .from('projects')
                      .update({
                        proposal_form_data: {
                          ...{ appendix_a_issues: appendixIssues, client_responsibilities: clientResponsibilities, priority_pages: priorityPages, theme_suggestions: themeSuggestions },
                          approval: {
                            accepted: true,
                            accepted_at: new Date().toISOString(),
                          }
                        }
                      })
                      .eq('subdomain', subdomain)
                    
                    // Get current user and project for the message
                    const { data: { user } } = await supabaseBrowser.auth.getUser()
                    const { data: project } = await supabaseBrowser
                      .from('projects')
                      .select('id')
                      .eq('subdomain', subdomain)
                      .single()
                    
                    // Send acceptance message to client_messages
                    if (user && project) {
                      await supabaseBrowser
                        .from('client_messages')
                        .insert({
                          sender_id: user.id,
                          project_id: project.id,
                          message: '✓ Proposal accepted: Firehouse Art Center - WordPress Theme Modernization & Stabilization (v6) - $4,000',
                          is_read: false,
                        })
                    }
                    
                    setIsSaving(false)
                    if (!projectError) {
                      setIsApproved(true)
                      alert('Thank you! Your acceptance has been recorded. Paul will reach out shortly to coordinate the first steps.')
                    } else {
                      alert('There was an error recording your acceptance. Please contact Paul directly at paul@loveondev.com')
                    }
                  }
                }}
                disabled={isSaving}
                style={{
                  padding: '1em 3em',
                  fontFamily: 'Georgia, serif',
                  fontSize: '14pt',
                  fontWeight: 'bold',
                  background: isSaving ? '#95a5a6' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {isSaving ? 'Processing...' : '✓ Accept Proposal'}
              </button>
              )}
              
              <button
                onClick={async () => {
                  const concern = prompt('What questions or concerns do you have about this proposal?')
                  if (concern && concern.trim()) {
                    setIsSaving(true)
                    
                    const { data: { user } } = await supabaseBrowser.auth.getUser()
                    const { data: project } = await supabaseBrowser
                      .from('projects')
                      .select('id')
                      .eq('subdomain', subdomain)
                      .single()
                    
                    if (user && project) {
                      const { error } = await supabaseBrowser
                        .from('client_messages')
                        .insert({
                          sender_id: user.id,
                          project_id: project.id,
                          message: `Proposal v6 Question/Concern: ${concern.trim()}`,
                          is_read: false,
                        })
                      
                      setIsSaving(false)
                      if (!error) {
                        alert('Your message has been sent to Paul. He will respond shortly.')
                      } else {
                        alert('There was an error sending your message. Please email Paul directly at paul@loveondev.com')
                      }
                    } else {
                      setIsSaving(false)
                      alert('Unable to send message. Please email Paul directly at paul@loveondev.com')
                    }
                  }
                }}
                disabled={isSaving}
                style={{
                  padding: '1em 2em',
                  fontFamily: 'Georgia, serif',
                  fontSize: '11pt',
                  background: isSaving ? '#95a5a6' : 'white',
                  color: '#34495e',
                  border: '2px solid #3498db',
                  borderRadius: '4px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {isSaving ? 'Sending...' : '💬 Questions or Concerns?'}
              </button>
            </div>
            {isApproved && (
              <div style={{ marginTop: '1.5em', padding: '1em', background: '#d4edda', borderRadius: '4px', border: '1px solid #c3e6cb' }}>
                <p style={{ margin: 0, fontSize: '11pt', color: '#155724', fontWeight: 'bold' }}>
                  ✓ Proposal Accepted
                </p>
                <p style={{ margin: '0.5em 0 0 0', fontSize: '10pt', color: '#155724' }}>
                  Thank you for accepting this proposal. Paul will be in touch shortly to begin the next steps.
                </p>
              </div>
            )}
            {!isApproved && (
              <p style={{ margin: '1em 0 0 0', fontSize: '9pt', color: '#7f8c8d', fontStyle: 'italic' }}>
                Clicking Accept confirms your acceptance of the proposal terms
              </p>
            )}
          </div>

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
        <h1>Firehouse Art Center</h1>
        <div className="subtitle">WordPress Theme Modernization & Stabilization</div>
        <div style={{ marginTop: '3em' }}>
          <p className="meta">
            <strong>Prepared for:</strong> Firehouse Art Center
          </p>
          <p className="meta">
            <strong>Prepared by:</strong> Paul Hartman, Common Ground Technology LLC
          </p>
          <p className="meta" style={{ marginTop: '1.5em' }}>
            <strong>Fixed Project Fee:</strong> $4,000
          </p>
          <p className="meta">
            <strong>Estimated Duration:</strong> 4–6 weeks from project start
          </p>
        </div>
        
        {/* Quick Action Buttons */}
        <div style={{ marginTop: '2em', display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              const clientRespIndex = pages.findIndex(p => p.title === 'Client Responsibilities')
              if (clientRespIndex !== -1) goToPage(clientRespIndex)
            }}
            style={{
              padding: '0.75em 1.5em',
              fontFamily: 'Georgia, serif',
              fontSize: '10pt',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5em',
            }}
          >
            <span>✓</span>
            <span>Client Checklist</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              const priorityPagesIndex = pages.findIndex(p => p.title === 'Priority Pages')
              if (priorityPagesIndex !== -1) goToPage(priorityPagesIndex)
            }}
            style={{
              padding: '0.75em 1.5em',
              fontFamily: 'Georgia, serif',
              fontSize: '10pt',
              background: '#9b59b6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5em',
            }}
          >
            <span>📝</span>
            <span>Select Priority Pages</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              const themeSuggestionsIndex = pages.findIndex(p => p.title === 'Theme Suggestions')
              if (themeSuggestionsIndex !== -1) goToPage(themeSuggestionsIndex)
            }}
            style={{
              padding: '0.75em 1.5em',
              fontFamily: 'Georgia, serif',
              fontSize: '10pt',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5em',
            }}
          >
            <span>🎨</span>
            <span>Theme Suggestions</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              const nextStepsIndex = pages.findIndex(p => p.title === 'Next Steps')
              if (nextStepsIndex !== -1) goToPage(nextStepsIndex)
            }}
            style={{
              padding: '0.75em 1.5em',
              fontFamily: 'Georgia, serif',
              fontSize: '10pt',
              background: '#e67e22',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5em',
            }}
          >
            <span>📋</span>
            <span>Appendix A (Issues)</span>
          </button>
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
