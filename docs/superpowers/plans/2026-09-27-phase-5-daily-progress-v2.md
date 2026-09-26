# Phase 5 — Daily Progress v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Submission → Review → Revision → Approval → Selective Publication → Customer Visibility, with calculated project progress.

**Architecture:** Pure domain commands in `src/domain/constructionCommands.ts` gain review notes, versioned resubmission and a separate publish command; `src/domain/progress.ts` becomes a pure calculator over tasks, stage baselines and fixed stage weights. Screens read through `src/mock/selectors.ts` and call commands through `ConstructionDataProvider`. New shared UI lives in `src/components/progress/`.

**Tech Stack:** React 19, TypeScript 5.7, Ant Design 6, Tailwind v4, Vite 8, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-phase-5-daily-progress-v2-design.md`

## Global Constraints

- Checks that must pass after every task: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
- Never run `pnpm run format` (oxfmt 0.2.0 strips `;` in TypeScript types and breaks the build). Match surrounding style by hand: no semicolons, double quotes in `src/domain` and `src/components`.
- Strings containing an apostrophe use double quotes: `"Voice notes can't be shared with the homeowner."`
- React components are default exports.
- Git: prefix commands with `export PATH="/opt/homebrew/bin:$PATH" &&` (git-lfs hooks). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push until the user says so.
- Dev server: `http://localhost:5174` (already running).
- Publishing permission: reuse existing `Permissions.CUSTOMER_PUBLISH` (`"customer.publish"`) — do not add a new permission (Task 1 updates the spec to say so).
- Stage weights by stage **code**: `SITE 5, FND 12, RCC 25, MSN 12, PLS 10, WPF 5, SRV 13, FLR 8, FIN 10` (sum 100). Unknown codes weigh 0.
- Error copy (exact):
  - `"Add a note so the worker knows what to fix."`
  - `"Add a note saying why this update is rejected."`
  - `"Only an update sent back for changes can be resubmitted."`
  - `"Only approved updates can be published."`
  - `"Voice notes can't be shared with the homeowner."`
  - `"Stage baselines must be between 0 and 100."`

## File Map

| File | Responsibility |
|---|---|
| `src/domain/models.ts` | Review/publication types, versioning fields, `stageBaselines` |
| `src/domain/permissions.ts` | Supervisor gets `CUSTOMER_PUBLISH` |
| `src/domain/progress.ts` | Calculated project progress (pure) |
| `src/domain/taskTransitions.ts` | `statusAfterChangesRequested` |
| `src/domain/commandInputs.ts` | `ResubmitDailyProgressInput` |
| `src/domain/constructionCommands.ts` | `reviewDailyProgress` (notes, request-changes, no publishing), `resubmitDailyProgress`, `publishDailyProgress`, `setStageBaselines` |
| `src/mock/seed.ts` | Versions, baselines, `"ready"` → `"private"` |
| `src/mock/selectors.ts` | Ready-to-publish, history, version chain, changes-requested, published evidence |
| `src/mock/ConstructionDataProvider.tsx` | Wire new commands |
| `src/components/progress/progressLabels.ts` | Company-side status labels/colours |
| `src/components/progress/EvidenceViewer.tsx` | Modal viewer (company + homeowner) |
| `src/components/progress/EvidenceGrid.tsx` | Clickable thumbnails that open the viewer |
| `src/components/progress/ProgressDetail.tsx` | One update's details + version history |
| `src/components/progress/ReviewDecisionModal.tsx` | Note entry for approve / request changes / reject |
| `src/components/progress/PublishPanel.tsx` | Evidence selection + preview + publish |
| `src/screens/DailyProgressReviewScreen.tsx` | Three tabs: review, ready to publish, history |
| `src/components/worker/workerLabels.ts` | Worker labels for new review states |
| `src/screens/WorkerTodayScreen.tsx` | "Changes requested" section |
| `src/screens/WorkerSubmitScreen.tsx` | Resubmit mode |
| `src/screens/DailyProgressSubmitScreen.tsx` | Resubmit mode (company) |
| `src/screens/TaskDetailScreen.tsx` | Versioned history + Resubmit |
| `src/screens/ProjectOverviewScreen.tsx` | Status label from `progressLabels` |
| `src/screens/ProjectStructureScreen.tsx` | Stage baseline inputs during setup |
| `src/screens/CustomerDailyUpdateScreen.tsx` | Published evidence only, calculated % |
| Tests | `progress.test.ts` (rewrite), `progressReview.test.ts` (new), `progressSelectors.test.ts` (new), updates to 3 existing tests |

---

### Task 1: Data model, permission, seed

**Files:**
- Modify: `src/domain/models.ts` (Project ~38-53, DailyProgress ~223-246)
- Modify: `src/domain/permissions.ts` (supervisor list)
- Modify: `src/mock/seed.ts` (projects ~230-310, dailyProgress ~752-822)
- Modify: `src/domain/constructionCommands.ts` (`createProject` ~225-245, `submitDailyProgress` record ~925-950)
- Modify: `src/components/worker/workerLabels.ts` (`reviewLabel`)
- Modify: `src/domain/progress.test.ts` fixture (`progress()` helper, `baseProject`)
- Modify: `src/domain/constructionCommands.test.ts:78` fixture if it builds a `Project`
- Modify: `docs/superpowers/specs/2026-09-27-phase-5-daily-progress-v2-design.md` (Permissions section)
- Test: `src/domain/seedIntegrity.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  export type ReviewStatus = "draft" | "submitted" | "approved" | "changes-requested" | "rejected" | "superseded"
  export type ReviewDecision = "approve" | "request-changes" | "reject"
  export interface ProgressReview { decision: ReviewDecision; note?: string; reviewedByMembershipId: EntityId; reviewedAt: ISODateTime }
  export interface ProgressPublication { publishedByMembershipId: EntityId; publishedAt: ISODateTime; evidenceIds: EntityId[] }
  // DailyProgress gains: version: number; supersedesId?; supersededById?; review?; publication?
  // DailyProgress.reviewStatus: ReviewStatus; publicationStatus: "private" | "published"
  // Project gains: stageBaselines: Record<EntityId, number>
  ```

- [ ] **Step 1: Write the failing test** — `src/domain/seedIntegrity.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { Permissions, permissionsForRole } from "./permissions"

describe("seed after Daily Progress v2", () => {
  it("gives every update a version and no leftover 'ready' publication state", () => {
    for (const item of seed.dailyProgress) {
      expect(item.version).toBe(1)
      expect(["private", "published"]).toContain(item.publicationStatus)
    }
  })

  it("records what the published Sharma update shared", () => {
    const item = seed.dailyProgress.find((p) => p.id === "progress-sharma-2009")!
    expect(item.publication?.evidenceIds).toEqual(["evidence-sharma-1", "evidence-sharma-2"])
    expect(item.review?.decision).toBe("approve")
  })

  it("gives every project stage baselines between 0 and 100", () => {
    for (const project of seed.projects) {
      for (const value of Object.values(project.stageBaselines)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
  })

  it("lets supervisors publish to the homeowner", () => {
    expect(permissionsForRole("supervisor")).toContain(Permissions.CUSTOMER_PUBLISH)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/domain/seedIntegrity.test.ts`
Expected: FAIL (`version` undefined / `stageBaselines` undefined).

- [ ] **Step 3: Update `src/domain/models.ts`**

Above `export interface DailyProgress` add:

```ts
export type ReviewStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "changes-requested"
  | "rejected"
  | "superseded"

export type ReviewDecision = "approve" | "request-changes" | "reject"

/** The reviewer's decision on one version of a daily progress update. */
export interface ProgressReview {
  decision: ReviewDecision
  /** Required for request-changes and reject. Never shown to the homeowner. */
  note?: string
  reviewedByMembershipId: EntityId
  reviewedAt: ISODateTime
}

/** What was shared with the homeowner, and by whom. */
export interface ProgressPublication {
  publishedByMembershipId: EntityId
  publishedAt: ISODateTime
  evidenceIds: EntityId[]
}
```

In `DailyProgress` replace the last two fields with:

```ts
  reviewStatus: ReviewStatus
  publicationStatus: "private" | "published"
  /** 1 for the first submission; +1 for each resubmission after changes were requested. */
  version: number
  supersedesId?: EntityId
  supersededById?: EntityId
  review?: ProgressReview
  publication?: ProgressPublication
```

In `Project` after `trackingStartedMidProject: boolean` add:

```ts
  /** stageId → % of that stage already complete when tracking started (0–100). */
  stageBaselines: Record<EntityId, number>
```

- [ ] **Step 4: Supervisor publish permission** — in `src/domain/permissions.ts`, `supervisor:` list, add `Permissions.CUSTOMER_PUBLISH,` after `Permissions.PROGRESS_REVIEW,`.

- [ ] **Step 5: Seed** — in `src/mock/seed.ts`:

Add to each project (after `trackingStartedMidProject`):

```ts
    // project-sharma
    stageBaselines: { "stage-site-prep": 100, "stage-foundation": 90, "stage-rcc": 73 },
    // project-reddy
    stageBaselines: {
      "stage-site-prep": 100, "stage-foundation": 100, "stage-rcc": 100,
      "stage-masonry": 100, "stage-plaster": 80, "stage-waterproofing": 100,
    },
    // project-tech-park
    stageBaselines: {
      "stage-site-prep": 100, "stage-foundation": 100, "stage-rcc": 96,
      "stage-masonry": 100, "stage-plaster": 100, "stage-waterproofing": 100,
      "stage-services": 100,
    },
    // project-krishna
    stageBaselines: { "stage-site-prep": 100, "stage-foundation": 25 },
    // project-lakeside
    stageBaselines: { "stage-site-prep": 80 },
```

(Each gives exactly the current `progress` under the Task 2 formula because every seed task is at 0%: Sharma 34, Reddy 67, Tech Park 81, Krishna 8, Lakeside 4.)

In `dailyProgress`:
- every record: add `version: 1,`
- `progress-sharma-2009`: add
  ```ts
    review: {
      decision: "approve",
      reviewedByMembershipId: "membership-manager-1",
      reviewedAt: "2026-09-20T18:30:00+05:30",
    },
    publication: {
      publishedByMembershipId: "membership-manager-1",
      publishedAt: "2026-09-20T18:35:00+05:30",
      evidenceIds: ["evidence-sharma-1", "evidence-sharma-2"],
    },
  ```
- `progress-reddy-1809`: change `publicationStatus: "ready"` → `"private"` and add
  ```ts
    review: {
      decision: "approve",
      reviewedByMembershipId: "membership-manager-2",
      reviewedAt: "2026-09-18T19:00:00+05:30",
    },
  ```

- [ ] **Step 6: Commands compile** — in `src/domain/constructionCommands.ts`:
- `createProject`: replace `progress: input.trackingStartedMidProject ? 1 : 0,` with `progress: 0,` and add `stageBaselines: {},` after `trackingStartedMidProject`.
- `submitDailyProgress` record: add `version: 1,` after `publicationStatus: "private",`.

- [ ] **Step 7: Worker labels** — replace `reviewLabel` in `src/components/worker/workerLabels.ts`:

```ts
/** How the worker's own update stands with the supervisor. */
export const reviewLabel: Record<DailyProgress["reviewStatus"], {
  text: string
  color: string
}> = {
  draft: { text: "Draft", color: "default" },
  submitted: { text: "Waiting for review", color: "warning" },
  approved: { text: "Approved", color: "success" },
  "changes-requested": { text: "Fix and resend", color: "error" },
  rejected: { text: "Not accepted", color: "error" },
  superseded: { text: "Replaced by a newer update", color: "default" },
}
```

- [ ] **Step 8: Fixtures** — `src/domain/progress.test.ts`: add `stageBaselines: {},` to `baseProject` and `version: 1,` to the `progress()` helper's returned object (this file is rewritten in Task 2; this keeps it compiling now). Run `pnpm run typecheck` and add `stageBaselines: {}` to any other hand-built `Project` it reports (e.g. `src/domain/constructionCommands.test.ts:78`).

- [ ] **Step 9: Spec note** — in the spec's "Permissions" section replace the paragraph with:

```md
Publishing uses the existing `Permissions.CUSTOMER_PUBLISH` (`"customer.publish"`), which project managers already hold; supervisors are granted it too. Publishing is a customer decision, separate from checking the work (`progress.review`).
```

- [ ] **Step 10: Verify**

Run: `pnpm run typecheck && pnpm vitest run src/domain/seedIntegrity.test.ts`
Expected: typecheck clean; 4 tests PASS. (`pnpm run test` may still fail in review/publication tests — fixed in Task 3.)

- [ ] **Step 11: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add -A src docs && git commit -m "feat: daily progress v2 data model, stage baselines, supervisor publish

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Calculated project progress

**Files:**
- Modify: `src/domain/progress.ts` (rewrite)
- Modify: `src/domain/progress.test.ts` (rewrite)
- Modify: `src/domain/constructionCommands.ts` (the one `calculateProjectProgress(...)` call inside `reviewDailyProgress`)

**Interfaces:**
- Produces:
  ```ts
  export const STAGE_WEIGHTS: Readonly<Record<string, number>>
  export function taskPercent(task: Task): number
  export function stagePercent(baseline: number, tasks: readonly Task[]): number
  export function calculateProjectProgress(
    project: Project,
    stages: readonly ConstructionStage[],
    tasks: readonly Task[],
  ): number
  ```

- [ ] **Step 1: Write the failing tests** — replace `src/domain/progress.test.ts` entirely:

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import type { ConstructionStage, Project, Task } from "./models"
import {
  calculateProjectProgress,
  STAGE_WEIGHTS,
  stagePercent,
  taskPercent,
} from "./progress"

const stages: ConstructionStage[] = [
  { id: "s-fnd", code: "FND", name: "Foundation", sequence: 1 },
  { id: "s-rcc", code: "RCC", name: "RCC", sequence: 2 },
  { id: "s-x", code: "CUSTOM", name: "Custom", sequence: 3 },
]

const project = (stageBaselines: Record<string, number> = {}): Project => ({
  id: "p",
  organizationId: "o",
  code: "P",
  name: "P",
  kind: "individual-house",
  status: "active",
  location: "Hyderabad",
  progress: 0,
  trackingStartedMidProject: false,
  stageBaselines,
  createdAt: "2026-09-01T00:00:00+05:30",
  updatedAt: "2026-09-01T00:00:00+05:30",
})

const task = (partial: Partial<Task> & Pick<Task, "id" | "stageId">): Task => ({
  projectId: "p",
  projectUnitId: "u1",
  tradeId: "t",
  workTypeId: "w",
  title: partial.id,
  status: "in-progress",
  priority: "medium",
  checklist: [],
  createdByMembershipId: "m",
  createdAt: "2026-09-01T00:00:00+05:30",
  updatedAt: "2026-09-01T00:00:00+05:30",
  ...partial,
})

describe("STAGE_WEIGHTS", () => {
  it("adds up to 100", () => {
    expect(Object.values(STAGE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe("taskPercent", () => {
  it("uses approved quantity against the plan, capped at 100", () => {
    expect(taskPercent(task({ id: "a", stageId: "s-fnd", plannedQuantity: { value: 20, unit: "m3" }, completedQuantity: { value: 5, unit: "m3" } }))).toBe(25)
    expect(taskPercent(task({ id: "b", stageId: "s-fnd", plannedQuantity: { value: 20, unit: "m3" }, completedQuantity: { value: 30, unit: "m3" } }))).toBe(100)
  })

  it("ignores quantity in a different unit", () => {
    expect(taskPercent(task({ id: "a", stageId: "s-fnd", plannedQuantity: { value: 20, unit: "m3" }, completedQuantity: { value: 5, unit: "nos" } }))).toBe(0)
  })

  it("falls back to status when there is no planned quantity", () => {
    expect(taskPercent(task({ id: "a", stageId: "s-fnd", status: "approved" }))).toBe(100)
    expect(taskPercent(task({ id: "b", stageId: "s-fnd", status: "completed" }))).toBe(100)
    expect(taskPercent(task({ id: "c", stageId: "s-fnd", status: "review" }))).toBe(0)
  })
})

describe("stagePercent", () => {
  it("is the baseline when the stage has no tasks", () => {
    expect(stagePercent(40, [])).toBe(40)
  })

  it("spreads task work over what the baseline leaves", () => {
    const tasks = [
      task({ id: "a", stageId: "s-rcc", status: "approved" }),
      task({ id: "b", stageId: "s-rcc" }),
    ]
    expect(stagePercent(40, tasks)).toBe(70) // 40 + 60 × 50%
  })
})

describe("calculateProjectProgress", () => {
  it("weights stages by code and rounds", () => {
    // FND 100% × 12 + RCC 50% × 25 = 24.5 → 25 (custom stage weighs 0)
    const tasks = [
      task({ id: "a", stageId: "s-rcc", status: "approved" }),
      task({ id: "b", stageId: "s-rcc" }),
      task({ id: "c", stageId: "s-x", status: "approved" }),
    ]
    expect(calculateProjectProgress(project({ "s-fnd": 100 }), stages, tasks)).toBe(25)
  })

  it("excludes cancelled tasks", () => {
    const tasks = [
      task({ id: "a", stageId: "s-rcc", status: "approved" }),
      task({ id: "b", stageId: "s-rcc", status: "cancelled" }),
    ]
    expect(calculateProjectProgress(project(), stages, tasks)).toBe(25)
  })

  it("counts tasks in every unit, so one unit can't overwrite the project", () => {
    const tasks = [
      task({ id: "a", stageId: "s-rcc", projectUnitId: "u1", status: "approved" }),
      task({ id: "b", stageId: "s-rcc", projectUnitId: "u2" }),
    ]
    expect(calculateProjectProgress(project(), stages, tasks)).toBe(13) // 50% × 25 = 12.5 → 13
  })

  it("only counts this project's tasks", () => {
    const other = task({ id: "a", stageId: "s-rcc", projectId: "other", status: "approved" })
    expect(calculateProjectProgress(project(), stages, [other])).toBe(0)
  })

  it("reproduces the seed projects' current percentages", () => {
    const expected: Record<string, number> = {
      "project-sharma": 34,
      "project-reddy": 67,
      "project-tech-park": 81,
      "project-krishna": 8,
      "project-lakeside": 4,
    }
    for (const item of seed.projects) {
      expect(calculateProjectProgress(item, seed.stages, seed.tasks), item.id).toBe(expected[item.id])
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/progress.test.ts`
Expected: FAIL (`STAGE_WEIGHTS`, `taskPercent`, `stagePercent` not exported).

- [ ] **Step 3: Replace `src/domain/progress.ts`**

```ts
import type { ConstructionStage, Project, Task } from "./models"

/**
 * Official project progress (build plan §18).
 *
 * Task % → stage % (over every unit) → fixed stage weights → project %.
 * The % a submitter types on a daily update is their estimate only; it never
 * changes the project figure.
 *
 * Known simplification: a stage's tasks are assumed to cover the work its
 * baseline leaves, so one tracked task at 100% completes a stage with a 40%
 * baseline. A BOQ / cost weighting replaces this later.
 */

/** Weight of each stage by stage code. Sums to 100; unknown codes weigh 0. */
export const STAGE_WEIGHTS: Readonly<Record<string, number>> = {
  SITE: 5,
  FND: 12,
  RCC: 25,
  MSN: 12,
  PLS: 10,
  WPF: 5,
  SRV: 13,
  FLR: 8,
  FIN: 10,
}

const DONE_STATUSES: ReadonlySet<Task["status"]> = new Set(["approved", "completed"])

/** How complete one task is, 0–100. */
export function taskPercent(task: Task): number {
  const planned = task.plannedQuantity
  if (planned && planned.value > 0) {
    const done = task.completedQuantity
    if (!done || done.unit !== planned.unit) return 0
    return clampPercent((done.value / planned.value) * 100)
  }
  return DONE_STATUSES.has(task.status) ? 100 : 0
}

/** baseline + (100 − baseline) × average task %; the baseline alone when there are no tasks. */
export function stagePercent(baseline: number, tasks: readonly Task[]): number {
  const base = clampPercent(baseline)
  if (!tasks.length) return base
  const average = tasks.reduce((sum, task) => sum + taskPercent(task), 0) / tasks.length
  return base + ((100 - base) * average) / 100
}

export function calculateProjectProgress(
  project: Project,
  stages: readonly ConstructionStage[],
  tasks: readonly Task[],
): number {
  const projectTasks = tasks.filter(
    (task) => task.projectId === project.id && task.status !== "cancelled",
  )
  const total = stages.reduce((sum, stage) => {
    const weight = STAGE_WEIGHTS[stage.code] ?? 0
    if (!weight) return sum
    const stageTasks = projectTasks.filter((task) => task.stageId === stage.id)
    const percent = stagePercent(project.stageBaselines[stage.id] ?? 0, stageTasks)
    return sum + (weight * percent) / 100
  }, 0)
  return Math.round(clampPercent(total))
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(100, Math.max(0, value))
}
```

- [ ] **Step 4: Update the caller** — in `reviewDailyProgress` (approve branch), the project map currently calls `calculateProjectProgress(project, updatedProgress)`. Compute the updated tasks first and pass them in. Replace the approve branch's `return { state: { ... } }` so that it builds `tasks` into a const before `projects`:

```ts
    const tasks = state.tasks.map((task) => {
      if (task.id !== progress.taskId || task.projectId !== progress.projectId) {
        return task
      }
      const nextStatus = statusAfterProgressApproval(task.status)
      const completedQuantity = addQuantity(
        task.completedQuantity,
        progress.completedQuantity,
      )
      return nextStatus === task.status && completedQuantity === task.completedQuantity
        ? task
        : { ...task, status: nextStatus, completedQuantity, updatedAt: timestamp }
    })
```

and in `projects:` use `progress: calculateProjectProgress(project, state.stages, tasks),`, then `tasks,` in the returned state. (Task 3 rewrites this command fully; this step only keeps it compiling and correct.)

- [ ] **Step 5: Run**

Run: `pnpm vitest run src/domain/progress.test.ts && pnpm run typecheck`
Expected: all progress tests PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src/domain/progress.ts src/domain/progress.test.ts src/domain/constructionCommands.ts && git commit -m "feat: calculate project progress from tasks, stage baselines and weights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Review with notes and request changes (no publishing on approve)

**Files:**
- Modify: `src/domain/taskTransitions.ts` (add `statusAfterChangesRequested`)
- Modify: `src/domain/constructionCommands.ts` (`reviewDailyProgress`, ~981-1076)
- Modify: `src/mock/ConstructionDataProvider.tsx` (`reviewDailyProgress` type + wiring)
- Modify: `src/screens/DailyProgressReviewScreen.tsx` (`decide` call only — full rewrite in Task 8)
- Test: `src/domain/progressReview.test.ts` (new)
- Modify tests: `src/domain/constructionCommands.test.ts` ("daily progress review"), `src/domain/workerTasks.test.ts` ("publishes on approval…"), `src/domain/operationsFlows.test.ts` (lines ~117-120)

**Interfaces:**
- Consumes: `ReviewDecision`, `ProgressReview` (Task 1); `calculateProjectProgress(project, stages, tasks)` (Task 2)
- Produces:
  ```ts
  export function statusAfterChangesRequested(status: TaskStatus): TaskStatus | null
  export const reviewDailyProgress: (progressId: EntityId, decision: ReviewDecision, note?: string) => Command<void>
  // provider: reviewDailyProgress(progressId, decision, note?) => void
  ```

- [ ] **Step 1: Write the failing tests** — create `src/domain/progressReview.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { getPublishedForCustomer } from "../mock/selectors"
import { seedConstructionData as seed } from "../mock/seed"
import * as commands from "./constructionCommands"
import type { SubmitDailyProgressInput } from "./commandInputs"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const clock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }

// One id sequence per test, shared by every command, so ids never collide.
let ids: IdGenerator
beforeEach(() => {
  let n = 0
  ids = { next: (prefix) => `${prefix}-${++n}`, short: () => `s${++n}` }
})
const as = (actor: Session): CommandContext => ({ actor, clock, ids })

function run<T>(
  state: ConstructionDataState,
  actor: Session,
  command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T },
) {
  return command(state, as(actor))
}

const find = (state: ConstructionDataState, id: string) =>
  state.dailyProgress.find((p) => p.id === id)!

function raviInput(extra: Partial<SubmitDailyProgressInput> = {}): SubmitDailyProgressInput {
  const t = seed.tasks.find((item) => item.id === "task-13")!
  return {
    projectId: t.projectId,
    projectUnitId: t.projectUnitId,
    taskId: t.id,
    stageId: t.stageId,
    tradeId: t.tradeId,
    workTypeId: t.workTypeId,
    workersPresent: 3,
    completedQuantity: { value: 8, unit: "m3" },
    todaySummary: "Backfilled Grid A east",
    tomorrowPlan: "Grid A west",
    evidence: [
      { type: "photo", url: "blob:photo-1", caption: "East side" },
      { type: "photo", url: "blob:photo-2", caption: "Compaction" },
      { type: "audio", url: "blob:voice", caption: "Voice note" },
    ],
    ...extra,
  }
}

/** Ravi accepts, starts and submits task-13. */
function raviSubmitted() {
  let state = run(seed, ravi, commands.acceptTaskAssignment("task-13")).state
  state = run(state, ravi, commands.startTask("task-13")).state
  return run(state, ravi, commands.submitDailyProgress(raviInput()))
}

describe("reviewDailyProgress", () => {
  it("approve records the reviewer but does not publish", () => {
    const submitted = raviSubmitted()
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve", "Good work"))
    const item = find(state, submitted.result.id)
    expect(item.reviewStatus).toBe("approved")
    expect(item.publicationStatus).toBe("private")
    expect(item.review).toEqual({
      decision: "approve",
      note: "Good work",
      reviewedByMembershipId: "membership-manager-1",
      reviewedAt: "2026-09-27T09:30:00.000Z",
    })
    expect(state.evidence.filter((e) => e.dailyProgressId === item.id).map((e) => e.customerVisibility))
      .toEqual(["review-required", "review-required", "private"])
    expect(getPublishedForCustomer(state, "project-sharma").some((p) => p.id === item.id)).toBe(false)
  })

  it("approve recalculates project progress from tasks, ignoring the typed %", () => {
    const submitted = raviSubmitted()
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve"))
    // task-13: 8 of 24 m3 → Foundation 90 + 10 × avg(0, 33.3)% = 91.67 → project 34.25 → 34
    expect(state.projects.find((p) => p.id === "project-sharma")!.progress).toBe(34)
  })

  it("request changes needs a note, then sends the task back to in progress", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "request-changes", "  ")))
      .toThrow("Add a note so the worker knows what to fix.")
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "request-changes", "Add a photo of the west side"))
    const item = find(state, submitted.result.id)
    expect(item.reviewStatus).toBe("changes-requested")
    expect(item.review?.note).toBe("Add a photo of the west side")
    expect(state.tasks.find((t) => t.id === "task-13")!.status).toBe("in-progress")
  })

  it("reject needs a note and reopens the task", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "reject")))
      .toThrow(ConflictError)
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "reject", "Wrong task"))
    expect(find(state, submitted.result.id).reviewStatus).toBe("rejected")
    expect(state.tasks.find((t) => t.id === "task-13")!.status).toBe("reopened")
  })

  it("ignores a second review of the same update", () => {
    const submitted = raviSubmitted()
    const once = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve"))
    const twice = run(once.state, manager, commands.reviewDailyProgress(submitted.result.id, "reject", "Late"))
    expect(twice.state).toBe(once.state)
  })

  it("a worker can't review", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, ravi, commands.reviewDailyProgress(submitted.result.id, "approve")))
      .toThrow(PermissionError)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/progressReview.test.ts`
Expected: FAIL (approve still publishes; `"request-changes"` not accepted by the type).

- [ ] **Step 3: Task transition** — append to `src/domain/taskTransitions.ts`:

```ts
/**
 * After a reviewer asks for changes, put the linked task back in progress
 * (via reopened) so the submitter can fix it and resend.
 */
export function statusAfterChangesRequested(
  status: TaskStatus,
): TaskStatus | null {
  let current = status
  if (canTransitionTask(current, "reopened")) current = "reopened"
  if (canTransitionTask(current, "in-progress")) current = "in-progress"
  return current === status ? null : current
}
```

- [ ] **Step 4: Rewrite `reviewDailyProgress`** — replace the whole `export const reviewDailyProgress = …` block (up to, not including, `// ─── Work library`) with:

```ts
const NOTE_REQUIRED: Record<Exclude<ReviewDecision, "approve">, string> = {
  "request-changes": "Add a note so the worker knows what to fix.",
  reject: "Add a note saying why this update is rejected.",
}

export const reviewDailyProgress =
  (
    progressId: EntityId,
    decision: ReviewDecision,
    note?: string,
  ): Command<void> =>
  (state, ctx) => {
    // Authorize against the stored item's project, never a caller-supplied one.
    const progress = state.dailyProgress.find((item) => item.id === progressId)
    if (!progress) throw new PermissionError(Permissions.PROGRESS_REVIEW)
    const reviewer = authorizeProject(
      state,
      ctx,
      progress.projectId,
      [Permissions.PROGRESS_REVIEW],
      progress,
    )
    // Only a waiting update can be reviewed; a repeat review is a no-op.
    if (progress.reviewStatus !== "submitted") return { state, result: undefined }

    const trimmed = note?.trim() || undefined
    if (decision !== "approve" && !trimmed) {
      throw new ConflictError(NOTE_REQUIRED[decision])
    }

    const timestamp = iso(ctx)
    const review: ProgressReview = {
      decision,
      note: trimmed,
      reviewedByMembershipId: reviewer.id,
      reviewedAt: timestamp,
    }
    const nextReviewStatus: DailyProgress["reviewStatus"] =
      decision === "approve"
        ? "approved"
        : decision === "reject"
          ? "rejected"
          : "changes-requested"
    const dailyProgress = state.dailyProgress.map((item) =>
      item.id === progressId
        ? { ...item, reviewStatus: nextReviewStatus, review }
        : item,
    )

    const tasks = state.tasks.map((task) => {
      if (task.id !== progress.taskId || task.projectId !== progress.projectId) {
        return task
      }
      if (decision === "approve") {
        const nextStatus = statusAfterProgressApproval(task.status)
        const completedQuantity = addQuantity(
          task.completedQuantity,
          progress.completedQuantity,
        )
        return nextStatus === task.status && completedQuantity === task.completedQuantity
          ? task
          : { ...task, status: nextStatus, completedQuantity, updatedAt: timestamp }
      }
      const nextStatus =
        decision === "reject"
          ? statusAfterProgressRejection(task.status)
          : statusAfterChangesRequested(task.status)
      return nextStatus ? { ...task, status: nextStatus, updatedAt: timestamp } : task
    })

    return {
      state: {
        ...state,
        dailyProgress,
        tasks,
        // Only approved work moves the official figure. Publishing is separate.
        projects:
          decision !== "approve"
            ? state.projects
            : state.projects.map((project) =>
                project.id !== progress.projectId
                  ? project
                  : {
                      ...project,
                      progress: calculateProjectProgress(project, state.stages, tasks),
                      updatedAt: timestamp,
                    },
              ),
      },
      result: undefined,
    }
  }
```

Imports: add `ProgressReview`, `ReviewDecision` to the `./models` type import; add `statusAfterChangesRequested` to the `./taskTransitions` import. `ConflictError` is already imported.

- [ ] **Step 5: Provider** — in `src/mock/ConstructionDataProvider.tsx`:

Type:
```ts
  reviewDailyProgress: (
    progressId: EntityId,
    decision: ReviewDecision,
    note?: string,
  ) => void
```
Wiring:
```ts
      reviewDailyProgress: (id, decision, note) =>
        run(commands.reviewDailyProgress(id, decision, note)),
```
Add `ReviewDecision` to the `../domain/models` type import.

- [ ] **Step 6: Keep the review screen compiling** — in `src/screens/DailyProgressReviewScreen.tsx`, change the reject button to `onClick={() => decide("reject")}` → unchanged, but reject now needs a note, so temporarily change `decide` to pass a fixed note for reject:

```ts
    const outcome = run(
      () => reviewDailyProgress(selected.id, decision, decision === "reject" ? "Rejected in review" : undefined),
      { success: decision === "approve" ? "Progress approved" : "Progress rejected" },
    )
```
and the approve button label to `Approve`. (Task 8 replaces this screen.)

- [ ] **Step 7: Update existing tests to the new rule** (approval no longer publishes):

`src/domain/constructionCommands.test.ts` — rename the test to `"approve keeps the item private and is idempotent"`, change `expect(item.publicationStatus).toBe("published")` → `.toBe("private")`, and the second review call to `commands.reviewDailyProgress(submitted.result.id, "reject", "Late")`.

`src/domain/workerTasks.test.ts` — rename `"publishes on approval, except voice notes, without moving project %"` → `"approval keeps the update private until it is published"`; replace the `getPublishedForCustomer(...).some(...)` expectation with `.toBe(false)`; replace the evidence expectation with `.toEqual(["review-required", "private"])`. In `"keeps a rejected worker update off the customer record"`, change the call to `commands.reviewDailyProgress(submitted.result.id, "reject", "Wrong grid")`.

`src/domain/operationsFlows.test.ts` — replace lines asserting `publicationStatus` `"published"` and all-`customer-visible` with:

```ts
    expect(item.publicationStatus).toBe("private")
    expect(approved.state.evidence.filter((e) => e.dailyProgressId === item.id).every((e) => e.customerVisibility === "review-required")).toBe(true)
```

Any other `reviewDailyProgress(id, "reject")` calls reported by the test run get a note argument, e.g. `"Rejected in test"`.

- [ ] **Step 8: Run everything**

Run: `pnpm run typecheck && pnpm run test`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: review notes and request changes; approval no longer publishes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Versioned resubmission

**Files:**
- Modify: `src/domain/commandInputs.ts` (add `ResubmitDailyProgressInput`)
- Modify: `src/domain/constructionCommands.ts` (add `resubmitDailyProgress` after `submitDailyProgress`)
- Modify: `src/mock/ConstructionDataProvider.tsx`
- Test: `src/domain/progressReview.test.ts` (append)

**Interfaces:**
- Consumes: `submitDailyProgress` (existing), `reviewDailyProgress` (Task 3)
- Produces:
  ```ts
  export interface ResubmitDailyProgressInput {
    workersPresent: number
    progressAfter?: number
    completedQuantity?: Quantity
    todaySummary: string
    tomorrowPlan: string
    yesterdaySummary?: string
    blockerSummary?: string
    /** Evidence from the previous version to carry over. */
    keepEvidenceIds: EntityId[]
    /** Newly captured evidence. */
    evidence: SubmitDailyProgressInput["evidence"]
  }
  export const resubmitDailyProgress: (previousId: EntityId, input: ResubmitDailyProgressInput) => Command<DailyProgress>
  // provider: resubmitDailyProgress(previousId, input) => DailyProgress
  ```

- [ ] **Step 1: Write the failing tests** — append to `src/domain/progressReview.test.ts`:

```ts
function sentBack() {
  const submitted = raviSubmitted()
  const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "request-changes", "Add the west side"))
  return { state, previous: find(state, submitted.result.id) }
}

describe("resubmitDailyProgress", () => {
  it("creates version 2, supersedes version 1 and carries kept evidence", () => {
    const { state, previous } = sentBack()
    const [keep] = previous.evidenceIds
    const next = run(state, ravi, commands.resubmitDailyProgress(previous.id, {
      workersPresent: 3,
      completedQuantity: { value: 8, unit: "m3" },
      todaySummary: "Backfilled Grid A east and west",
      tomorrowPlan: "Grid B",
      keepEvidenceIds: [keep],
      evidence: [{ type: "photo", url: "blob:west", caption: "West side" }],
    }))
    const v1 = find(next.state, previous.id)
    const v2 = next.result
    expect(v2.version).toBe(2)
    expect(v2.supersedesId).toBe(previous.id)
    expect(v2.reviewStatus).toBe("submitted")
    expect(v1.reviewStatus).toBe("superseded")
    expect(v1.supersededById).toBe(v2.id)
    expect(v1.todaySummary).toBe("Backfilled Grid A east") // never overwritten
    expect(v2.evidenceIds[0]).toBe(keep)
    expect(v2.evidenceIds).toHaveLength(2)
    expect(next.state.evidence.find((e) => e.id === keep)!.dailyProgressId).toBe(v2.id)
    expect(v2.taskId).toBe("task-13")
    // Sent back put it in progress; resending moves it to submitted again.
    expect(next.state.tasks.find((t) => t.id === "task-13")!.status).toBe("submitted")
  })

  it("only works on an update sent back for changes", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, ravi, commands.resubmitDailyProgress(submitted.result.id, {
      workersPresent: 1, todaySummary: "x", tomorrowPlan: "y", keepEvidenceIds: [], evidence: [],
    }))).toThrow("Only an update sent back for changes can be resubmitted.")
  })

  it("only the original submitter can resubmit", () => {
    const { state, previous } = sentBack()
    expect(() => run(state, manager, commands.resubmitDailyProgress(previous.id, {
      workersPresent: 1, todaySummary: "x", tomorrowPlan: "y", keepEvidenceIds: [], evidence: [],
    }))).toThrow(PermissionError)
  })

  it("can't keep evidence from another update", () => {
    const { state, previous } = sentBack()
    expect(() => run(state, ravi, commands.resubmitDailyProgress(previous.id, {
      workersPresent: 1, todaySummary: "x", tomorrowPlan: "y", keepEvidenceIds: ["evidence-sharma-1"], evidence: [],
    }))).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/progressReview.test.ts`
Expected: FAIL (`resubmitDailyProgress` is not a function).

- [ ] **Step 3: Input type** — append to `src/domain/commandInputs.ts`:

```ts
/** A fixed version of an update the reviewer sent back. Location and task stay the same. */
export interface ResubmitDailyProgressInput {
  workersPresent: number
  progressAfter?: number
  completedQuantity?: Quantity
  todaySummary: string
  tomorrowPlan: string
  yesterdaySummary?: string
  blockerSummary?: string
  /** Evidence from the previous version to carry over. */
  keepEvidenceIds: EntityId[]
  /** Newly captured evidence. */
  evidence: SubmitDailyProgressInput["evidence"]
}
```
(Add `Quantity` / `EntityId` to that file's model import if missing.)

- [ ] **Step 4: Command** — in `src/domain/constructionCommands.ts` after `submitDailyProgress`:

```ts
/**
 * Sends a fixed version of an update the reviewer sent back. Builds the new
 * version through submitDailyProgress (same checks, same task move), then
 * links the two; the earlier version is kept as it was, marked superseded.
 */
export const resubmitDailyProgress =
  (
    previousId: EntityId,
    input: ResubmitDailyProgressInput,
  ): Command<DailyProgress> =>
  (state, ctx) => {
    const previous = state.dailyProgress.find((item) => item.id === previousId)
    if (!previous) throw new PermissionError(Permissions.PROGRESS_SUBMIT)
    if (previous.reviewStatus !== "changes-requested") {
      throw new ConflictError("Only an update sent back for changes can be resubmitted.")
    }
    const { keepEvidenceIds, ...rest } = input
    for (const id of keepEvidenceIds) {
      if (!previous.evidenceIds.includes(id)) {
        throw new IntegrityError(`Evidence ${id} is not on update ${previousId}`)
      }
    }

    const submitted = submitDailyProgress({
      ...rest,
      projectId: previous.projectId,
      projectUnitId: previous.projectUnitId,
      taskId: previous.taskId,
      stageId: previous.stageId,
      tradeId: previous.tradeId,
      workTypeId: previous.workTypeId,
    })(state, ctx)
    const created = submitted.result
    if (created.submittedByMembershipId !== previous.submittedByMembershipId) {
      throw new PermissionError(Permissions.PROGRESS_SUBMIT, previous.projectId)
    }

    const next: DailyProgress = {
      ...created,
      version: previous.version + 1,
      supersedesId: previous.id,
      evidenceIds: [...keepEvidenceIds, ...created.evidenceIds],
    }
    return {
      state: {
        ...submitted.state,
        dailyProgress: submitted.state.dailyProgress.map((item) =>
          item.id === created.id
            ? next
            : item.id === previous.id
              ? { ...item, reviewStatus: "superseded" as const, supersededById: created.id }
              : item,
        ),
        evidence: submitted.state.evidence.map((item) =>
          keepEvidenceIds.includes(item.id)
            ? { ...item, dailyProgressId: created.id }
            : item,
        ),
      },
      result: next,
    }
  }
```

Add `ResubmitDailyProgressInput` to the `./commandInputs` type import.

- [ ] **Step 5: Provider** — type `resubmitDailyProgress: (previousId: EntityId, input: Inputs.ResubmitDailyProgressInput) => DailyProgress`, wiring `resubmitDailyProgress: (id, input) => run(commands.resubmitDailyProgress(id, input)),`, and add `ResubmitDailyProgressInput` to the re-exported input types list.

- [ ] **Step 6: Run**

Run: `pnpm run typecheck && pnpm run test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: resubmit a sent-back update as a new version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Publish selected evidence

**Files:**
- Modify: `src/domain/constructionCommands.ts` (add `publishDailyProgress` after `reviewDailyProgress`)
- Modify: `src/mock/ConstructionDataProvider.tsx`
- Test: `src/domain/progressReview.test.ts` (append)

**Interfaces:**
- Consumes: `ProgressPublication` (Task 1)
- Produces:
  ```ts
  export const publishDailyProgress: (progressId: EntityId, evidenceIds: EntityId[]) => Command<void>
  // provider: publishDailyProgress(progressId, evidenceIds) => void
  ```

- [ ] **Step 1: Write the failing tests** — append:

```ts
function approved() {
  const submitted = raviSubmitted()
  const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve"))
  return { state, item: find(state, submitted.result.id) }
}

describe("publishDailyProgress", () => {
  it("shares only the chosen evidence with the homeowner", () => {
    const { state, item } = approved()
    const [first] = item.evidenceIds
    const published = run(state, manager, commands.publishDailyProgress(item.id, [first])).state
    const after = find(published, item.id)
    expect(after.publicationStatus).toBe("published")
    expect(after.publication).toEqual({
      publishedByMembershipId: "membership-manager-1",
      publishedAt: "2026-09-27T09:30:00.000Z",
      evidenceIds: [first],
    })
    expect(published.evidence.filter((e) => e.dailyProgressId === item.id).map((e) => e.customerVisibility))
      .toEqual(["customer-visible", "review-required", "private"])
    expect(getPublishedForCustomer(published, "project-sharma").some((p) => p.id === item.id)).toBe(true)
  })

  it("does not change project progress", () => {
    const { state, item } = approved()
    const published = run(state, manager, commands.publishDailyProgress(item.id, [])).state
    expect(published.projects).toBe(state.projects)
  })

  it("refuses voice notes", () => {
    const { state, item } = approved()
    const audio = state.evidence.find((e) => e.dailyProgressId === item.id && e.type === "audio")!
    expect(() => run(state, manager, commands.publishDailyProgress(item.id, [audio.id])))
      .toThrow("Voice notes can't be shared with the homeowner.")
  })

  it("refuses evidence from another update", () => {
    const { state, item } = approved()
    expect(() => run(state, manager, commands.publishDailyProgress(item.id, ["evidence-sharma-1"]))).toThrow()
  })

  it("only publishes approved updates", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, manager, commands.publishDailyProgress(submitted.result.id, [])))
      .toThrow("Only approved updates can be published.")
  })

  it("needs the publish permission", () => {
    const { state, item } = approved()
    expect(() => run(state, ravi, commands.publishDailyProgress(item.id, []))).toThrow(PermissionError)
  })

  it("publishing twice is a no-op", () => {
    const { state, item } = approved()
    const once = run(state, manager, commands.publishDailyProgress(item.id, []))
    const twice = run(once.state, manager, commands.publishDailyProgress(item.id, [item.evidenceIds[0]]))
    expect(twice.state).toBe(once.state)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/domain/progressReview.test.ts`
Expected: FAIL (`publishDailyProgress` is not a function).

- [ ] **Step 3: Command** — after `reviewDailyProgress`:

```ts
/**
 * Shares an approved update with the homeowner. Only the chosen evidence
 * becomes customer-visible; voice notes and review notes never do.
 */
export const publishDailyProgress =
  (progressId: EntityId, evidenceIds: EntityId[]): Command<void> =>
  (state, ctx) => {
    const progress = state.dailyProgress.find((item) => item.id === progressId)
    if (!progress) throw new PermissionError(Permissions.CUSTOMER_PUBLISH)
    const publisher = authorizeProject(
      state,
      ctx,
      progress.projectId,
      [Permissions.CUSTOMER_PUBLISH],
      progress,
    )
    if (progress.publicationStatus === "published") return { state, result: undefined }
    if (progress.reviewStatus !== "approved") {
      throw new ConflictError("Only approved updates can be published.")
    }
    const chosen = [...new Set(evidenceIds)]
    for (const id of chosen) {
      const item = state.evidence.find((evidence) => evidence.id === id)
      if (!item || !progress.evidenceIds.includes(id)) {
        throw new IntegrityError(`Evidence ${id} is not on update ${progressId}`)
      }
      if (item.type === "audio") {
        throw new ConflictError("Voice notes can't be shared with the homeowner.")
      }
    }

    const publication: ProgressPublication = {
      publishedByMembershipId: publisher.id,
      publishedAt: iso(ctx),
      evidenceIds: chosen,
    }
    return {
      state: {
        ...state,
        dailyProgress: state.dailyProgress.map((item) =>
          item.id === progressId
            ? { ...item, publicationStatus: "published" as const, publication }
            : item,
        ),
        evidence: state.evidence.map((item) =>
          chosen.includes(item.id)
            ? { ...item, customerVisibility: "customer-visible" as const }
            : item,
        ),
      },
      result: undefined,
    }
  }
```

Add `ProgressPublication` to the models type import.

- [ ] **Step 4: Provider** — type `publishDailyProgress: (progressId: EntityId, evidenceIds: EntityId[]) => void`; wiring `publishDailyProgress: (id, evidenceIds) => run(commands.publishDailyProgress(id, evidenceIds)),`.

- [ ] **Step 5: Run**

Run: `pnpm run typecheck && pnpm run test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: publish an approved update with chosen evidence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Set stage baselines

**Files:**
- Modify: `src/domain/constructionCommands.ts` (add `setStageBaselines` after `createProject`)
- Modify: `src/mock/ConstructionDataProvider.tsx`
- Test: `src/domain/progressReview.test.ts` (append)

**Interfaces:**
- Produces:
  ```ts
  export const setStageBaselines: (projectId: EntityId, baselines: Record<EntityId, number>) => Command<Project>
  // provider: setStageBaselines(projectId, baselines) => Project
  ```

- [ ] **Step 1: Failing tests** — append:

```ts
describe("setStageBaselines", () => {
  it("stores baselines and recalculates progress", () => {
    const { state, result } = run(seed, manager, commands.setStageBaselines("project-lakeside", { "stage-site-prep": 100, "stage-foundation": 50 }))
    expect(result.stageBaselines).toEqual({ "stage-site-prep": 100, "stage-foundation": 50 })
    expect(state.projects.find((p) => p.id === "project-lakeside")!.progress).toBe(11) // 5 + 6
  })

  it("rejects values outside 0–100 and unknown stages", () => {
    expect(() => run(seed, manager, commands.setStageBaselines("project-lakeside", { "stage-site-prep": 120 })))
      .toThrow("Stage baselines must be between 0 and 100.")
    expect(() => run(seed, manager, commands.setStageBaselines("project-lakeside", { "stage-nope": 10 }))).toThrow()
  })

  it("needs project management rights", () => {
    expect(() => run(seed, ravi, commands.setStageBaselines("project-sharma", {}))).toThrow(PermissionError)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/domain/progressReview.test.ts` → FAIL.

- [ ] **Step 3: Command**

```ts
/** Records how complete each stage was when tracking started, and refreshes project %. */
export const setStageBaselines =
  (projectId: EntityId, baselines: Record<EntityId, number>): Command<Project> =>
  (state, ctx) => {
    authorizeProject(state, ctx, projectId, [Permissions.PROJECT_MANAGE])
    const project = projectOrThrow(state, projectId)
    for (const [stageId, value] of Object.entries(baselines)) {
      if (!state.stages.some((stage) => stage.id === stageId)) {
        throw new IntegrityError(`Unknown stage ${stageId}`)
      }
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new ConflictError("Stage baselines must be between 0 and 100.")
      }
    }
    const withBaselines: Project = { ...project, stageBaselines: { ...baselines } }
    const updated: Project = {
      ...withBaselines,
      progress: calculateProjectProgress(withBaselines, state.stages, state.tasks),
      updatedAt: iso(ctx),
    }
    return {
      state: {
        ...state,
        projects: state.projects.map((item) => (item.id === projectId ? updated : item)),
      },
      result: updated,
    }
  }
```

- [ ] **Step 4: Provider** — type `setStageBaselines: (projectId: EntityId, baselines: Record<EntityId, number>) => Project`; wiring `setStageBaselines: (id, baselines) => run(commands.setStageBaselines(id, baselines)),`.

- [ ] **Step 5: Run** — `pnpm run typecheck && pnpm run test` → all PASS.

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: set stage baselines for projects already under way

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Selectors and labels

**Files:**
- Modify: `src/mock/selectors.ts` (after `getCustomerVisibleEvidence`)
- Create: `src/components/progress/progressLabels.ts`
- Test: `src/mock/progressSelectors.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  export function getReadyToPublish(state, projectId?: EntityId): DailyProgress[]
  export function getProgressHistory(state, projectId?: EntityId): DailyProgress[]
  export function getVersionChain(state, progress: DailyProgress): DailyProgress[] // oldest → newest, includes `progress`
  export function getChangesRequested(state, membershipIds: ReadonlySet<EntityId>, taskId?: EntityId): DailyProgress[]
  export function getPublishedEvidence(state, progress: DailyProgress): Evidence[]
  export function getMyMembershipIds(state, personId: EntityId | undefined): Set<EntityId>
  // progressLabels.ts
  export const reviewStatusLabel: Record<ReviewStatus, { text: string; color: string }>
  export const visibilityLabel: Record<Evidence["customerVisibility"], { text: string; color: string }>
  ```

- [ ] **Step 1: Failing tests** — `src/mock/progressSelectors.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { DailyProgress } from "../domain/models"
import { seedConstructionData as seed } from "./seed"
import {
  getChangesRequested,
  getMyMembershipIds,
  getProgressHistory,
  getPublishedEvidence,
  getReadyToPublish,
  getVersionChain,
} from "./selectors"

const sharma = seed.dailyProgress.find((p) => p.id === "progress-sharma-2009")!

describe("progress selectors", () => {
  it("lists approved, unpublished updates as ready to publish", () => {
    expect(getReadyToPublish(seed).map((p) => p.id)).toEqual(["progress-reddy-1809"])
    expect(getReadyToPublish(seed, "project-sharma")).toEqual([])
  })

  it("history leaves out drafts and is newest first", () => {
    const ids = getProgressHistory(seed).map((p) => p.id)
    expect(ids).toEqual(["progress-sharma-2009", "progress-tech-1909", "progress-reddy-1809"])
  })

  it("walks the version chain oldest first", () => {
    const v1: DailyProgress = { ...sharma, id: "v1", reviewStatus: "superseded", supersededById: "v2" }
    const v2: DailyProgress = { ...sharma, id: "v2", version: 2, supersedesId: "v1" }
    const state = { ...seed, dailyProgress: [v2, v1] }
    expect(getVersionChain(state, v2).map((p) => p.id)).toEqual(["v1", "v2"])
  })

  it("finds updates sent back to a submitter", () => {
    const back: DailyProgress = { ...sharma, id: "back", reviewStatus: "changes-requested" }
    const state = { ...seed, dailyProgress: [back, ...seed.dailyProgress] }
    const mine = getMyMembershipIds(state, "person-arjun")
    expect(getChangesRequested(state, mine).map((p) => p.id)).toEqual(["back"])
    expect(getChangesRequested(state, mine, "task-99")).toEqual([])
    expect(getChangesRequested(state, getMyMembershipIds(state, "person-ravi"))).toEqual([])
  })

  it("returns only evidence named in the publication", () => {
    expect(getPublishedEvidence(seed, sharma).map((e) => e.id)).toEqual(["evidence-sharma-1", "evidence-sharma-2"])
    const reddy = seed.dailyProgress.find((p) => p.id === "progress-reddy-1809")!
    expect(getPublishedEvidence(seed, reddy)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/mock/progressSelectors.test.ts` → FAIL.

- [ ] **Step 3: Selectors** — append to `src/mock/selectors.ts` after `getCustomerVisibleEvidence`:

```ts
const newestFirst = (left: DailyProgress, right: DailyProgress) =>
  right.submittedAt.localeCompare(left.submittedAt)

/** Approved updates not yet shared with the homeowner. */
export function getReadyToPublish(state: ConstructionDataState, projectId?: EntityId) {
  return state.dailyProgress
    .filter(
      (progress) =>
        (!projectId || progress.projectId === projectId) &&
        progress.reviewStatus === "approved" &&
        progress.publicationStatus === "private",
    )
    .sort(newestFirst)
}

/** Every submitted update (all review states), newest first. */
export function getProgressHistory(state: ConstructionDataState, projectId?: EntityId) {
  return state.dailyProgress
    .filter(
      (progress) =>
        (!projectId || progress.projectId === projectId) &&
        progress.reviewStatus !== "draft",
    )
    .sort(newestFirst)
}

/** All versions of an update, oldest first, including `progress` itself. */
export function getVersionChain(state: ConstructionDataState, progress: DailyProgress) {
  const byId = new Map(state.dailyProgress.map((item) => [item.id, item]))
  let first = progress
  while (first.supersedesId && byId.has(first.supersedesId)) {
    first = byId.get(first.supersedesId)!
  }
  const chain = [first]
  let current = first
  while (current.supersededById && byId.has(current.supersededById)) {
    current = byId.get(current.supersededById)!
    chain.push(current)
  }
  return chain
}

/** Updates sent back to these memberships (optionally for one task), newest first. */
export function getChangesRequested(
  state: ConstructionDataState,
  membershipIds: ReadonlySet<EntityId>,
  taskId?: EntityId,
) {
  return state.dailyProgress
    .filter(
      (progress) =>
        progress.reviewStatus === "changes-requested" &&
        membershipIds.has(progress.submittedByMembershipId) &&
        (!taskId || progress.taskId === taskId),
    )
    .sort(newestFirst)
}

/** Evidence the reviewer chose to share when publishing; nothing else. */
export function getPublishedEvidence(state: ConstructionDataState, progress: DailyProgress) {
  const chosen = new Set(progress.publication?.evidenceIds ?? [])
  return state.evidence.filter(
    (item) => chosen.has(item.id) && item.customerVisibility === "customer-visible",
  )
}

/** Membership ids held by a signed-in person. */
export function getMyMembershipIds(state: ConstructionDataState, personId: EntityId | undefined) {
  return new Set(
    state.memberships
      .filter((item) => item.principalType === "person" && item.principalId === personId)
      .map((item) => item.id),
  )
}
```

- [ ] **Step 4: Labels** — create `src/components/progress/progressLabels.ts`:

```ts
import type { Evidence, ReviewStatus } from "../../domain/models"

/** Company-side review status wording. */
export const reviewStatusLabel: Record<ReviewStatus, { text: string; color: string }> = {
  draft: { text: "Draft", color: "default" },
  submitted: { text: "Waiting for review", color: "warning" },
  approved: { text: "Approved", color: "success" },
  "changes-requested": { text: "Changes requested", color: "orange" },
  rejected: { text: "Rejected", color: "error" },
  superseded: { text: "Superseded", color: "default" },
}

/** Who can see a piece of evidence. */
export const visibilityLabel: Record<Evidence["customerVisibility"], { text: string; color: string }> = {
  private: { text: "Internal only", color: "default" },
  "review-required": { text: "Not shared", color: "warning" },
  "customer-visible": { text: "Shared with homeowner", color: "success" },
}
```

- [ ] **Step 5: Run** — `pnpm run typecheck && pnpm run test` → all PASS.

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: progress selectors for publishing, history, versions and send-backs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Evidence viewer and evidence grid

**Files:**
- Create: `src/components/progress/EvidenceViewer.tsx`
- Create: `src/components/progress/EvidenceGrid.tsx`
- Modify: `src/index.css` (append viewer styles)

**Interfaces:**
- Consumes: `visibilityLabel`, `reviewStatusLabel` (Task 7); `EvidenceThumb` (existing)
- Produces:
  ```tsx
  export type EvidenceAudience = "company" | "homeowner"
  // EvidenceViewer default export: { items: Evidence[]; index: number | null; audience: EvidenceAudience; onChange: (index: number | null) => void }
  // EvidenceGrid default export: { items: Evidence[]; audience?: EvidenceAudience; empty?: string }
  ```

- [ ] **Step 1: Create `src/components/progress/EvidenceViewer.tsx`**

```tsx
import { FileOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons"
import { Button, Descriptions, Flex, Modal, Tag, Typography } from "antd"
import type { Evidence } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getMembershipName, getProject, getProjectUnits } from "../../mock/selectors"
import { reviewStatusLabel, visibilityLabel } from "./progressLabels"

const { Text } = Typography

export type EvidenceAudience = "company" | "homeowner"

function Media({ item }: { item: Evidence }) {
  if (item.type === "photo") {
    return <img src={item.url} alt={item.caption || "Site photo"} className="evidence-viewer-media" />
  }
  if (item.type === "video") {
    return <video src={item.url} controls playsInline className="evidence-viewer-media" />
  }
  if (item.type === "audio") {
    return (
      <Flex align="center" justify="center" className="evidence-viewer-media">
        <audio src={item.url} controls className="w-full" />
      </Flex>
    )
  }
  return (
    <Flex vertical align="center" justify="center" gap="small" className="evidence-viewer-media">
      <FileOutlined style={{ fontSize: 40 }} />
      <a href={item.url} target="_blank" rel="noreferrer">Open document</a>
    </Flex>
  )
}

/**
 * Full-size look at one piece of evidence, with who captured it and who can
 * see it. The homeowner audience gets only date, location and task.
 */
export default function EvidenceViewer({
  items,
  index,
  audience,
  onChange,
}: {
  items: Evidence[]
  index: number | null
  audience: EvidenceAudience
  onChange: (index: number | null) => void
}) {
  const { state } = useConstructionData()
  const item = index === null ? undefined : items[index]
  if (!item) return null

  const unit = getProjectUnits(state, item.projectId).find((u) => u.id === item.projectUnitId)
  const task = state.tasks.find((t) => t.id === item.taskId)
  const progress = state.dailyProgress.find((p) => p.id === item.dailyProgressId)
  const worker = state.workers.find((w) => w.id === item.capturedByWorkerId)
  const capturedBy =
    worker?.name ??
    (item.capturedByMembershipId ? getMembershipName(state, item.capturedByMembershipId) : undefined) ??
    "—"
  const where = [getProject(state, item.projectId)?.name, unit?.name].filter(Boolean).join(" · ")
  const when = new Date(item.capturedAt).toLocaleString("en-IN")

  const details =
    audience === "homeowner"
      ? [
          { key: "when", label: "Date", children: when },
          { key: "where", label: "Location", children: where },
          { key: "task", label: "Work", children: task?.title ?? "—" },
        ]
      : [
          { key: "by", label: "Captured by", children: capturedBy },
          { key: "when", label: "Captured at", children: when },
          { key: "where", label: "Project / unit", children: where },
          { key: "task", label: "Task", children: task?.title ?? "—" },
          {
            key: "visibility",
            label: "Homeowner",
            children: (
              <Tag color={visibilityLabel[item.customerVisibility].color} className="m-0!">
                {visibilityLabel[item.customerVisibility].text}
              </Tag>
            ),
          },
          ...(progress
            ? [{
                key: "review",
                label: "Review",
                children: (
                  <Tag color={reviewStatusLabel[progress.reviewStatus].color} className="m-0!">
                    {reviewStatusLabel[progress.reviewStatus].text}
                  </Tag>
                ),
              }]
            : []),
        ]

  const at = index ?? 0
  return (
    <Modal
      open
      width={960}
      footer={null}
      title={item.caption || item.type}
      onCancel={() => onChange(null)}
      destroyOnHidden
    >
      <Flex gap="large" wrap className="evidence-viewer">
        <Flex vertical gap="small" className="evidence-viewer-stage">
          <Media item={item} />
          {items.length > 1 && (
            <Flex align="center" justify="space-between">
              <Button icon={<LeftOutlined />} disabled={at === 0} onClick={() => onChange(at - 1)} aria-label="Previous" />
              <Text type="secondary">{at + 1} of {items.length}</Text>
              <Button icon={<RightOutlined />} disabled={at === items.length - 1} onClick={() => onChange(at + 1)} aria-label="Next" />
            </Flex>
          )}
        </Flex>
        <Descriptions column={1} size="small" items={details} className="evidence-viewer-details" />
      </Flex>
    </Modal>
  )
}
```

- [ ] **Step 2: Create `src/components/progress/EvidenceGrid.tsx`**

```tsx
import { useState } from "react"
import { Col, Row, Typography } from "antd"
import type { Evidence } from "../../domain/models"
import EvidenceThumb from "../EvidenceThumb"
import EvidenceViewer, { type EvidenceAudience } from "./EvidenceViewer"

const { Text } = Typography

/** Thumbnails that open the evidence viewer. */
export default function EvidenceGrid({
  items,
  audience = "company",
  empty = "No evidence was attached.",
}: {
  items: Evidence[]
  audience?: EvidenceAudience
  empty?: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  if (!items.length) return <Text type="secondary">{empty}</Text>
  return (
    <>
      <Row gutter={[16, 16]}>
        {items.map((item, index) => (
          <Col key={item.id} xs={12} sm={8}>
            <button
              type="button"
              className="evidence-grid-item"
              onClick={() => setOpen(index)}
              aria-label={`Open ${item.caption || item.type}`}
            >
              <EvidenceThumb evidence={item} />
            </button>
          </Col>
        ))}
      </Row>
      <EvidenceViewer items={items} index={open} audience={audience} onChange={setOpen} />
    </>
  )
}
```

- [ ] **Step 3: Styles** — append to `src/index.css`:

```css
/* Evidence viewer: media on the left, details on the right (stacked on phones). */
.evidence-viewer-stage {
  flex: 1 1 520px;
  min-width: 0;
}

.evidence-viewer-media {
  width: 100%;
  max-height: 70vh;
  min-height: 240px;
  object-fit: contain;
  border-radius: var(--ant-border-radius-lg);
  background: var(--ant-color-fill-quaternary);
}

.evidence-viewer-details {
  flex: 1 1 240px;
}

.evidence-grid-item {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: zoom-in;
}
```

- [ ] **Step 4: Verify** — `pnpm run typecheck && pnpm run build` → clean. (Rendered in Task 9.)

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: shared evidence viewer and clickable evidence grid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Progress page — review, ready to publish, history

**Files:**
- Create: `src/components/progress/ProgressDetail.tsx`
- Create: `src/components/progress/ReviewDecisionModal.tsx`
- Create: `src/components/progress/PublishPanel.tsx`
- Modify: `src/screens/DailyProgressReviewScreen.tsx` (rewrite)

**Interfaces:**
- Consumes: selectors (Task 7), `EvidenceGrid` (Task 8), provider `reviewDailyProgress(id, decision, note?)`, `publishDailyProgress(id, evidenceIds)`
- Produces:
  ```tsx
  // ProgressDetail: { progress: DailyProgress }
  // ReviewDecisionModal: { decision: ReviewDecision | null; onCancel: () => void; onConfirm: (note?: string) => void }
  // PublishPanel: { progress: DailyProgress }
  ```

- [ ] **Step 1: `src/components/progress/ProgressDetail.tsx`**

```tsx
import { Alert, Descriptions, Flex, Tag, Timeline, Typography } from "antd"
import type { DailyProgress } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import {
  getEvidenceForProgress,
  getMembershipName,
  getProject,
  getVersionChain,
  getWorkTypeName,
} from "../../mock/selectors"
import EvidenceGrid from "./EvidenceGrid"
import { reviewStatusLabel } from "./progressLabels"

const { Paragraph, Text } = Typography

/** One update: what was done, the evidence, and every earlier version with its review. */
export default function ProgressDetail({ progress }: { progress: DailyProgress }) {
  const { state } = useConstructionData()
  const project = getProject(state, progress.projectId)
  const evidence = getEvidenceForProgress(state, progress)
  const chain = getVersionChain(state, progress)
  const earlier = chain.filter((item) => item.id !== progress.id)
  const who = (membershipId?: string) =>
    (membershipId && getMembershipName(state, membershipId)) || "—"

  return (
    <Flex vertical gap="large">
      <Flex align="center" gap="small" wrap>
        <Tag color={reviewStatusLabel[progress.reviewStatus].color} className="m-0!">
          {reviewStatusLabel[progress.reviewStatus].text}
        </Tag>
        {progress.version > 1 && <Tag className="m-0!">Version {progress.version}</Tag>}
        {progress.publicationStatus === "published" && (
          <Tag color="success" className="m-0!">Published</Tag>
        )}
      </Flex>

      <Descriptions
        column={{ xs: 1, sm: 2 }}
        items={[
          { key: "work", label: "Work", children: getWorkTypeName(state, progress.workTypeId) },
          { key: "by", label: "Submitted by", children: who(progress.submittedByMembershipId) },
          { key: "date", label: "Date", children: progress.date },
          { key: "workers", label: "Workers", children: progress.workersPresent },
          ...(progress.completedQuantity
            ? [{
                key: "quantity",
                label: "Done today",
                children: `${progress.completedQuantity.value} ${progress.completedQuantity.unit}${
                  progress.plannedQuantity ? ` of ${progress.plannedQuantity.value} ${progress.plannedQuantity.unit} planned` : ""
                }`,
              }]
            : []),
          ...(typeof progress.progressAfter === "number"
            ? [{ key: "estimate", label: "Submitter's estimate", children: `${progress.progressAfter}%` }]
            : []),
          { key: "official", label: "Project progress (calculated)", children: `${project?.progress ?? 0}%` },
        ]}
      />

      <Flex vertical gap="small">
        <Text strong>Yesterday</Text>
        <Paragraph className="m-0!">{progress.yesterdaySummary || "No previous-day note was included."}</Paragraph>
        <Text strong>Today</Text>
        <Paragraph className="m-0!">{progress.todaySummary}</Paragraph>
        <Text strong>Tomorrow</Text>
        <Paragraph className="m-0!">{progress.tomorrowPlan}</Paragraph>
        {progress.blockerSummary && <Alert type="warning" showIcon message={progress.blockerSummary} />}
      </Flex>

      {progress.review?.note && (
        <Alert
          type={progress.review.decision === "approve" ? "success" : "warning"}
          showIcon
          message={`Review note from ${who(progress.review.reviewedByMembershipId)}`}
          description={progress.review.note}
        />
      )}

      <Flex vertical gap="small">
        <Text strong>Evidence</Text>
        <EvidenceGrid items={evidence} />
      </Flex>

      {earlier.length > 0 && (
        <Flex vertical gap="small">
          <Text strong>Earlier versions</Text>
          <Timeline
            items={earlier.map((item) => ({
              key: item.id,
              content: (
                <Flex vertical gap={2}>
                  <Text>
                    Version {item.version} · {item.date} · {reviewStatusLabel[item.reviewStatus].text}
                  </Text>
                  {item.review?.note && (
                    <Text type="secondary">
                      {who(item.review.reviewedByMembershipId)}: “{item.review.note}”
                    </Text>
                  )}
                </Flex>
              ),
            }))}
          />
        </Flex>
      )}
    </Flex>
  )
}
```

- [ ] **Step 2: `src/components/progress/ReviewDecisionModal.tsx`**

```tsx
import { useEffect, useState } from "react"
import { Input, Modal, Typography } from "antd"
import type { ReviewDecision } from "../../domain/models"

const { Text } = Typography

const COPY: Record<ReviewDecision, { title: string; ok: string; hint: string; required: boolean }> = {
  approve: { title: "Approve update", ok: "Approve", hint: "Optional note for the submitter.", required: false },
  "request-changes": { title: "Request changes", ok: "Send back", hint: "Tell the submitter what to fix. They will see this note.", required: true },
  reject: { title: "Reject update", ok: "Reject", hint: "Say why this update doesn't belong in the record. It stays private.", required: true },
}

export default function ReviewDecisionModal({
  decision,
  onCancel,
  onConfirm,
}: {
  decision: ReviewDecision | null
  onCancel: () => void
  onConfirm: (note?: string) => void
}) {
  const [note, setNote] = useState("")
  useEffect(() => setNote(""), [decision])
  if (!decision) return null
  const copy = COPY[decision]
  const blocked = copy.required && !note.trim()
  return (
    <Modal
      open
      title={copy.title}
      okText={copy.ok}
      okButtonProps={{ disabled: blocked, danger: decision === "reject" }}
      onCancel={onCancel}
      onOk={() => onConfirm(note.trim() || undefined)}
    >
      <Text type="secondary">{copy.hint}</Text>
      <Input.TextArea
        rows={4}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="mt-2!"
        aria-label="Review note"
      />
    </Modal>
  )
}
```

- [ ] **Step 3: `src/components/progress/PublishPanel.tsx`**

```tsx
import { useState } from "react"
import { LockOutlined } from "@ant-design/icons"
import { Button, Card, Checkbox, Col, Flex, Modal, Row, Tag, Typography } from "antd"
import type { DailyProgress } from "../../domain/models"
import { Permissions } from "../../domain/permissions"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getEvidenceForProgress, getMembershipName, getProject, getWorkTypeName } from "../../mock/selectors"
import { useAccess } from "../../session/useCan"
import { useCommand } from "../../session/useCommand"
import EvidenceThumb from "../EvidenceThumb"
import Gated from "../Gated"

const { Paragraph, Text } = Typography

/** Pick which photos, videos and documents the homeowner sees, preview, then publish. */
export default function PublishPanel({ progress }: { progress: DailyProgress }) {
  const { state, publishDailyProgress } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const evidence = getEvidenceForProgress(state, progress)
  const shareable = evidence.filter((item) => item.type !== "audio")
  const voice = evidence.filter((item) => item.type === "audio")
  const [chosen, setChosen] = useState<string[]>(shareable.map((item) => item.id))
  const [previewing, setPreviewing] = useState(false)
  const project = getProject(state, progress.projectId)
  const reviewer = progress.review ? getMembershipName(state, progress.review.reviewedByMembershipId) : undefined

  const publish = () => {
    const outcome = run(() => publishDailyProgress(progress.id, chosen), { success: "Shared with the homeowner" })
    if (outcome.ok) setPreviewing(false)
  }

  return (
    <Card
      title={`${project?.name ?? "Project"} · ${getWorkTypeName(state, progress.workTypeId)}`}
      extra={<Text type="secondary">{progress.date}{reviewer ? ` · approved by ${reviewer}` : ""}</Text>}
    >
      <Flex vertical gap="middle">
        <Paragraph className="m-0!">{progress.todaySummary}</Paragraph>
        {shareable.length ? (
          <Checkbox.Group value={chosen} onChange={(values) => setChosen(values as string[])} className="w-full">
            <Row gutter={[16, 16]} className="w-full">
              {shareable.map((item) => (
                <Col key={item.id} xs={12} sm={8} lg={6}>
                  <Flex vertical gap={6}>
                    <EvidenceThumb evidence={item} />
                    <Checkbox value={item.id}>Share</Checkbox>
                  </Flex>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        ) : (
          <Text type="secondary">No photos, video or documents to share. The written update can still be published.</Text>
        )}
        {voice.length > 0 && (
          <Tag icon={<LockOutlined />} className="self-start">
            {voice.length} voice note{voice.length === 1 ? "" : "s"} · internal only
          </Tag>
        )}
        <Flex justify="flex-end">
          <Gated allowed={can(Permissions.CUSTOMER_PUBLISH, progress.projectId, progress)}>
            <Button type="primary" onClick={() => setPreviewing(true)}>
              Publish to homeowner
            </Button>
          </Gated>
        </Flex>
      </Flex>

      <Modal
        open={previewing}
        title="The homeowner will see"
        okText="Publish"
        onOk={publish}
        onCancel={() => setPreviewing(false)}
      >
        <Flex vertical gap="middle">
          <Paragraph className="m-0!"><Text strong>Today: </Text>{progress.todaySummary}</Paragraph>
          <Paragraph className="m-0!"><Text strong>Tomorrow: </Text>{progress.tomorrowPlan}</Paragraph>
          <Row gutter={[12, 12]}>
            {shareable.filter((item) => chosen.includes(item.id)).map((item) => (
              <Col key={item.id} span={8}><EvidenceThumb evidence={item} /></Col>
            ))}
          </Row>
          <Text type="secondary">Voice notes and review notes stay internal.</Text>
        </Flex>
      </Modal>
    </Card>
  )
}
```

- [ ] **Step 4: Rewrite `src/screens/DailyProgressReviewScreen.tsx`**

```tsx
import { useState } from "react"
import { Button, Card, Col, Drawer, Empty, Flex, Row, Table, Tabs, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import Gated from "../components/Gated"
import ProgressDetail from "../components/progress/ProgressDetail"
import PublishPanel from "../components/progress/PublishPanel"
import ReviewDecisionModal from "../components/progress/ReviewDecisionModal"
import { reviewStatusLabel } from "../components/progress/progressLabels"
import type { DailyProgress, EntityId, ReviewDecision } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { Permissions } from "../domain/permissions"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getMembershipName,
  getPendingReview,
  getProgressHistory,
  getProject,
  getReadyToPublish,
  getWorkTypeName,
} from "../mock/selectors"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"

const { Text } = Typography

const SUCCESS: Record<ReviewDecision, string> = {
  approve: "Approved — ready to publish",
  "request-changes": "Sent back to the submitter",
  reject: "Update rejected",
}

function ReviewTab({ items }: { items: DailyProgress[] }) {
  const { state, reviewDailyProgress } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const [selectedId, setSelectedId] = useState<EntityId>()
  const [decision, setDecision] = useState<ReviewDecision | null>(null)
  const selected = items.find((item) => item.id === selectedId) ?? items[0]

  if (!items.length) return <Card><Empty description="No updates are waiting for review." /></Card>

  const canReview = can(Permissions.PROGRESS_REVIEW, selected.projectId, selected)
  const confirm = (note?: string) => {
    if (!decision) return
    const outcome = run(() => reviewDailyProgress(selected.id, decision, note), { success: SUCCESS[decision] })
    if (outcome.ok) {
      setDecision(null)
      setSelectedId(undefined)
    }
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Flex vertical gap="small">
          {items.map((item) => {
            const active = item.id === selected.id
            return (
              <Button
                key={item.id}
                block
                type={active ? "primary" : "default"}
                className="h-auto! py-3! text-left! whitespace-normal!"
                onClick={() => setSelectedId(item.id)}
              >
                <Flex vertical align="flex-start" gap={2}>
                  <Text strong className={active ? "text-inherit!" : undefined}>
                    {getProject(state, item.projectId)?.name ?? "Project"}
                    {item.version > 1 ? ` · v${item.version}` : ""}
                  </Text>
                  <Text className={active ? "text-inherit!" : undefined} type={active ? undefined : "secondary"}>
                    {item.date} · {getWorkTypeName(state, item.workTypeId)}
                    {getMembershipName(state, item.submittedByMembershipId) ? ` · ${getMembershipName(state, item.submittedByMembershipId)}` : ""}
                  </Text>
                </Flex>
              </Button>
            )
          })}
        </Flex>
      </Col>
      <Col xs={24} lg={15}>
        <Card>
          <Flex vertical gap="large">
            <ProgressDetail progress={selected} />
            <Flex gap="small" wrap>
              <Gated allowed={canReview}>
                <Button type="primary" onClick={() => setDecision("approve")}>Approve</Button>
              </Gated>
              <Gated allowed={canReview}>
                <Button onClick={() => setDecision("request-changes")}>Request changes</Button>
              </Gated>
              <Gated allowed={canReview}>
                <Button danger onClick={() => setDecision("reject")}>Reject</Button>
              </Gated>
            </Flex>
          </Flex>
        </Card>
      </Col>
      <ReviewDecisionModal decision={decision} onCancel={() => setDecision(null)} onConfirm={confirm} />
    </Row>
  )
}

function PublishTab({ items }: { items: DailyProgress[] }) {
  if (!items.length) return <Card><Empty description="Nothing is waiting to be published." /></Card>
  return (
    <Flex vertical gap="middle">
      {items.map((item) => <PublishPanel key={item.id} progress={item} />)}
    </Flex>
  )
}

function HistoryTab({ items }: { items: DailyProgress[] }) {
  const { state } = useConstructionData()
  const [openId, setOpenId] = useState<EntityId>()
  const open = items.find((item) => item.id === openId)
  return (
    <Card classNames={{ body: "company-table-card-body" }}>
      <Table<DailyProgress>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 760 }}
        onRow={(record) => ({ onClick: () => setOpenId(record.id), className: "cursor-pointer" })}
        columns={[
          { title: "Date", dataIndex: "date" },
          { title: "Project", render: (_, record) => getProject(state, record.projectId)?.name },
          { title: "Work", render: (_, record) => getWorkTypeName(state, record.workTypeId) },
          { title: "Submitted by", render: (_, record) => getMembershipName(state, record.submittedByMembershipId) ?? "—" },
          { title: "Version", render: (_, record) => `v${record.version}` },
          {
            title: "Review",
            render: (_, record) => (
              <Tag color={reviewStatusLabel[record.reviewStatus].color}>{reviewStatusLabel[record.reviewStatus].text}</Tag>
            ),
          },
          {
            title: "Homeowner",
            render: (_, record) =>
              record.publication ? (
                <Tag color="success">Published · {record.publication.evidenceIds.length} items</Tag>
              ) : (
                <Text type="secondary">Not published</Text>
              ),
          },
        ]}
      />
      <Drawer open={Boolean(open)} size={640} title="Daily update" onClose={() => setOpenId(undefined)}>
        {open && <ProgressDetail progress={open} />}
      </Drawer>
    </Card>
  )
}

function ProgressPage({ onNavigate, projectId }: { onNavigate: Navigate; projectId?: EntityId }) {
  const { state } = useConstructionData()
  const can = useAccess()
  // Item-level: a scoped reviewer only sees items inside their scope.
  const visible = (item: DailyProgress) => can(Permissions.PROGRESS_REVIEW, item.projectId, item)
  const pending = getPendingReview(state, projectId).filter(visible)
  const ready = getReadyToPublish(state, projectId).filter(visible)
  const history = getProgressHistory(state, projectId).filter(visible)
  const homeownerProjectId = projectId ?? pending[0]?.projectId ?? ready[0]?.projectId

  return (
    <CompanyLayout
      nav={projectId ? { menu: "project", projectId, active: "progress" } : { menu: "company", active: "progress" }}
      onNavigate={onNavigate}
      description="Review site updates, then choose what the homeowner sees"
      actions={
        <Button
          disabled={!homeownerProjectId}
          onClick={() => homeownerProjectId && onNavigate("customer-daily-update", { project_id: homeownerProjectId })}
        >
          Homeowner view
        </Button>
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Tabs
          items={[
            { key: "review", label: `Waiting for review (${pending.length})`, children: <ReviewTab items={pending} /> },
            { key: "publish", label: `Ready to publish (${ready.length})`, children: <PublishTab items={ready} /> },
            { key: "history", label: "History", children: <HistoryTab items={history} /> },
          ]}
        />
      </Flex>
    </CompanyLayout>
  )
}

export default function DailyProgressReviewScreen({ onNavigate, projectId }: { onNavigate: Navigate; projectId?: EntityId }) {
  return (
    <CompanyThemeProvider>
      <ProgressPage onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
```

- [ ] **Step 5: Verify** — `pnpm run typecheck && pnpm run test && pnpm run build` → clean. Then in the browser (1440px): sign in via `#onboarding-business` → Create workspace → `#daily-progress-review?project_id=project-tech-park`. Check: Tech Park update listed; Request changes with an empty note keeps the button disabled; with a note → toast "Sent back to the submitter", item leaves the tab. On `project-reddy`, **Ready to publish** shows the waterproofing update with its photo ticked; Publish → preview → Publish → it moves to History tagged "Published · 1 items". Click a thumbnail in History's drawer → viewer opens with details.

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: progress page with review, ready-to-publish and history tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Worker — changes requested and resubmit

**Files:**
- Modify: `src/screens/WorkerTodayScreen.tsx` (`Today`)
- Modify: `src/screens/WorkerSubmitScreen.tsx` (`SubmitWork`)
- Modify: `src/screens/WorkerTaskScreen.tsx` (history list uses `reviewLabel` — already updated in Task 1; add the review note)

**Interfaces:**
- Consumes: `getChangesRequested`, `getMyMembershipIds`, `getEvidenceForProgress` (Task 7); provider `resubmitDailyProgress` (Task 4)

- [ ] **Step 1: Worker Today section** — in `Today`, after `const day = workerDay(state, worker.id)` add:

```tsx
  const mine = getMyMembershipIds(state, session?.personId)
  const sentBack = getChangesRequested(state, mine)
```

(Add `const { session } = useSession()` at the top of `Today`, and import `useSession` from `../session/SessionProvider`, `getChangesRequested`, `getMyMembershipIds` from `../mock/selectors`.)

Render this block above the existing "New tasks" section:

```tsx
      {sentBack.length > 0 && (
        <Section title="Changes requested" count={sentBack.length}>
          {sentBack.map((item) => {
            const task = state.tasks.find((t) => t.id === item.taskId)
            if (!task) return null
            return (
              <Alert
                key={item.id}
                type="warning"
                showIcon
                message={task.title}
                description={item.review?.note}
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => onNavigate("worker-submit", { project_id: task.projectId, task_id: task.id })}
                  >
                    Fix and resend
                  </Button>
                }
              />
            )
          })}
        </Section>
      )}
```

- [ ] **Step 2: Resubmit mode in `SubmitWork`** — after `previous` is computed, add:

```tsx
  const sentBack = getChangesRequested(state, myMembershipIds, task.id)[0]
  const sentBackEvidence = sentBack ? getEvidenceForProgress(state, sentBack) : []
  const [keptIds, setKeptIds] = useState<string[]>(() => sentBack?.evidenceIds ?? [])
```

Hooks must run before the early returns: move the `useState` for `keptIds` next to the other `useState` calls at the top as `const [keptIds, setKeptIds] = useState<string[] | null>(null)` and resolve it after `sentBack` is known with `const kept = keptIds ?? sentBack?.evidenceIds ?? []`. Use `kept` below.

Evidence check in `handleSubmit`: count kept items too:

```tsx
    const keptDrafts = sentBackEvidence
      .filter((item) => kept.includes(item.id))
      .map(({ type, url, caption }) => ({ type, url, caption: caption ?? "" }))
    const missing = missingRequiredEvidence(required, [...keptDrafts, ...evidence])
```

Replace the `submitDailyProgress(...)` call with:

```tsx
    const fields = {
      workersPresent: values.workersPresent,
      completedQuantity: { value: values.completedQuantity, unit: unitOfMeasure },
      todaySummary: values.todaySummary.trim(),
      tomorrowPlan: values.tomorrowPlan.trim(),
      yesterdaySummary: previous?.todaySummary,
      blockerSummary: values.blockerSummary?.trim() || undefined,
      evidence: evidence.map(({ type, url, caption }) => ({ type, url, caption })),
    }
    const outcome = run(
      () =>
        sentBack
          ? resubmitDailyProgress(sentBack.id, { ...fields, keepEvidenceIds: kept })
          : submitDailyProgress({
              ...fields,
              projectId: task.projectId,
              projectUnitId: task.projectUnitId,
              taskId: task.id,
              stageId: task.stageId,
              tradeId: task.tradeId,
              workTypeId: task.workTypeId,
            }),
      { success: sentBack ? "Sent again to your supervisor" : "Sent to your supervisor for review" },
    )
```

(`previous` should skip superseded/sent-back records for "yesterday": change its filter to also require `item.reviewStatus !== "changes-requested" && item.reviewStatus !== "superseded"`.)

Form `initialValues` when sent back:

```tsx
        initialValues={
          sentBack
            ? {
                workersPresent: sentBack.workersPresent,
                completedQuantity: sentBack.completedQuantity?.value,
                todaySummary: sentBack.todaySummary,
                tomorrowPlan: sentBack.tomorrowPlan,
                blockerSummary: sentBack.blockerSummary,
              }
            : { workersPresent: 1 }
        }
```

Above the form, when `sentBack`:

```tsx
      {sentBack && (
        <Alert
          type="warning"
          showIcon
          message="Your supervisor asked for changes"
          description={sentBack.review?.note}
        />
      )}
```

Inside the evidence card, before `<EvidenceCapture …>`, when `sentBackEvidence.length`:

```tsx
            {sentBackEvidence.length > 0 && (
              <Flex vertical gap={6}>
                <Text type="secondary" className="text-[12px]!">From your last update — untick to leave out</Text>
                <Checkbox.Group
                  value={kept}
                  onChange={(values) => setKeptIds(values as string[])}
                  options={sentBackEvidence.map((item) => ({ value: item.id, label: item.caption || item.type }))}
                />
              </Flex>
            )}
```

Button label: `{sentBack ? "Send again" : "Send to supervisor"}`. Add `Checkbox` to the antd import; add `getChangesRequested`, `getEvidenceForProgress` to the selectors import; take `resubmitDailyProgress` from `useConstructionData()`. `myMembershipIds` already exists in this component.

- [ ] **Step 3: Worker task history note** — in `src/screens/WorkerTaskScreen.tsx`, in the progress list item that renders the `reviewLabel` tag (~line 326), add under it:

```tsx
                  {item.review?.note && item.reviewStatus !== "approved" && (
                    <Text type="secondary" className="text-[13px]!">“{item.review.note}”</Text>
                  )}
```

- [ ] **Step 4: Verify** — `pnpm run typecheck && pnpm run test && pnpm run build`. Browser: `#onboarding-worker` → Continue (Ravi) → task "Complete footing curing log" → Log progress → fill quantity 1, texts, add a photo via Gallery (any image) → Send. Sign in as company (`#onboarding-business`) → Progress (Sharma) → Request changes "Add the west side". Back to `#onboarding-worker` → Worker Today shows "Changes requested" with the note → Fix and resend → form pre-filled, previous photo ticked → Send again. Company Progress → the item shows "· v2", and its detail lists "Earlier versions: Version 1 · Superseded" with the note.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: workers see sent-back updates and resend them as a new version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Company — task history, resubmit, overview label

**Files:**
- Modify: `src/screens/TaskDetailScreen.tsx` (progress history card ~258-284)
- Modify: `src/screens/DailyProgressSubmitScreen.tsx` (`SubmitProgress`)
- Modify: `src/screens/ProjectOverviewScreen.tsx` (~188-190)

**Interfaces:**
- Consumes: `getChangesRequested`, `getMyMembershipIds`, `getEvidenceForProgress` (Task 7); `reviewStatusLabel` (Task 7); provider `resubmitDailyProgress`

- [ ] **Step 1: Task detail history** — replace the `Timeline items={progressRecords.map(...)}` with:

```tsx
                  <Timeline
                    items={progressRecords
                      .slice()
                      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
                      .map((record) => ({
                        key: record.id,
                        title: `${record.date} · v${record.version}`,
                        content: (
                          <Flex vertical gap="small">
                            <Flex gap="small" wrap>
                              <Tag color={reviewStatusLabel[record.reviewStatus].color} className="m-0!">
                                {reviewStatusLabel[record.reviewStatus].text}
                              </Tag>
                              {record.publicationStatus === "published" && <Tag color="success" className="m-0!">Published</Tag>}
                            </Flex>
                            <Text>{record.todaySummary}</Text>
                            {record.review?.note && <Text type="secondary">“{record.review.note}”</Text>}
                            {record.reviewStatus === "changes-requested" && mine.has(record.submittedByMembershipId) && (
                              <Button
                                size="small"
                                type="primary"
                                className="self-start"
                                onClick={() => onNavigate("daily-progress-submit", { project_id: projectId, task_id: task.id })}
                              >
                                Resubmit
                              </Button>
                            )}
                          </Flex>
                        ),
                      }))}
                  />
```

Add near `progressRecords`: `const { session } = useSession()` (import from `../session/SessionProvider`) and `const mine = getMyMembershipIds(state, session?.personId)`. Import `reviewStatusLabel` from `../components/progress/progressLabels`; drop the now-unused `Progress` import if the typecheck reports it.

- [ ] **Step 2: Company resubmit** — in `DailyProgressSubmitScreen.tsx` `SubmitProgress`, after `previous`:

```tsx
  const { session } = useSession()
  const sentBack = task
    ? getChangesRequested(state, getMyMembershipIds(state, session?.personId), task.id)[0]
    : undefined
```

(`useSession` must be called before the early return — place it with the other hooks at the top.)

Form: set values from `sentBack` when it changes:

```tsx
  useEffect(() => {
    if (!sentBack) return
    form.setFieldsValue({
      workersPresent: sentBack.workersPresent,
      progressAfter: sentBack.progressAfter,
      todaySummary: sentBack.todaySummary,
      tomorrowPlan: sentBack.tomorrowPlan,
      blockerSummary: sentBack.blockerSummary,
    })
  }, [form, sentBack])
```

In `handleSubmit`, replace the `submitDailyProgress({...})` call body with:

```tsx
        sentBack
          ? resubmitDailyProgress(sentBack.id, {
              workersPresent: values.workersPresent,
              progressAfter: values.progressAfter,
              todaySummary: values.todaySummary.trim(),
              tomorrowPlan: values.tomorrowPlan.trim(),
              yesterdaySummary: previous?.todaySummary,
              blockerSummary: values.blockerSummary?.trim() || undefined,
              keepEvidenceIds: sentBack.evidenceIds,
              evidence,
            })
          : submitDailyProgress({ /* existing object unchanged */ }),
```

Above the form, when `sentBack`: `<Alert type="warning" showIcon message="Changes requested" description={sentBack.review?.note} />`. Rename the "Progress after today (%)" label to `"Your estimate of project progress (%)"` with `extra="The official figure is calculated from approved task quantities."`. Import `useEffect`, `useSession`, `getChangesRequested`, `getMyMembershipIds`; take `resubmitDailyProgress` from `useConstructionData()`.

- [ ] **Step 3: Overview label** — in `ProjectOverviewScreen.tsx` replace

```tsx
                <Tag color={latestProgress.reviewStatus === "approved" ? "success" : "warning"}>
                  {latestProgress.reviewStatus}
```
with
```tsx
                <Tag color={reviewStatusLabel[latestProgress.reviewStatus].color}>
                  {reviewStatusLabel[latestProgress.reviewStatus].text}
```
and import `reviewStatusLabel`.

- [ ] **Step 4: Verify** — `pnpm run typecheck && pnpm run test && pnpm run build`. Browser: company user logs progress on Tech Park task via Task detail → Progress → Request changes → Task detail shows "Changes requested" + note + Resubmit → form pre-filled with the warning → submit → Task detail shows v2 Waiting for review and v1 Superseded.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: versioned task progress history and company resubmit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Stage baselines in project setup

**Files:**
- Modify: `src/screens/ProjectStructureScreen.tsx` (`ProjectStructure`, setup mode)

**Interfaces:**
- Consumes: provider `setStageBaselines(projectId, baselines)` (Task 6)

- [ ] **Step 1: Baseline card** — in `ProjectStructure`, add state and handler (with the other hooks):

```tsx
  const { setStageBaselines } = useConstructionData()
  const stages = [...state.stages].sort((a, b) => a.sequence - b.sequence)
  const [baselines, setBaselines] = useState<Record<string, number>>(() => project?.stageBaselines ?? {})
  const saveBaselines = () =>
    run(() => setStageBaselines(projectId, baselines), { success: "Work already done saved" })
```

(Merge `setStageBaselines` into the existing `useConstructionData()` destructure rather than calling the hook twice.)

Render, when `setup && project?.trackingStartedMidProject`, a card between the Steps card and "Units and locations":

```tsx
        {setup && project?.trackingStartedMidProject && (
          <Card
            title={<Title level={5} className="company-heading! m-0!">Work already done</Title>}
            extra={<Text type="secondary">Project progress now: {project.progress}%</Text>}
          >
            <Flex vertical gap="middle">
              <Text type="secondary">
                How complete was each stage when you started tracking? Leave 0 for stages not started.
              </Text>
              <Row gutter={[16, 8]}>
                {stages.map((stage) => (
                  <Col key={stage.id} xs={24} sm={12} lg={8}>
                    <Flex align="center" justify="space-between" gap="small">
                      <Text>{stage.name}</Text>
                      <InputNumber
                        min={0}
                        max={100}
                        suffix="%"
                        value={baselines[stage.id] ?? 0}
                        onChange={(value) => setBaselines((current) => ({ ...current, [stage.id]: value ?? 0 }))}
                        aria-label={`${stage.name} already complete`}
                      />
                    </Flex>
                  </Col>
                ))}
              </Row>
              <Flex justify="flex-end">
                <Gated allowed={canAddTopLevel}>
                  <Button onClick={saveBaselines}>Save</Button>
                </Gated>
              </Flex>
            </Flex>
          </Card>
        )}
```

`InputNumber`, `Row`, `Col` are already imported in this file; `canAddTopLevel` (project.manage) already exists.

- [ ] **Step 2: Verify** — `pnpm run typecheck && pnpm run build`. Browser: `#company-create-project` → fill name/code/location, tick "Construction has already started" → Continue → the Structure step shows "Work already done"; set Site Preparation 100, Foundation 50 → Save → header text shows "Project progress now: 11%".

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: record work already done per stage when setting up a project

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Homeowner Daily Update

**Files:**
- Modify: `src/screens/CustomerDailyUpdateScreen.tsx` (~55-140)
- Modify: `src/domain/visibility.test.ts` (add a test)

**Interfaces:**
- Consumes: `getPublishedEvidence` (Task 7), `EvidenceGrid` with `audience="homeowner"` (Task 8)

- [ ] **Step 1: Failing test** — append to `src/domain/visibility.test.ts` inside the first `describe`:

```ts
  it("shows the homeowner only what was chosen at publishing", () => {
    const progress = seedConstructionData.dailyProgress.find((item) => item.id === "progress-sharma-2009")!
    const narrowed = {
      ...seedConstructionData,
      dailyProgress: seedConstructionData.dailyProgress.map((item) =>
        item.id === progress.id
          ? { ...item, publication: { ...item.publication!, evidenceIds: ["evidence-sharma-1"] } }
          : item,
      ),
    }
    const shown = getPublishedEvidence(narrowed, narrowed.dailyProgress.find((item) => item.id === progress.id)!)
    expect(shown.map((item) => item.id)).toEqual(["evidence-sharma-1"])
  })
```

Add `getPublishedEvidence` to the selectors import. Run `pnpm vitest run src/domain/visibility.test.ts` → PASS already (selector exists from Task 7); this test pins the rule before the screen changes.

- [ ] **Step 2: Screen** — in `CustomerUpdate`:

```tsx
  const evidence = latest ? getPublishedEvidence(state, latest) : []
  const progress = project?.progress ?? 0
```

replacing the `getCustomerVisibleEvidence(getEvidenceForProgress(...))` and `latest?.progressAfter ?? …` lines. Replace the evidence `Row`/`EvidenceThumb` block with:

```tsx
            <EvidenceGrid items={evidence} audience="homeowner" empty="No photos were shared with this update." />
```

Update imports: remove `EvidenceThumb`, `getCustomerVisibleEvidence`, `getEvidenceForProgress` if unused; add `EvidenceGrid` from `../components/progress/EvidenceGrid` and `getPublishedEvidence`.

- [ ] **Step 3: Verify** — `pnpm run typecheck && pnpm run test && pnpm run build`. Browser: `#customer-daily-update?project_id=project-sharma` shows the Sharma update, 2 photos, % = 34; clicking a photo opens the viewer with only Date / Location / Work.

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add src && git commit -m "feat: homeowner sees only published evidence and calculated progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: End-to-end check and spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-phase-5-daily-progress-v2-design.md` (Status line)

- [ ] **Step 1: Full checks** — `pnpm run typecheck && pnpm run test && pnpm run build` → all pass; note the test count.

- [ ] **Step 2: Browser acceptance (fresh page load, 1440px, then 375px spot check)**
1. `#onboarding-worker` → Ravi → task "Complete footing curing log" → Log progress: quantity 1, texts, add **two** photos and a voice note → Send.
2. `#onboarding-business` → Create workspace → Progress (Sharma) → Request changes: "Add a close-up of the curing".
3. `#onboarding-worker` → "Changes requested" → Fix and resend → keep both photos → Send again.
4. Company → Progress → item shows v2; detail shows earlier version note → Approve.
5. Ready to publish → untick the second photo → Publish → preview shows one photo → Publish.
6. Homeowner view (`#customer-daily-update?project_id=project-sharma`) → exactly one photo from this update, no voice note, no review note; % equals the Overview's %.
7. History tab → v1 Superseded, v2 Approved · Published · 1 items.

- [ ] **Step 3: Spec status** — change `**Status:** Design approved — not yet implemented` to `**Status:** Implemented`.

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH" && git add docs && git commit -m "docs: mark Phase 5 Daily Progress v2 implemented

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Report to the user** — summary, test count, browser results. Do not push or open a PR until the user says so.
