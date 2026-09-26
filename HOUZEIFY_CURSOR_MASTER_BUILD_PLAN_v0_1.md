# HOUZEIFY — Cursor Master Build Plan v0.1

**Product:** Houzeify
**Repository:** `adarshkiran/houzeify-app-v0.1`
**Primary branch:** `main`
**Current product state:** React + Vite + Tailwind + Ant Design prototype with an in-memory construction domain model and a completed mock daily-progress review loop.
**Plan status:** Working engineering plan for incremental implementation.
**Last repository review:** 26 Sep 2026

---

## 0. Purpose

This document is the engineering source of truth for implementing Houzeify in Cursor from the current repository state.

It translates the Houzeify product/master plan into an incremental development sequence while preserving the current prototype and visual system.

The objective is **not** to rebuild the application from scratch. The objective is to evolve the existing Figma Make-generated React application into a coherent, testable construction SaaS prototype and then into a production architecture.

### Core principle

> **Build the construction operating loop first. Add marketplace, billing, realtime communication, advanced AI, and production infrastructure only after the construction data model and workflows are stable.**

---

# 1. Current GitHub Repository Assessment

## 1.1 Repository state

The repository is public and the default branch is `main`.

The latest `main` commit is the merge of the daily-progress-loop implementation from `cursor/daily-progress-loop`.

There are two historical daily-progress branches:

- `cursor/daily-progress-loop` — no longer ahead of `main`.
- `cursor/daily-progress-loop-bde4` — associated with the earlier draft PR #1.

PR #2 is merged into `main` and is the implementation that should be treated as the current daily-progress baseline.

PR #1 is still a draft and represents an earlier/different implementation of the same feature area. Do not merge both implementations.

## 1.2 Root structure currently present

```text
AGENTS.md
CLAUDE.md
DESIGN.md
package.json
pnpm-lock.yaml
vite.config.ts
tsconfig.json
index.html
src/
  App.tsx
  main.tsx
  index.css
  assets/
  components/
  domain/
  imports/
  mock/
  screens/
```

There is currently no dedicated README, automated test script, backend folder, database layer, API client, or mobile application in the repository.

## 1.3 Frontend stack currently present

- React 19
- React DOM 19
- Vite 8
- TypeScript 5.7
- Tailwind CSS 4
- Ant Design 6.6.5
- `@ant-design/icons` 6.3.4
- oxfmt

The application currently uses a central `App.tsx` screen switcher rather than React Router.

The construction-management screens already use an Ant Design `ConfigProvider` through `CompanyThemeProvider`.

### UI rule

Keep:

```text
Houzeify visual language
+
Ant Design functional components
+
Tailwind layout/composition
```

Do not convert the application into stock/default Ant Design styling.

## 1.4 Current screen inventory

### Authentication / entry

- Splash
- Welcome
- Login
- OTP
- Create Account
- Account Created
- Choose Role

### Homeowner / estimation

- Homeowner Onboarding
- Home Dashboard
- AI Advisor
- Create Project
- Estimate Loading
- Estimate Dashboard
- Cost Breakdown

### Company / construction management

- Business Onboarding
- Company Dashboard
- Company Projects
- Company Create Project
- Project Overview
- Project Structure
- Project Team
- Work Library
- Work Plan
- Tasks
- Task Detail
- Daily Progress Submit
- Daily Progress Review
- Customer Daily Update

The current application therefore already has a surprisingly broad prototype surface. The next task is to make the system internally coherent rather than adding screens indiscriminately.

---

# 2. Current Architecture

## 2.1 App shell

`src/App.tsx` is the application-level switchboard.

It currently:

- stores `screen` in React state;
- stores shared navigation values in `projectData: Record<string, string>`;
- stores phone state separately;
- uses `isAppScreen()` to validate screen names;
- writes the current screen into `window.location.hash`;
- does not implement a full route/history model;
- lazy-loads most construction-management screens.

### Immediate implication

Do **not** replace the navigation system and refactor every screen in the same task.

First complete the prototype using the current pattern. Later introduce React Router as a dedicated navigation migration.

## 2.2 Domain model

A strong typed domain foundation already exists in `src/domain/models.ts`.

Current models include:

```text
Quantity
Organization
Project
ProjectUnit
ConstructionStage
Trade
WorkType
TaskTemplate
WorkPlanItem
Person
ProjectMembership
Worker
TaskChecklistItem
Task
TaskAssignment
Evidence
DailyProgress
Issue
ConstructionDataState
```

This is important: **do not create a second parallel type system.** Extend and stabilize these models.

## 2.3 Navigation model

`src/domain/navigation.ts` already defines typed screen names and a generic navigation payload.

Current construction routes include:

```text
company-dashboard
company-projects
company-create-project
project-overview
project-structure
project-team
work-library
work-plan
tasks
task-detail
daily-progress-submit
daily-progress-review
customer-daily-update
```

Navigation should eventually move from `Record<string, string>` to typed route params, but this should be done deliberately rather than mixed into unrelated feature work.

## 2.4 Mock repository / state

`src/mock/ConstructionDataProvider.tsx` acts as the current domain state and mutation layer.

It provides mutations for:

```text
updateOrganizationProfile
createProject
addProjectUnit
inviteProjectMember
addWorkPlanItem
createTask
assignTask
transitionTask
addEvidence
submitDailyProgress
reviewDailyProgress
```

The state is seeded by `src/mock/seed.ts` and queried through `src/mock/selectors.ts`.

This is a good prototype boundary and should be preserved.

### Future rule

When a real backend arrives, the screen layer should ideally continue consuming domain-level query/mutation interfaces rather than importing database/API details directly.

---

# 3. Current Construction Data Model

## 3.1 Organization

Represents the company/contractor/developer operating in Houzeify.

Current organization kinds include:

```text
developer
construction-company
builder
contractor
subcontractor
```

## 3.2 Project

A construction project belongs to an organization and supports multiple project kinds:

```text
individual-house
multiple-houses
villa-development
apartment
multi-block
commercial
```

Important existing flag:

```text
trackingStartedMidProject
```

This supports the use case where an existing construction project is onboarded into Houzeify after construction has already started.

## 3.3 Project structure

`ProjectUnit` already supports hierarchical locations such as:

```text
phase
block
tower
villa
house
apartment
floor
zone
room
location
```

This is sufficient to model:

```text
Developer
  → Project
    → Phase
      → Block
        → Villa 001
        → Villa 002
        → ...
        → Villa 170
```

Do not replace this with a flat property table.

## 3.4 Construction taxonomy

Current seed data already contains the initial stage/trade/work-type structure.

Current stages include:

```text
Site Preparation
Foundation
RCC Structure
Masonry
Plastering
Waterproofing
Services
Flooring
Finishing
```

Current trades include:

```text
Survey
Civil
Reinforcement
Formwork
Masonry
Waterproofing
Plumbing
Electrical
Flooring
Painting
```

This is a useful prototype, but it is **not yet the final Houzeify Construction Work Library**.

The final library should eventually include the broader taxonomy from the product master plan:

- site preparation and survey;
- excavation and earthwork;
- foundation and plinth;
- RCC structural work;
- masonry/blockwork;
- plastering;
- waterproofing;
- plumbing;
- electrical;
- HVAC/mechanical;
- flooring/tiling;
- doors/windows/aluminium/glass;
- carpentry/joinery;
- false ceiling/interiors;
- painting;
- kitchen;
- bathroom/sanitary;
- external development;
- testing, snagging, completion and handover.

Expand this in controlled batches, not in one giant seed-file rewrite.

---

# 4. Current Daily Progress Loop

The current `main` branch already contains the first end-to-end construction loop:

```text
Task
  ↓
Daily Progress Submit
  ↓
Review Queue
  ↓
Approve / Reject
  ↓
Customer Daily Update
```

The customer view only surfaces published/approved progress.

That is the current baseline.

## Current evidence behavior

Evidence supports:

```text
photo
video
audio
document
```

but the current submit UI primarily implements photo/video selection. Real audio/voice capture is not yet implemented.

## Current review behavior

The current review mutation correctly gates customer publication, but the data model and mutation logic need strengthening before production behavior is designed.

---

# 5. Current Technical Gaps That Must Be Addressed

These are the highest-value engineering gaps discovered in the current codebase.

## 5.1 Project progress can be overwritten incorrectly

Current approval logic updates the project `progress` directly from the latest progress update's `progressAfter` value.

This is acceptable for a demo but is not safe for multi-task/multi-unit construction.

Example problem:

```text
Villa 001 progress → 80%
Villa 002 progress → 30%
Latest update says → 30%
Project progress becomes → 30%
```

### Required solution

Separate:

```text
Unit progress
Task/work-type progress
Stage progress
Project overall progress
```

Then calculate/project the overall value from the configured aggregation model.

The first prototype can use a documented weighted-average rule.

## 5.2 Task state is not fully synchronized with progress approval

The task state machine already exists, but daily-progress approval does not fully synchronize the task state with the approved progress.

Define one authoritative state transition path.

Example:

```text
in-progress
  → submitted
  → review
  → approved
  → completed
```

The exact transition must be consistent across Task Detail and Daily Progress Review.

## 5.3 Worker project assignment is incomplete

Workers exist at organization level, but there is not yet a first-class worker-to-project assignment model.

Add a clear relationship such as:

```text
Worker
  ↔ Organization
  ↔ Project Assignment
  ↔ Trade / Skill
  ↔ Unit Scope
```

Do not let any worker submit or receive work merely because their organization ID matches.

## 5.4 Permission model is too free-form

`ProjectMembership.permissions` is currently a string array.

For the prototype this is acceptable, but define a permission vocabulary and role matrix before real authentication.

At minimum distinguish:

```text
Organization role
Project role
Scope
Capabilities
```

Scope can include:

```text
project
phase/block
unit/location
stage
trade
```

## 5.5 Evidence attribution needs correction

The domain model supports `capturedByWorkerId`, but the current evidence builder path does not consistently populate worker attribution.

Fix this before worker-side evidence is implemented.

## 5.6 Daily progress has redundant narrative fields

`DailyProgress` contains `yesterdaySummary`, `todaySummary`, and `tomorrowPlan`.

The customer experience should eventually derive Yesterday/Today/Tomorrow from the project's published progress history where possible, while allowing authored AI/manual narrative when appropriate.

Do not create duplicate facts that can drift apart.

## 5.7 No persistence

All construction state is currently in-memory React state.

A browser refresh resets mutations.

This is intentional for the prototype and should remain so until the core workflow is validated.

## 5.8 No real media layer

Photos are object URLs/mock paths.

There is no:

- upload service;
- media storage;
- compression;
- background upload queue;
- media processing;
- signed URLs;
- audio transcription.

Do not introduce these until the prototype data contracts are stable.

## 5.9 No automated test suite

The repository currently has no test script.

Add tests incrementally after the domain state machine and repository APIs stabilize.

---

# 6. Houzeify Product Architecture to Implement

```text
                         HOUZEIFY
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    HOMEOWNER          CONSTRUCTION        CONTRACTOR
                         COMPANY
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                         PROJECT
                            │
         ┌──────────────────┼───────────────────┐
         │                  │                   │
      PEOPLE              WORK               RECORD
         │                  │                   │
   Company              Stage               Photo
   Contractor            Trade               Video
   Supervisor            Work Type           Voice
   Worker                Task                Document
   Consultant            Checklist            Report
   Homeowner             Progress             Audit
                            │
                            ↓
                  CONSTRUCTION INTELLIGENCE
                            │
                    AI CONSTRUCTION ADVISOR
```

---

# 7. Source-of-Truth Hierarchy

Cursor must use the following priority:

1. `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` — engineering execution plan.
2. Houzeify Master Plan v0.2 — product requirements and business rules.
3. `DESIGN.md` — visual system and implementation constraints.
4. `AGENTS.md` — repository-specific coding rules.
5. Existing code — current implementation details to preserve unless explicitly changed.
6. New assumptions — only when documented in the current task.

If documents conflict, stop and surface the conflict instead of inventing a third interpretation.

---

# 8. Development Rules for Cursor

## Rule 1 — Inspect first

Before editing:

- inspect the relevant files;
- follow imports;
- understand the existing provider/selectors;
- identify the route/screen path;
- identify reusable components;
- identify existing mock data.

## Rule 2 — One vertical slice per branch

Do not combine unrelated features in one Cursor task.

## Rule 3 — Preserve working flows

The following must not be broken unless the task explicitly targets them:

- authentication prototype;
- homeowner estimation flow;
- company dashboard;
- project navigation;
- current daily-progress approval gate.

## Rule 4 — Shared data only

No new screen-specific copies of project/task/worker data.

Every screen must read/write through the shared construction data layer.

## Rule 5 — No fake backend

Do not create fake API calls that look like production APIs merely to satisfy a screen.

Use the current mock repository until the backend phase begins.

## Rule 6 — Avoid premature abstraction

Do not build a massive component framework before repeated patterns appear.

Use existing Ant Design components and existing Houzeify components first.

## Rule 7 — UI library rule

Use Ant Design 6.6.5 already installed for construction-management functional components.

Use Tailwind v4 for layout/composition.

Preserve the current Houzeify visual language.

## Rule 8 — Do not touch Figma-imported source assets

Do not edit files under `src/imports/` unless explicitly required for a controlled asset update.

Use the official logo components:

```text
HIcon
LogoHorizontal
LogoStacked
```

## Rule 9 — Keep product logic out of presentational components

Screens should orchestrate data and workflow.

Selectors/repositories/domain utilities should contain reusable logic.

## Rule 10 — Every mutation must have a valid transition

Do not let UI controls bypass the task/progress state machine.

---

# 9. Phase Roadmap

## PHASE 0 — Repository & Domain Stabilization

### Goal
Make the current prototype safe to extend.

### Scope

- Review PR #2 merged state.
- Do not merge PR #1.
- Remove accidental/unused duplicate work only when safe.
- Add `README.md` with local setup and architecture notes.
- Add typecheck/build scripts.
- Add a basic test framework only for domain logic.
- Stabilize `domain/models.ts`.
- Formalize task status transitions.
- Fix worker attribution in Evidence.
- Fix DailyProgress/Task synchronization.
- Document the project progress aggregation rule.
- Document permissions vocabulary.

### Expected result

The current prototype remains visually unchanged but becomes a stable base for the next phases.

### Suggested branch

```text
feature/phase-0-foundation
```

---

## PHASE 1 — Project & Organization Core

### Goal
Make company project setup coherent for both one-house and multi-unit projects.

### Screens

```text
BusinessOnboarding
CompanyDashboard
CompanyProjects
CompanyCreateProject
ProjectOverview
ProjectStructure
ProjectTeam
```

### Implement

- Organization profile.
- Project CRUD in mock repository.
- Project kinds.
- Existing-project onboarding.
- Hierarchical ProjectUnit CRUD.
- Project team invitations.
- Project role model.
- Scope assignment foundation.
- Project overview navigation.
- Shared mock records.

### Acceptance

A user can:

```text
Business Onboarding
→ Company Dashboard
→ Create Project
→ Define structure
→ Add project members
→ Open Project Overview
```

Both of these must work using the same project engine:

```text
Single house
```

and

```text
170-villa development
```

### Suggested branch

```text
feature/project-core
```

---

## PHASE 2 — Construction Work Library

### Goal
Turn construction vocabulary into structured product data.

### Core hierarchy

```text
Stage
→ Trade
→ Work Type
→ Task Template
```

### Implement

- Standard stage library.
- Trade library.
- Work types.
- Units of measure.
- Task templates.
- Checklist templates.
- Evidence requirements.
- Dependency references.
- Search/filter.
- Construction library versioning strategy.

### Important design requirement

A contractor should select:

```text
RCC Structure
→ Reinforcement
→ Column Reinforcement
```

rather than typing arbitrary task names.

### Acceptance

Work Library can be used to create a valid task without free-form construction work naming.

### Suggested branch

```text
feature/work-library
```

---

## PHASE 3 — Work Plan & Task Engine

### Goal
Make planned construction work executable.

### Screens

```text
WorkPlan
Tasks
TaskDetail
```

### Task creation

A task should reference:

```text
Project
Unit/location
Stage
Trade
Work Type
Template
Quantity
Dates
Assignee
Priority
```

### State machine

```text
Draft
→ Assigned
→ Accepted
→ Ready
→ In Progress
→ Submitted
→ Review
→ Approved
→ Completed
```

Alternative states:

```text
Blocked
Delayed
Reopened
Cancelled
```

### Acceptance

No screen may create an invalid state transition.

Task Detail must clearly show:

- scope;
- location;
- work type;
- checklist;
- assignments;
- quantity;
- progress history;
- next actions.

### Suggested branch

```text
feature/task-engine
```

---

## PHASE 4 — Workforce & Worker Experience

### Goal
Make workers real project participants.

### First-class entities

Add/clarify:

```text
Worker
WorkerProjectAssignment
WorkerSkill / Trade
WorkerLanguage
WorkerOnboarding
WorkerAttendance
```

### Onboarding methods

1. Manual invite.
2. OTP onboarding.
3. QR-code join.
4. Supervisor-assisted onboarding.
5. Bulk import later.

### Worker screens

```text
Worker Home / Today
My Tasks
Worker Task Detail
Start Work
Capture Evidence
Voice Update
Submit Progress
Messages
Profile
Attendance
```

### Worker principle

Worker home must answer:

> What do I need to do today?

### Worker workflow

```text
Receive Task
→ Open Task
→ Listen to Instructions
→ Start Work
→ Capture Photo/Video
→ Voice Update
→ Quantity/Progress
→ Submit
→ Supervisor Review
```

### Supervisor flow

```text
Worker Submission
→ Review
→ Approve / Request Changes / Reject
→ Official Progress Record
```

### Suggested branch

```text
feature/workforce-worker
```

---

## PHASE 5 — Daily Progress v2

### Goal
Upgrade the current mock loop into the structured construction record.

### Screens

```text
Daily Progress Submit
Progress Review
Evidence Viewer
Issues
```

### Required data

```text
Project
Unit/location
Stage
Trade
Work Type
Task
Workers present
Planned quantity
Completed quantity
Progress
Evidence
Issues/blockers
Tomorrow's plan
Submitter
Timestamp
Review status
Customer publication status
```

### Evidence types

```text
Photo
Video
Voice
Document
```

### Review lifecycle

```text
Draft
→ Submitted
→ Review
→ Approved
→ Published
```

Rejected updates stay private.

### Acceptance

The current working behavior must remain intact:

```text
Pending update ≠ visible to homeowner
Approved update = visible to homeowner
Rejected update = not visible to homeowner
```

### Important improvement

Customer visibility must be a deliberate publication action, not a side effect of a database/UI flag.

### Suggested branch

```text
feature/daily-progress-v2
```

---

## PHASE 6 — Communication & Voice

### Goal
Make construction communication contextual.

### Communication levels

```text
Project Chat
Task Chat
Direct Message
Voice Message
Voice Instruction
Voice → Task
Voice → Progress
Voice → Issue
Voice/Video Call
Phone Call
```

### Important rule

Communication should be attachable to:

```text
Project
Unit
Task
Issue
Person
```

Avoid a single unstructured inbox.

### Voice pipeline

```text
Speech
→ Transcription
→ Intent / extraction
→ Draft structured action
→ User confirms
→ Record saved
```

Do not let AI silently mutate official project records.

### Suggested branch

```text
feature/communication-voice
```

---

## PHASE 7 — Customer Transparency

### Goal
Give homeowners a simple, trustworthy view.

### Screens

```text
Customer Project
Project Timeline
Customer Evidence
Customer Issues / Questions
```

### Homeowner view

```text
My Project
Overall Progress
Yesterday
Today
Tomorrow
Current Stage
Photos
Videos
Issues
Documents
Questions
```

### Publication rule

Only approved customer-facing information is shown.

### Acceptance

A homeowner never sees an internal draft/submitted/rejected update.

### Suggested branch

```text
feature/customer-experience
```

---

# 10. Phase 8 — AI Construction Advisor

AI should be built on structured construction data rather than on a generic chatbot first.

## 10.1 Homeowner AI

```text
Requirements
→ Project assumptions
→ Materials
→ Labour
→ Finishing
→ Quantity
→ Cost
→ Estimate
→ Bill of Quantities
```

## 10.2 Partner AI

```text
Customer requirement
→ Understand scope
→ Generate contractor estimate
→ Generate proposal
→ Share proposal link
```

## 10.3 Site AI

```text
Voice
→ Task
→ Progress
→ Issue
→ Summary
```

## 10.4 Project AI

```text
Project data
→ Progress analysis
→ Planned vs actual
→ Issue summary
→ Delay signals
→ Management report
```

### AI governance

Every AI-generated record must carry:

```text
source
confidence / assumptions where applicable
createdBy = AI
review status
approvedBy
approvedAt
```

### Suggested branch

```text
feature/ai-construction-advisor
```

---

# 11. Phase 9 — Homeowner Construction Marketplace

### Goal
Support the user who needs to find a construction professional.

### Flow

```text
Homeowner
→ AI Estimate
→ Requirement
→ Post Requirement
→ Partner Discovery
→ Limited Opportunity View
→ Paid Unlock
→ Full Requirement
→ Proposal
→ Compare
→ Select Partner
→ Project
```

### Partner flow

```text
Partner Profile
→ Discover Opportunities
→ Unlock
→ View Requirement
→ AI Estimate
→ Proposal
→ Share
```

### Critical rule

Marketplace identity and project execution are different states.

Before winning:

```text
Partner
```

After selection:

```text
Project Contractor / Project Member
```

### Suggested branch

```text
feature/marketplace
```

---

# 12. Phase 10 — Pricing, Billing & SaaS Entitlements

### Revenue engines

```text
Homeowner AI
Contractor lead unlock
Contractor SaaS
Company SaaS
Developer / Enterprise SaaS
AI credits
Storage add-ons
Advanced modules
```

### Required billing model

```text
Plan
Subscription
Entitlement
Usage
Credits
Invoice
Payment
Refund
Coupon
Trial
Cancellation
```

### Product rule

The UI must read entitlements from one billing/entitlement source.

Do not hardcode plan checks in dozens of screens.

### Suggested branch

```text
feature/billing-subscriptions
```

---

# 13. Phase 11 — Production Backend

Only after the prototype workflows are stable.

## Recommended architecture

```text
React + Vite Web
React Native + Expo Mobile
           ↓
       API Layer
           ↓
       NestJS Backend
           ↓
 PostgreSQL + PostGIS
           ↓
 Redis / Queue
           ↓
 Object Storage (S3)
```

### Backend domain modules

```text
Auth
Organizations
Projects
Project Units
Members
Workers
Construction Library
Work Plans
Tasks
Progress
Evidence
Issues
Documents
Communications
Marketplace
Estimates
AI
Billing
Notifications
Audit
```

### Production storage

- Database stores structured metadata.
- Object storage stores photos/videos/audio/documents.
- Redis handles cache/queue concerns.

### Important

Do not immediately split into microservices.

Start as a modular monolith with clear domain boundaries.

---

# 14. Phase 12 — Mobile Worker Application

### Recommended technology

```text
React Native
Expo
TypeScript
```

### Primary worker screens

```text
Today
Task
Start Work
Capture Evidence
Voice
Submit
Messages
Attendance
Profile
```

### Mobile requirements

- camera;
- microphone;
- background upload strategy;
- retry;
- offline draft queue;
- local media state;
- push notifications;
- language preference.

Do not implement continuous worker GPS as a default behavior.

---

# 15. Phase 13 — Offline & Site Reliability

Construction sites can have weak connectivity.

Design the mobile workflow so that:

```text
Capture
→ Store locally
→ Mark Pending Sync
→ Upload when connected
→ Server confirms
→ Mark Synced
```

At minimum, offline-capable actions should include:

- task viewing;
- voice/photo capture;
- daily progress draft;
- evidence capture;
- issue creation.

---

# 16. Phase 14 — Advanced Construction Intelligence

After sufficient structured data exists:

```text
Planned vs Actual
Progress forecasting
Issue patterns
Material utilization
Workforce analytics
Project risk signals
Time-lapse
Live site integrations
AI management reports
```

These should be built on the digital construction record, not as isolated analytics features.

---

# 17. Recommended Data Model Evolution

The current models are a strong start. Evolve them toward:

```text
User
Organization
OrganizationMembership
Project
ProjectUnit
ProjectMembership
Worker
WorkerProjectAssignment
ConstructionStage
Trade
WorkType
TaskTemplate
WorkPlanItem
Task
TaskAssignment
DailyProgress
Evidence
Issue
Document
CommunicationThread
Message
VoiceMessage
CallRecord
Estimate
EstimateLine
BOQ
Proposal
MarketplaceRequirement
MarketplaceUnlock
Subscription
Plan
Entitlement
AIUsage
AuditEvent
```

Do not implement all these tables immediately.

Use them as the target architecture and introduce them as the roadmap reaches each domain.

---

# 18. Project Progress Model

Before backend work, define the calculation rules.

Recommended hierarchy:

```text
Task progress
→ Work Type progress
→ Stage progress
→ Unit progress
→ Project progress
```

For example:

```text
Villa 042
  RCC 70%
  Electrical 40%
  Plumbing 55%
  Flooring 0%
```

The project-level progress should be calculated from configured weights rather than taking the last submitted percentage.

Weights may eventually come from:

- Bill of Quantities;
- construction cost weight;
- predefined stage weights;
- work-package weights.

For the prototype, use a documented fixed-weight model.

---

# 19. Worker Permission Model

Worker permissions should be project-scoped.

Example:

```text
Worker
  Organization: ABC Electrical
  Project: Green Valley Villas
  Scope: Villas 001–050
  Trade: Electrical
  Permissions:
    task.read
    task.start
    progress.create
    evidence.create
    issue.create
    message.send
```

Worker must not automatically see:

- other projects;
- financial data;
- homeowner private information beyond approved needs;
- unrelated units;
- company-wide reports.

---

# 20. Customer Publication Model

Use explicit states.

```text
Internal Draft
Submitted
Under Review
Approved
Published
Rejected
Superseded
```

A record can remain visible internally while remaining invisible externally.

Never use the customer-visible UI as the source of truth for whether a record is approved.

---

# 21. Communication Security Model

The app should support permission-aware communication.

Worker:

```text
Worker ↔ Supervisor
Worker ↔ Assigned Contractor
```

Contractor:

```text
Contractor ↔ Supervisor
Contractor ↔ Company
```

Company:

```text
Company ↔ Customer
```

Homeowner:

```text
Homeowner ↔ Assigned Project Team
```

Do not expose individual worker phone numbers to customers by default.

Phone calling, number masking, and call recording must be implemented with appropriate consent and legal/compliance handling.

---

# 22. Figma Make / Cursor / Claude Division of Work

Figma AI credits are exhausted, so Figma Make should no longer be treated as the main implementation engine.

## Cursor

Use Cursor for:

- repository changes;
- components;
- TypeScript;
- state management;
- routing;
- refactors;
- testing;
- performance;
- integration work.

## Claude

Use Claude as:

- architecture reviewer;
- code reviewer;
- requirements clarifier;
- data-model reviewer;
- debugging partner;
- PR reviewer.

## Figma

Use normal Figma as:

- visual reference;
- design review;
- design system documentation;
- manual screen refinement;
- handoff.

---

# 23. Cursor Task Protocol

Every Cursor task should follow this pattern.

## Prompt structure

```text
ROLE
You are the senior engineer implementing Houzeify in the existing repository.

CONTEXT
Read:
- Houzeify Master Plan v0.2
- HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md
- DESIGN.md
- AGENTS.md
- relevant current source files

OBJECTIVE
[one feature only]

CURRENT STATE
[what already exists]

SCOPE
[files/features allowed to change]

OUT OF SCOPE
[list what must not be touched]

DATA MODEL
[models involved]

WORKFLOW
[exact user flow]

ACCEPTANCE CRITERIA
[numbered testable outcomes]

IMPLEMENTATION RULES
- preserve existing visual system
- use Ant Design where appropriate
- use shared mock data
- no new fake APIs
- no unrelated refactors

VALIDATION
Run:
- typecheck
- build
- formatter
- targeted manual flow

REPORT
Return:
- changed files
- implementation summary
- validation result
- remaining limitations
```

---

# 24. Cursor PR Protocol

Each feature should produce one focused pull request.

### PR title format

```text
feat: <feature>
fix: <issue>
refactor: <scope>
```

### PR body

```text
## Objective

## What changed

## User flow

## Data model changes

## Validation

## Out of scope

## Known limitations
```

### Before merge

Check:

- no existing flow broken;
- no duplicate data model;
- no direct screen-only mock data introduced;
- no permission leakage;
- no customer visibility regression;
- typecheck passes;
- build passes;
- formatting passes;
- manual critical path verified.

---

# 25. First Cursor Build: Exact Scope

The next Cursor task should **not** build the worker app, marketplace, billing, AI, or backend.

It should prepare the current codebase for the next construction feature.

## First task

### Title

```text
refactor: stabilize construction domain foundation
```

### Exact scope

1. Inspect the current `main` branch.
2. Confirm the merged daily-progress loop remains intact.
3. Stabilize the existing domain model without redesigning the UI.
4. Fix Evidence worker attribution support.
5. Make task status transitions authoritative and reusable.
6. Synchronize task status after approved daily progress where the product state requires it.
7. Separate/centralize project progress calculation so approval does not blindly overwrite the project-level percentage.
8. Define typed permission names/constants without implementing real auth yet.
9. Define a worker project-assignment model in the mock domain.
10. Keep the current in-memory provider pattern.
11. Do not introduce a backend.
12. Do not introduce React Router yet.
13. Do not change the homeowner estimation flow.
14. Do not redesign existing screens.
15. Do not implement worker UI yet.

### Validation

Run:

```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm run format
```

Then manually verify:

```text
Sharma Residence
→ Task
→ Log Today’s Progress
→ Submit
→ Review
→ Approve
→ Customer Daily Update
```

and:

```text
Tech Park
→ Submit / Reject
→ Customer view remains unpublished
```

---

# 26. Second Cursor Build

After Phase 0 is complete:

### Title

```text
feat: build workforce and worker task foundation
```

### Scope

- Worker onboarding domain.
- Worker project assignment.
- Worker today screen.
- Worker task detail.
- Worker evidence capture mock.
- Worker voice update mock.
- Supervisor review handoff.

### Acceptance

A seeded worker can:

```text
Open Today
→ Open assigned task
→ Start
→ Add mock evidence
→ Add mock voice update
→ Submit
```

Supervisor can review it.

Customer cannot see it until approval.

---

# 27. Third Cursor Build

After worker execution is stable:

### Title

```text
feat: complete construction work library and task templates
```

### Scope

- Expand stages.
- Expand trades.
- Expand work types.
- Add reusable task templates.
- Add evidence requirements.
- Add dependencies.
- Connect Work Library → Create Task.

---

# 28. Fourth Cursor Build

### Title

```text
feat: add contextual construction communication
```

### Scope

- Project chat mock.
- Task discussion.
- Voice message mock.
- Worker/supervisor communication.
- Customer communication permissions.

Do not implement real telephony or calling infrastructure in this phase.

---

# 29. Fifth Cursor Build

### Title

```text
feat: customer construction transparency workspace
```

### Scope

- Customer project overview.
- Timeline.
- Published evidence.
- Yesterday / Today / Tomorrow.
- Progress history.
- Approved issues.
- Questions/communication entry point.

---

# 30. React Router Migration Plan

Do this only after the current screen architecture is stable.

Target route shape:

```text
/company
/company/projects
/company/projects/new
/company/projects/:projectId
/company/projects/:projectId/structure
/company/projects/:projectId/team
/company/projects/:projectId/work-plan
/company/projects/:projectId/tasks
/company/projects/:projectId/tasks/:taskId
/company/projects/:projectId/progress
/company/projects/:projectId/review
/company/projects/:projectId/workforce
/company/projects/:projectId/issues
/customer/projects/:projectId
```

Keep the homeowner estimation flow alongside the company routes.

Migration must preserve deep links and browser back/forward behavior.

---

# 31. Testing Strategy

No large test suite is required immediately.

Start with deterministic domain tests.

## Unit tests

Test:

- task transition rules;
- permission evaluation;
- project progress aggregation;
- published-only selectors;
- evidence visibility;
- worker scope filtering.

## Integration tests

Then test:

```text
Task
→ Progress
→ Review
→ Publish
→ Customer Selector
```

## Browser/acceptance tests

Eventually automate:

1. Homeowner estimate flow.
2. Company project setup.
3. Worker task execution.
4. Daily progress approval.
5. Customer visibility gate.
6. Marketplace unlock.
7. Subscription entitlement.

---

# 32. Definition of Done

A feature is not complete because the screen looks finished.

It is complete when:

- the UI is connected to the shared domain model;
- state changes are deterministic;
- permissions are enforced at the domain boundary;
- customer publication rules are preserved;
- no duplicated mock data is introduced;
- typecheck passes;
- build passes;
- formatting passes;
- critical path is manually verified;
- the PR clearly states limitations.

---

# 33. Explicitly Do NOT Build Yet

Until the construction core is stable, do not implement:

- real backend;
- real authentication;
- real payment processing;
- marketplace lead payment;
- real AI cost estimation APIs;
- real voice transcription APIs;
- real phone calling;
- real video calling;
- continuous GPS tracking;
- advanced analytics;
- time-lapse infrastructure;
- enterprise integrations;
- microservices;
- full mobile app;
- white-label customer portals.

These belong to later phases.

---

# 34. Product Scenarios the Final System Must Support

## Scenario A — Homeowner looking for a contractor

```text
Homeowner
→ AI Construction Advisor
→ Estimate
→ Requirement
→ Marketplace
→ Partner Unlock
→ Proposal
→ Partner Selected
→ Project
```

## Scenario B — Homeowner already has a contractor

```text
Construction Company / Contractor
→ Create Existing Project
→ Add Homeowner
→ Construction continues
→ Homeowner views approved progress
```

## Scenario C — Contractor looking for work

```text
Contractor
→ Partner profile
→ Opportunities
→ Paid unlock
→ Requirement
→ Estimate / Proposal
```

## Scenario D — Contractor already hired by developer

```text
Developer
→ Multi-unit project
→ Contractor assignment
→ Supervisor
→ Workers
→ Tasks
→ Daily progress
→ Review
→ Customer
```

## Scenario E — Developer managing 170 villas

```text
Developer
→ Project
→ Phases
→ Blocks
→ Villas 001–170
→ Multiple contractors
→ Supervisors
→ Workforce
→ Work plans
→ Tasks
→ Progress
→ Customer visibility per unit
```

These are not separate applications. They are different roles/relationships on the same project engine.

---

# 35. Long-Term Houzeify Product Loop

The complete platform should eventually operate as:

```text
DISCOVER
  ↓
ESTIMATE
  ↓
CONNECT
  ↓
PLAN
  ↓
ASSIGN
  ↓
EXECUTE
  ↓
CAPTURE
  ↓
REVIEW
  ↓
PUBLISH
  ↓
TRACK
  ↓
ANALYZE
  ↓
LEARN
```

The digital construction record is the connective tissue across the entire loop.

---

# 36. Immediate Next Action

Use Cursor to execute **Phase 0 only**.

Do not start Phase 1 in the same task.

Do not add worker screens until the Phase 0 domain changes are stable.

Do not add real backend infrastructure yet.

After Phase 0 is merged, proceed to the worker/task execution slice.

---

# 37. Cursor Instruction — Paste This Now

```text
You are the senior engineer implementing Houzeify in the existing repository.

First read:
- HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md
- Houzeify Master Plan v0.2
- DESIGN.md
- AGENTS.md
- CLAUDE.md

The current repository is React + Vite + TypeScript + Tailwind v4 + Ant Design 6.6.5.
The existing Figma-generated visual system is already approved.
Do not replace it.

The current `main` branch already contains the merged daily-progress loop:
Task → Daily Progress → Review → Approve/Reject → Customer Update.
Preserve that working flow.

PHASE 0 OBJECTIVE:
Stabilize the construction domain foundation without redesigning screens.

Implement only:
1. Fix Evidence worker attribution so capturedByWorkerId is preserved.
2. Centralize and reuse task transition rules.
3. Make approved daily progress synchronize task status consistently with the defined state machine.
4. Replace direct project-progress overwrite with a centralized progress calculation function that can evolve into task/work-type/stage/unit/project aggregation.
5. Add typed permission constants/names without implementing real authentication.
6. Add a first-class worker project assignment model in the mock domain/state layer.
7. Keep the existing in-memory ConstructionDataProvider and selectors.
8. Improve domain typing where needed.
9. Add minimal deterministic tests for task transitions, progress aggregation, and published-only customer visibility.
10. Add or update package scripts required to run typecheck/tests/build without changing the current runtime architecture.

DO NOT:
- change the homeowner estimation flow;
- redesign the current UI;
- introduce React Router;
- add a backend;
- add real authentication;
- add real uploads;
- add real voice APIs;
- add marketplace;
- add billing;
- add real AI APIs;
- build worker screens yet;
- refactor unrelated components;
- edit src/imports/

ANT DESIGN RULE:
Keep the existing Ant Design integration and Houzeify theme. Do not convert screens to stock Ant Design styling.

DATA RULE:
Do not add new screen-local fake project/task/worker arrays. All construction data must go through the shared mock domain state.

Before editing, inspect the relevant files and explain the exact changes you intend to make.
Then implement the smallest safe patch.

VALIDATION:
Run:
pnpm exec tsc --noEmit
pnpm run build
pnpm run format
and the new targeted tests.

Finally report:
- files changed;
- domain changes;
- tests added/run;
- build/typecheck results;
- any remaining limitations;
- whether the daily-progress/customer visibility flow was preserved.
```

---

# 38. Final Engineering Principle

Houzeify must evolve around one shared truth:

> **A construction project is not a collection of screens. It is a structured record of people, places, work, evidence, decisions, and progress.**

Cursor should therefore build the application from the **domain outward**, while preserving the existing Houzeify visual system.

The correct sequence is:

```text
Domain foundation
→ Project
→ Structure
→ Work Library
→ Workforce
→ Tasks
→ Evidence
→ Progress
→ Review
→ Customer
→ Communication
→ AI
→ Marketplace
→ Billing
→ Production backend/mobile
```

This keeps the product extensible from:

```text
one homeowner + one house
```

to:

```text
developer + 170 villas + multiple contractors + supervisors + hundreds of workers + individual homeowners
```

without creating separate product architectures for each scenario.
