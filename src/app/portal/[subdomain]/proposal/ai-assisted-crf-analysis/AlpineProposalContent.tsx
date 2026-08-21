'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

type ProposalPage = {
  title: string
  content: ReactNode
}

type AccessOption = '' | '1' | '2' | '3'
type YesNo = '' | 'yes' | 'no' | 'unknown'
type Confirm = '' | 'yes' | 'needs_discussion'

type DecisionForm = {
  code_location: string
  code_access_path: string
  access_option: AccessOption
  legal_review_needed: YesNo
  legal_review_notes: string
  provider_terms_confirmed: Confirm
  provider_terms_notes: string
  jurisdiction_system: string
  historical_cases_notes: string
  christie_operator_confirmed: Confirm
  contamination_accepted: Confirm
  condition_a_approved: Confirm
  condition_b_deferred: Confirm
  materiality_rubric_approved: Confirm
  materiality_rubric_notes: string
  historical_time_data_exists: YesNo
  time_data_notes: string
  artifact_retention_schedule: string
  general_notes: string
  experiment_authorized: boolean
  authorized_at: string | null
  authorized_by_name: string
}

const emptyForm: DecisionForm = {
  code_location: '',
  code_access_path: '',
  access_option: '',
  legal_review_needed: '',
  legal_review_notes: '',
  provider_terms_confirmed: '',
  provider_terms_notes: '',
  jurisdiction_system: '',
  historical_cases_notes: '',
  christie_operator_confirmed: '',
  contamination_accepted: '',
  condition_a_approved: '',
  condition_b_deferred: '',
  materiality_rubric_approved: '',
  materiality_rubric_notes: '',
  historical_time_data_exists: '',
  time_data_notes: '',
  artifact_retention_schedule: '',
  general_notes: '',
  experiment_authorized: false,
  authorized_at: null,
  authorized_by_name: '',
}

export default function AlpineProposalContent() {
  const params = useParams()
  const subdomain = params?.subdomain as string
  const [pageIndex, setPageIndex] = useState(0)
  const [form, setForm] = useState<DecisionForm>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const loadFormData = async () => {
      const { data: project, error } = await supabaseBrowser
        .from('projects')
        .select('proposal_form_data')
        .eq('subdomain', subdomain)
        .single()

      if (error) {
        setLoadError(error.message)
        return
      }

      const saved = project?.proposal_form_data?.rich_decisions
      if (saved && typeof saved === 'object') {
        setForm({ ...emptyForm, ...saved })
      }
    }

    if (subdomain) {
      loadFormData()
    }
  }, [subdomain])

  const updateField = <K extends keyof DecisionForm>(key: K, value: DecisionForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveFormData = async (nextForm: DecisionForm = form) => {
    setIsSaving(true)
    const { data: project } = await supabaseBrowser
      .from('projects')
      .select('proposal_form_data')
      .eq('subdomain', subdomain)
      .single()

    const existing =
      project?.proposal_form_data && typeof project.proposal_form_data === 'object'
        ? project.proposal_form_data
        : {}

    const { error } = await supabaseBrowser
      .from('projects')
      .update({
        proposal_form_data: {
          ...existing,
          rich_decisions: nextForm,
        },
      })
      .eq('subdomain', subdomain)

    setIsSaving(false)
    if (!error) {
      setLastSaved(new Date())
      return true
    }
    alert('There was an error saving your answers. Please try again or contact Paul at paul@loveondev.com')
    return false
  }

  const authorizeExperiment = async () => {
    if (
      !confirm(
        'Authorize Experiment 001 as a bounded experiment under the decisions recorded in this proposal?'
      )
    ) {
      return
    }

    const authorizedForm: DecisionForm = {
      ...form,
      experiment_authorized: true,
      authorized_at: new Date().toISOString(),
      authorized_by_name: form.authorized_by_name.trim() || 'Rich Chopyak',
    }

    setIsSaving(true)
    const saved = await saveFormData(authorizedForm)
    if (!saved) {
      setIsSaving(false)
      return
    }

    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser()
    const { data: project } = await supabaseBrowser
      .from('projects')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (user && project) {
      await supabaseBrowser.from('client_messages').insert({
        sender_id: user.id,
        project_id: project.id,
        message:
          '✓ Experiment authorized: Proposal 001 — CRF Analysis Experiment (access option ' +
          (authorizedForm.access_option || 'unspecified') +
          ')',
        is_read: false,
      })
    }

    setForm(authorizedForm)
    setIsSaving(false)
    alert('Thank you. Experiment authorization has been recorded.')
  }

  const fieldStyle: CSSProperties = {
    width: '100%',
    padding: '0.55em 0.65em',
    fontFamily: 'Georgia, serif',
    fontSize: '10.5pt',
    border: '1px solid #d8d2c6',
    borderRadius: '4px',
    background: '#fffaf0',
    color: '#2c3e50',
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '10.5pt',
    fontWeight: 'bold',
    margin: '0 0 0.35em 0',
    color: '#2c3e50',
  }

  const decisionBox = (title: string, children: ReactNode) => (
    <div className="decision-box">
      <p className="decision-title">{title}</p>
      {children}
    </div>
  )

  const saveBar = (
    <div className="save-bar">
      <button type="button" className="save-button" onClick={() => saveFormData()} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save answers'}
      </button>
      {lastSaved && (
        <span className="save-meta">Last saved: {lastSaved.toLocaleTimeString()}</span>
      )}
      {loadError && <span className="save-error">Load issue: {loadError}</span>}
    </div>
  )

  const pages: ProposalPage[] = [
    {
      title: 'Problem & Hypothesis',
      content: (
        <>
          <h2>1. Problem and Experimental Hypothesis</h2>
          <p>
            Alpine receives CRFs/change requests electronically. Producing a valid response can
            require understanding the request, reconstructing current behavior, finding relevant
            code and prior work, identifying ambiguity, reasoning about impact, estimating effort,
            and preparing a defensible response.
          </p>
          <p>
            Much of that work depends on experienced staff who know the systems and their history.
          </p>

          <blockquote>
            <p>
              <strong>Known Operating Constraint</strong>
              <br />
              For Pennsylvania CRFs, the 72-hour response window begins when the client sends the
              request. Manual discovery and intake therefore consume part of the available response
              time. Experiment 001 accepts manual intake deliberately so that intake automation does
              not become another experimental variable.
            </p>
            <p>
              <strong>Estimated timeline:</strong> 1–2 weeks after approval and data availability,
              subject to Alpine reviewer availability.
            </p>
          </blockquote>

          <h3>Hypotheses (sequenced, not simultaneous)</h3>
          <p>
            <strong>H1 — primary, tested first:</strong> Giving a reasoning model access to
            Alpine&apos;s codebase — bounded by an agreed security/access model (Section 3) — will
            improve the usefulness of CRF analysis compared with the request alone.
          </p>
          <p>
            <strong>H2 — deferred, tested only if earned:</strong> Adding Alpine&apos;s historical
            CRF precedent (past requests + Alpine&apos;s actual responses) will <em>further</em>{' '}
            improve usefulness beyond code access alone.
          </p>
          <p>
            We&apos;re testing H1 first and holding H2 back deliberately. Building a usable
            historical-precedent reference set carries real cost — curating PRE/POST pairs, and
            enforcing an anti-leakage rule so no held-out case can see its own answer or a document
            derived from it. That cost is only worth paying if code access alone leaves a specific,
            identified gap that precedent would plausibly close. If code access alone gets Alpine
            most of the value, we&apos;ve saved that build entirely.
          </p>
          <p>
            &ldquo;Improve&rdquo; means more than better prose. The system must recover important
            reasoning, expose uncertainty, avoid unsupported technical claims, and reduce expert
            reconstruction work without replacing it with equal or greater verification work.
          </p>

          <h3>Why We Still Need Christie&apos;s Actual Answer, Even Without Feeding It In</h3>
          <p>
            Historical cases give Alpine something most AI pilots lack: a real comparison target —
            even under H1, where the system never sees the historical answer as input.
          </p>
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>PRE</strong>
                </td>
                <td>
                  The request as the client originally sent it, plus code/material available at that
                  time.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>POST</strong>
                </td>
                <td>
                  The response Alpine actually sent. Not fed to the system under H1 — used only
                  afterward, as evidence of Alpine&apos;s historical conclusion, not unquestionable
                  ground truth.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>TEST</strong>
                </td>
                <td>
                  Give the system PRE and code access; hide POST; freeze the generated analysis;
                  then reveal POST and compare against expert judgment.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            This is the direct answer to &ldquo;give it a CRF Christie&apos;s already done, in its
            undone state, and compare to what she actually did&rdquo; — the POST is the scoring
            anchor whether or not precedent is part of the system&apos;s input.
          </p>

          <h3>What Experiment 001 Is Not</h3>
          <ul>
            <li>Not a production CRF-response system.</li>
            <li>Not approval for automated Outlook/Slack intake.</li>
            <li>
              Not proof that a given redaction approach, access model, or cloud provider is secure
              or contractually permissible long-term.
            </li>
            <li>Not a fine-tuning or machine-learning project.</li>
            <li>Not an autonomous client-response workflow.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Experiment Design',
      content: (
        <>
          <h2>2. Experiment Design</h2>
          <p className="emphasis">
            Start small, change one meaningful variable at a time, and stop if the premise fails.
          </p>

          <h3>Conditions</h3>
          <p>
            <strong>Condition 0 — Request only.</strong> No code, no precedent. Establishes the
            floor: what a general frontier model can infer with nothing Alpine-specific.
          </p>
          <p>
            <strong>Condition A — Request + code access, no precedent.</strong>{' '}
            <em>(Primary test.)</em> The system may access code bounded by whichever access model
            Rich approves in Section 3. This is the first real question: does code access alone
            materially help.
          </p>
          <p>
            <strong>Condition B — Request + code + historical precedent.</strong>{' '}
            <em>(Deferred.)</em> Added only if Condition A leaves a specific, named gap — e.g.,
            recurring ambiguity that past decisions have already resolved — that precedent would
            plausibly close. Not added by default.
          </p>

          <h3>Data Split (still required, even without precedent as input)</h3>
          <p>
            <strong>Held-out test set:</strong> Historical PRE only, plus code access. The real POST
            is hidden until the generated analysis has been frozen and scored.
          </p>
          <p>
            <strong>Temporal rule:</strong> Where practical, the system receives only code/material
            that existed before the held-out request was answered. Cases that can&apos;t be bounded
            well enough are excluded or explicitly marked contaminated.
          </p>

          <h3>Initial Learning Cycle</h3>
          <p>
            Run five deliberately varied held-out cases first. Add up to five more only if the first
            five don&apos;t expose a fatal flaw or a clear next question.
          </p>
          <ul>
            <li>One strongly precedent-based case.</li>
            <li>One moderately familiar case.</li>
            <li>One case requiring clarification.</li>
            <li>One technically complex or relatively novel case, where available.</li>
            <li>
              Begin with one jurisdiction/system; do not mix PA and Louisiana unless Rich confirms
              comparability.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: 'Security / Access Model',
      content: (
        <>
          <h2>3. Security Considerations — Access Model (for Rich to weigh)</h2>
          <p>
            This section is the direct answer to the open question raised in our meeting:{' '}
            <em>
              should Experiment 001 point at the existing codebase, or wait for dedicated
              infrastructure?
            </em>
          </p>
          <p>
            <strong>Note on current code location:</strong> this proposal does not assume the code
            lives on GitHub. As of this writing, our understanding is that it&apos;s hosted on bare
            metal on a secure private network — GitHub came up in our conversation as a desired
            future direction (moving off Visual SourceSafe), not a confirmed current state.{' '}
            <strong>
              Rich should confirm the actual location and access path as part of approving Section
              3
            </strong>
            , since that materially affects which access option (below) is even feasible.
          </p>
          <p>
            <strong>Constraint driving this section:</strong> CGT does not currently hold a signed
            data-use agreement with Pennsylvania or Louisiana. Until one exists, CGT&apos;s
            principals should not directly view or handle actual client CRF content or the codebase
            tied to those contracts.
          </p>
          <p>
            <strong>Proposed operating model:</strong> CGT and Christie build the analysis
            tool/agent configuration together. Christie — already vetted, with existing system
            access — operates it, feeding in the actual CRF and code. CGT sees the tool&apos;s
            design, prompts, and de-identified outputs for review, not the raw client data or
            codebase directly.
          </p>
          <p>
            Three ways to bound code access, in order of increasing exposure and decreasing setup
            cost:
          </p>
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>How it works</th>
                <th>Trade-off</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>1. Scoped snippets</strong>
                </td>
                <td>
                  Christie supplies only the relevant classes/functions/schema sections per case,
                  not the full repo.
                </td>
                <td>
                  Lowest exposure. Slower to prepare — someone has to pre-select what&apos;s
                  relevant, which may itself miss context the model would otherwise find.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>2. Full read access, no-training/no-retention agent</strong>
                </td>
                <td>
                  Christie runs the tool against the real repo through a provider configured so data
                  isn&apos;t used for training and isn&apos;t retained.
                </td>
                <td>
                  Faster, no manual snippet selection. Depends on trusting the vendor&apos;s stated
                  data-handling terms — worth confirming those terms explicitly rather than assuming
                  them.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>3. Fully local/self-hosted model, no internet access</strong>
                </td>
                <td>e.g., a self-hosted model on Alpine hardware with no external connectivity.</td>
                <td>
                  Nothing ever leaves Alpine. Requires GPU hardware Alpine may not currently have,
                  and a self-hosted model likely reasons less capably than a frontier cloud model —
                  a real trade-off, and probably more than a $0, 1–2 week experiment needs to resolve
                  up front.
                </td>
              </tr>
            </tbody>
          </table>
          <div className="phase-box">
            <p className="investment">Recommendation: start with Option 1 (scoped snippets)</p>
            <p>
              It requires no new infrastructure decision, keeps exposure lowest, and still directly
              answers H1. If it proves promising but manual snippet-selection becomes the
              bottleneck, that&apos;s itself a finding — and the exact kind of evidence that would
              justify moving to Option 2 for a later experiment, not something to assume up front.
            </p>
          </div>
          <p>
            Whichever option Rich selects, it should be confirmed <em>before</em> any code or CRF
            content is sent to a model provider — this is a precondition for running Experiment 001,
            not a future architecture question.
          </p>

          {decisionBox(
            'Rich response — Section 3',
            <>
              <label style={labelStyle}>Actual code location (confirm/correct)</label>
              <textarea
                style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' }}
                value={form.code_location}
                onChange={(e) => updateField('code_location', e.target.value)}
                placeholder="e.g. bare metal on secure private network; not GitHub"
              />
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Access path for Experiment 001</label>
              <textarea
                style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' }}
                value={form.code_access_path}
                onChange={(e) => updateField('code_access_path', e.target.value)}
                placeholder="How Christie/operator would obtain scoped code for a case"
              />
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Approved access option</label>
              <select
                style={fieldStyle}
                value={form.access_option}
                onChange={(e) => updateField('access_option', e.target.value as AccessOption)}
              >
                <option value="">Select…</option>
                <option value="1">Option 1 — Scoped snippets (recommended)</option>
                <option value="2">Option 2 — Full read, no-training/no-retention agent</option>
                <option value="3">Option 3 — Fully local/self-hosted, no internet</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>
                Contract / legal / compliance review needed before code reaches a model provider?
              </label>
              <select
                style={fieldStyle}
                value={form.legal_review_needed}
                onChange={(e) => updateField('legal_review_needed', e.target.value as YesNo)}
              >
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown / needs discussion</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Notes</label>
              <textarea
                style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' }}
                value={form.legal_review_notes}
                onChange={(e) => updateField('legal_review_notes', e.target.value)}
                placeholder="Any constraints, required reviewers, or caveats"
              />
              {saveBar}
            </>
          )}
        </>
      ),
    },
    {
      title: 'Validity Controls',
      content: (
        <>
          <h2>4. Validity Controls Before the First Run</h2>
          <p className="emphasis">
            These are blocking controls, not polish. Without them the experiment may produce
            impressive-looking but uninterpretable results.
          </p>
          <ul>
            <li>
              <strong>External data handling.</strong> No historical client material or code is sent
              to any model provider until Rich/Alpine approves the exact access model (Section 3)
              and confirms whether contract, legal, or compliance review is required.
            </li>
            <li>
              <strong>Model-provider data terms.</strong> Whichever provider is used, confirm in
              writing that inputs are not retained or used for training — this is separate from, and
              in addition to, the access-model decision above.
            </li>
            <li>
              <strong>Evaluator blinding.</strong> Remove condition labels (0/A/B) and model labels
              before expert scoring. Reveal only after scores are recorded.
            </li>
            <li>
              <strong>Evaluator contamination.</strong> Where practical, the scorer should not be
              the person who originally authored the historical POST. If Christie is both the only
              available domain expert and the original author, document the contamination rather
              than presenting the evaluation as blind.
            </li>
            <li>
              <strong>Materiality rubric.</strong> Before any output is seen, define critical /
              significant / minor issues and what counts as a correct identification, omission,
              unsupported claim, or appropriate unknown.
            </li>
            <li>
              <strong>Case-selection rule.</strong> Fix the sample categories before model outputs
              are generated. Don&apos;t choose cases because they seem likely to make the system
              look good or bad.
            </li>
            <li>
              <strong>Anti-leakage.</strong> Held-out POSTs, later CRFs that quote them, post-event
              documentation, later code/comments, and commit messages referencing the eventual
              change are excluded from what the system can see — this still applies even though
              precedent isn&apos;t part of Condition A&apos;s input, because it protects the
              integrity of the POST as a scoring anchor.
            </li>
            <li>
              <strong>Baseline honesty.</strong> If reliable historical effort data doesn&apos;t
              exist, Experiment 001 will not claim measured time savings — it will record experiment
              effort and establish a prospective baseline for later live work.
            </li>
            <li>
              <strong>Artifact retention.</strong> Redacted/scoped packets, model outputs, and
              scores are retained only as long as needed to complete scoring and write up findings,
              then deleted on an agreed schedule — this should be confirmed alongside Section 3, not
              left open.
            </li>
          </ul>

          {decisionBox(
            'Rich response — provider terms & validity gates',
            <>
              <label style={labelStyle}>
                Confirm model-provider data terms (no training, no retention) will be verified in
                writing before use
              </label>
              <select
                style={fieldStyle}
                value={form.provider_terms_confirmed}
                onChange={(e) =>
                  updateField('provider_terms_confirmed', e.target.value as Confirm)
                }
              >
                <option value="">Select…</option>
                <option value="yes">Confirmed</option>
                <option value="needs_discussion">Needs discussion</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Notes</label>
              <textarea
                style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' }}
                value={form.provider_terms_notes}
                onChange={(e) => updateField('provider_terms_notes', e.target.value)}
                placeholder="Preferred provider, ZDR requirements, open questions"
              />
              {saveBar}
            </>
          )}
        </>
      ),
    },
    {
      title: 'Measures & Stop Rules',
      content: (
        <>
          <h2>5. What We Measure — and What Makes Us Stop</h2>
          <table>
            <thead>
              <tr>
                <th>Quality / Reasoning</th>
                <th>Effort / Boundary</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Important behavior and dependencies identified</td>
                <td>Time preparing/approving input</td>
              </tr>
              <tr>
                <td>Meaningful ambiguities surfaced</td>
                <td>Time reviewing and verifying output</td>
              </tr>
              <tr>
                <td>Code referenced correctly and relevantly</td>
                <td>Time correcting the analysis</td>
              </tr>
              <tr>
                <td>Unsupported claims and omissions</td>
                <td>Categories withheld vs. transmitted</td>
              </tr>
              <tr>
                <td>Appropriate &ldquo;insufficient evidence&rdquo;</td>
                <td>What missing context materially blocked reasoning</td>
              </tr>
              <tr>
                <td>Provenance for important claims</td>
                <td>Client-sent timestamp → experiment start timestamp</td>
              </tr>
            </tbody>
          </table>

          <h3>Stop or redesign if</h3>
          <ul>
            <li>
              Review/verification effort is roughly equal to the current investigation burden.
            </li>
            <li>
              Unsupported technical claims are frequent enough that the first pass can&apos;t be
              trusted as useful work.
            </li>
            <li>
              <strong>
                Code access alone does not materially improve analysis over the request alone
              </strong>{' '}
              (i.e., H1 isn&apos;t supported).
            </li>
            <li>
              Useful performance requires information/access Alpine can&apos;t permissibly provide
              under any of the three options in Section 3.
            </li>
            <li>
              The system mostly imitates plausible-sounding structure while missing real technical
              reasoning.
            </li>
            <li>
              The available historical record is too incomplete or temporally contaminated to
              interpret the result.
            </li>
          </ul>

          <h3>What earns a next step</h3>
          <ul>
            <li>
              <strong>Add historical precedent (Condition B):</strong> only if Condition A leaves a
              specific, named gap that precedent would plausibly close — not by default.
            </li>
            <li>
              <strong>Move to Option 2 access (full read, no-training agent):</strong> only if
              Option 1&apos;s manual snippet-selection step repeatedly becomes the bottleneck.
            </li>
            <li>
              <strong>Larger historical corpus / better retrieval:</strong> only if precedent (once
              tested) helps and coverage/retrieval is the limiting factor.
            </li>
            <li>
              <strong>Automated intake:</strong> only if analysis proves useful and intake latency
              materially consumes the 72-hour window.
            </li>
            <li>
              <strong>Fine-tuning / other ML:</strong> only if retrieval + prompting reaches a
              repeatable limitation that a learned component has a plausible mechanism to address.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: 'Decisions Requested',
      content: (
        <>
          <h2>6. Decisions Requested from Rich</h2>
          <p className="emphasis">
            CGT is asking for authorization to run a bounded experiment — not approval of a
            production architecture.
          </p>
          <ol className="flow-list">
            <li>
              Choose the first jurisdiction/system and approve the population of historical cases
              suitable for testing.
            </li>
            <li>
              <strong>Approve an access model from Section 3 (Option 1 recommended)</strong> and
              confirm whether contract/legal/compliance review is needed before any code reaches a
              model provider.
            </li>
            <li>
              Confirm the model-provider data terms (no training, no retention) required regardless
              of which access option is chosen.
            </li>
            <li>
              Confirm Christie as the operator/evaluator, and accept documented contamination for
              her dual role where independence isn&apos;t practical.
            </li>
            <li>
              Approve Condition A (code + request, no precedent) as the first test; Condition B (add
              precedent) is added only if the evidence earns it.
            </li>
            <li>Approve the severity/materiality rubric before any model output is scored.</li>
            <li>
              Confirm whether reliable historical time-per-CRF data exists; if not, accept that
              Experiment 001 will not claim measured time savings.
            </li>
            <li>
              Confirm the artifact retention/destruction schedule for redacted packets, outputs, and
              scores.
            </li>
          </ol>

          {decisionBox(
            'Rich responses — decisions 1–8',
            <>
              <p className="decision-subtitle">1. Jurisdiction / system & case population</p>
              <label style={labelStyle}>First jurisdiction/system</label>
              <input
                style={fieldStyle}
                value={form.jurisdiction_system}
                onChange={(e) => updateField('jurisdiction_system', e.target.value)}
                placeholder="e.g. Pennsylvania — [system name]"
              />
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>
                Historical cases suitable for testing
              </label>
              <textarea
                style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
                value={form.historical_cases_notes}
                onChange={(e) => updateField('historical_cases_notes', e.target.value)}
                placeholder="Population notes, inclusions/exclusions, who will assemble the set"
              />

              <p className="decision-subtitle">2. Access model (also editable in Section 3)</p>
              <select
                style={fieldStyle}
                value={form.access_option}
                onChange={(e) => updateField('access_option', e.target.value as AccessOption)}
              >
                <option value="">Select…</option>
                <option value="1">Option 1 — Scoped snippets (recommended)</option>
                <option value="2">Option 2 — Full read, no-training/no-retention agent</option>
                <option value="3">Option 3 — Fully local/self-hosted, no internet</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Legal/compliance review needed?</label>
              <select
                style={fieldStyle}
                value={form.legal_review_needed}
                onChange={(e) => updateField('legal_review_needed', e.target.value as YesNo)}
              >
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown / needs discussion</option>
              </select>

              <p className="decision-subtitle">3. Model-provider data terms</p>
              <select
                style={fieldStyle}
                value={form.provider_terms_confirmed}
                onChange={(e) =>
                  updateField('provider_terms_confirmed', e.target.value as Confirm)
                }
              >
                <option value="">Select…</option>
                <option value="yes">Confirmed — no training / no retention required</option>
                <option value="needs_discussion">Needs discussion</option>
              </select>

              <p className="decision-subtitle">4. Christie as operator/evaluator</p>
              <label style={labelStyle}>Confirm Christie as operator/evaluator</label>
              <select
                style={fieldStyle}
                value={form.christie_operator_confirmed}
                onChange={(e) =>
                  updateField('christie_operator_confirmed', e.target.value as Confirm)
                }
              >
                <option value="">Select…</option>
                <option value="yes">Confirmed</option>
                <option value="needs_discussion">Needs discussion / alternate</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>
                Accept documented contamination where independence isn&apos;t practical
              </label>
              <select
                style={fieldStyle}
                value={form.contamination_accepted}
                onChange={(e) => updateField('contamination_accepted', e.target.value as Confirm)}
              >
                <option value="">Select…</option>
                <option value="yes">Accepted</option>
                <option value="needs_discussion">Needs discussion</option>
              </select>

              <p className="decision-subtitle">5. Conditions A / B</p>
              <label style={labelStyle}>
                Approve Condition A (request + code, no precedent) as first test
              </label>
              <select
                style={fieldStyle}
                value={form.condition_a_approved}
                onChange={(e) => updateField('condition_a_approved', e.target.value as Confirm)}
              >
                <option value="">Select…</option>
                <option value="yes">Approved</option>
                <option value="needs_discussion">Needs discussion</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>
                Condition B only if evidence earns it
              </label>
              <select
                style={fieldStyle}
                value={form.condition_b_deferred}
                onChange={(e) => updateField('condition_b_deferred', e.target.value as Confirm)}
              >
                <option value="">Select…</option>
                <option value="yes">Agreed</option>
                <option value="needs_discussion">Needs discussion</option>
              </select>

              <p className="decision-subtitle">6. Severity / materiality rubric</p>
              <select
                style={fieldStyle}
                value={form.materiality_rubric_approved}
                onChange={(e) =>
                  updateField('materiality_rubric_approved', e.target.value as Confirm)
                }
              >
                <option value="">Select…</option>
                <option value="yes">Will approve before scoring (or attach notes)</option>
                <option value="needs_discussion">Needs discussion</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Rubric notes / draft criteria</label>
              <textarea
                style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' }}
                value={form.materiality_rubric_notes}
                onChange={(e) => updateField('materiality_rubric_notes', e.target.value)}
              />

              <p className="decision-subtitle">7. Historical time-per-CRF data</p>
              <select
                style={fieldStyle}
                value={form.historical_time_data_exists}
                onChange={(e) =>
                  updateField('historical_time_data_exists', e.target.value as YesNo)
                }
              >
                <option value="">Select…</option>
                <option value="yes">Yes — reliable historical data exists</option>
                <option value="no">
                  No — Experiment 001 will not claim measured time savings
                </option>
                <option value="unknown">Unknown</option>
              </select>
              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Notes</label>
              <textarea
                style={{ ...fieldStyle, minHeight: '60px', resize: 'vertical' }}
                value={form.time_data_notes}
                onChange={(e) => updateField('time_data_notes', e.target.value)}
              />

              <p className="decision-subtitle">8. Artifact retention / destruction</p>
              <textarea
                style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
                value={form.artifact_retention_schedule}
                onChange={(e) => updateField('artifact_retention_schedule', e.target.value)}
                placeholder="How long redacted packets, outputs, and scores may be retained; destruction trigger"
              />

              <p className="decision-subtitle">Additional notes</p>
              <textarea
                style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
                value={form.general_notes}
                onChange={(e) => updateField('general_notes', e.target.value)}
                placeholder="Anything else CGT should know before starting"
              />

              <label style={{ ...labelStyle, marginTop: '0.9em' }}>Name for authorization record</label>
              <input
                style={fieldStyle}
                value={form.authorized_by_name}
                onChange={(e) => updateField('authorized_by_name', e.target.value)}
                placeholder="Rich Chopyak"
              />

              {saveBar}

              <div className="authorize-box">
                <p className="authorize-heading">Ready to authorize Experiment 001?</p>
                <p className="authorize-copy">
                  This records Alpine authorization to run the bounded experiment described here —
                  not approval of a production architecture.
                </p>
                <div className="authorize-actions">
                  {!form.experiment_authorized && (
                    <button
                      type="button"
                      className="authorize-button"
                      onClick={authorizeExperiment}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Processing...' : '✓ Authorize Experiment 001'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="concern-button"
                    disabled={isSaving}
                    onClick={async () => {
                      const concern = prompt(
                        'What questions or concerns do you have about this proposal?'
                      )
                      if (!concern?.trim()) return
                      setIsSaving(true)
                      const {
                        data: { user },
                      } = await supabaseBrowser.auth.getUser()
                      const { data: project } = await supabaseBrowser
                        .from('projects')
                        .select('id')
                        .eq('subdomain', subdomain)
                        .single()
                      if (user && project) {
                        const { error } = await supabaseBrowser.from('client_messages').insert({
                          sender_id: user.id,
                          project_id: project.id,
                          message: `Proposal 001 Question/Concern: ${concern.trim()}`,
                          is_read: false,
                        })
                        setIsSaving(false)
                        if (!error) {
                          alert('Your message has been sent to Paul.')
                        } else {
                          alert(
                            'There was an error sending your message. Please email paul@loveondev.com'
                          )
                        }
                      } else {
                        setIsSaving(false)
                        alert('Unable to send message. Please email paul@loveondev.com')
                      }
                    }}
                  >
                    {isSaving ? 'Sending...' : '💬 Questions or Concerns?'}
                  </button>
                </div>
                {form.experiment_authorized && (
                  <div className="authorized-banner">
                    <p>
                      <strong>✓ Experiment authorized</strong>
                    </p>
                    <p>
                      Recorded
                      {form.authorized_at
                        ? ` ${new Date(form.authorized_at).toLocaleString()}`
                        : ''}
                      {form.authorized_by_name ? ` · ${form.authorized_by_name}` : ''}
                      {form.access_option ? ` · Access option ${form.access_option}` : ''}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <h3>Known Future Opportunity — Deliberately Out of Scope</h3>
          <blockquote>
            <p>
              <strong>If Experiment 001 succeeds:</strong> a later Alpine-controlled agent could
              ingest CRFs, retrieve approved code and (eventually) history, prepare a minimized
              context package, preserve provenance, and reduce intake latency through ticketing
              integration. None of that is proposed for implementation here — each capability must
              be earned by evidence from the preceding step.
            </p>
          </blockquote>

          <h3>CGT Operating Constraints</h3>
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rule 0</td>
                <td>Question everything.</td>
              </tr>
              <tr>
                <td>Know the problem</td>
                <td>Test CRF analysis, not an imagined production system.</td>
              </tr>
              <tr>
                <td>Make work visible</td>
                <td>Preserve inputs, access decisions, outputs, edits, and scores.</td>
              </tr>
              <tr>
                <td>Work together</td>
                <td>Alpine retains domain, security, and architecture authority.</td>
              </tr>
              <tr>
                <td>Simple steps</td>
                <td>0 → A → B only when evidence earns the next condition.</td>
              </tr>
              <tr>
                <td>Composition</td>
                <td>Keep intake, access model, reasoning, and review independently replaceable.</td>
              </tr>
              <tr>
                <td>Validate</td>
                <td>Use held-out evidence and expert judgment, not plausibility.</td>
              </tr>
              <tr>
                <td>Release often</td>
                <td>Five-case learning cycle before scale.</td>
              </tr>
              <tr>
                <td>Prefer automation</td>
                <td>Automate only demonstrated repeated work.</td>
              </tr>
            </tbody>
          </table>

          <div className="phase-box">
            <p className="investment">Understand first. Build second.</p>
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
          margin: 0.35em 0;
        }

        .proposal-container ol.flow-list li {
          margin: 0.55em 0;
        }

        .proposal-container table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.75em 0 1.25em 0;
          font-size: 10.5pt;
        }

        .proposal-container th,
        .proposal-container td {
          border: 1px solid #c9cfd6;
          padding: 0.55em 0.65em;
          text-align: left;
          vertical-align: top;
        }

        .proposal-container th {
          background: #ecf0f1;
          font-weight: bold;
          color: #2c3e50;
        }

        .proposal-container blockquote {
          margin: 0.75em 0 1em 0;
          padding: 0.75em 1em;
          border-left: 4px solid #3498db;
          background: #ecf0f1;
          color: #34495e;
        }

        .proposal-container blockquote p:last-child {
          margin-bottom: 0;
        }

        .title-section {
          text-align: center;
          margin: 3rem 0;
          padding: 2rem 0;
          border-bottom: 2px solid #ecf0f1;
        }

        .title-section h1 {
          font-size: 28pt;
          margin: 0 0 0.25em 0;
          font-weight: normal;
          color: #1a1a1a;
          line-height: 1.2;
        }

        .subtitle {
          font-size: 16pt;
          color: #7f8c8d;
          margin: 0 0 0.35em 0;
        }

        .tagline {
          font-size: 12pt;
          color: #7f8c8d;
          font-style: italic;
          margin: 0 0 1.5em 0;
        }

        .lede {
          max-width: 38em;
          margin: 1.25em auto 0 auto;
          font-size: 11.5pt;
          color: #34495e;
          font-style: italic;
          text-align: center;
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
          font-size: 13pt;
          font-weight: bold;
          color: #27ae60;
          margin: 0.25em 0;
        }

        .emphasis {
          font-style: italic;
          color: #34495e;
        }

        .decision-box {
          margin: 1.75em 0;
          padding: 1.1em 1.15em;
          background: #fffaf0;
          border: 1px solid #d9d0bf;
          border-left: 4px solid #c5912f;
          border-radius: 6px;
        }

        .decision-title {
          margin: 0 0 0.85em 0 !important;
          font-weight: bold;
          color: #674f27;
          text-align: left !important;
        }

        .decision-subtitle {
          margin: 1.25em 0 0.5em 0 !important;
          font-weight: bold;
          color: #2c3e50;
          text-align: left !important;
          border-top: 1px solid #e6dcc8;
          padding-top: 0.85em;
        }

        .save-bar {
          display: flex;
          align-items: center;
          gap: 1em;
          flex-wrap: wrap;
          margin-top: 1em;
        }

        .save-button {
          padding: 0.5em 1.5em;
          font-family: Georgia, serif;
          font-size: 11pt;
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .save-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .save-meta {
          font-size: 10pt;
          color: #7f8c8d;
          font-style: italic;
        }

        .save-error {
          font-size: 10pt;
          color: #c0392b;
        }

        .authorize-box {
          margin-top: 1.5em;
          padding: 1.5em;
          background: #e8f5e9;
          border-radius: 8px;
          border: 2px solid #27ae60;
          text-align: center;
        }

        .authorize-heading {
          margin: 0 0 0.5em 0 !important;
          font-size: 12pt;
          font-weight: bold;
          color: #27ae60;
          text-align: center !important;
        }

        .authorize-copy {
          margin: 0 0 1em 0 !important;
          font-size: 10.5pt;
          color: #2c3e50;
          text-align: center !important;
        }

        .authorize-actions {
          display: flex;
          gap: 1em;
          justify-content: center;
          flex-wrap: wrap;
        }

        .authorize-button {
          padding: 1em 2em;
          font-family: Georgia, serif;
          font-size: 13pt;
          font-weight: bold;
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .authorize-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .concern-button {
          padding: 1em 1.5em;
          font-family: Georgia, serif;
          font-size: 11pt;
          background: white;
          color: #34495e;
          border: 2px solid #3498db;
          border-radius: 4px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .concern-button:disabled {
          background: #95a5a6;
          color: white;
          border-color: #95a5a6;
          cursor: not-allowed;
        }

        .authorized-banner {
          margin-top: 1.25em;
          padding: 1em;
          background: #d4edda;
          border-radius: 4px;
          border: 1px solid #c3e6cb;
          text-align: left;
        }

        .authorized-banner p {
          margin: 0.25em 0 !important;
          color: #155724;
          text-align: left !important;
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

          .proposal-navigation,
          .save-bar,
          .authorize-actions {
            display: none;
          }

          .proposal-page-content {
            min-height: 0;
          }
        }
      `}</style>

      <div className="title-section">
        <h1>Proposal 001 — CRF Analysis Experiment</h1>
        <div className="subtitle">Alpine Technology Group</div>
        <p className="tagline">Common Ground Technology · Understand first. Build second.</p>
        <div style={{ marginTop: '2em' }}>
          <p className="meta">
            <strong>Prepared for:</strong> Rich Chopyak, Chief Architect
          </p>
          <p className="meta">
            <strong>Prepared by:</strong> Common Ground Technology
          </p>
          <p className="meta">
            <strong>Date:</strong> August 20, 2026 (revised)
          </p>
        </div>
        <p className="lede">
          A bounded test of whether Alpine&apos;s codebase, combined with AI-assisted reasoning, can
          reduce expert reconstruction effort — with Alpine&apos;s historical CRF precedent added
          only if the evidence shows it&apos;s actually needed.
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
