# Project AI — Project Report Design

**Status:** Approved design, implementing in two PRs

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §10.4 "Project AI":

```
Project data → Progress analysis → Planned vs actual → Issue summary → Delay signals → Management report
```

with the §10 AI governance rule: every AI-generated record carries `source`, `confidence`/assumptions, `createdBy = AI`, review status, `approvedBy`, `approvedAt`.

**Context:** Homeowner AI (§10.1, Phase 8), Site AI voice → task/progress/issue (§10.3, Phase 6B) and rate-card Partner pricing (§10.2, Phase 9) already exist and are all deterministic behind swappable interfaces. Project AI is the one track with nothing built. Decisions made during brainstorming: build Project AI first; rules now with an LLM swap-in later (no real LLM in this work).

## Goal

Give business staff a per-project report that turns data the app already holds into a progress analysis, a planned-vs-actual comparison, an issue summary, delay signals and a short management summary, clearly marked as an AI-generated draft until a person approves it.

## Out of scope

- A real LLM, prompt design, or any server-side AI call.
- Showing the report to homeowners, or any customer-facing sharing.
- Scheduled / emailed reports.
- The company-level "Hozie AI" nav item (stays "Soon").
- Cross-project portfolio reports.

## Delivery: two PRs

| PR | Contents | Schema change |
|---|---|---|
| 1 | Analyzer, `project-report` screen, project-menu entry, tests. The report is always a live draft. | none |
| 2 | "Approve and save" persists an immutable snapshot with `approvedBy` / `approvedAt`, plus a report history list. | new table, RLS, function, pgTAP, adapter |

## 1. Analyzer — `src/domain/projectAnalysis.ts`

Pure and deterministic. No clock reads, no I/O; `today` is passed in so tests are reproducible.

```ts
analyzeProject(state: ConstructionDataState, projectId: EntityId, today: ISODate): ProjectReport | undefined
```

Returns `undefined` for an unknown project. Reads only `state`.

### Named thresholds (constants, exported for tests)

| Constant | Value |
|---|---|
| `STALE_UPDATE_DAYS` | 3 |
| `STALE_UPDATE_HIGH_DAYS` | 7 |
| `SCHEDULE_VARIANCE_MEDIUM_POINTS` | 10 |
| `SCHEDULE_VARIANCE_HIGH_POINTS` | 25 |
| `OVERDUE_HIGH_DAYS` | 7 |
| `LATE_START_MEDIUM_DAYS` | 3 |
| `SERIOUS_ISSUE_AGE_DAYS` | 7 |
| `MIN_TASKS_FOR_HIGH_CONFIDENCE` | 5 |

### Data model

```ts
type ReportStatus = "on-track" | "at-risk" | "behind" | "not-enough-data"
type SignalSeverity = "medium" | "high"
type SignalKind =
  | "overdue-task" | "blocked-task" | "late-start"
  | "stale-updates" | "behind-schedule" | "aging-issue"

interface DelaySignal {
  kind: SignalKind
  severity: SignalSeverity
  /** Plain-language one-liner, e.g. "Backfill around footings is 4 days overdue". */
  message: string
  /** Ids the signal is about, so the UI can link to them. */
  taskId?: EntityId
  issueId?: EntityId
  stageId?: EntityId
}

interface StageAnalysis {
  stageId: EntityId
  name: string
  percent: number          // stagePercent(baseline, stage tasks)
  baseline: number
  taskCount: number
  dueByToday: number       // tasks with dueDate <= today (excl. cancelled)
  doneOfDue: number        // of those, approved/completed
}

interface ProjectReport {
  projectId: EntityId
  asOf: ISODate
  status: ReportStatus
  summary: string[]        // templated sentences, in reading order
  progress: {
    overall: number                 // calculateProjectProgress
    stages: StageAnalysis[]         // stages with tasks or a baseline > 0, in sequence
    lastApprovedUpdate?: ISODate
    daysSinceLastUpdate?: number
  }
  plannedVsActual: {
    dueByToday: number
    doneOfDue: number
    expectedPercent?: number        // only when start and target dates are valid
    actualPercent: number
    variancePoints?: number         // expected - actual
  }
  issues: {
    open: number
    bySeverity: Record<"low" | "medium" | "high" | "critical", number>
    byStatus: Record<"open" | "in-progress" | "resolved" | "closed", number>
    oldestSerious?: { issueId: EntityId; title: string; ageDays: number }
  }
  signals: DelaySignal[]
  // AI governance (mirrors Estimate's fields)
  source: "ai"
  createdBy: "ai"
  engine: "rules-v1"        // names the generator, so an LLM engine can replace it
  confidence: "low" | "medium" | "high"
  assumptions: string[]
  reviewStatus: "draft" | "approved"
  approvedBy?: EntityId
  approvedAt?: ISODateTime
  generatedAt: ISODateTime
}
```

### Rules

"Done" means task status `approved` or `completed` (the existing `DONE_STATUSES`). Cancelled tasks are excluded everywhere. Dates compare as `YYYY-MM-DD` strings; "days" are whole calendar days.

| Rule | Fires when | Severity |
|---|---|---|
| `overdue-task` | task not done, `dueDate < today` | high if priority is high/critical or overdue more than `OVERDUE_HIGH_DAYS`; else medium |
| `blocked-task` | status `blocked` or `delayed` | high if priority is high/critical; else medium |
| `late-start` | `plannedStart < today` and status in `draft`, `assigned`, `accepted`, `ready` | medium if more than `LATE_START_MEDIUM_DAYS` late; otherwise no signal |
| `stale-updates` | project `active` and the latest approved daily progress is at least `STALE_UPDATE_DAYS` old, or none exists | high at `STALE_UPDATE_HIGH_DAYS`+ or none; else medium |
| `behind-schedule` | start and target valid, `expected - actual` exceeds `SCHEDULE_VARIANCE_MEDIUM_POINTS` | high above `SCHEDULE_VARIANCE_HIGH_POINTS`; else medium |
| `aging-issue` | issue `open`/`in-progress`, severity high/critical, older than `SERIOUS_ISSUE_AGE_DAYS` | high |

`expectedPercent = clamp((today - startDate) / (targetDate - startDate)) * 100`, only when both dates parse and `targetDate > startDate`.

### Status

- `not-enough-data`: the project has no non-cancelled tasks.
- else `behind`: any high signal.
- else `at-risk`: any medium signal.
- else `on-track`.

### Confidence and assumptions

- `low`: no tasks. `high`: valid start and target dates and at least `MIN_TASKS_FOR_HIGH_CONFIDENCE` tasks. `medium`: everything else.
- `assumptions` lists what was not available, e.g. "No target date is set, so schedule variance was not computed.", "Tasks without a planned quantity count as 0% until approved or completed.", "No approved updates yet, so update freshness could not be measured."

### Summary text

Templated, in a fixed order: headline (status plus overall %), planned-vs-actual sentence, the top three signals by severity then recency, issue sentence, and one sentence per assumption that materially affects confidence. Every number in the text comes from the report's own fields.

## 2. Screen — `src/screens/ProjectReportScreen.tsx` (PR 1)

- Route `project-report`, `requires: ["project_id"]`, access `project(Permissions.PROJECT_MANAGE)` (business accounts only).
- Project menu entry "AI Report" (key `report`) after "Progress".
- Layout (antd, same conventions as the other company screens): status banner with a "Draft — generated by rules, not yet reviewed" tag and the `asOf` date; stat cards (overall progress, planned vs actual, open issues, days since last update); stage table; delay signals list linking to the task/issue; issue summary; assumptions.
- `today` comes from the injected clock via the provider, not `new Date()` inside the component.
- Empty / not-enough-data state explains what is missing instead of showing zeros.

## 3. Approval and persistence (PR 2)

- Table `project_reports`: `id`, `project_id`, `as_of date`, `status`, `payload jsonb` (the full report), `engine`, `generated_at`, `approved_by` (person id), `approved_at`, `created_at`. Immutable after insert (trigger refuses update/delete), one row per approval.
- RLS: select for staff with `project.manage` on the project; no direct insert/update/delete policy (writes go through the function), like the other B4-governed tables.
- Function `approve_project_report(project_id uuid, payload jsonb)`: security definer; checks `project.manage`; records `approved_by = current_person_id()` and `approved_at = now()`; validates the payload's `projectId` matches and `engine`/`source`/`createdBy` are the expected values. Refusals use the existing `conflict:` / `permission:` prefixes.
- Domain command `approveProjectReport` + in-memory repository support; adapter wrapper; `commandSurface` entry.
- UI: "Approve and save" on the report screen; a "Saved reports" list showing approver and date, opening the stored snapshot read-only.

## 4. Testing

- Per-rule unit tests with crafted minimal states, including each boundary (exactly at a threshold, one day either side).
- Thin-data tests: no tasks → `not-enough-data` and low confidence; no dates → no schedule variance and the assumption present; no approved updates.
- A seed-based test on Sharma Residence asserting the report is internally consistent (counts match the state; every signal references a real id).
- Determinism test: same state and `today` → deep-equal report.
- Navigation tests: the route exists, requires `project_id`, and is refused for homeowner and worker sessions.
- PR 2: pgTAP for the function and table (permission refusal, payload mismatch, immutability, RLS), adapter integration test against the local stack.
- Live browser check as the business user in supabase mode.
