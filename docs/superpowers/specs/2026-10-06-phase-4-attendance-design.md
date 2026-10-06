# Phase 4 — Worker Attendance Design

**Status:** Revised after spec review; awaiting approval

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §Phase 4 (`WorkerAttendance` entity; Attendance screen). `Houzeify_Master_Plan_v0_2_FINAL.md` FR-048 (authorized supervisors or contractors record or verify attendance, linked to project, date, worker, and assignment or policy), Worker Home (check-in and check-out status; history per project policy), and the reassignment rule (history stays on the project after unassignment).

## Goal

Record whether each assigned worker was on site for a project on a given day, and when they checked in and out. A supervisor can record attendance for the team, and a worker can check in and out on their own record. History is kept per project and survives reassignment.

## Explicitly out of scope

- Device location or geofencing.
- QR-based attendance. The join code is for onboarding only.
- Payroll, overtime, wage calculation, and leave balances.
- Attendance reports and exports (a later reporting phase).
- Verification by contractors, and a contractor role. FR-048's "verify" is deferred; this phase supports recording by supervisors only.
- Real authentication for worker check-in. The phone-number stand-in from Phase 4 applies (see §5).
- A worker profile or a worker-facing history screen. Workers see their own day state on Today only.

## Decisions

- **A1. Capture: supervisor entry and worker self check-in.** Both write the same record. A worker checks in and out only for themselves and only for a project where they are active today.
- **A2. No device location in this phase.**
- **A3. One record per worker, per project, per day.** Fields: check-in time, check-out time, and status (`present`, `absent`, `half-day`). A supervisor sets any status and any time. A worker's check-in sets the status to `present` if none is set. A worker's check-out sets only the check-out time.
- **A4. Per-project policy: `requireCheckout`.** Default `false`. A supervisor with `PROJECT_MANAGE` sets it with `setAttendancePolicy`. When true, a present or half-day record without a check-out is `incomplete`.
- **A5. Dates use the project's timezone, `Asia/Kolkata`, for this prototype.** The project does not store a timezone yet. The `date` is derived from the check-in or the supervisor's chosen date, in that zone. A later phase adds a per-project timezone.
- **A6. Repeat check-in is refused.** A second check-in on the same day is refused, and a supervisor corrects a wrong time instead.
- **A7. A check-out needs a check-in.** Both a supervisor entry and a worker check-out refuse a check-out time without a check-in time on that record.
- **A8. A worker can always close a day they opened.** A worker can check out for a day that has a check-in, even after the assignment has ended. The day is closed; no new check-in is accepted.
- **A9. A day belongs to the project, and its `assignmentId` is the assignment active on that date.** If a worker is unassigned and reassigned to the same project on the same day, the day keeps the first assignment.

## 1. Data model

Added to `src/domain/models.ts`:

```ts
export type AttendanceStatus = "present" | "absent" | "half-day"

export interface WorkerAttendance {
  id: EntityId
  workerId: EntityId
  projectId: EntityId
  /** The assignment active on this date (A9). Kept after the assignment ends. */
  assignmentId: EntityId
  /** Calendar day in Asia/Kolkata, YYYY-MM-DD (A5). */
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

Changes to existing types:

- `Project` gains `requireCheckout: boolean`, default `false` (A4).
- `ConstructionDataState` gains `workerAttendance: WorkerAttendance[]`.

**Invariants**

- At most one `WorkerAttendance` per worker, project, and date.
- `checkOutAt` is set only when `checkInAt` is set, and is not earlier than it (A7).
- A record is never deleted. Corrections overwrite fields and update `updatedAt`.
- A record for a day after the worker's assignment ended is read-only, except for a worker's check-out on a day already checked in (A8).

## 2. Day state

Computed, not stored:

| Condition | Day state |
|---|---|
| No record | `not-recorded` |
| `status` is `absent` | `absent` |
| `status` is `present` or `half-day`, and `checkInAt` is set, and (`requireCheckout` is false or `checkOutAt` is set) | `complete` |
| `status` is `present` or `half-day`, `checkInAt` is set, `requireCheckout` is true, and `checkOutAt` is unset | `incomplete` |
| `status` is `present` or `half-day`, `checkInAt` is unset (supervisor entry with no times) | `complete` when `requireCheckout` is false; `incomplete` when true |

## 3. Commands and reads

In a new `src/domain/attendanceCommands.ts`. All refusals are `ConflictError` with the messages in §6.

**Writes**

- `recordAttendance({ projectId, workerId, date, status, checkInAt?, checkOutAt? })` — supervisor entry or correction. Permission: `WORKFORCE_MANAGE` on the project. Refuses an unknown worker or project; a worker with no assignment to the project on that date; `checkOutAt` without `checkInAt` (A7); a `checkOutAt` earlier than `checkInAt`; and a record for an ended assignment.
- `checkInWorker({ projectId, phone, at })` — worker self check-in. Identity is the phone (§5). Refuses unless the worker's status is `active` (Phase 4), the worker has an active assignment to the project today, and there is no check-in yet for that date (A6). Sets the status to `present` if unset and sets `checkInAt`.
- `checkOutWorker({ projectId, phone, at })` — worker self check-out. Refuses without a check-in for that date and refuses a second check-out. Allowed after the assignment has ended (A8).
- `setAttendancePolicy(projectId, requireCheckout)` — Permission: `PROJECT_MANAGE`.

**Reads**

- `listAttendance(projectId, date)` — supervisors with `PROJECT_READ` on the project see every worker's record for that day.
- `getOwnAttendance(projectId, phone, date)` — a worker sees only their own record, matched by phone (§5).
- Neither read command returns another worker's records to a worker session.

Every write sets `updatedAt`, and the date is in Asia/Kolkata (A5).

## 4. Screens

- **Workforce** (existing): row action "Record attendance" opens a form for a date, a status, and optional times. The row shows today's day state.
- **Project team** (existing): an "Attendance" section lists the project's workers for the selected day with their day state, and lets a supervisor record or correct it. Includes the `requireCheckout` toggle for supervisors with `PROJECT_MANAGE`.
- **Worker Today** (existing): shows today's check-in and check-out status for each active project, with "Check in" and "Check out" buttons where allowed, and "Check-out needed" for an `incomplete` day.
- **Attendance history** per project: a table of dates, workers, status, and times, read through `listAttendance`. Ended assignments appear, marked "Ended".

Each changed screen keeps its Hozie insight card with factual copy only.

## 5. Identity and permissions

- Supervisors use `WORKFORCE_MANAGE` for writes and `PROJECT_READ` for reads, as other project screens do.
- Worker self check-in and check-out identify the worker by phone, matched exactly within the organization that owns the project, as Phase 4 does for duplicate phones. This is a stand-in until Phase 11 and is not authentication. The docblock on each worker command must say so.
- A worker's records are readable only by that worker. A worker session cannot read another worker's records.

## 6. Error messages

- Check-out before check-in, or without a check-in: "Check in before you check out."
- Second check-in on the same day: "You've already checked in today."
- Check-out already recorded: "You've already checked out today."
- Check-out earlier than check-in: "Check-out can't be earlier than check-in."
- No active assignment: "You're not assigned to this project."
- Worker not active: "Your account isn't active yet."
- Unknown worker or project: "That worker or project no longer exists."
- Supervisor writes a day with no assignment: "This worker wasn't assigned to the project on that date."
- Ended assignment, supervisor write: "This assignment has ended, so attendance can't be changed."

## 7. Testing

Domain tests (Vitest):

- `recordAttendance` creates one record per worker, project, and date; a second call updates it.
- The day state table in §2, with `requireCheckout` true and false, including status-only entries.
- `checkInWorker` sets `present` and the time; a second check-in is refused (A6).
- `checkOutWorker` refuses without a check-in and refuses a second check-out.
- A check-out without a check-in is refused for both supervisors and workers (A7).
- A worker can check out after their assignment ended, on a day already checked in (A8).
- Reassignment on the same day keeps the first assignment on the record (A9).
- Reads: a supervisor with `PROJECT_READ` sees all records for a day; a worker sees only their own; a worker session cannot call `listAttendance`.
- A worker who is not active cannot check in.
- A worker cannot check in for a project without an active assignment, nor for another worker's phone.
- The phone match is scoped to the organization.
- Writes by a worker-role session to `recordAttendance` and `setAttendancePolicy` are refused.
- Dates are derived in Asia/Kolkata, including a check-in just after midnight UTC.

Browser walkthrough (separate page sessions for business and worker roles): supervisor records a day; the worker checks in and out on Today; the Workforce row updates; end the assignment and confirm history remains and is read-only.

## 8. Build-plan alignment

- `WorkerAttendance` is a first-class record linked to project, worker, and assignment, as the Phase 4 entity list requires.
- History stays on the project after unassignment, matching the master plan's reassignment rule.
- Verification by contractors (FR-048) is deferred with the contractor role.
- Attendance stays separate from the worker profile, which is still deferred.
