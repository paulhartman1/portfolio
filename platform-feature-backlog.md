# Platform Feature Backlog

## High Priority

### AI Agent Session Awareness
**Problem**: During discovery/consulting sessions, the AI agent should be actively "aware" and monitoring the conversation flow, not just responding when explicitly asked.

**Desired Behavior**:
- Agent monitors the consulting lifecycle position (Discovery → Journey Mapping → Personas → etc.)
- Agent acts as a gatekeeper, ensuring sufficient information exists before moving to next phase
- Agent proactively suggests when enough information has been gathered
- Agent flags missing information: "We don't have a Prospect persona yet" or "The journey map has no actual journey steps"
- Agent can interject during sessions: "Before we build that, we need to understand X first" (Commandment #1: Know the problem)

**Current State**: Agent responds reactively when Paul asks questions, but doesn't proactively monitor session progress

**Requirements**:
- Follow Commandment #6 (Validate before, during, and after)
- Follow Commandment #1 (Know the problem being solved)
- Agent should know when Paul has "just barely enough to begin prototyping" vs. needs more discovery
- Make agent presence visible but not intrusive

**When to Build**: After CGT Phase 1 proves the basic flow works

---

### AI Agent DoD Scanning & Reaction
**Problem**: When a Definition of Done is created or edited in a project, the AI agent should automatically scan it and react by:
- Breaking DoD into tasks
- Estimating time/budget for each task
- Suggesting build order (dependencies)
- Identifying risks or ambiguities
- Proposing next steps

**Current State**: Manual—Paul has to explicitly ask the agent to review DoD

**Desired State**: 
- AI agent monitors project for DoD changes
- Automatically analyzes new/updated DoD
- Generates draft task breakdown for Paul to review
- Visible in portal: "Agent's Analysis of Phase 1 DoD (Draft)"

**Requirements**:
- Follow "Paul + Agent" model (AI drafts, Paul reviews/refines)
- Make analysis visible in portal (Commandment #2)
- Simple, incremental implementation (Commandment #4)

**When to Build**: After CGT Phase 1 is complete and basic DoD workflow is validated

---

### Project Phases Support
**Problem**: Admin panel at `/admin/projects/[project_id]` has no concept of project phases. Projects need to support multiple phases (e.g., "Phase 1: Foundation", "Phase 2: Enhanced Features").

**Current Workaround**: Definition of Done goes into "Ideas and Messages" section.

**Desired State**:
- Projects can have multiple phases
- Each phase has: name, description, Definition of Done, status, timeline
- Admin UI shows phases clearly
- Per-phase tracking and progress visibility

**Requirements**:
- Write tests BEFORE implementing
- Follow Commandment #4: Simple things in small steps
- Follow Commandment #6: Validate before, during, and after

**When to Build**: After CGT Phase 1 is complete and methodology is validated

---

## Future Features
(Add other features here as they emerge from client work)
