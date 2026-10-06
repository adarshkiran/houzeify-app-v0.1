# Phase 4 — Worker Attendance Design

**Status:** Draft for review

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §Phase 4 (`WorkerAttendance` entity; Attendance screen). `Houzeify_Master_Plan_v0_2_FINAL.md` FR-048 (record or verify attendance by authorized supervisors or contractors; linked to project, date, worker, and assignment or policy), Worker Home (check-in and check-out status; history per project policy), and the reassignment rule (history stays on the project record after unassignment).

## Goal

Record whether each assigned worker was on site for a project on a given day, and when they checked in and out. A supervisor can record attendance for the team, and a worker can check in and out themselves. History is kept per project and survives reassignment.

## Explicitly out of scope

- Device location or geofencing. Browser location needs permission and is deferred.
- QR-based attendance. The join code is for onboarding only.
- Payroll, overtime, wage calculation, and leave balances.
- Per-project rule engines. The project has one simple setting (see decision A4).
- Attendance reports and exports (a later reporting phase).
- Real authentication for worker check-in. The phone-number stand-in from Phase 4 applies (see §5).

## Decisions

These answer the open questions from the audit and the master plan.

- **A1. Capture methods: supervisor entry and worker self check-in.** Both write the same record. A supervisor can enter or correct any worker's attendance for their project. A worker can check in and check out on their own record for a project they are actively assigned to.
- **A2. No device location in this phase.**
- **A3. One record per worker, per project, per day.** Fields: check-in time, check-out time, and status (`present`, `absent`, `half-day`). Status is set by the supervisor. A worker's self check-in sets `present` and the check-in time. A check-out sets the check-out time.
- **A4. Per-project policy: one boolean, `requireCheckout`.** When true, a day is `incomplete` until a check-out is recorded. When false, a check-in alone is a complete day. Default false.

## 1. Data model

Added to `src/domain/models.ts`:

```ts
export type AttendanceStatus = "present" | "absent" | "half-day"

export interface WorkerAttendance {
  id: EntityId
  workerId: EntityId
  projectId: EntityId
  /** The assignment this day's attendance belongs to. Kept after the assignment ends. */
  assignmentId: EntityId
  /** Calendar day in the project's local time, YYYY-MM-DD. */
  date: ISODate
  status?: AttendanceStatus
  checkInAt?: ISODateTime
  checkOutAt?: ISODateTime
  recordedByMembershipId?: EntityId
  recordedBy: "supervisor" | "worker"
  createdAt: ISODateTime
  updatedAt: ISODateTime
}
```

Changes to existing types:

- `Project` gains `requireCheckout: boolean` (default `false`).
- `ConstructionDataState` gains `workerAttendance: WorkerAttendance[]`.

**Invariants**

- At most one `WorkerAttendance` per worker, project, and date. A repeat check-in on the same day updates that record; it does not create a second one.
- `checkOutAt`, when set, is not earlier than `checkInAt`.
- A record for a worker whose assignment has ended is read-only. History is kept.
- An attendance record is never deleted. Corrections overwrite the field and update `updatedAt`.

## 2. Day status

Computed, not stored:

| Condition | Day state |
|---|---|
| No record | `not-recorded` |
| `status` is `absent` | `absent` |
| `status` is `present` or `half-day`, `checkInAt` set, and (`requireCheckout` is false, or `checkOutAt` is set) | `complete` |
| `status` is `present` or `half-day`, `checkInAt` set, `requireCheckout` true, `checkOutAt` unset | `incomplete` |
| `status` is set but there is no check-in (supervisor entry without a time) | `complete` |

A supervisor entry sets `status` directly and may leave the times blank.

## 3. Commands

In a new `src/domain/attendanceCommands.ts` (keeps `constructionCommands.ts` from growing further). All refusals are `ConflictError` with plain messages.

- `recordAttendance({ projectId, workerId, date, status, checkInAt?, checkOutAt? })` — supervisor entry or correction. Permission: `WORKFORCE_MANAGE` on the project. Refuses an unknown worker or project, a worker with no assignment to the project on that date, a `checkOutAt` earlier than `checkInAt`, and a read-only (ended) assignment.
- `checkInWorker({ projectId, workerId, at })` — worker self check-in. Permission: the worker's own session, with the phone stand-in (see §5). Sets `status` to `present` if unset, and sets `checkInAt`. Refuses a second check-in for the same day, and refuses if the worker has no active assignment to the project.
- `checkOutWorker({ projectId, workerId, at })` — worker self check-out. Refuses without a check-in on that day, and refuses a check-out already recorded.

Every command writes an `updatedAt` timestamp and uses the project's local date for `date`.

## 4. Screens

- **Workforce** (existing): a row action "Record attendance" opens a small form for a date, a status, and optional times. The worker row shows today's day state.
- **Project team or project page** (existing): an "Attendance" section lists this project's workers for the selected day with their day state, and lets a supervisor record or correct it.
- **Worker Today** (existing): shows today's check-in and check-out status for each active project, with "Check in" and "Check out" buttons when allowed. Shows "Check-out needed" when a day is `incomplete`.
- **Attendance history** per project: a table of dates, workers, status, and times. It includes ended assignments, marked "Ended".

Each changed screen keeps its Hozie insight card with factual copy only.

## 5. Identity and permissions

- Supervisors use `WORKFORCE_MANAGE` on the project, as other workforce commands do.
- Worker self check-in uses the worker's phone, matched against the worker record exactly as the Phase 4 self-accept path does. This is a stand-in until Phase 11 and is not authentication. The domain command's docblock must say so.
- A worker may check in or out only for a project where they hold an active assignment today.
- A worker may not read or change another worker's attendance.

## 6. Error handling

- Check-out before check-in: "Check in before you check out."
- Second check-in on the same day: "You've already checked in today."
- No active assignment: "You're not assigned to this project."
- Ended assignment: "This assignment has ended, so attendance can't be changed."
- Check-out earlier than check-in: "Check-out can't be earlier than check-in."

## 7. Testing

Domain tests (Vitest):

- `recordAttendance` creates one record per worker, project, and date; a second call updates it.
- The day state table in §2, including `requireCheckout` true and false.
- `checkInWorker` sets `present` and the time; a second check-in is refused.
- `checkOutWorker` refuses without a check-in and refuses a second check-out.
- The invariant: a check-out is never earlier than the check-in.
- An ended assignment's records are read-only, and reassignment does not remove history.
- A worker cannot check in for a project without an active assignment, and cannot check in for another worker.
- A supervisor-only command refuses a worker session (`WORKFORCE_MANAGE`).

Browser walkthrough (business and worker roles, separate page sessions because of in-memory state): supervisor records a day; worker checks in and out on Today; the day state updates on the Workforce row; end the assignment and confirm the history remains and is read-only.

## 8. Build-plan alignment

- `WorkerAttendance` is a first-class record, linked to project, worker, and assignment, as the build plan's Phase 4 entity list requires.
- Attendance history stays on the project after unassignment, matching the master plan's reassignment rule.
- Attendance remains separate from the worker profile, which is still deferred.
