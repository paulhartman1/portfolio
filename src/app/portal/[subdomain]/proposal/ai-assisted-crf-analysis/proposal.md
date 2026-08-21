# Proposal 001 — CRF Analysis Experiment
**Alpine Technology Group**
Common Ground Technology · *Understand first. Build second.*

**Prepared for:** Rich Chopyak, Chief Architect
**Prepared by:** Common Ground Technology
**Date:** August 20, 2026 (revised)

A bounded test of whether Alpine's codebase, combined with AI-assisted reasoning, can reduce expert reconstruction effort — with Alpine's historical CRF precedent added only if the evidence shows it's actually needed.

---

## 1. Problem and Experimental Hypothesis

Alpine receives CRFs/change requests electronically. Producing a valid response can require understanding the request, reconstructing current behavior, finding relevant code and prior work, identifying ambiguity, reasoning about impact, estimating effort, and preparing a defensible response.

Much of that work depends on experienced staff who know the systems and their history.

> **Known Operating Constraint**
> For Pennsylvania CRFs, the 72-hour response window begins when the client sends the request. Manual discovery and intake therefore consume part of the available response time. Experiment 001 accepts manual intake deliberately so that intake automation does not become another experimental variable.
>
> **Estimated timeline:** 1–2 weeks after approval and data availability, subject to Alpine reviewer availability.

### Hypotheses (sequenced, not simultaneous)

**H1 — primary, tested first:** Giving a reasoning model access to Alpine's codebase — bounded by an agreed security/access model (Section 3) — will improve the usefulness of CRF analysis compared with the request alone.

**H2 — deferred, tested only if earned:** Adding Alpine's historical CRF precedent (past requests + Alpine's actual responses) will *further* improve usefulness beyond code access alone.

We're testing H1 first and holding H2 back deliberately. Building a usable historical-precedent reference set carries real cost — curating PRE/POST pairs, and enforcing an anti-leakage rule so no held-out case can see its own answer or a document derived from it. That cost is only worth paying if code access alone leaves a specific, identified gap that precedent would plausibly close. If code access alone gets Alpine most of the value, we've saved that build entirely.

"Improve" means more than better prose. The system must recover important reasoning, expose uncertainty, avoid unsupported technical claims, and reduce expert reconstruction work without replacing it with equal or greater verification work.

### Why We Still Need Christie's Actual Answer, Even Without Feeding It In

Historical cases give Alpine something most AI pilots lack: a real comparison target — even under H1, where the system never sees the historical answer as input.

| Element | Meaning |
|---|---|
| **PRE** | The request as the client originally sent it, plus code/material available at that time. |
| **POST** | The response Alpine actually sent. Not fed to the system under H1 — used only afterward, as evidence of Alpine's historical conclusion, not unquestionable ground truth. |
| **TEST** | Give the system PRE and code access; hide POST; freeze the generated analysis; then reveal POST and compare against expert judgment. |

This is the direct answer to "give it a CRF Christie's already done, in its undone state, and compare to what she actually did" — the POST is the scoring anchor whether or not precedent is part of the system's input.

### What Experiment 001 Is Not

- Not a production CRF-response system.
- Not approval for automated Outlook/Slack intake.
- Not proof that a given redaction approach, access model, or cloud provider is secure or contractually permissible long-term.
- Not a fine-tuning or machine-learning project.
- Not an autonomous client-response workflow.

---

## 2. Experiment Design

**Start small, change one meaningful variable at a time, and stop if the premise fails.**

### Conditions

**Condition 0 — Request only.** No code, no precedent. Establishes the floor: what a general frontier model can infer with nothing Alpine-specific.

**Condition A — Request + code access, no precedent.** *(Primary test.)* The system may access code bounded by whichever access model Rich approves in Section 3. This is the first real question: does code access alone materially help.

**Condition B — Request + code + historical precedent.** *(Deferred.)* Added only if Condition A leaves a specific, named gap — e.g., recurring ambiguity that past decisions have already resolved — that precedent would plausibly close. Not added by default.

### Data Split (still required, even without precedent as input)

**Held-out test set:** Historical PRE only, plus code access. The real POST is hidden until the generated analysis has been frozen and scored.

**Temporal rule:** Where practical, the system receives only code/material that existed before the held-out request was answered. Cases that can't be bounded well enough are excluded or explicitly marked contaminated.

### Initial Learning Cycle

Run five deliberately varied held-out cases first. Add up to five more only if the first five don't expose a fatal flaw or a clear next question.

- One strongly precedent-based case.
- One moderately familiar case.
- One case requiring clarification.
- One technically complex or relatively novel case, where available.
- Begin with one jurisdiction/system; do not mix PA and Louisiana unless Rich confirms comparability.

---

## 3. Security Considerations — Access Model (for Rich to weigh)

This section is the direct answer to the open question raised in our meeting: *should Experiment 001 point at the existing codebase, or wait for dedicated infrastructure?*

**Note on current code location:** this proposal does not assume the code lives on GitHub. As of this writing, our understanding is that it's hosted on bare metal on a secure private network — GitHub came up in our conversation as a desired future direction (moving off Visual SourceSafe), not a confirmed current state. **Rich should confirm the actual location and access path as part of approving Section 3**, since that materially affects which access option (below) is even feasible.

**Constraint driving this section:** CGT does not currently hold a signed data-use agreement with Pennsylvania or Louisiana. Until one exists, CGT's principals should not directly view or handle actual client CRF content or the codebase tied to those contracts.

**Proposed operating model:** CGT and Christie build the analysis tool/agent configuration together. Christie — already vetted, with existing system access — operates it, feeding in the actual CRF and code. CGT sees the tool's design, prompts, and de-identified outputs for review, not the raw client data or codebase directly.

Three ways to bound code access, in order of increasing exposure and decreasing setup cost:

| Option | How it works | Trade-off |
|---|---|---|
| **1. Scoped snippets** | Christie supplies only the relevant classes/functions/schema sections per case, not the full repo. | Lowest exposure. Slower to prepare — someone has to pre-select what's relevant, which may itself miss context the model would otherwise find. |
| **2. Full read access, no-training/no-retention agent** | Christie runs the tool against the real repo through a provider configured so data isn't used for training and isn't retained. | Faster, no manual snippet selection. Depends on trusting the vendor's stated data-handling terms — worth confirming those terms explicitly rather than assuming them. |
| **3. Fully local/self-hosted model, no internet access** | e.g., a self-hosted model on Alpine hardware with no external connectivity. | Nothing ever leaves Alpine. Requires GPU hardware Alpine may not currently have, and a self-hosted model likely reasons less capably than a frontier cloud model — a real trade-off, and probably more than a $0, 1–2 week experiment needs to resolve up front. |

**Recommendation:** start Experiment 001 with **Option 1 (scoped snippets)**. It requires no new infrastructure decision, keeps exposure lowest, and still directly answers H1. If it proves promising but manual snippet-selection becomes the bottleneck, that's itself a finding — and the exact kind of evidence that would justify moving to Option 2 for a later experiment, not something to assume up front.

Whichever option Rich selects, it should be confirmed *before* any code or CRF content is sent to a model provider — this is a precondition for running Experiment 001, not a future architecture question.

---

## 4. Validity Controls Before the First Run

These are blocking controls, not polish. Without them the experiment may produce impressive-looking but uninterpretable results.

- **External data handling.** No historical client material or code is sent to any model provider until Rich/Alpine approves the exact access model (Section 3) and confirms whether contract, legal, or compliance review is required.
- **Model-provider data terms.** Whichever provider is used, confirm in writing that inputs are not retained or used for training — this is separate from, and in addition to, the access-model decision above.
- **Evaluator blinding.** Remove condition labels (0/A/B) and model labels before expert scoring. Reveal only after scores are recorded.
- **Evaluator contamination.** Where practical, the scorer should not be the person who originally authored the historical POST. If Christie is both the only available domain expert and the original author, document the contamination rather than presenting the evaluation as blind.
- **Materiality rubric.** Before any output is seen, define critical / significant / minor issues and what counts as a correct identification, omission, unsupported claim, or appropriate unknown.
- **Case-selection rule.** Fix the sample categories before model outputs are generated. Don't choose cases because they seem likely to make the system look good or bad.
- **Anti-leakage.** Held-out POSTs, later CRFs that quote them, post-event documentation, later code/comments, and commit messages referencing the eventual change are excluded from what the system can see — this still applies even though precedent isn't part of Condition A's input, because it protects the integrity of the POST as a scoring anchor.
- **Baseline honesty.** If reliable historical effort data doesn't exist, Experiment 001 will not claim measured time savings — it will record experiment effort and establish a prospective baseline for later live work.
- **Artifact retention.** Redacted/scoped packets, model outputs, and scores are retained only as long as needed to complete scoring and write up findings, then deleted on an agreed schedule — this should be confirmed alongside Section 3, not left open.

---

## 5. What We Measure — and What Makes Us Stop

| Quality / Reasoning | Effort / Boundary |
|---|---|
| Important behavior and dependencies identified | Time preparing/approving input |
| Meaningful ambiguities surfaced | Time reviewing and verifying output |
| Code referenced correctly and relevantly | Time correcting the analysis |
| Unsupported claims and omissions | Categories withheld vs. transmitted |
| Appropriate "insufficient evidence" | What missing context materially blocked reasoning |
| Provenance for important claims | Client-sent timestamp → experiment start timestamp |

### Stop or redesign if

- Review/verification effort is roughly equal to the current investigation burden.
- Unsupported technical claims are frequent enough that the first pass can't be trusted as useful work.
- **Code access alone does not materially improve analysis over the request alone** (i.e., H1 isn't supported).
- Useful performance requires information/access Alpine can't permissibly provide under any of the three options in Section 3.
- The system mostly imitates plausible-sounding structure while missing real technical reasoning.
- The available historical record is too incomplete or temporally contaminated to interpret the result.

### What earns a next step

- **Add historical precedent (Condition B):** only if Condition A leaves a specific, named gap that precedent would plausibly close — not by default.
- **Move to Option 2 access (full read, no-training agent):** only if Option 1's manual snippet-selection step repeatedly becomes the bottleneck.
- **Larger historical corpus / better retrieval:** only if precedent (once tested) helps and coverage/retrieval is the limiting factor.
- **Automated intake:** only if analysis proves useful and intake latency materially consumes the 72-hour window.
- **Fine-tuning / other ML:** only if retrieval + prompting reaches a repeatable limitation that a learned component has a plausible mechanism to address.

---

## 6. Decisions Requested from Rich

CGT is asking for authorization to run a bounded experiment — not approval of a production architecture.

1. Choose the first jurisdiction/system and approve the population of historical cases suitable for testing.
2. **Approve an access model from Section 3 (Option 1 recommended)** and confirm whether contract/legal/compliance review is needed before any code reaches a model provider.
3. Confirm the model-provider data terms (no training, no retention) required regardless of which access option is chosen.
4. Confirm Christie as the operator/evaluator, and accept documented contamination for her dual role where independence isn't practical.
5. Approve Condition A (code + request, no precedent) as the first test; Condition B (add precedent) is added only if the evidence earns it.
6. Approve the severity/materiality rubric before any model output is scored.
7. Confirm whether reliable historical time-per-CRF data exists; if not, accept that Experiment 001 will not claim measured time savings.
8. Confirm the artifact retention/destruction schedule for redacted packets, outputs, and scores.

### Known Future Opportunity — Deliberately Out of Scope

> **If Experiment 001 succeeds:** a later Alpine-controlled agent could ingest CRFs, retrieve approved code and (eventually) history, prepare a minimized context package, preserve provenance, and reduce intake latency through ticketing integration. None of that is proposed for implementation here — each capability must be earned by evidence from the preceding step.

### CGT Operating Constraints

| Rule | Meaning |
|---|---|
| Rule 0 | Question everything. |
| Know the problem | Test CRF analysis, not an imagined production system. |
| Make work visible | Preserve inputs, access decisions, outputs, edits, and scores. |
| Work together | Alpine retains domain, security, and architecture authority. |
| Simple steps | 0 → A → B only when evidence earns the next condition. |
| Composition | Keep intake, access model, reasoning, and review independently replaceable. |
| Validate | Use held-out evidence and expert judgment, not plausibility. |
| Release often | Five-case learning cycle before scale. |
| Prefer automation | Automate only demonstrated repeated work. |
