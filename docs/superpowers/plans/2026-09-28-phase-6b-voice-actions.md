# Phase 6B — Voice → Structured Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speak (or type) an instruction → editable draft with Heard / Guessed / Needs-you markers → the user confirms in the existing form → the existing domain command saves the record; chat messages can become tasks/issues that link back to the message.

**Architecture:** A pure rules extractor in `src/domain/voice/` turns text into typed drafts (`task` / `issue` / `progress`) behind a `VoiceExtractor` interface. A shared `VoiceCapture` modal collects speech (existing `useDictation`) or typed text, then the existing forms open pre-filled. `Task` and `Issue` gain an optional `source` (thread + message), validated by `createTask` / `reportIssue`.

**Tech Stack:** React 19, TypeScript 5.7, Ant Design 6, Tailwind v4, Vitest. Package manager pnpm.

**Spec:** `docs/superpowers/specs/2026-09-28-phase-6b-voice-actions-design.md`

## Global Constraints

- Checks: `pnpm run typecheck`, `pnpm run test`, `pnpm run build` must pass after every task.
- **Never run `pnpm run format`** (oxfmt 0.2.0 strips `;` in TypeScript types and breaks the build).
- Git commands need `export PATH="/opt/homebrew/bin:$PATH"` first (git-lfs hooks).
- **Never kill processes by pattern** (`pkill -f …`); the dev server on port 5174 must keep running.
- Domain commands are pure `(state, ctx) => { state, result }`, authorize first; errors: `PermissionError` (from `./session`), `IntegrityError` / `ConflictError` (from `./errors`).
- Nothing is created or changed without the user pressing the form's own submit; drafts are never stored; voice-command audio is not stored.
- A 🎤 entry point is shown only to people allowed to perform that action (same check as the non-voice button).
- Copy (exact): "Say or type what needs doing." · "Voice isn't available in this browser — type the instruction instead." · "Nobody named '{name}' on this project" · markers "Heard", "Guessed", "Needs you" · chips "→ Task: {title}" / "→ Issue: {title}" · link "From conversation".
- Code style: double quotes, no semicolons, match surrounding comment density; default exports for components.
- Speech recognition language stays `en-IN` (existing `useDictation`); rules are English only.

## Rulings (plan vs. spec)

- The spec's `VoiceContext.members` becomes `people: { id, name }[]` = the project's **workers** (`getWorkersForProject`), because `assignTask(taskId, "worker", workerId)` takes worker ids. The spec is updated in Task 1.
- The spec's single `(text, kind, ctx)` function is implemented as an object `VoiceExtractor` with `task` / `issue` / `progress` methods (same swap point, typed per kind). `voiceExtractor` (the exported instance) is what screens use.

## File structure

| File | Responsibility |
|---|---|
| `src/domain/models.ts` (modify) | `MessageSource`; optional `source` on `Task` and `Issue` |
| `src/domain/commandInputs.ts` (modify) | optional `source` on `CreateTaskInput`, `ReportIssueInput` |
| `src/domain/constructionCommands.ts` (modify) | `assertSourceMessage`; used by `createTask`, `reportIssue` |
| `src/domain/voiceSource.test.ts` (create) | command tests for `source` |
| `src/domain/voice/types.ts` (create) | draft / field-state / context / extractor types |
| `src/domain/voice/rules.ts` (create) | pure helpers: dates, quantity, people, unit, work type, priority, severity, people count, progress split, title cleanup |
| `src/domain/voice/rules.test.ts` (create) | helper tests |
| `src/domain/voice/extract.ts` (create) | `rulesExtractor`, `voiceExtractor` |
| `src/domain/voice/extract.test.ts` (create) | sentence table tests |
| `src/components/voice/VoiceCapture.tsx` (create) | speak/type modal |
| `src/components/voice/VoiceFieldMark.tsx` (create) | marker tag + `voiceLabel` + `VoiceDraftBanner` |
| `src/components/voice/useVoiceContext.ts` (create) | builds `VoiceContext` from app state |
| `src/components/tasks/CreateTaskModal.tsx` (create) | Create task form extracted from `TasksScreen`, + Assign to, draft, source |
| `src/screens/TasksScreen.tsx` (modify) | uses `CreateTaskModal`; "Speak a task" |
| `src/components/ReportIssueModal.tsx` (modify) | `draft` + `source` props, markers |
| `src/screens/IssuesScreen.tsx`, `TaskDetailScreen.tsx`, `WorkerTaskScreen.tsx` (modify) | "Speak an issue" |
| `src/screens/WorkerSubmitScreen.tsx`, `DailyProgressSubmitScreen.tsx` (modify) | "Fill from voice" |
| `src/mock/messageLinks.ts` (create) + test | records created from each message |
| `src/components/conversations/ThreadPanel.tsx` (modify) | per-message "Turn into task / issue", chips |
| `src/screens/TaskDetailScreen.tsx`, `IssueDetailScreen.tsx` (modify) | "From conversation" |

---

### Task 1: `source` on tasks and issues (domain)

**Files:**
- Modify: `src/domain/models.ts` (Task at ~line 178, Issue at ~line 282)
- Modify: `src/domain/commandInputs.ts` (`CreateTaskInput` ~line 70, `ReportIssueInput` ~line 189)
- Modify: `src/domain/constructionCommands.ts` (`createTask` ~line 463, `reportIssue` ~line 1433)
- Create: `src/domain/voiceSource.test.ts`
- Modify: `docs/superpowers/specs/2026-09-28-phase-6b-voice-actions-design.md` (rulings)

**Interfaces:**
- Produces: `interface MessageSource { threadId: EntityId; messageId: EntityId }`; `Task.source?: MessageSource`; `Issue.source?: MessageSource`; `CreateTaskInput.source?: MessageSource`; `ReportIssueInput.source?: MessageSource`.

- [ ] **Step 1: Write the failing tests** — `src/domain/voiceSource.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import * as commands from "./constructionCommands"
import { IntegrityError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext } from "./ports"
import { PermissionError, type Session } from "./session"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const clock: Clock = { now: () => new Date("2026-09-28T09:00:00.000Z") }
const as = (actor: Session): CommandContext => {
  let n = 0
  return { actor, clock, ids: { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` } }
}

const taskInput = {
  projectId: "project-sharma",
  projectUnitId: "unit-sharma-house",
  stageId: "stage-rcc",
  tradeId: "trade-civil",
  workTypeId: "work-curing",
  title: "Cure the Grid B columns",
  priority: "medium" as const,
}
const fromTask4 = { threadId: "thread-sharma-task-4", messageId: "message-5" }

describe("createTask with a source message", () => {
  it("keeps the link to the conversation message", () => {
    const { result } = commands.createTask({ ...taskInput, source: fromTask4 })(seed, as(arjun))
    expect(result.source).toEqual(fromTask4)
  })

  it("refuses a message that isn't in that thread", () => {
    expect(() =>
      commands.createTask({ ...taskInput, source: { threadId: "thread-sharma-task-4", messageId: "message-1" } })(seed, as(arjun)),
    ).toThrow(IntegrityError)
  })

  it("refuses a message that doesn't exist", () => {
    expect(() =>
      commands.createTask({ ...taskInput, source: { threadId: "thread-sharma-task-4", messageId: "message-nope" } })(seed, as(arjun)),
    ).toThrow(IntegrityError)
  })

  it("refuses a thread from another project", () => {
    const moved: ConstructionDataState = {
      ...seed,
      threads: seed.threads.map((t) => (t.id === "thread-sharma-task-4" ? { ...t, projectId: "project-reddy" } : t)),
    }
    expect(() => commands.createTask({ ...taskInput, source: fromTask4 })(moved, as(arjun))).toThrow(IntegrityError)
  })
})

describe("reportIssue with a source message", () => {
  const issueInput = {
    projectId: "project-sharma",
    taskId: "task-4",
    title: "Hessian drying out",
    description: "",
    severity: "medium" as const,
  }

  it("keeps the link when the reporter can read the thread", () => {
    const { result } = commands.reportIssue({ ...issueInput, source: fromTask4 })(seed, as(ravi))
    expect(result.source).toEqual(fromTask4)
  })

  it("refuses a thread the reporter can't read", () => {
    // Workers never read the Homeowner thread.
    expect(() =>
      commands.reportIssue({ ...issueInput, source: { threadId: "thread-sharma-homeowner", messageId: "message-7" } })(seed, as(ravi)),
    ).toThrow(PermissionError)
  })

  it("works without a source, as before", () => {
    const { result } = commands.reportIssue(issueInput)(seed, as(ravi))
    expect(result.source).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/voiceSource.test.ts`
Expected: type errors / failures (`source` does not exist).

- [ ] **Step 3: Implement**

`src/domain/models.ts` — above `export interface Task {` add:

```ts
/** The conversation message a task or issue was created from (Phase 6B). */
export interface MessageSource {
  threadId: EntityId
  messageId: EntityId
}
```

In `Task` (after `checklist`… keep order readable, e.g. after `dueDate?`) add `source?: MessageSource`; in `Issue` after `dailyProgressId?` add:

```ts
  /** The conversation message this was created from, if any. */
  source?: MessageSource
```

(and the same doc comment on `Task.source`).

`src/domain/commandInputs.ts` — import `MessageSource` from `./models` alongside existing model imports; add to `CreateTaskInput` and `ReportIssueInput`:

```ts
  /** Created from a conversation message (checked: exists, same project, readable). */
  source?: MessageSource
```

`src/domain/constructionCommands.ts` — add imports `import { readerMembership } from "./conversations"` and `MessageSource` to the models type import; add this helper near the other `assert…` helpers:

```ts
/** A source message must exist, sit in its thread, belong to the project, and be readable by the caller. */
function assertSourceMessage(
  state: ConstructionDataState,
  ctx: CommandContext,
  projectId: EntityId,
  source?: MessageSource,
) {
  if (!source) return
  const thread = state.threads.find((item) => item.id === source.threadId)
  const message = state.messages.find((item) => item.id === source.messageId)
  if (!thread || !message || message.threadId !== thread.id) {
    throw new IntegrityError("The conversation message for this record wasn't found.")
  }
  if (thread.projectId !== projectId) {
    throw new IntegrityError(`Message ${message.id} is not in project ${projectId}`)
  }
  if (!readerMembership(state, ctx.actor, thread)) {
    throw new PermissionError(Permissions.PROJECT_READ, projectId)
  }
}
```

In `createTask`, right after `assertWorkTypeMatches(state, input)` add `assertSourceMessage(state, ctx, input.projectId, input.source)` (the task already spreads `...input`, so `source` is stored). In `reportIssue`, after the `assertUnitInProject(...)` / task-unit checks add `assertSourceMessage(state, ctx, input.projectId, input.source)`, and in the `issue` object literal add `source: input.source,` after `dailyProgressId`.

If `PermissionError` / `Permissions` are not yet imported in `constructionCommands.ts`, add them from `./session` / `./permissions` (check the existing import block first). If importing `./conversations` creates a cycle (it imports only `./permissions` and `./session` today), keep it — there is none.

Spec update: in `docs/superpowers/specs/2026-09-28-phase-6b-voice-actions-design.md` §1, replace the `members:` line with `people: { id: EntityId; name: string }[]   // the project's workers (assignable)` and add under the extractor paragraph: "Implemented as an object `VoiceExtractor` with `task` / `issue` / `progress` methods; screens use the exported `voiceExtractor` instance."

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/domain/voiceSource.test.ts && pnpm run typecheck && pnpm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/models.ts src/domain/commandInputs.ts src/domain/constructionCommands.ts src/domain/voiceSource.test.ts docs/superpowers/specs/2026-09-28-phase-6b-voice-actions-design.md
git commit -m "feat: tasks and issues can record the conversation message they came from"
```

---

### Task 2: Voice types and rule helpers

**Files:**
- Create: `src/domain/voice/types.ts`, `src/domain/voice/rules.ts`, `src/domain/voice/rules.test.ts`

**Interfaces:**
- Consumes: `ISODate`, `EntityId`, `ProjectUnit`, `WorkType`, `Task`, `QuantityUnit`, `Issue` from `../models`.
- Produces (types.ts):

```ts
import type { EntityId, ISODate, Issue, ProjectUnit, QuantityUnit, Task, WorkType } from "../models"

export interface VoicePerson {
  id: EntityId
  name: string
}

export interface VoiceContext {
  today: ISODate
  units: ProjectUnit[]
  workTypes: WorkType[]
  /** People who can be assigned (the project's workers). */
  people: VoicePerson[]
  /** Open tasks of the project, for linking issues. */
  tasks: Task[]
  /** Set when started from a task or a task conversation. */
  currentTaskId?: EntityId
}

export type FieldState =
  | { state: "heard" }
  | { state: "guessed"; reason: string }
  | { state: "missing"; note?: string }
  | { state: "choose"; options: { value: string; label: string }[] }

export interface TaskDraftValues {
  title?: string
  projectUnitId?: EntityId
  workTypeId?: EntityId
  priority?: Task["priority"]
  plannedValue?: number
  unit?: QuantityUnit
  plannedStart?: ISODate
  dueDate?: ISODate
  assigneeId?: EntityId
}

export interface IssueDraftValues {
  title?: string
  description?: string
  severity?: Issue["severity"]
  projectUnitId?: EntityId
  taskId?: EntityId
}

export interface ProgressDraftValues {
  todaySummary?: string
  tomorrowPlan?: string
  blockerSummary?: string
  completedQuantity?: number
  workersPresent?: number
}

export interface VoiceDraft<V> {
  transcript: string
  values: V
  fields: Partial<Record<keyof V, FieldState>>
}

/** Swap point: rules today, an AI extractor later. */
export interface VoiceExtractor {
  task(text: string, ctx: VoiceContext): VoiceDraft<TaskDraftValues>
  issue(text: string, ctx: VoiceContext): VoiceDraft<IssueDraftValues>
  progress(text: string, ctx: VoiceContext): VoiceDraft<ProgressDraftValues>
}
```

- Produces (rules.ts), all pure:

```ts
findDate(text: string, today: ISODate): { date: ISODate; start: boolean; guessed?: string; matched: string } | undefined
findQuantity(text: string): { value: number; unit: QuantityUnit; matched: string; converted?: string } | undefined
findPerson(text: string, people: VoicePerson[]):
  | { kind: "one"; person: VoicePerson; matched: string }
  | { kind: "many"; options: VoicePerson[]; matched: string }
  | { kind: "unknown"; name: string; matched: string }
  | undefined
findUnit(text: string, units: ProjectUnit[]): { unit: ProjectUnit; how: "heard" | "only-one"; matched?: string } | undefined
findWorkType(text: string, workTypes: WorkType[]): { workType: WorkType; how: "name" | "keyword"; keyword: string } | undefined
findPriority(text: string): { priority: Task["priority"]; matched?: string }   // matched undefined → default
findSeverity(text: string): { severity: Issue["severity"]; matched?: string }
findPeopleCount(text: string): { count: number; matched: string } | undefined
splitProgress(text: string): { today: string[]; tomorrow: string[]; blocker: string[] }
cleanTitle(text: string, remove: string[]): string
```

- [ ] **Step 1: Write the failing tests** — `src/domain/voice/rules.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../../mock/seed"
import type { ProjectUnit } from "../models"
import {
  cleanTitle, findDate, findPeopleCount, findPerson, findPriority, findQuantity,
  findSeverity, findUnit, findWorkType, splitProgress,
} from "./rules"

const MON = "2026-09-28" // a Monday
const people = [
  { id: "w-ravi-n", name: "Ravi Naik" },
  { id: "w-ravi-k", name: "Ravi Kumar" },
  { id: "w-suresh", name: "Suresh Kumar" },
]
const unit = (id: string, name: string, code: string): ProjectUnit =>
  ({ id, projectId: "p", kind: "block", code, name, status: "active", sequence: 1 })
const units = [unit("u-main", "Main House", "HOUSE"), unit("u-b", "Block B", "BLK-B")]

describe("findDate", () => {
  it("reads today, tomorrow and day after tomorrow", () => {
    expect(findDate("do it today", MON)?.date).toBe("2026-09-28")
    expect(findDate("pour the columns tomorrow", MON)?.date).toBe("2026-09-29")
    expect(findDate("day after tomorrow please", MON)?.date).toBe("2026-09-30")
  })
  it("reads weekdays forward, and rolls today's weekday to next week as a guess", () => {
    expect(findDate("finish by Friday", MON)?.date).toBe("2026-10-02")
    const monday = findDate("on monday", MON)
    expect(monday?.date).toBe("2026-10-05")
    expect(monday?.guessed).toBeDefined()
  })
  it("reads day-of-month, rolling into next month", () => {
    expect(findDate("by the 30th", MON)?.date).toBe("2026-09-30")
    expect(findDate("by the 5th", MON)?.date).toBe("2026-10-05")
  })
  it("reads next week as next Monday (guessed) and marks starts", () => {
    const next = findDate("sometime next week", MON)
    expect(next?.date).toBe("2026-10-05")
    expect(next?.guessed).toBeDefined()
    expect(findDate("start tomorrow", MON)?.start).toBe(true)
    expect(findDate("finish tomorrow", MON)?.start).toBe(false)
  })
  it("returns nothing without a date", () => {
    expect(findDate("pour the columns", MON)).toBeUndefined()
  })
})

describe("findQuantity", () => {
  it("reads number + unit", () => {
    expect(findQuantity("pour 42 cubic metres")).toMatchObject({ value: 42, unit: "m3" })
    expect(findQuantity("plaster 120 sqm")).toMatchObject({ value: 120, unit: "m2" })
    expect(findQuantity("10 bags of cement")).toMatchObject({ value: 10, unit: "nos" })
    expect(findQuantity("curing for 3 days")).toMatchObject({ value: 3, unit: "day" })
    expect(findQuantity("500 kg steel")).toMatchObject({ value: 500, unit: "kg" })
  })
  it("converts square feet to m2 and says so", () => {
    const q = findQuantity("tile 100 sq ft")
    expect(q).toMatchObject({ value: 9.29, unit: "m2" })
    expect(q?.converted).toBeDefined()
  })
  it("ignores bare numbers", () => {
    expect(findQuantity("grid 4 to 9")).toBeUndefined()
  })
})

describe("findPerson", () => {
  it("matches a full name", () => {
    expect(findPerson("Ravi Naik, pour the columns", people)).toMatchObject({ kind: "one", person: { id: "w-ravi-n" } })
  })
  it("asks to choose when a first name is shared", () => {
    const found = findPerson("Ravi, pour the columns", people)
    expect(found?.kind).toBe("many")
  })
  it("matches a unique first name", () => {
    expect(findPerson("ask Suresh to check", people)).toMatchObject({ kind: "one", person: { id: "w-suresh" } })
  })
  it("reports an unknown name after assign/ask/tell", () => {
    expect(findPerson("assign to Mahesh", people)).toMatchObject({ kind: "unknown", name: "Mahesh" })
  })
  it("returns nothing when no one is named", () => {
    expect(findPerson("pour the columns tomorrow", people)).toBeUndefined()
  })
})

describe("findUnit", () => {
  it("matches name or code, else the only unit", () => {
    expect(findUnit("in block b", units)?.unit.id).toBe("u-b")
    expect(findUnit("at the main house", units)?.unit.id).toBe("u-main")
    expect(findUnit("somewhere", units)).toBeUndefined()
    expect(findUnit("somewhere", [units[0]!])).toMatchObject({ how: "only-one" })
  })
})

describe("findWorkType", () => {
  const lib = seed.workTypes
  it("prefers a Work Library name", () => {
    expect(findWorkType("column shuttering on grid B", lib)).toMatchObject({ how: "name", workType: { id: "work-column-shuttering" } })
    expect(findWorkType("start curing", lib)?.workType.id).toBe("work-curing")
  })
  it("combines element and action words", () => {
    expect(findWorkType("pour the columns", lib)?.workType.id).toBe("work-column-casting")
    expect(findWorkType("concrete the footings", lib)?.workType.id).toBe("work-footing-concrete")
    expect(findWorkType("put rebar in the slab", lib)?.workType.id).toBe("work-slab-reinforcement")
  })
  it("uses single keywords", () => {
    expect(findWorkType("backfill around grid A", lib)?.workType.id).toBe("work-backfilling")
    expect(findWorkType("brick work on the east wall", lib)?.workType.id).toBe("work-brick-masonry")
  })
  it("returns nothing for unknown work", () => {
    expect(findWorkType("have a chat with the client", lib)).toBeUndefined()
  })
})

describe("priority, severity, people count", () => {
  it("reads priority words, default medium", () => {
    expect(findPriority("urgent, pour now").priority).toBe("high")
    expect(findPriority("this is critical").priority).toBe("critical")
    expect(findPriority("low priority, when free").priority).toBe("low")
    expect(findPriority("pour the columns")).toEqual({ priority: "medium" })
  })
  it("reads severity words, default medium", () => {
    expect(findSeverity("scaffold is unsafe").severity).toBe("critical")
    expect(findSeverity("water leak in the basement").severity).toBe("high")
    expect(findSeverity("sand delivery is late").severity).toBe("medium")
    expect(findSeverity("something looks off")).toEqual({ severity: "medium" })
  })
  it("reads people on site", () => {
    expect(findPeopleCount("5 of us worked today")?.count).toBe(5)
    expect(findPeopleCount("we had 7 workers")?.count).toBe(7)
    expect(findPeopleCount("finished the slab")).toBeUndefined()
  })
})

describe("splitProgress and cleanTitle", () => {
  it("splits today / tomorrow / blocker", () => {
    const s = splitProgress("Finished curing the footings. Tomorrow we start backfilling, waiting for sand delivery")
    expect(s.today).toEqual(["Finished curing the footings"])
    expect(s.tomorrow).toEqual(["Tomorrow we start backfilling"])
    expect(s.blocker).toEqual(["waiting for sand delivery"])
  })
  it("treats unmarked sentences as today", () => {
    expect(splitProgress("Laid 200 blocks on the east wall").today).toEqual(["Laid 200 blocks on the east wall"])
  })
  it("cleans a title", () => {
    expect(cleanTitle("Ravi, please pour the Grid B columns tomorrow, urgent", ["Ravi", "tomorrow", "urgent"]))
      .toBe("Pour the Grid B columns")
    expect(cleanTitle("ok can you check the lintel", [])).toBe("Check the lintel")
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/voice/rules.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/domain/voice/types.ts` exactly as in Interfaces; `src/domain/voice/rules.ts`:

```ts
import type { ISODate, Issue, ProjectUnit, QuantityUnit, Task, WorkType } from "../models"
import type { VoicePerson } from "./types"

/**
 * Pure rules that pull structured values out of an English instruction
 * (speech is recognised as en-IN). Each helper returns what it matched so
 * the title can be cleaned and the UI can mark fields Heard / Guessed.
 */

const addDays = (date: ISODate, days: number): ISODate => {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}
const weekdayOf = (date: ISODate) => new Date(`${date}T00:00:00Z`).getUTCDay()
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const START_WORDS = /\b(start|starting|begin|from)\b[^.,]*$/i

export function findDate(text: string, today: ISODate) {
  const lower = text.toLowerCase()
  const startsBefore = (index: number) => START_WORDS.test(lower.slice(0, index))
  const hit = (date: ISODate, match: RegExpMatchArray, guessed?: string) => ({
    date,
    start: startsBefore(match.index ?? 0),
    guessed,
    matched: match[0],
  })

  let m = lower.match(/\bday after tomorrow\b/)
  if (m) return hit(addDays(today, 2), m)
  m = lower.match(/\btomorrow\b/)
  if (m) return hit(addDays(today, 1), m)
  m = lower.match(/\btoday\b/)
  if (m) return hit(today, m)
  m = lower.match(/\bnext week\b/)
  if (m) {
    const toMonday = ((8 - weekdayOf(today)) % 7) || 7
    return hit(addDays(today, toMonday), m, "Read 'next week' as next Monday")
  }
  m = lower.match(new RegExp(`\\b(?:on |by |this |next )?(${WEEKDAYS.join("|")})\\b`))
  if (m) {
    const target = WEEKDAYS.indexOf(m[1]!)
    const ahead = (target - weekdayOf(today) + 7) % 7
    return ahead === 0
      ? hit(addDays(today, 7), m, `Today is ${m[1]}, so read as next week`)
      : hit(addDays(today, ahead), m)
  }
  m = lower.match(/\b(?:by |on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/)
  if (m) {
    const day = Number(m[1])
    const [y, mo, d] = today.split("-").map(Number)
    const sameMonth = day >= d!
    const date = new Date(Date.UTC(y!, mo! - 1 + (sameMonth ? 0 : 1), day)).toISOString().slice(0, 10)
    return hit(date, m, sameMonth ? undefined : "That day has passed this month, so next month")
  }
  return undefined
}

const UNITS: Array<[RegExp, QuantityUnit, number?, string?]> = [
  [/cubic met(?:er|re)s?|cu\.? ?m\b|\bm3\b|\bcum\b/, "m3"],
  [/sq(?:uare)?\.? ?f(?:ee|oo)?t\b|\bsqft\b/, "m2", 0.092903, "square feet"],
  [/sq(?:uare)?\.? ?met(?:er|re)s?|\bsqm\b|\bm2\b/, "m2"],
  [/running met(?:er|re)s?|\bmet(?:er|re)s?\b|\brm\b/, "m"],
  [/\bkgs?\b|\bkilo(?:gram)?s?\b/, "kg"],
  [/\btonnes?\b|\btons?\b/, "tonne"],
  [/\bhours?\b|\bhrs?\b/, "hour"],
  [/\bdays?\b/, "day"],
  [/\bnos\b|\bnumbers?\b|\bpieces?\b|\bpcs\b|\bbags?\b|\bblocks?\b|\bbricks?\b/, "nos"],
]

export function findQuantity(text: string) {
  const lower = text.toLowerCase()
  for (const match of lower.matchAll(/(\d+(?:\.\d+)?)\s*/g)) {
    const rest = lower.slice((match.index ?? 0) + match[0].length)
    for (const [pattern, unit, factor, label] of UNITS) {
      const u = rest.match(new RegExp(`^(?:${pattern.source})`))
      if (!u) continue
      const raw = Number(match[1])
      const value = factor ? Math.round(raw * factor * 100) / 100 : raw
      return {
        value,
        unit,
        matched: `${match[0]}${u[0]}`.trim(),
        converted: factor ? `Converted ${raw} ${label} to ${value} m²` : undefined,
      }
    }
  }
  return undefined
}

export function findPerson(text: string, people: VoicePerson[]) {
  const lower = text.toLowerCase()
  const full = people.filter((p) => new RegExp(`\\b${escape(p.name.toLowerCase())}\\b`).test(lower))
  if (full.length === 1) return { kind: "one" as const, person: full[0]!, matched: full[0]!.name }
  const byFirst = new Map<string, VoicePerson[]>()
  for (const p of people) {
    const first = p.name.split(/\s+/)[0]!.toLowerCase()
    byFirst.set(first, [...(byFirst.get(first) ?? []), p])
  }
  for (const [first, group] of byFirst) {
    const m = lower.match(new RegExp(`\\b${escape(first)}\\b`))
    if (!m) continue
    const matched = text.slice(m.index, (m.index ?? 0) + first.length)
    return group.length === 1
      ? { kind: "one" as const, person: group[0]!, matched }
      : { kind: "many" as const, options: group, matched }
  }
  const unknown = text.match(/\b(?:assign(?:ed)? (?:it )?to|ask|tell)\s+([A-Z][a-z]+)/)
  if (unknown) return { kind: "unknown" as const, name: unknown[1]!, matched: unknown[1]! }
  return undefined
}

export function findUnit(text: string, units: ProjectUnit[]) {
  const lower = text.toLowerCase()
  const byLength = [...units].sort((a, b) => b.name.length - a.name.length)
  for (const unit of byLength) {
    for (const label of [unit.name, unit.code]) {
      const m = lower.match(new RegExp(`\\b${escape(label.toLowerCase())}\\b`))
      if (m) return { unit, how: "heard" as const, matched: text.slice(m.index, (m.index ?? 0) + label.length) }
    }
  }
  if (units.length === 1) return { unit: units[0]!, how: "only-one" as const }
  return undefined
}

const ELEMENTS = ["footing", "column", "beam", "slab"] as const
const ELEMENT_ACTIONS: Array<[RegExp, (element: string) => string]> = [
  [/\b(pour|pouring|concret\w*|cast\w*)\b/, (e) => (e === "footing" ? "Footing Concrete" : `${cap(e)} Casting`)],
  [/\b(shutter\w*|formwork)\b/, (e) => `${cap(e)} Shuttering`],
  [/\b(rebar|reinforc\w*|steel)\b/, (e) => `${cap(e)} Reinforcement`],
]
const KEYWORDS: Array<[RegExp, string[]]> = [
  [/\bcur(e|ing)\b/, ["Curing"]],
  [/\bbackfill\w*\b/, ["Backfilling"]],
  [/\bbrick\w*\b/, ["Brick Masonry"]],
  [/\b(aac|block ?work)\b/, ["AAC Block Work"]],
  [/\bplaster\w*\b/, ["Internal Plaster", "External Plaster"]],
  [/\bexcavat\w*\b/, ["Foundation Excavation", "Site Excavation"]],
  [/\bwaterproof\w*\b/, ["Waterproofing"]],
  [/\btil(e|es|ing)\b/, ["Floor Tiling", "Tiling"]],
  [/\bpaint\w*\b/, ["Painting", "Interior Painting"]],
  [/\b(wiring|electrical)\b/, ["Electrical Wiring", "Wiring"]],
  [/\bplumb\w*\b/, ["Plumbing"]],
  [/\bde-?shutter\w*\b/, ["De-shuttering"]],
]
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export function findWorkType(text: string, workTypes: WorkType[]) {
  const lower = text.toLowerCase()
  const byName = (name: string) => workTypes.find((w) => w.name.toLowerCase() === name.toLowerCase())
  const named = [...workTypes]
    .sort((a, b) => b.name.length - a.name.length)
    .find((w) => new RegExp(`\\b${escape(w.name.toLowerCase())}\\b`).test(lower))
  if (named) return { workType: named, how: "name" as const, keyword: named.name }
  for (const element of ELEMENTS) {
    if (!new RegExp(`\\b${element}s?\\b`).test(lower)) continue
    for (const [action, nameFor] of ELEMENT_ACTIONS) {
      const a = lower.match(action)
      const found = a && byName(nameFor(element))
      if (found) return { workType: found, how: "keyword" as const, keyword: `${a![0]} … ${element}` }
    }
  }
  for (const [pattern, names] of KEYWORDS) {
    const k = lower.match(pattern)
    if (!k) continue
    const found = names.map(byName).find(Boolean)
    if (found) return { workType: found, how: "keyword" as const, keyword: k[0] }
  }
  return undefined
}

export function findPriority(text: string): { priority: Task["priority"]; matched?: string } {
  const lower = text.toLowerCase()
  const m = (re: RegExp) => lower.match(re)?.[0]
  const critical = m(/\bcritical\b/)
  if (critical) return { priority: "critical", matched: critical }
  const high = m(/\b(urgent(?:ly)?|asap|immediately|high priority)\b/)
  if (high) return { priority: "high", matched: high }
  const low = m(/\b(low priority|when free|no rush)\b/)
  if (low) return { priority: "low", matched: low }
  return { priority: "medium" }
}

export function findSeverity(text: string): { severity: Issue["severity"]; matched?: string } {
  const lower = text.toLowerCase()
  const m = (re: RegExp) => lower.match(re)?.[0]
  const critical = m(/\b(unsafe|danger\w*|collaps\w*|injur\w*)\b/)
  if (critical) return { severity: "critical", matched: critical }
  const high = m(/\b(leak\w*|crack\w*|damaged|broken|short|stopped)\b/)
  if (high) return { severity: "high", matched: high }
  const medium = m(/\b(delay\w*|late|missing)\b/)
  if (medium) return { severity: "medium", matched: medium }
  return { severity: "medium" }
}

export function findPeopleCount(text: string) {
  const m =
    text.match(/\b(\d+)\s+(?:of us|workers?|people|men|labou?rers|members)\b/i) ??
    text.match(/\bwe were\s+(\d+)\b/i)
  return m ? { count: Number(m[1]), matched: m[0] } : undefined
}

const TOMORROW = /^(tomorrow|next|we will|will)\b/i
const BLOCKER = /^(problem|issue|blocked|waiting for|stuck|no )\b/i

export function splitProgress(text: string) {
  const clauses = text
    .split(/[.;!?]+|,\s*(?=(?:tomorrow|next|problem|issue|blocked|waiting for|stuck)\b)/i)
    .map((c) => c.trim())
    .filter(Boolean)
  const out = { today: [] as string[], tomorrow: [] as string[], blocker: [] as string[] }
  for (const clause of clauses) {
    if (TOMORROW.test(clause)) out.tomorrow.push(clause)
    else if (BLOCKER.test(clause)) out.blocker.push(clause)
    else out.today.push(clause)
  }
  return out
}

const FILLER = /^(?:(?:ok(?:ay)?|so|hey|please|pls|can you|could you|we need to|need to|i want you to)[\s,]+)+/i

export function cleanTitle(text: string, remove: string[]) {
  let title = text
  for (const part of remove.filter(Boolean)) {
    title = title.replace(new RegExp(`\\b${escape(part)}\\b`, "i"), " ")
  }
  title = title
    .replace(/\b(?:by|on|before|for|at)\s*(?=[,.]|$)/gi, " ")
    .replace(/[,.;!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(FILLER, "")
    .trim()
  if (!title) return ""
  return (title[0]!.toUpperCase() + title.slice(1)).slice(0, 120)
}
```

Note to implementer: the regexes above are the reference behaviour; if a listed test fails because of a regex detail, fix the regex (not the test) and keep the helper's signature. If a keyword's target name isn't in the seed Work Library (e.g. "Waterproofing"), `findWorkType` simply skips it — that is intended.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/domain/voice/rules.test.ts && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/voice/types.ts src/domain/voice/rules.ts src/domain/voice/rules.test.ts
git commit -m "feat: voice rule helpers — dates, quantities, people, units, work types"
```

---

### Task 3: The rules extractor

**Files:**
- Create: `src/domain/voice/extract.ts`, `src/domain/voice/extract.test.ts`

**Interfaces:**
- Consumes: Task 2 types and helpers.
- Produces: `export const rulesExtractor: VoiceExtractor`, `export const voiceExtractor: VoiceExtractor = rulesExtractor` (the swap point screens import).

- [ ] **Step 1: Write the failing tests** — `src/domain/voice/extract.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../../mock/seed"
import type { ProjectUnit } from "../models"
import { voiceExtractor as x } from "./extract"
import type { VoiceContext } from "./types"

const units: ProjectUnit[] = [
  { id: "u-main", projectId: "project-sharma", kind: "house", code: "HOUSE", name: "Main House", status: "active", sequence: 1 },
  { id: "u-b", projectId: "project-sharma", kind: "block", code: "BLK-B", name: "Block B", status: "planned", sequence: 2 },
]
const ctx: VoiceContext = {
  today: "2026-09-28",
  units,
  workTypes: seed.workTypes,
  people: [
    { id: "w-ravi-n", name: "Ravi Naik" },
    { id: "w-ravi-k", name: "Ravi Kumar" },
    { id: "w-suresh", name: "Suresh Kumar" },
  ],
  tasks: seed.tasks.filter((t) => t.projectId === "project-sharma"),
}

describe("task drafts", () => {
  it("fills a full instruction", () => {
    const d = x.task("Suresh, pour the Block B columns tomorrow, urgent", ctx)
    expect(d.values).toMatchObject({
      assigneeId: "w-suresh",
      projectUnitId: "u-b",
      workTypeId: "work-column-casting",
      priority: "high",
      dueDate: "2026-09-29",
      title: "Pour the Block B columns",
    })
    expect(d.fields.assigneeId).toEqual({ state: "heard" })
    expect(d.fields.workTypeId?.state).toBe("guessed")
  })

  it("asks to choose between two people with the same first name", () => {
    const d = x.task("Ravi, cure the footings in Main House", ctx)
    expect(d.values.assigneeId).toBeUndefined()
    expect(d.fields.assigneeId).toMatchObject({ state: "choose" })
  })

  it("marks unknown people, missing work type and location", () => {
    const d = x.task("assign to Mahesh, sort out the site office", ctx)
    expect(d.fields.assigneeId).toMatchObject({ state: "missing", note: "Nobody named 'Mahesh' on this project" })
    expect(d.fields.workTypeId).toEqual({ state: "missing" })
    expect(d.fields.projectUnitId).toEqual({ state: "missing" })
  })

  it("reads planned quantity and a start date", () => {
    const d = x.task("Start Main House slab casting on Friday, 42 cubic metres", ctx)
    expect(d.values).toMatchObject({ plannedStart: "2026-10-02", plannedValue: 42, unit: "m3", workTypeId: "work-slab-casting" })
    expect(d.values.dueDate).toBeUndefined()
  })

  it("defaults priority to medium as a guess, and the unit from the work type", () => {
    const d = x.task("Main House curing for 3", ctx)
    expect(d.values.priority).toBe("medium")
    expect(d.fields.priority?.state).toBe("guessed")
  })
})

describe("issue drafts", () => {
  it("fills title, severity, description and location", () => {
    const d = x.issue("Water leak in the Block B basement. Pump stopped.", ctx)
    expect(d.values).toMatchObject({ severity: "high", projectUnitId: "u-b", description: "Water leak in the Block B basement. Pump stopped." })
    expect(d.values.title).toBe("Water leak in the Block B basement")
  })
  it("links the current task when started from one", () => {
    const d = x.issue("hessian is drying out", { ...ctx, currentTaskId: "task-4" })
    expect(d.values.taskId).toBe("task-4")
    expect(d.fields.taskId).toEqual({ state: "heard" })
  })
  it("marks severity guessed when no signal word", () => {
    expect(x.issue("something is off with the lintel", ctx).fields.severity?.state).toBe("guessed")
  })
})

describe("progress drafts", () => {
  it("splits the day and reads people and quantity", () => {
    const d = x.progress("Laid 200 blocks on the east wall, 5 of us. Tomorrow we start the lintel. Waiting for cement", ctx)
    expect(d.values.todaySummary).toBe("Laid 200 blocks on the east wall, 5 of us")
    expect(d.values.tomorrowPlan).toBe("Tomorrow we start the lintel")
    expect(d.values.blockerSummary).toBe("Waiting for cement")
    expect(d.values.workersPresent).toBe(5)
    expect(d.values.completedQuantity).toBe(200)
  })
  it("leaves tomorrow missing when not said", () => {
    const d = x.progress("finished curing the footings", ctx)
    expect(d.fields.tomorrowPlan).toEqual({ state: "missing" })
  })
})

describe("empty input", () => {
  it("returns empty drafts", () => {
    expect(x.task("   ", ctx).values).toEqual({})
    expect(x.issue("", ctx).values).toEqual({})
    expect(x.progress("", ctx).values).toEqual({})
  })
})
```

(Together with Task 2's helper tests this gives the spec's ~30 sentence cases.)

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/voice/extract.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/domain/voice/extract.ts`

```ts
import {
  cleanTitle, findDate, findPeopleCount, findPerson, findPriority, findQuantity,
  findSeverity, findUnit, findWorkType, splitProgress,
} from "./rules"
import type {
  FieldState, IssueDraftValues, ProgressDraftValues, TaskDraftValues, VoiceContext, VoiceDraft, VoiceExtractor,
} from "./types"

const heard: FieldState = { state: "heard" }
const missing: FieldState = { state: "missing" }
const guessed = (reason: string): FieldState => ({ state: "guessed", reason })

function task(text: string, ctx: VoiceContext): VoiceDraft<TaskDraftValues> {
  const transcript = text.trim()
  const values: TaskDraftValues = {}
  const fields: VoiceDraft<TaskDraftValues>["fields"] = {}
  if (!transcript) return { transcript, values, fields }
  const remove: string[] = []

  const person = findPerson(transcript, ctx.people)
  if (person?.kind === "one") {
    values.assigneeId = person.person.id
    fields.assigneeId = heard
    remove.push(person.matched)
  } else if (person?.kind === "many") {
    fields.assigneeId = { state: "choose", options: person.options.map((p) => ({ value: p.id, label: p.name })) }
    remove.push(person.matched)
  } else if (person?.kind === "unknown") {
    fields.assigneeId = { state: "missing", note: `Nobody named '${person.name}' on this project` }
    remove.push(person.matched)
  }

  const date = findDate(transcript, ctx.today)
  if (date) {
    const key = date.start ? "plannedStart" : "dueDate"
    values[key] = date.date
    fields[key] = date.guessed ? guessed(date.guessed) : heard
    remove.push(date.matched)
  }

  const unit = findUnit(transcript, ctx.units)
  if (unit) {
    values.projectUnitId = unit.unit.id
    fields.projectUnitId = unit.how === "heard" ? heard : guessed("The project's only location")
  } else fields.projectUnitId = missing

  const workType = findWorkType(transcript, ctx.workTypes)
  if (workType) {
    values.workTypeId = workType.workType.id
    fields.workTypeId = workType.how === "name" ? heard : guessed(`From "${workType.keyword}"`)
  } else fields.workTypeId = missing

  const priority = findPriority(transcript)
  values.priority = priority.priority
  fields.priority = priority.matched ? heard : guessed("No priority said — medium")
  if (priority.matched) remove.push(priority.matched)

  const quantity = findQuantity(transcript)
  if (quantity) {
    values.plannedValue = quantity.value
    values.unit = quantity.unit
    fields.plannedValue = quantity.converted ? guessed(quantity.converted) : heard
    remove.push(quantity.matched)
  } else if (workType) {
    values.unit = workType.workType.defaultUnit
  }

  remove.push("assign to", "assign it to", "ask", "tell", "start", "starting")
  values.title = cleanTitle(transcript, remove)
  fields.title = values.title ? heard : missing
  return { transcript, values, fields }
}

function issue(text: string, ctx: VoiceContext): VoiceDraft<IssueDraftValues> {
  const transcript = text.trim()
  const values: IssueDraftValues = {}
  const fields: VoiceDraft<IssueDraftValues>["fields"] = {}
  if (!transcript) return { transcript, values, fields }

  const firstSentence = transcript.split(/[.!?]/)[0] ?? transcript
  values.title = cleanTitle(firstSentence, [])
  fields.title = values.title ? heard : missing
  values.description = transcript

  const severity = findSeverity(transcript)
  values.severity = severity.severity
  fields.severity = severity.matched ? heard : guessed("No severity word — medium")

  if (ctx.currentTaskId) {
    values.taskId = ctx.currentTaskId
    fields.taskId = heard
  } else {
    const words = (s: string) => s.toLowerCase().split(/\W+/).filter((w) => w.length >= 4)
    const said = new Set(words(transcript))
    const match = ctx.tasks.find((t) => words(t.title).filter((w) => said.has(w)).length >= 2)
    if (match) {
      values.taskId = match.id
      fields.taskId = guessed(`Sounds like "${match.title}"`)
    }
  }

  if (!values.taskId) {
    const unit = findUnit(transcript, ctx.units)
    if (unit) {
      values.projectUnitId = unit.unit.id
      fields.projectUnitId = unit.how === "heard" ? heard : guessed("The project's only location")
    }
  }
  return { transcript, values, fields }
}

function progress(text: string, _ctx: VoiceContext): VoiceDraft<ProgressDraftValues> {
  const transcript = text.trim()
  const values: ProgressDraftValues = {}
  const fields: VoiceDraft<ProgressDraftValues>["fields"] = {}
  if (!transcript) return { transcript, values, fields }

  const parts = splitProgress(transcript)
  const join = (list: string[]) => list.join(". ")
  if (parts.today.length) {
    values.todaySummary = join(parts.today)
    fields.todaySummary = heard
  } else fields.todaySummary = missing
  if (parts.tomorrow.length) {
    values.tomorrowPlan = join(parts.tomorrow)
    fields.tomorrowPlan = heard
  } else fields.tomorrowPlan = missing
  if (parts.blocker.length) {
    values.blockerSummary = join(parts.blocker)
    fields.blockerSummary = heard
  }

  const people = findPeopleCount(transcript)
  if (people) {
    values.workersPresent = people.count
    fields.workersPresent = heard
  }
  const quantity = findQuantity(join(parts.today) || transcript)
  if (quantity) {
    values.completedQuantity = quantity.value
    fields.completedQuantity = quantity.converted ? guessed(quantity.converted) : heard
  }
  return { transcript, values, fields }
}

export const rulesExtractor: VoiceExtractor = { task, issue, progress }

/** What the screens use. Swap for an AI extractor later without touching them. */
export const voiceExtractor: VoiceExtractor = rulesExtractor
```

Note: the first progress test expects the "5 of us" clause to stay in Today (it is part of the first clause, not a separate sentence) — do not strip it.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/domain/voice && pnpm run typecheck && pnpm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/voice/extract.ts src/domain/voice/extract.test.ts
git commit -m "feat: rules voice extractor for task, issue and progress drafts"
```

---

### Task 4: Shared voice UI — capture modal, field markers, context hook

**Files:**
- Create: `src/components/voice/VoiceCapture.tsx`, `src/components/voice/VoiceFieldMark.tsx`, `src/components/voice/useVoiceContext.ts`

**Interfaces:**
- Consumes: `useDictation(value, onText)` from `src/components/useDictation.ts` (returns `{ supported, listening, status, toggle, clearStatus }`); `localToday` from `src/mock/dayStory.ts`; `getProjectUnits`, `getWorkersForProject` from `src/mock/selectors.ts`; `useConstructionData` from `src/mock/ConstructionDataProvider`.
- Produces:
  - `VoiceCapture({ open, title, placeholder, onCancel, onDraft }: { open: boolean; title: string; placeholder: string; onCancel: () => void; onDraft: (transcript: string) => void })` (default export)
  - `VoiceFieldMark({ field }: { field?: FieldState })` (default export) and named exports `voiceLabel(label: ReactNode, field?: FieldState): ReactNode`, `VoiceDraftBanner({ transcript }: { transcript: string })`
  - `useVoiceContext(projectId: EntityId, currentTaskId?: EntityId): VoiceContext` (named export)

- [ ] **Step 1: Implement `useVoiceContext.ts`**

```ts
import { useMemo } from "react"
import type { EntityId } from "../../domain/models"
import type { VoiceContext } from "../../domain/voice/types"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { localToday } from "../../mock/dayStory"
import { getProjectUnits, getWorkersForProject } from "../../mock/selectors"

const DONE = new Set(["completed", "approved", "cancelled"])

/** What the voice extractor may match against for one project. */
export function useVoiceContext(projectId: EntityId, currentTaskId?: EntityId): VoiceContext {
  const { state } = useConstructionData()
  return useMemo(
    () => ({
      today: localToday(),
      units: getProjectUnits(state, projectId),
      workTypes: state.workTypes,
      people: getWorkersForProject(state, projectId).map((w) => ({ id: w.id, name: w.name })),
      tasks: state.tasks.filter((t) => t.projectId === projectId && !DONE.has(t.status)),
      currentTaskId,
    }),
    [state, projectId, currentTaskId],
  )
}
```

- [ ] **Step 2: Implement `VoiceFieldMark.tsx`**

```tsx
import type { ReactNode } from "react"
import { Flex, Tag, Tooltip, Typography } from "antd"
import type { FieldState } from "../../domain/voice/types"

const { Text } = Typography

/** 🎤 Heard / ✨ Guessed / ⚠ Needs you — how a voice draft filled a field. */
export default function VoiceFieldMark({ field }: { field?: FieldState }) {
  if (!field) return null
  if (field.state === "heard") return <Tag variant="outlined" color="blue" className="m-0! text-[11px]!">🎤 Heard</Tag>
  if (field.state === "guessed")
    return (
      <Tooltip title={field.reason}>
        <Tag variant="outlined" color="gold" className="m-0! text-[11px]!">✨ Guessed</Tag>
      </Tooltip>
    )
  const tip =
    field.state === "choose"
      ? `Choose: ${field.options.map((o) => o.label).join(" or ")}`
      : field.note ?? "Not heard — please fill this in"
  return (
    <Tooltip title={tip}>
      <Tag variant="outlined" color="red" className="m-0! text-[11px]!">⚠ Needs you</Tag>
    </Tooltip>
  )
}

/** A form label with its voice marker. */
export function voiceLabel(label: ReactNode, field?: FieldState): ReactNode {
  return (
    <Flex align="center" gap={6}>
      {label}
      <VoiceFieldMark field={field} />
    </Flex>
  )
}

/** "You said: …" above a pre-filled form. */
export function VoiceDraftBanner({ transcript }: { transcript: string }) {
  return (
    <div className="voice-draft-banner">
      <Text type="secondary" className="text-[12px]!">You said</Text>
      <Text italic>“{transcript}”</Text>
    </div>
  )
}
```

Add to `src/index.css` (near the conversation styles):

```css
/* "You said: …" above a voice-filled form. */
.voice-draft-banner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: var(--ant-border-radius-lg);
  background: var(--ant-color-fill-quaternary);
}
```

- [ ] **Step 3: Implement `VoiceCapture.tsx`**

```tsx
import { useState } from "react"
import { AudioMutedOutlined, AudioOutlined } from "@ant-design/icons"
import { Alert, Button, Flex, Input, Modal, Typography } from "antd"
import { useDictation } from "../useDictation"

const { Text } = Typography

/**
 * Speak (or type) an instruction, check the words, then make a draft. Nothing
 * is saved here — the caller opens the normal form pre-filled from the draft.
 */
export default function VoiceCapture({
  open,
  title,
  placeholder,
  onCancel,
  onDraft,
}: {
  open: boolean
  title: string
  placeholder: string
  onCancel: () => void
  onDraft: (transcript: string) => void
}) {
  const [text, setText] = useState("")
  const dictation = useDictation(text, setText)
  const close = () => {
    setText("")
    onCancel()
  }
  return (
    <Modal open={open} title={title} onCancel={close} footer={null} destroyOnHidden>
      <Flex vertical gap="middle">
        {!dictation.supported && (
          <Alert type="info" showIcon message="Voice isn't available in this browser — type the instruction instead." />
        )}
        <Input.TextArea
          autoFocus
          autoSize={{ minRows: 3, maxRows: 8 }}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label="Instruction"
        />
        <Text type="secondary" className="text-[12px]!">
          {dictation.status ?? (text.trim() ? "Check the words, then make a draft." : "Say or type what needs doing.")}
        </Text>
        <Flex justify="space-between" gap="small">
          <Button
            icon={dictation.listening ? <AudioMutedOutlined /> : <AudioOutlined />}
            danger={dictation.listening}
            disabled={!dictation.supported}
            onClick={dictation.toggle}
          >
            {dictation.listening ? "Stop" : "Speak"}
          </Button>
          <Flex gap="small">
            <Button onClick={close}>Cancel</Button>
            <Button
              type="primary"
              disabled={!text.trim() || dictation.listening}
              onClick={() => {
                onDraft(text.trim())
                setText("")
              }}
            >
              Make draft
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  )
}
```

- [ ] **Step 4: Check**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS (components are not used yet).

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/voice src/index.css
git commit -m "feat: voice capture modal, field markers and voice context hook"
```

---

### Task 5: Voice → Task (CreateTaskModal + Speak a task + Assign to)

**Files:**
- Create: `src/components/tasks/CreateTaskModal.tsx`
- Modify: `src/screens/TasksScreen.tsx` (create-task modal + `handleCreate` ~lines 185–215 and the `<Modal>` form ~lines 300–360)

**Interfaces:**
- Consumes: Task 1 (`CreateTaskInput.source`), Task 3 (`voiceExtractor`), Task 4 (`VoiceCapture`, `voiceLabel`, `VoiceDraftBanner`, `useVoiceContext`), existing `WorkTypeCascadeFields` (form fields `stageId`, `tradeId`, `workTypeId`, `title`), `getWorkersForProject`, `createTask`, `assignTask` from `useConstructionData`, `useCommand`.
- Produces: `CreateTaskModal({ open, onClose, projectId, draft, source, onCreated }: { open: boolean; onClose: () => void; projectId: EntityId; draft?: VoiceDraft<TaskDraftValues>; source?: MessageSource; onCreated?: (task: Task) => void })` (default export). Task 8 reuses it from chat.

- [ ] **Step 1: Extract the modal.** Move the create-task `Modal` + `Form` + `handleCreate` from `TasksScreen` into `CreateTaskModal.tsx` unchanged in behaviour (same fields, same `creatableUnits` / `creatableLibrary` derivation — move those computations with it; read how `TasksScreen` computes them and copy them). `TasksScreen` renders `<CreateTaskModal open={modalOpen} onClose={() => setModalOpen(false)} projectId={projectId} onCreated={(task) => onNavigate("task-detail", { project_id: projectId, task_id: task.id })} />`. Run `pnpm run typecheck`, then check in the browser that Create task still works (Task register → Create task → fill → task detail opens). Commit: `refactor: extract CreateTaskModal from TasksScreen`.

- [ ] **Step 2: Add Assign to, draft and source to `CreateTaskModal`.**
  - Add `assigneeId?: EntityId` to the form values and a field after Priority:

```tsx
<Form.Item label={voiceLabel("Assign to (optional)", draft?.fields.assigneeId)} name="assigneeId">
  <Select
    allowClear
    showSearch
    optionFilterProp="label"
    placeholder="Not assigned yet"
    options={getWorkersForProject(state, projectId).map((w) => ({ value: w.id, label: w.name }))}
  />
</Form.Item>
```

  - When `draft` is set: render `<VoiceDraftBanner transcript={draft.transcript} />` above the form; wrap labels with `voiceLabel(...)` for `title`, `projectUnitId`, `workTypeId` (the Work type item inside `WorkTypeCascadeFields` — pass the marker via a new optional prop `workTypeMark?: ReactNode` rendered next to that label, and `titleMark?: ReactNode` for the title label), `priority`, `plannedValue`, `plannedStart`, `dueDate`.
  - Pre-fill on open: in a `useEffect` keyed on `[open, draft]`, when `open && draft`:

```ts
const workType = state.workTypes.find((w) => w.id === draft.values.workTypeId)
form.setFieldsValue({
  ...draft.values,
  stageId: workType?.stageId,
  tradeId: workType?.tradeId,
})
```

  - Required ⚠ fields keep the form's existing `rules={[{ required: true }]}`; `workTypeId` and `projectUnitId` are already required, so Create stays blocked until filled.
  - `handleCreate`: pass `source` into the `CreateTaskInput`; after a successful `createTask`, if `values.assigneeId`:

```ts
const assigned = run(() => assignTask(task.id, "worker", values.assigneeId!), { success: "Task created and assigned" })
if (!assigned.ok) message.warning("Task created, but it couldn't be assigned — assign it from the task page.")
```

  (use `App.useApp().message` like `useCommand` does, or `useCommand`'s error toast — whichever the file already imports; don't add a new toast mechanism). Keep "Task created" as the success toast when no assignee.

- [ ] **Step 3: Speak a task on the Tasks page.** In `TasksScreen`, next to "Create task" inside the same `<Gated allowed={canManage}>`, add:

```tsx
<Button icon={<AudioOutlined />} onClick={() => setCapturing(true)}>Speak a task</Button>
```

  and render:

```tsx
<VoiceCapture
  open={capturing}
  title="Speak a task"
  placeholder="e.g. Ravi, pour the Block B columns tomorrow, urgent"
  onCancel={() => setCapturing(false)}
  onDraft={(text) => {
    setCapturing(false)
    setDraft(voiceExtractor.task(text, voiceContext))
    setModalOpen(true)
  }}
/>
```

  with `const voiceContext = useVoiceContext(projectId)`, `const [capturing, setCapturing] = useState(false)`, `const [draft, setDraft] = useState<VoiceDraft<TaskDraftValues>>()`; pass `draft` to `CreateTaskModal` and clear it (`setDraft(undefined)`) in `onClose` and `onCreated`. The plain "Create task" button opens the modal with no draft.

- [ ] **Step 4: Check**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Browser (http://localhost:5174, signed in as the business demo account, Tasks for project-sharma): Speak a task → type "Ravi, pour the Main House columns tomorrow, urgent" → Make draft → the form shows the banner, Title "Pour the Main House columns", ✨ Work type Column Casting, 🎤 location, ⚠ Assign to (if two Ravis exist in the project's workers; otherwise 🎤) → Create task → task detail opens; if assigned, the worker is listed.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/tasks/CreateTaskModal.tsx src/components/WorkTypeCascadeFields.tsx src/screens/TasksScreen.tsx
git commit -m "feat: speak a task — voice draft pre-fills Create task, with Assign to"
```

---

### Task 6: Voice → Issue (ReportIssueModal + Speak an issue)

**Files:**
- Modify: `src/components/ReportIssueModal.tsx`
- Modify: `src/screens/IssuesScreen.tsx` (~line 203), `src/screens/TaskDetailScreen.tsx` (~line 430), `src/screens/WorkerTaskScreen.tsx` (~line 353)

**Interfaces:**
- Consumes: Task 1 (`ReportIssueInput.source`), Task 3, Task 4.
- Produces: `ReportIssueModal` gains optional props `draft?: VoiceDraft<IssueDraftValues>` and `source?: MessageSource` (Task 8 reuses).

- [ ] **Step 1: `ReportIssueModal`.** Add the two props. When `draft` is set:
  - render `<VoiceDraftBanner transcript={draft.transcript} />` at the top of the form;
  - `initialValues={{ severity: "medium", taskId, ...draft?.values }}` (the modal uses `destroyOnHidden`, so initial values apply on each open); when the modal was opened with a fixed `taskId` prop, that prop still wins over `draft.values.taskId`;
  - labels: "What is the problem?" → `voiceLabel("What is the problem?", draft?.fields.title)`, Details → `draft?.fields.description`, Severity → `draft?.fields.severity`, Linked task → `draft?.fields.taskId`, Location → `draft?.fields.projectUnitId`;
  - `handleFinish` passes `source` to `reportIssue`.

- [ ] **Step 2: Entry points.** On each screen, next to the existing Report issue / Report a problem button (inside the same permission wrapper it already uses), add a button with `<AudioOutlined />` labelled **Speak an issue** that opens `VoiceCapture` (title "Speak an issue", placeholder "e.g. Water leak in the Block B basement, pump stopped"); `onDraft` → `setIssueDraft(voiceExtractor.issue(text, voiceContext))` and open `ReportIssueModal` with `draft={issueDraft}`. Use `useVoiceContext(projectId, taskId)` where a task is on the page (Task detail, Worker task) so the issue links to it. Clear the draft on close.

- [ ] **Step 3: Check**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Browser: Task detail (task-4) → Speak an issue → "hessian is drying out, water tank empty" → draft: title "Hessian is drying out", 🎤 severity High ("empty" isn't a signal word, so check: severity ✨ guessed medium — accept either, the marker must match the value), linked task task-4 → Report issue → it appears on the task.

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/ReportIssueModal.tsx src/screens/IssuesScreen.tsx src/screens/TaskDetailScreen.tsx src/screens/WorkerTaskScreen.tsx
git commit -m "feat: speak an issue — voice draft pre-fills Report issue"
```

---

### Task 7: Voice → Progress (Fill from voice)

**Files:**
- Modify: `src/screens/WorkerSubmitScreen.tsx` (form ~lines 224–320; fields `completedQuantity`, `workersPresent`, `todaySummary`, `tomorrowPlan`, `blockerSummary`)
- Modify: `src/screens/DailyProgressSubmitScreen.tsx` (form ~lines 198–295; fields `workersPresent`, `todaySummary`, `tomorrowPlan`, `blockerSummary` — no quantity field)

**Interfaces:**
- Consumes: Task 3 `voiceExtractor.progress`, Task 4 components/hook.

- [ ] **Step 1: Worker screen.** Above the first form card add a full-width button `🎤 Fill from voice` (`<Button block icon={<AudioOutlined />}>Fill from voice</Button>`) that opens `VoiceCapture` (title "Fill from voice", placeholder "e.g. Laid 200 blocks, 5 of us. Tomorrow the lintel. Waiting for cement"). `onDraft`:

```ts
const draft = voiceExtractor.progress(text, voiceContext)
form.setFieldsValue(draft.values)
setProgressDraft(draft)
```

  Show `<VoiceDraftBanner transcript={progressDraft.transcript} />` above the form when set, and wrap the five field labels with `voiceLabel(existingLabel, progressDraft?.fields.<name>)`. Keep the existing label text exactly. Evidence stays manual; submit is the existing button.

- [ ] **Step 2: Company screen.** Same, but only `workersPresent`, `todaySummary`, `tomorrowPlan`, `blockerSummary` are set (drop `completedQuantity` from `draft.values` before `setFieldsValue`). Put the button in the "Today's work" card header `extra`.

- [ ] **Step 3: Check**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Browser (worker demo sign-in, `#worker-submit?project_id=project-sharma&task_id=task-4`): Fill from voice → "Covered footings with wet hessian, 3 of us. Tomorrow we check the starter columns" → fields filled with markers; add a photo; Submit → the update shows under My updates.

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/WorkerSubmitScreen.tsx src/screens/DailyProgressSubmitScreen.tsx
git commit -m "feat: fill Log progress from voice"
```

---

### Task 8: Chat → Task / Issue with links both ways

**Files:**
- Create: `src/mock/messageLinks.ts`, `src/mock/messageLinks.test.ts`
- Modify: `src/components/conversations/ThreadPanel.tsx` (message bubble ~lines 225–255; props type ~line 31)
- Modify: `src/screens/ProjectMessagesScreen.tsx`, `src/screens/TaskDetailScreen.tsx`, `src/screens/IssueDetailScreen.tsx`, `src/screens/WorkerMessagesScreen.tsx`, `src/screens/WorkerTaskScreen.tsx` (pass `onOpenRecord`)

**Interfaces:**
- Consumes: Task 1 (`source`), Task 5 (`CreateTaskModal`), Task 6 (`ReportIssueModal` `draft`/`source`), Task 3/4.
- Produces:

```ts
export interface MessageLink { kind: "task" | "issue"; id: EntityId; title: string }
/** Records created from messages in one thread, keyed by message id (only the records passed in). */
export function messageLinks(threadId: EntityId, tasks: Task[], issues: Issue[]): Map<EntityId, MessageLink[]>
```

  and `ThreadPanel` prop `onOpenRecord?: (kind: "task" | "issue", id: EntityId) => void`.

- [ ] **Step 1: Failing test** — `src/mock/messageLinks.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "./seed"
import { messageLinks } from "./messageLinks"

describe("messageLinks", () => {
  const task = { ...seed.tasks[0]!, id: "t-1", title: "Pour Grid B", source: { threadId: "th-1", messageId: "m-1" } }
  const issue = { ...seed.issues[0]!, id: "i-1", title: "Leak", source: { threadId: "th-1", messageId: "m-1" } }
  const elsewhere = { ...seed.tasks[0]!, id: "t-2", source: { threadId: "th-2", messageId: "m-9" } }

  it("groups tasks and issues by their source message in this thread", () => {
    const links = messageLinks("th-1", [task, elsewhere], [issue])
    expect(links.get("m-1")).toEqual([
      { kind: "task", id: "t-1", title: "Pour Grid B" },
      { kind: "issue", id: "i-1", title: "Leak" },
    ])
    expect(links.has("m-9")).toBe(false)
  })

  it("only lists the records it is given (the caller passes what the viewer can read)", () => {
    expect(messageLinks("th-1", [], []).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run** `pnpm vitest run src/mock/messageLinks.test.ts` — FAIL.

- [ ] **Step 3: Implement `messageLinks.ts`**

```ts
import type { EntityId, Issue, Task } from "../domain/models"

export interface MessageLink {
  kind: "task" | "issue"
  id: EntityId
  title: string
}

/** Records created from messages in one thread, keyed by message id. Pass only what the viewer may read. */
export function messageLinks(threadId: EntityId, tasks: Task[], issues: Issue[]): Map<EntityId, MessageLink[]> {
  const links = new Map<EntityId, MessageLink[]>()
  const add = (messageId: EntityId, link: MessageLink) => links.set(messageId, [...(links.get(messageId) ?? []), link])
  for (const task of tasks) if (task.source?.threadId === threadId) add(task.source.messageId, { kind: "task", id: task.id, title: task.title })
  for (const issue of issues) if (issue.source?.threadId === threadId) add(issue.source.messageId, { kind: "issue", id: issue.id, title: issue.title })
  return links
}
```

- [ ] **Step 4: ThreadPanel.**
  - `const scoped = useScopedData()`; `const links = thread ? messageLinks(thread.id, scoped.tasks, scoped.issues) : new Map()`.
  - `const can = useAccess()`; `canTask = can([Permissions.TASK_MANAGE], probe.projectId)`; `canIssue = can(ISSUE_REPORT_PERMISSIONS, probe.projectId)`.
  - For each message with text (`message.body ?? message.voice?.transcript`) and `(canTask || canIssue)`, render a small `Dropdown` trigger (`<Button type="text" size="small" icon={<MoreOutlined />} aria-label="Message actions" className="thread-message-action" />`) beside the time line with items **Turn into task** (if `canTask`) and **Turn into issue** (if `canIssue`).
  - On select: build `voiceContext` with `useVoiceContext(probe.projectId, probe.subject === "task" ? probe.targetId : undefined)`; set `source = { threadId: thread.id, messageId: message.id }`; for a task: `setTaskDraft(voiceExtractor.task(text, voiceContext))`, and when the thread is a task thread pre-set `projectUnitId` / `workTypeId` from that task if the draft lacks them (mark them `guessed` with reason "From this task's conversation"); open `CreateTaskModal` with `draft` + `source`. For an issue: `voiceExtractor.issue(...)` → `ReportIssueModal` with `draft` + `source` + `taskId` (task thread's task).
  - Under a message bubble with links, render chips: `<Tag className="thread-link-chip" onClick={() => props.onOpenRecord?.(link.kind, link.id)}>→ {link.kind === "task" ? "Task" : "Issue"}: {link.title}</Tag>` (clickable only when `onOpenRecord` is set).
  - CSS (`src/index.css`): `.thread-message-action { opacity: 0; } .thread-row:hover .thread-message-action, .thread-message-action:focus-visible { opacity: 1; } .thread-link-chip { cursor: pointer; margin: 2px 0 0 !important; }` (on touch devices keep it visible: `@media (hover: none) { .thread-message-action { opacity: 1; } }`).

- [ ] **Step 5: Wire `onOpenRecord`.** Company screens (`ProjectMessagesScreen`, `TaskDetailScreen` / `IssueDetailScreen` Discussion cards): `(kind, id) => onNavigate(kind === "task" ? "task-detail" : "issue-detail", { project_id: projectId, [kind === "task" ? "task_id" : "issue_id"]: id })`. Worker screens (`WorkerMessagesScreen`, `WorkerTaskScreen`): tasks → `onNavigate("worker-task", { project_id, task_id })`; issues → no link (leave `onOpenRecord` returning nothing for issues — the chip is then plain text: render chips as non-clickable when the handler is missing for that kind; implement by passing `onOpenRecord` and letting it ignore issues, and give the chip `cursor: default` when `kind === "issue"` on worker screens is fine — simplest: only make chips clickable when `onOpenRecord` is provided).

- [ ] **Step 6: "From conversation".** In `TaskDetailScreen` and `IssueDetailScreen`, when `task.source` / `issue.source` is set, show under the title: `<Button type="link" size="small" icon={<MessageOutlined />} className="p-0!" onClick={() => onNavigate("project-messages", { project_id: projectId, thread_id: record.source.threadId })}>From conversation</Button>`.

- [ ] **Step 7: Check**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Browser (business): Messages → task-4 conversation → hover Ravi's voice message → ⋯ → Turn into issue → draft from its transcript, linked to task-4 → Report issue → the message shows "→ Issue: …"; click it → Issue detail shows "From conversation" → click → back to the thread.

- [ ] **Step 8: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/mock/messageLinks.ts src/mock/messageLinks.test.ts src/components/conversations/ThreadPanel.tsx src/screens src/index.css
git commit -m "feat: turn a chat message into a task or issue, linked both ways"
```

---

### Task 9: Walkthrough, spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-phase-6b-voice-actions-design.md` (Status → Implemented)

- [ ] **Step 1: Full checks** — `pnpm run typecheck && pnpm run test && pnpm run build` (all pass).
- [ ] **Step 2: Browser walkthrough** (typed input; the preview has no mic) — all four flows from Tasks 5–8, plus: a worker never sees "Turn into task" (no task permission); the homeowner never sees 🎤 buttons on company screens; phone width (375px) — capture modal and markers fit, message ⋯ visible without hover.
- [ ] **Step 3: Spec status** — set `**Status:** Implemented` in the spec.
- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add docs/superpowers/specs/2026-09-28-phase-6b-voice-actions-design.md
git commit -m "docs: Phase 6B spec implemented"
```
