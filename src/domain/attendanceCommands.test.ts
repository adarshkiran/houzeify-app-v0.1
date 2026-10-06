import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import { PermissionError } from "./session"
import {
  checkInWorker,
  checkOutWorker,
  getOwnAttendance,
  listAttendance,
  recordAttendance,
  setAttendancePolicy,
} from "./attendanceCommands"
import { Permissions } from "./permissions"
import type { ConstructionDataState, ProjectMembership, WorkerAttendance, WorkerProjectAssignment } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const project = seed.projects[0]
const ORG = project.organizationId
const PHONE = "+91 98765 43210"
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: ORG }
const stranger: Session = { accountType: "worker", personId: "person-nobody", organizationId: ORG }
const clock: Clock = { now: () => new Date("2026-10-06T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })
const asAt = (actor: Session | null, now: string): CommandContext => ({
  actor,
  clock: { now: () => new Date(now) },
  ids: ids(),
})
const workerActor = (phone: string | undefined = PHONE): Session => ({
  accountType: "worker",
  personId: "person-worker-test",
  organizationId: ORG,
  ...(phone === undefined ? {} : { phone }),
})
const OWN_ONLY = "You can only check in or out for yourself."

const CHECK_IN = "2026-10-06T03:30:00.000Z" // 09:00 in Asia/Kolkata
const CHECK_OUT = "2026-10-06T12:00:00.000Z"
const TODAY = "2026-10-06"

/**
 * A seeded worker in the project's organization with a phone and an active
 * assignment to the project, started before today. Built here so the tests do
 * not depend on seed ids that other fixtures may change.
 */
function fixture(options: { status?: "active" | "invited"; assignment?: Partial<WorkerProjectAssignment> | null } = {}) {
  const base = seed.workers[seed.workers.length - 1]
  const worker = { ...base, organizationId: ORG, phone: PHONE, status: options.status ?? "active" }
  const assignment: WorkerProjectAssignment | null =
    options.assignment === null
      ? null
      : {
          id: "assignment-test",
          workerId: worker.id,
          projectId: project.id,
          projectUnitIds: [],
          tradeIds: worker.tradeIds.slice(0, 1),
          role: "worker",
          status: "active",
          startedAt: "2026-09-01T09:00:00.000Z",
          assignedAt: "2026-09-01T09:00:00.000Z",
          ...options.assignment,
        }
  const state: ConstructionDataState = {
    ...seed,
    workers: seed.workers.map((item) => (item.id === worker.id ? worker : item)),
    workerProjectAssignments: [
      ...seed.workerProjectAssignments.filter((item) => item.workerId !== worker.id),
      ...(assignment ? [assignment] : []),
    ],
    workerAttendance: [],
  }
  return { state, worker, assignment }
}

function recordFor(state: ConstructionDataState, workerId: string, overrides: Partial<WorkerAttendance> = {}): ConstructionDataState {
  const record: WorkerAttendance = {
    id: "attendance-existing",
    workerId,
    projectId: project.id,
    assignmentId: "assignment-test",
    date: TODAY,
    recordedBy: "worker",
    createdAt: "2026-10-06T03:30:00.000Z",
    updatedAt: "2026-10-06T03:30:00.000Z",
    ...overrides,
  }
  return { ...state, workerAttendance: [...state.workerAttendance, record] }
}

describe("recordAttendance", () => {
  const input = { projectId: project.id, date: TODAY, status: "present" as const, checkInAt: CHECK_IN }

  it("creates one record for the worker, project and date, and a second call updates it", () => {
    const { state } = fixture()
    const workerId = state.workerProjectAssignments.find((a) => a.id === "assignment-test")!.workerId
    const first = recordAttendance({ ...input, workerId })(state, as(manager))
    expect(first.result.recordedBy).toBe("supervisor")
    expect(first.result.assignmentId).toBe("assignment-test")

    const second = recordAttendance({ ...input, workerId, status: "half-day", checkOutAt: CHECK_OUT })(first.state, as(manager))
    const matches = second.state.workerAttendance.filter(
      (r) => r.workerId === workerId && r.projectId === project.id && r.date === TODAY,
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].status).toBe("half-day")
    expect(matches[0].checkOutAt).toBe(CHECK_OUT)
    expect(matches[0].id).toBe(first.result.id)
  })

  it("refuses a check-out without a check-in", () => {
    const { state, worker } = fixture()
    expect(() =>
      recordAttendance({ projectId: project.id, workerId: worker.id, date: TODAY, status: "present", checkOutAt: CHECK_OUT })(
        state,
        as(manager),
      ),
    ).toThrow(new ConflictError("Check in before you check out."))
  })

  it("refuses a worker with no assignment to the project on that date", () => {
    const { state, worker } = fixture()
    expect(() =>
      recordAttendance({ ...input, workerId: worker.id, date: "2026-08-01" })(state, as(manager)),
    ).toThrow("This worker wasn't assigned to the project on that date.")
  })

  it("refuses a record for an ended assignment", () => {
    const { state, worker } = fixture({ assignment: { endedAt: "2026-10-01T09:00:00.000Z", status: "inactive", endReason: "left-project" } })
    expect(() => recordAttendance({ ...input, workerId: worker.id })(state, as(manager))).toThrow(
      "This assignment has ended, so attendance can't be changed.",
    )
  })

  it("refuses a day that falls inside an assignment that has ended (R9)", () => {
    const { state, worker } = fixture({ assignment: { endedAt: "2026-09-30T09:00:00.000Z", status: "inactive", endReason: "left-project" } })
    expect(() =>
      recordAttendance({ projectId: project.id, workerId: worker.id, date: "2026-09-15", status: "present", checkInAt: CHECK_IN })(
        state,
        as(manager),
      ),
    ).toThrow(new ConflictError("This assignment has ended, so attendance can't be changed."))
  })

  it("writes a day that falls inside an active assignment", () => {
    const { state, worker } = fixture()
    const { result } = recordAttendance({ projectId: project.id, workerId: worker.id, date: "2026-09-15", status: "present", checkInAt: CHECK_IN })(
      state,
      as(manager),
    )
    expect(result.assignmentId).toBe("assignment-test")
  })

  it("refuses a worker-role session", () => {
    const { state, worker } = fixture()
    expect(() => recordAttendance({ ...input, workerId: worker.id })(state, as(stranger))).toThrow(PermissionError)
  })

  it("does not mutate its input state", () => {
    const { state, worker } = fixture()
    const before = JSON.stringify(state)
    recordAttendance({ ...input, workerId: worker.id })(state, as(manager))
    expect(JSON.stringify(state)).toBe(before)
  })

  it("keeps the first assignment when the worker is reassigned to the project the same day (A9)", () => {
    const { state, worker } = fixture()
    const first = recordAttendance({ ...input, workerId: worker.id })(state, as(manager))
    expect(first.result.assignmentId).toBe("assignment-test")

    // End the first assignment later that day, then assign the worker again on the same project.
    const reassigned: ConstructionDataState = {
      ...first.state,
      workerProjectAssignments: [
        // Listed first so the fallback (first covering assignment) would pick it over "assignment-test".
        {
          ...first.state.workerProjectAssignments.find((item) => item.id === "assignment-test")!,
          id: "assignment-second",
          startedAt: "2026-10-06T09:00:00.000Z",
          assignedAt: "2026-10-06T09:00:00.000Z",
          endedAt: undefined,
          status: "active" as const,
          endReason: undefined,
        },
        ...first.state.workerProjectAssignments.map((item) =>
          item.id === "assignment-test"
            ? { ...item, endedAt: "2026-10-06T08:00:00.000Z", status: "inactive" as const, endReason: "removed" as const }
            : item,
        ),
      ],
    }
    const corrected = recordAttendance({ ...input, workerId: worker.id, checkOutAt: CHECK_OUT })(reassigned, as(manager))
    expect(corrected.result.id).toBe(first.result.id)
    expect(corrected.result.assignmentId).toBe("assignment-test")
  })
})

describe("checkInWorker", () => {
  const checkIn = (phone = PHONE) => checkInWorker({ projectId: project.id, phone })

  it("creates a present record stamped with the server clock, recorded by the worker", () => {
    const { state } = fixture()
    const { result } = checkIn()(state, asAt(workerActor(), CHECK_IN))
    expect(result.status).toBe("present")
    expect(result.checkInAt).toBe(CHECK_IN)
    expect(result.recordedBy).toBe("worker")
    expect(result.date).toBe(TODAY)
  })

  it("uses the server clock, not a caller-supplied time (R8)", () => {
    const { state } = fixture()
    const backdated = { projectId: project.id, phone: PHONE, at: CHECK_OUT }
    const { result } = checkInWorker(backdated)(state, asAt(workerActor(), CHECK_IN))
    expect(result.checkInAt).toBe(CHECK_IN)
    expect(result.date).toBe(TODAY)
  })

  it("refuses a null actor", () => {
    const { state } = fixture()
    expect(() => checkIn()(state, asAt(null, CHECK_IN))).toThrow(new ConflictError(OWN_ONLY))
  })

  it("refuses a worker session with a different phone", () => {
    const { state } = fixture()
    expect(() => checkIn()(state, asAt(workerActor("+91 00000 00000"), CHECK_IN))).toThrow(new ConflictError(OWN_ONLY))
  })

  it("refuses a worker session with no phone", () => {
    const { state } = fixture()
    const noPhone: Session = { accountType: "worker", personId: "person-worker-test", organizationId: ORG }
    expect(() => checkIn()(state, asAt(noPhone, CHECK_IN))).toThrow(new ConflictError(OWN_ONLY))
  })

  it("refuses a business session, even one whose phone matches", () => {
    const { state } = fixture()
    const business = { ...manager, phone: PHONE } as Session
    expect(() => checkIn()(state, asAt(business, CHECK_IN))).toThrow(new ConflictError(OWN_ONLY))
  })

  it("refuses a second check-in on the same day", () => {
    const { state } = fixture()
    const once = checkIn()(state, asAt(workerActor(), CHECK_IN))
    expect(() => checkIn()(once.state, asAt(workerActor(), CHECK_OUT))).toThrow("You've already checked in today.")
  })

  it("records the Asia/Kolkata date, so a check-in just before UTC midnight is the next day", () => {
    const { state } = fixture()
    const late = checkIn()(state, asAt(workerActor(), "2026-10-05T18:45:00.000Z"))
    expect(late.result.date).toBe("2026-10-06")
    const nextDay = checkIn()(state, asAt(workerActor(), "2026-10-06T18:45:00.000Z"))
    expect(nextDay.result.date).toBe("2026-10-07")
  })

  it("does not match a worker in another organization with the same phone", () => {
    const { state, worker } = fixture()
    const otherOrg: ConstructionDataState = {
      ...state,
      workers: state.workers.map((item) => (item.id === worker.id ? { ...item, organizationId: "organization-other" } : item)),
    }
    expect(() => checkIn()(otherOrg, asAt(workerActor(), CHECK_IN))).toThrow("That worker or project no longer exists.")
  })

  it("does not mutate its input state", () => {
    const { state } = fixture()
    const before = JSON.stringify(state)
    checkIn()(state, asAt(workerActor(), CHECK_IN))
    expect(JSON.stringify(state)).toBe(before)
  })

  it("refuses a worker whose status is invited", () => {
    const { state } = fixture({ status: "invited" })
    expect(() => checkIn()(state, asAt(workerActor(), CHECK_IN))).toThrow("Your account isn't active yet.")
  })

  it("refuses a worker with no active assignment to the project", () => {
    const { state } = fixture({ assignment: null })
    expect(() => checkIn()(state, asAt(workerActor(), CHECK_IN))).toThrow("You're not assigned to this project.")
  })

  it("refuses a phone that matches no worker in the project's organization", () => {
    const { state } = fixture()
    const unknown = "+91 00000 00000"
    expect(() => checkIn(unknown)(state, asAt(workerActor(unknown), CHECK_IN))).toThrow(
      "That worker or project no longer exists.",
    )
  })
})

describe("checkOutWorker", () => {
  const checkOut = (phone = PHONE) => checkOutWorker({ projectId: project.id, phone })

  it("refuses a check-out without a check-in", () => {
    const { state } = fixture()
    expect(() => checkOut()(state, asAt(workerActor(), CHECK_OUT))).toThrow("Check in before you check out.")
  })

  it("sets the check-out time from the server clock on a day already checked in", () => {
    const { state, worker } = fixture()
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const { result } = checkOut()(checkedIn, asAt(workerActor(), CHECK_OUT))
    expect(result.checkOutAt).toBe(CHECK_OUT)
    expect(result.checkInAt).toBe(CHECK_IN)
  })

  it("uses the server clock, not a caller-supplied time (R8)", () => {
    const { state, worker } = fixture()
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const backdated = { projectId: project.id, phone: PHONE, at: "2026-10-06T04:00:00.000Z" }
    const { result } = checkOutWorker(backdated)(checkedIn, asAt(workerActor(), CHECK_OUT))
    expect(result.checkOutAt).toBe(CHECK_OUT)
  })

  it("refuses a null actor", () => {
    const { state, worker } = fixture()
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    expect(() => checkOut()(checkedIn, asAt(null, CHECK_OUT))).toThrow(new ConflictError(OWN_ONLY))
  })

  it("refuses a worker session with a different phone", () => {
    const { state, worker } = fixture()
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    expect(() => checkOut()(checkedIn, asAt(workerActor("+91 00000 00000"), CHECK_OUT))).toThrow(
      new ConflictError(OWN_ONLY),
    )
  })

  it("refuses a business session", () => {
    const { state, worker } = fixture()
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    expect(() => checkOut()(checkedIn, asAt(manager, CHECK_OUT))).toThrow(new ConflictError(OWN_ONLY))
  })

  it("refuses a second check-out", () => {
    const { state, worker } = fixture()
    const closed = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN, checkOutAt: CHECK_OUT })
    expect(() => checkOut()(closed, asAt(workerActor(), CHECK_OUT))).toThrow("You've already checked out today.")
  })

  it("allows a check-out after the assignment has ended, on a day already checked in (A8)", () => {
    const { state, worker } = fixture({
      assignment: { endedAt: "2026-10-06T09:00:00.000Z", status: "inactive", endReason: "removed" },
    })
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const { result } = checkOut()(checkedIn, asAt(workerActor(), CHECK_OUT))
    expect(result.checkOutAt).toBe(CHECK_OUT)
  })

  it("closes a day for a worker deactivated after checking in (A8, R5)", () => {
    const { state, worker } = fixture()
    const { state: checkedIn } = checkInWorker({ projectId: project.id, phone: PHONE })(state, asAt(workerActor(), CHECK_IN))
    const deactivated: ConstructionDataState = {
      ...checkedIn,
      workers: checkedIn.workers.map((item) => (item.id === worker.id ? { ...item, status: "inactive" } : item)),
    }
    const { result } = checkOut()(deactivated, asAt(workerActor(), CHECK_OUT))
    expect(result.checkOutAt).toBe(CHECK_OUT)
    expect(result.checkInAt).toBe(CHECK_IN)
  })

  it("does not mutate its input state", () => {
    const { state, worker } = fixture()
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const before = JSON.stringify(checkedIn)
    checkOut()(checkedIn, asAt(workerActor(), CHECK_OUT))
    expect(JSON.stringify(checkedIn)).toBe(before)
  })

  it("refuses a new check-in after the assignment has ended (A8)", () => {
    const { state } = fixture({
      assignment: { endedAt: "2026-10-06T09:00:00.000Z", status: "inactive", endReason: "removed" },
    })
    expect(() => checkInWorker({ projectId: project.id, phone: PHONE })(state, asAt(workerActor(), CHECK_IN))).toThrow("You're not assigned to this project.")
  })
})

describe("setAttendancePolicy", () => {
  it("sets requireCheckout on the project", () => {
    const { state } = fixture()
    const { state: next, result } = setAttendancePolicy(project.id, true)(state, as(manager))
    expect(result.requireCheckout).toBe(true)
    expect(next.projects.find((p) => p.id === project.id)!.requireCheckout).toBe(true)
  })

  it("does not mutate its input state", () => {
    const { state } = fixture()
    const before = JSON.stringify(state)
    setAttendancePolicy(project.id, true)(state, as(manager))
    expect(JSON.stringify(state)).toBe(before)
  })

  it("refuses a worker-role session", () => {
    const { state } = fixture()
    expect(() => setAttendancePolicy(project.id, true)(state, as(stranger))).toThrow(PermissionError)
  })
})

describe("listAttendance", () => {
  it("returns every record for the date to a supervisor with PROJECT_READ", () => {
    const { state, worker } = fixture()
    const other = seed.workers.find((item) => item.id !== worker.id && item.organizationId === ORG)!
    let next = recordFor(state, worker.id, { id: "attendance-a", status: "present", checkInAt: CHECK_IN })
    next = recordFor(next, other.id, { id: "attendance-b", status: "absent" })
    next = recordFor(next, worker.id, { id: "attendance-old", date: "2026-10-05" })
    const { result } = listAttendance(project.id, TODAY)(next, as(manager))
    expect(result.map((item) => item.id).sort()).toEqual(["attendance-a", "attendance-b"])
  })

  it("refuses a worker-role session even when it holds an active PROJECT_READ membership", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const workerMembership: ProjectMembership = {
      id: "membership-worker-test",
      projectId: project.id,
      principalType: "person",
      principalId: "person-worker-test",
      role: "worker",
      scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
      permissions: [Permissions.PROJECT_READ],
      status: "active",
    }
    const withMembership: ConstructionDataState = {
      ...withRecord,
      memberships: [...withRecord.memberships, workerMembership],
    }
    const workerSession: Session = { accountType: "worker", personId: "person-worker-test", organizationId: ORG }
    expect(() => listAttendance(project.id, TODAY)(withMembership, as(workerSession))).toThrow(
      new ConflictError("Only the project's team can see attendance for the day."),
    )
  })

  it("refuses a business session with no membership on the project", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const outsider: Session = { accountType: "business", personId: "person-nobody", organizationId: ORG }
    expect(() => listAttendance(project.id, TODAY)(withRecord, as(outsider))).toThrow(PermissionError)
  })

  it("does not mutate its input state", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const before = JSON.stringify(withRecord)
    listAttendance(project.id, TODAY)(withRecord, as(manager))
    expect(JSON.stringify(withRecord)).toBe(before)
  })
})

describe("getOwnAttendance", () => {
  const workerSession = (phone?: string): Session => ({
    accountType: "worker",
    personId: "person-worker-own",
    organizationId: ORG,
    ...(phone === undefined ? {} : { phone }),
  })

  it("lets a worker session with the matching phone read its own record", () => {
    const { state, worker } = fixture()
    const other = seed.workers.find((item) => item.id !== worker.id && item.organizationId === ORG)!
    let next = recordFor(state, worker.id, { id: "attendance-a", status: "present", checkInAt: CHECK_IN })
    next = recordFor(next, other.id, { id: "attendance-b", status: "absent" })
    const { result } = getOwnAttendance(project.id, PHONE, TODAY)(next, as(workerSession(PHONE)))
    expect(result?.id).toBe("attendance-a")
    expect(result?.workerId).toBe(worker.id)
  })

  it("refuses a worker session whose phone differs from the argument", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    expect(() =>
      getOwnAttendance(project.id, PHONE, TODAY)(withRecord, as(workerSession("+91 00000 00000"))),
    ).toThrow(new ConflictError("You can only see your own attendance."))
  })

  it("refuses a worker session that has no phone", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    expect(() => getOwnAttendance(project.id, PHONE, TODAY)(withRecord, as(workerSession()))).toThrow(
      new ConflictError("You can only see your own attendance."),
    )
  })

  it("lets a business session with PROJECT_READ read any worker's record", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { id: "attendance-a", status: "present", checkInAt: CHECK_IN })
    const { result } = getOwnAttendance(project.id, PHONE, TODAY)(withRecord, as(manager))
    expect(result?.id).toBe("attendance-a")
  })

  it("refuses a business session without PROJECT_READ on the project", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const outsider: Session = { accountType: "business", personId: "person-nobody", organizationId: ORG }
    expect(() => getOwnAttendance(project.id, PHONE, TODAY)(withRecord, as(outsider))).toThrow(
      new ConflictError("You can only see your own attendance."),
    )
  })

  it("refuses an anonymous caller", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    expect(() => getOwnAttendance(project.id, PHONE, TODAY)(withRecord, as(null))).toThrow(
      new ConflictError("You can only see your own attendance."),
    )
  })

  it("returns undefined for an unknown phone when the worker session matches it", () => {
    const { state, worker } = fixture()
    const withRecord = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const { result } = getOwnAttendance(project.id, "+91 00000 00000", TODAY)(
      withRecord,
      as(workerSession("+91 00000 00000")),
    )
    expect(result).toBeUndefined()
  })
})
