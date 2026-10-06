# Phase 4 Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record per-worker, per-project, per-day attendance with check-in and check-out, supervisor entry and correction, a project `requireCheckout` policy, and role-scoped reads. All in the in-memory mock.

**Architecture:** One new record, `WorkerAttendance`, in `ConstructionDataState`. Pure helpers in `src/domain/attendance.ts` (day state, Asia/Kolkata date, validation). Commands in `src/domain/attendanceCommands.ts`, each returning `{ state, result }` or throwing `ConflictError`. Reads are separate functions with permission checks. Screens call the commands through the provider.

**Tech Stack:** TypeScript, React 19, Ant Design 6, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-phase-4-attendance-design.md` (approved; decisions A1–A9)

## Global Constraints

- `src/domain/*.ts` production code never imports `src/mock/*`. Test files may import `../mock/seed`.
- Legacy-style files keep single quotes and no semicolons. New files use double quotes and no semicolons.
- Refusals are `ConflictError` with the plain messages in spec §6.
- Dates are `YYYY-MM-DD` in `Asia/Kolkata` (A5). Derive them with `Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"`, never with the machine's local zone.
- At most one `WorkerAttendance` per worker, project, and date (A6).
- A check-out time is set only with a check-in time, and is not earlier than it (A7).
- Records are never deleted.
- A worker can always close a day they opened, even after the assignment ended (A8).
- Phone identity is a stand-in until Phase 11 and is not authentication. Each worker command's docblock says so.
- Out of scope: device location, QR attendance, payroll, reports and exports, contractor verification, the worker profile, and a worker history screen.
- Every changed screen keeps its Hozie insight card with factual copy only.

## File Structure

- Modify `src/domain/models.ts`: `AttendanceStatus`, `WorkerAttendance`, `Project.requireCheckout`, `ConstructionDataState.workerAttendance`.
- Modify `src/mock/seed.ts`: `requireCheckout: false` on every seeded project; `workerAttendance: []`.
- Create `src/domain/attendance.ts`: `attendanceDate(instant)`, `dayState(record, requireCheckout)`, `validateTimes(checkInAt, checkOutAt)`.
- Create `src/domain/attendanceCommands.ts`: `recordAttendance`, `checkInWorker`, `checkOutWorker`, `setAttendancePolicy`, `listAttendance`, `getOwnAttendance`.
- Modify `src/mock/ConstructionDataProvider.tsx`: expose the writes and reads.
- Modify `src/screens/WorkforceScreen.tsx`: "Record attendance" row action and today's day state.
- Modify the project team screen (`src/screens/ProjectTeamScreen.tsx`): Attendance section and the `requireCheckout` toggle.
- Modify `src/screens/WorkerTodayScreen.tsx`: check-in and check-out buttons and day states.
- Create `src/screens/AttendanceHistoryScreen.tsx` and route it from the project navigation (`attendance-history`, project scope, `PROJECT_READ`).
- Modify `src/domain/navigation.ts`: add the route; `src/App.tsx`: render it.
- Tests: `src/domain/attendance.test.ts`, `src/domain/attendanceCommands.test.ts`.

---

### Task 1: Attendance model, project policy, and seed

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/mock/seed.ts`
- Test: `src/mock/seed.test.ts` (append)

**Interfaces:**
- Produces: `AttendanceStatus`, `WorkerAttendance`, `Project.requireCheckout`, `ConstructionDataState.workerAttendance`.

- [ ] **Step 1: Write the failing test**

Append to `src/mock/seed.test.ts`:

```ts
describe("attendance seed", () => {
  it("seeds an empty attendance list and no project requires checkout", () => {
    expect(seed.workerAttendance).toEqual([])
    expect(seed.projects.every((p) => p.requireCheckout === false)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/mock/seed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the types**

In `src/domain/models.ts`, add near the Worker types:

```ts
export type AttendanceStatus = "present" | "absent" | "half-day"

export interface WorkerAttendance {
  id: EntityId
  workerId: EntityId
  projectId: EntityId
  /** The assignment active on this date (spec A9). Kept after the assignment ends. */
  assignmentId: EntityId
  /** Calendar day in Asia/Kolkata, YYYY-MM-DD. */
  date: ISODate
  status?: AttendanceStatus
  checkInAt?: ISODateTime
  checkOutAt?: ISODateTime
  recordedBy: "supervisor" | "worker"
  recordedByMembershipId?: EntityId
  createdAt: ISODateTime
  updatedAt: ISODateTime
}
```

Add `requireCheckout: boolean` to `Project`, and `workerAttendance: WorkerAttendance[]` to `ConstructionDataState`.

- [ ] **Step 4: Seed**

In `src/mock/seed.ts`, add `requireCheckout: false` to every project literal, and `workerAttendance: [],` to the state literal.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/mock/seed.test.ts` (pass), `npx tsc --noEmit`. Fixture states elsewhere may need `workerAttendance: []` and `requireCheckout: false` (add them where typecheck reports).

- [ ] **Step 6: Commit**

```bash
git add src/domain/models.ts src/mock/seed.ts src/mock/seed.test.ts
git commit -m "feat: add the worker attendance record and project checkout policy"
```

---

### Task 2: Pure helpers (date, day state, time validation)

**Files:**
- Create: `src/domain/attendance.ts`
- Test: `src/domain/attendance.test.ts` (create)

**Interfaces:**
- Consumes: `WorkerAttendance` (Task 1).
- Produces: `attendanceDate(instant: Date): ISODate`, `dayState(record: WorkerAttendance | undefined, requireCheckout: boolean): DayState`, `validateTimes(checkInAt?: string, checkOutAt?: string): ConflictError | null` (returns the error instead of throwing, so callers choose).
- `type DayState = "not-recorded" | "absent" | "complete" | "incomplete"`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/attendance.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { attendanceDate, dayState, validateTimes } from "./attendance"
import type { WorkerAttendance } from "./models"

const base: WorkerAttendance = {
  id: "a1", workerId: "w1", projectId: "p1", assignmentId: "as1", date: "2026-10-06",
  recordedBy: "supervisor", createdAt: "2026-10-06T03:00:00.000Z", updatedAt: "2026-10-06T03:00:00.000Z",
}

describe("attendanceDate", () => {
  it("uses the Asia/Kolkata calendar day, not UTC", () => {
    // 2026-10-05T19:00:00Z is 2026-10-06 00:30 in Asia/Kolkata
    expect(attendanceDate(new Date("2026-10-05T19:00:00.000Z"))).toBe("2026-10-06")
  })
})

describe("dayState", () => {
  it("is not-recorded with no record", () => {
    expect(dayState(undefined, false)).toBe("not-recorded")
  })
  it("is absent for an absent status", () => {
    expect(dayState({ ...base, status: "absent" }, true)).toBe("absent")
  })
  it("is complete for a check-in when checkout is not required", () => {
    expect(dayState({ ...base, status: "present", checkInAt: "2026-10-06T03:30:00.000Z" }, false)).toBe("complete")
  })
  it("is incomplete for a check-in without checkout when checkout is required", () => {
    expect(dayState({ ...base, status: "present", checkInAt: "2026-10-06T03:30:00.000Z" }, true)).toBe("incomplete")
  })
  it("is complete once checked out when checkout is required", () => {
    expect(
      dayState({ ...base, status: "present", checkInAt: "2026-10-06T03:30:00.000Z", checkOutAt: "2026-10-06T12:00:00.000Z" }, true),
    ).toBe("complete")
  })
  it("is complete for a supervisor entry with no times when checkout is not required", () => {
    expect(dayState({ ...base, status: "half-day" }, false)).toBe("complete")
  })
  it("is incomplete for a supervisor entry with no times when checkout is required", () => {
    expect(dayState({ ...base, status: "half-day" }, true)).toBe("incomplete")
  })
})

describe("validateTimes", () => {
  it("refuses a check-out without a check-in", () => {
    expect(validateTimes(undefined, "2026-10-06T12:00:00.000Z")?.message).toBe("Check in before you check out.")
  })
  it("refuses a check-out earlier than check-in", () => {
    expect(validateTimes("2026-10-06T12:00:00.000Z", "2026-10-06T03:00:00.000Z")?.message).toBe(
      "Check-out can't be earlier than check-in.",
    )
  })
  it("accepts valid times", () => {
    expect(validateTimes("2026-10-06T03:00:00.000Z", "2026-10-06T12:00:00.000Z")).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/attendance.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/domain/attendance.ts`:

```ts
import { ConflictError } from "./errors"
import type { ISODate, WorkerAttendance } from "./models"

export type DayState = "not-recorded" | "absent" | "complete" | "incomplete"

/** The calendar day in Asia/Kolkata for an instant (spec A5). */
export function attendanceDate(instant: Date): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

/** Computed, never stored (spec §2). */
export function dayState(record: WorkerAttendance | undefined, requireCheckout: boolean): DayState {
  if (!record) return "not-recorded"
  if (record.status === "absent") return "absent"
  const present = record.status === "present" || record.status === "half-day" || !record.status
  if (!present) return "not-recorded"
  if (requireCheckout && !record.checkOutAt) return "incomplete"
  return "complete"
}

/** Returns the refusal, or null when the times are valid (spec A7). */
export function validateTimes(checkInAt?: string, checkOutAt?: string): ConflictError | null {
  if (!checkOutAt) return null
  if (!checkInAt) return new ConflictError("Check in before you check out.")
  if (new Date(checkOutAt) < new Date(checkInAt)) {
    return new ConflictError("Check-out can't be earlier than check-in.")
  }
  return null
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/domain/attendance.test.ts` (all pass), `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/attendance.ts src/domain/attendance.test.ts
git commit -m "feat: attendance date, day state, and time validation helpers"
```

---

### Task 3: Supervisor record, policy, and check-in/out commands

**Files:**
- Create: `src/domain/attendanceCommands.ts`
- Test: `src/domain/attendanceCommands.test.ts` (create)

**Interfaces:**
- Consumes: helpers from Task 2; `authorizeProject` and `Permissions` (WORKFORCE_MANAGE, PROJECT_MANAGE) as the nearby commands use them; `ConflictError`; `Command`, `CommandContext`.
- Produces:
  - `recordAttendance(input: { projectId; workerId; date; status; checkInAt?; checkOutAt? }): Command<WorkerAttendance>`
  - `checkInWorker(input: { projectId; phone; at: string }): Command<WorkerAttendance>`
  - `checkOutWorker(input: { projectId; phone; at: string }): Command<WorkerAttendance>`
  - `setAttendancePolicy(projectId: EntityId, requireCheckout: boolean): Command<Project>`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/attendanceCommands.test.ts` with fixtures built the way `workforceCommands.test.ts` does (manager session for `person-arjun` in `org-buildright`; a seeded worker with a seeded `phone`, active, with an active assignment to a seeded project; a clock). Cover, at minimum:

- `recordAttendance` creates one record for worker, project and date; a second call with the same key updates it and does not add a second record (`workerAttendance` has one entry).
- `recordAttendance` refuses `checkOutAt` without `checkInAt` (message "Check in before you check out.").
- `recordAttendance` refuses a worker with no assignment to the project on that date ("This worker wasn't assigned to the project on that date.").
- `recordAttendance` refuses a worker-role session (manager permission check).
- `checkInWorker` with the worker's phone creates a record with `status "present"`, `checkInAt` set, `recordedBy "worker"`.
- `checkInWorker` a second time on the same date throws "You've already checked in today."
- `checkInWorker` for a worker whose status is `invited` throws "Your account isn't active yet."
- `checkInWorker` for a worker with no active assignment throws "You're not assigned to this project."
- `checkOutWorker` without a check-in throws "Check in before you check out."; with a check-in it sets `checkOutAt`; a second check-out throws "You've already checked out today."
- A worker can check out after the assignment has ended, on a day already checked in (A8); the record is read-only otherwise.
- `setAttendancePolicy` sets `requireCheckout` and refuses a worker-role session.

Use `as never` for input casts if the typed input is awkward in tests (R2 applies).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/attendanceCommands.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the four commands**

Create `src/domain/attendanceCommands.ts`. Use the pattern of `constructionCommands.ts`: `authorizeProject` for `recordAttendance` (WORKFORCE_MANAGE) and `setAttendancePolicy` (PROJECT_MANAGE). The worker commands take a phone, not a session: find the worker in the project's organization with `samePhone` (the same helper Phase 4 uses), require `status === "active"`, and require an active assignment (`status "active"`, no `endedAt`) to the project. Use `attendanceDate(new Date(at))` for the date. Each command returns `{ state, result }` and never mutates its input. Each worker command's docblock says: "Identity is the phone number. This is a stand-in for OTP until Phase 11, not authentication."

- `checkInWorker`: refuse "You've already checked in today." if a record for that date has `checkInAt`. Create the record (assignmentId = the active assignment) or set `checkInAt` and `status` (to `present` when unset). Set `recordedBy "worker"`.
- `checkOutWorker`: refuse "Check in before you check out." without a `checkInAt` that date; refuse "You've already checked out today." when `checkOutAt` is set. Allowed after the assignment has ended (A8): do not require an active assignment for check-out, only that the record exists.
- `recordAttendance`: validate times with `validateTimes`; refuse a record for an ended assignment ("This assignment has ended, so attendance can't be changed."); when the worker has no assignment on that date, refuse. Upsert on (worker, project, date).

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/domain/attendanceCommands.test.ts` (all pass), `npx vitest run` (all pass), `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/attendanceCommands.ts src/domain/attendanceCommands.test.ts
git commit -m "feat: supervisor attendance entry and worker check-in and check-out"
```

---

### Task 4: Reads with role scoping

**Files:**
- Modify: `src/domain/attendanceCommands.ts`
- Test: `src/domain/attendanceCommands.test.ts` (append)

**Interfaces:**
- Produces:
  - `listAttendance(projectId: EntityId, date: ISODate): Command<WorkerAttendance[]>` — requires `PROJECT_READ` on the project; refuses a worker session.
  - `getOwnAttendance(projectId: EntityId, phone: string, date: ISODate): Command<WorkerAttendance | undefined>` — the phone identifies the worker; returns only that record.

- [ ] **Step 1: Write the failing tests**

Append tests: a supervisor with `PROJECT_READ` gets every record for the date; a worker-role session cannot call `listAttendance` (refused); `getOwnAttendance` for worker A returns only A's record and never B's; an unknown phone returns `undefined`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/attendanceCommands.test.ts`
Expected: FAIL (not exported).

- [ ] **Step 3: Implement**

Add `listAttendance` (filter `workerAttendance` by project and date, after `authorizeProject` with `PROJECT_READ`) and `getOwnAttendance` (find the worker by phone in the project's organization, then the record for that worker, project and date). Neither returns another worker's records.

- [ ] **Step 4: Run tests**

Run: `npx vitest run` (all pass), `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/attendanceCommands.ts src/domain/attendanceCommands.test.ts
git commit -m "feat: role-scoped attendance reads for supervisors and workers"
```

---

### Task 5: Provider wiring

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx`

**Interfaces:**
- Consumes: Task 3 and Task 4 commands.

- [ ] **Step 1: Read the reference pattern**

Read `src/mock/ConstructionDataProvider.tsx` (the `run(commands.x(...))` shape used by the Phase 4 workforce commands). Copy it exactly.

- [ ] **Step 2: Expose the commands**

Add `recordAttendance`, `checkInWorker`, `checkOutWorker`, `setAttendancePolicy`, `listAttendance`, `getOwnAttendance` to the provider context, using the same shape. Reads return values directly; writes go through `run`.

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit` (clean) and `npx vitest run` (all pass).

- [ ] **Step 4: Commit**

```bash
git add src/mock/ConstructionDataProvider.tsx
git commit -m "feat: expose attendance commands through the provider"
```

---

### Task 6: Supervisor screens (Workforce row, project section, policy toggle)

**Files:**
- Modify: `src/screens/WorkforceScreen.tsx`
- Modify: `src/screens/ProjectTeamScreen.tsx`

**Interfaces:**
- Consumes: provider commands from Task 5.

- [ ] **Step 1: Read both files in full** and keep their patterns and Hozie cards.

- [ ] **Step 2: Workforce row**: add a "Record attendance" action that opens a small form (date defaults to today in Asia/Kolkata via `attendanceDate(new Date())`, status select, optional check-in and check-out time pickers). Show the worker's day state for today next to the row, using `dayState`.

- [ ] **Step 3: Project team page**: add an "Attendance" section listing the project's workers for a chosen day with their day state (`listAttendance`), with per-row "Record" correction, and a `requireCheckout` switch (visible to users with PROJECT_MANAGE) calling `setAttendancePolicy`.

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` and `npx vitest run`. Do not start a dev server; the controller checks the screens after the branch is complete.

- [ ] **Step 5: Commit**

```bash
git add src/screens/WorkforceScreen.tsx src/screens/ProjectTeamScreen.tsx
git commit -m "feat: supervisors record attendance and set the checkout policy"
```

---

### Task 7: Worker Today check-in and check-out

**Files:**
- Modify: `src/screens/WorkerTodayScreen.tsx`

**Interfaces:**
- Consumes: `checkInWorker`, `checkOutWorker`, `getOwnAttendance` through the provider.

- [ ] **Step 1: Read the screen in full**, keep its layout and Hozie card.

- [ ] **Step 2:** For each active project, show today's day state. Show "Check in" when there is no record for today and the worker is active, "Check out" when checked in and not checked out, and "Check-out needed" when the day is `incomplete`. The worker's phone comes from the signed-in worker record, as the Phase 4 self-accept path does. Refusals show their messages through the existing run helper.

- [ ] **Step 3: Verify** with `npx tsc --noEmit` and `npx vitest run`. No dev server.

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkerTodayScreen.tsx
git commit -m "feat: worker today shows check-in and check-out"
```

---

### Task 8: Attendance history screen and route

**Files:**
- Create: `src/screens/AttendanceHistoryScreen.tsx`
- Modify: `src/domain/navigation.ts` (add route `attendance-history` with project scope, `PROJECT_READ`, requires `project_id`)
- Modify: `src/App.tsx` (render the screen)
- Modify: the project navigation (`src/components/company/companyNav.tsx`, project menu) to add an "Attendance" entry

**Interfaces:**
- Consumes: `listAttendance` through the provider; `attendanceDate`.

- [ ] **Step 1: Read `navigation.ts`, `App.tsx`, and `companyNav.tsx`**, and follow the nearest project-scoped route (for example `workforce` or `tasks`) exactly.

- [ ] **Step 2:** The screen shows a date picker (default today), and a table of workers with status, check-in, check-out, and day state. Ended assignments appear with an "Ended" tag. Keep the Hozie card.

- [ ] **Step 3: Verify** with `npx tsc --noEmit` and `npx vitest run`. Add a route test if the navigation tests have a pattern for it.

- [ ] **Step 4: Commit**

```bash
git add src/screens/AttendanceHistoryScreen.tsx src/domain/navigation.ts src/App.tsx src/components/company/companyNav.tsx
git commit -m "feat: attendance history screen per project"
```

---

### Task 9: Final verification

- [ ] **Step 1:** `npx vitest run` (report the count), `npx tsc --noEmit` (clean), `npm run build` (success).
- [ ] **Step 2:** `git diff --stat main..HEAD`: only the files in File Structure plus the spec and plan.
- [ ] **Step 3:** Report the test count, typecheck and build results, and the commit list. The browser walkthrough follows the merge.
