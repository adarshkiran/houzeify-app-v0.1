import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import { PermissionError } from "./session"
import { checkInWorker, checkOutWorker, recordAttendance, setAttendancePolicy } from "./attendanceCommands"
import type { ConstructionDataState, WorkerAttendance, WorkerProjectAssignment } from "./models"
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
})

describe("checkInWorker", () => {
  it("creates a present record with the check-in time, recorded by the worker", () => {
    const { state } = fixture()
    const { result } = checkInWorker({ projectId: project.id, phone: PHONE, at: CHECK_IN })(state, as(null))
    expect(result.status).toBe("present")
    expect(result.checkInAt).toBe(CHECK_IN)
    expect(result.recordedBy).toBe("worker")
    expect(result.date).toBe(TODAY)
  })

  it("refuses a second check-in on the same day", () => {
    const { state } = fixture()
    const once = checkInWorker({ projectId: project.id, phone: PHONE, at: CHECK_IN })(state, as(null))
    expect(() => checkInWorker({ projectId: project.id, phone: PHONE, at: CHECK_OUT })(once.state, as(null))).toThrow(
      "You've already checked in today.",
    )
  })

  it("refuses a worker whose status is invited", () => {
    const { state } = fixture({ status: "invited" })
    expect(() => checkInWorker({ projectId: project.id, phone: PHONE, at: CHECK_IN })(state, as(null))).toThrow(
      "Your account isn't active yet.",
    )
  })

  it("refuses a worker with no active assignment to the project", () => {
    const { state } = fixture({ assignment: null })
    expect(() => checkInWorker({ projectId: project.id, phone: PHONE, at: CHECK_IN })(state, as(null))).toThrow(
      "You're not assigned to this project.",
    )
  })

  it("refuses a phone that matches no worker in the project's organization", () => {
    const { state } = fixture()
    expect(() => checkInWorker({ projectId: project.id, phone: "+91 00000 00000", at: CHECK_IN })(state, as(null))).toThrow(
      "That worker or project no longer exists.",
    )
  })
})

describe("checkOutWorker", () => {
  it("refuses a check-out without a check-in", () => {
    const { state } = fixture()
    expect(() => checkOutWorker({ projectId: project.id, phone: PHONE, at: CHECK_OUT })(state, as(null))).toThrow(
      "Check in before you check out.",
    )
  })

  it("sets the check-out time on a day already checked in", () => {
    const { state, worker } = fixture()
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const { result } = checkOutWorker({ projectId: project.id, phone: PHONE, at: CHECK_OUT })(checkedIn, as(null))
    expect(result.checkOutAt).toBe(CHECK_OUT)
    expect(result.checkInAt).toBe(CHECK_IN)
  })

  it("refuses a second check-out", () => {
    const { state, worker } = fixture()
    const closed = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN, checkOutAt: CHECK_OUT })
    expect(() => checkOutWorker({ projectId: project.id, phone: PHONE, at: CHECK_OUT })(closed, as(null))).toThrow(
      "You've already checked out today.",
    )
  })

  it("allows a check-out after the assignment has ended, on a day already checked in (A8)", () => {
    const { state, worker } = fixture({
      assignment: { endedAt: "2026-10-06T09:00:00.000Z", status: "inactive", endReason: "removed" },
    })
    const checkedIn = recordFor(state, worker.id, { status: "present", checkInAt: CHECK_IN })
    const { result } = checkOutWorker({ projectId: project.id, phone: PHONE, at: CHECK_OUT })(checkedIn, as(null))
    expect(result.checkOutAt).toBe(CHECK_OUT)
  })

  it("refuses a new check-in after the assignment has ended (A8)", () => {
    const { state } = fixture({
      assignment: { endedAt: "2026-10-06T09:00:00.000Z", status: "inactive", endReason: "removed" },
    })
    expect(() => checkInWorker({ projectId: project.id, phone: PHONE, at: CHECK_IN })(state, as(null))).toThrow(
      "You're not assigned to this project.",
    )
  })
})

describe("setAttendancePolicy", () => {
  it("sets requireCheckout on the project", () => {
    const { state } = fixture()
    const { state: next, result } = setAttendancePolicy(project.id, true)(state, as(manager))
    expect(result.requireCheckout).toBe(true)
    expect(next.projects.find((p) => p.id === project.id)!.requireCheckout).toBe(true)
  })

  it("refuses a worker-role session", () => {
    const { state } = fixture()
    expect(() => setAttendancePolicy(project.id, true)(state, as(stranger))).toThrow(PermissionError)
  })
})
