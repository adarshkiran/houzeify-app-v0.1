import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import {
  acceptWorkerOnboarding,
  assignWorkerToProject,
  cancelWorkerOnboarding,
  createWorkerOnboarding,
  endWorkerProjectAssignment,
  expireWorkerOnboarding,
  inviteProjectMember,
} from "./constructionCommands"
import { openOnboardingFor } from "./workforceOnboarding"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const ORG = "org-buildright"
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: ORG }
const clock: Clock = { now: () => new Date("2026-10-06T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

/** A seeded active assignment to end. Built in the test so it doesn't depend on fixture ids. */
function withAssignment(): { state: ConstructionDataState; assignmentId: string } {
  const worker = seed.workers[0]
  const project = seed.projects[0]
  const assignment = {
    id: "assignment-test",
    workerId: worker.id,
    projectId: project.id,
    projectUnitIds: [],
    tradeIds: worker.tradeIds.slice(0, 1),
    role: "worker" as const,
    status: "active" as const,
    startedAt: "2026-09-01T09:00:00.000Z",
    assignedAt: "2026-09-01T09:00:00.000Z",
  }
  return {
    state: { ...seed, workerProjectAssignments: [...seed.workerProjectAssignments, assignment] },
    assignmentId: assignment.id,
  }
}

describe("endWorkerProjectAssignment", () => {
  it("sets endedAt and endReason and keeps the record", () => {
    const { state, assignmentId } = withAssignment()
    const { state: next, result } = endWorkerProjectAssignment(assignmentId, "left-project")(state, as(manager))
    expect(result.endedAt).toBe("2026-10-06T10:00:00.000Z")
    expect(result.endReason).toBe("left-project")
    expect(next.workerProjectAssignments.find((a) => a.id === assignmentId)).toBeDefined()
  })

  it("does not change the worker's status", () => {
    const { state, assignmentId } = withAssignment()
    const workerId = state.workerProjectAssignments.find((a) => a.id === assignmentId)!.workerId
    const before = state.workers.find((w) => w.id === workerId)!.status
    const { state: next } = endWorkerProjectAssignment(assignmentId, "reassigned")(state, as(manager))
    expect(next.workers.find((w) => w.id === workerId)!.status).toBe(before)
  })

  it("refuses to end an assignment twice", () => {
    const { state, assignmentId } = withAssignment()
    const once = endWorkerProjectAssignment(assignmentId, "removed")(state, as(manager)).state
    expect(() => endWorkerProjectAssignment(assignmentId, "removed")(once, as(manager))).toThrow(ConflictError)
  })

  it("refuses an unknown assignment", () => {
    expect(() => endWorkerProjectAssignment("assignment-nope", "removed")(seed, as(manager))).toThrow(ConflictError)
  })
})

describe("assignWorkerToProject after an assignment ended", () => {
  it("creates a new assignment instead of returning the ended record", () => {
    const { state, assignmentId } = withAssignment()
    const ended = endWorkerProjectAssignment(assignmentId, "left-project")(state, as(manager))
    const endedRecord = ended.result
    const workerId = endedRecord.workerId
    const projectId = endedRecord.projectId
    const { state: next, result } = assignWorkerToProject({
      workerId,
      projectId,
      tradeIds: endedRecord.tradeIds,
      projectUnitIds: endedRecord.projectUnitIds,
    })(ended.state, as(manager))
    expect(result.id).not.toBe(assignmentId)
    expect(result.endedAt).toBeUndefined()
    expect(result.status).toBe("active")
    expect(result.startedAt).toBe("2026-10-06T10:00:00.000Z")
    expect(next.workerProjectAssignments.filter((a) => a.id === result.id)).toHaveLength(1)
    expect(next.workerProjectAssignments.find((a) => a.id === assignmentId)!.endedAt).toBeDefined()
  })
})

function withWorker(): { state: ConstructionDataState; workerId: string } {
  const worker = seed.workers[0]
  return { state: seed, workerId: worker.id }
}

describe("createWorkerOnboarding", () => {
  it("creates a qr onboarding with a join code", () => {
    const { state, workerId } = withWorker()
    const { state: next, result } = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    expect(result.method).toBe("qr")
    expect(result.joinCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(openOnboardingFor(next, workerId)).toEqual(result)
  })

  it("records the supervisor for a supervisor-assisted onboarding", () => {
    const { state, workerId } = withWorker()
    const { result } = createWorkerOnboarding({ workerId, method: "supervisor-assisted" })(state, as(manager))
    expect(result.method).toBe("supervisor-assisted")
    expect(result.joinCode).toBeUndefined()
  })

  it("refuses when the worker already has an open onboarding", () => {
    const { state, workerId } = withWorker()
    const once = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager)).state
    expect(() => createWorkerOnboarding({ workerId, method: "qr" })(once, as(manager))).toThrow(ConflictError)
  })

  it("keeps exactly one open onboarding after a refused second create", () => {
    const { state, workerId } = withWorker()
    const once = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager)).state
    const openCount = (s: ConstructionDataState) =>
      s.workerOnboardings.filter(
        (o) => o.workerId === workerId && (o.status === "invited" || o.status === "accepted"),
      ).length
    const before = once.workerOnboardings.length
    expect(() => createWorkerOnboarding({ workerId, method: "qr" })(once, as(manager))).toThrow(ConflictError)
    expect(once.workerOnboardings.length).toBe(before)
    expect(openCount(once)).toBe(1)
  })

  it("leaves invitedByMembershipId undefined when the supervisor's only membership is in another organization", () => {
    const worker = seed.workers[0]
    const otherProject = { ...seed.projects[0], id: "project-other-org", organizationId: "org-other" }
    const state: ConstructionDataState = {
      ...seed,
      projects: [...seed.projects, otherProject],
      memberships: [
        ...seed.memberships.filter((m) => !(m.principalType === "person" && m.principalId === "person-arjun")),
        {
          ...seed.memberships[0],
          id: "membership-arjun-other-org",
          projectId: otherProject.id,
          principalType: "person" as const,
          principalId: "person-arjun",
          status: "active" as const,
        },
      ],
    }
    const { result } = createWorkerOnboarding({ workerId: worker.id, method: "supervisor-assisted" })(
      state,
      as(manager),
    )
    expect(result.invitedByMembershipId).toBeUndefined()
  })
})

describe("cancelWorkerOnboarding and expireWorkerOnboarding", () => {
  it("cancel keeps the worker and marks the onboarding cancelled", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const { state: next, result } = cancelWorkerOnboarding(created.result.id)(created.state, as(manager))
    expect(result.status).toBe("cancelled")
    expect(next.workers.find((w) => w.id === workerId)).toBeDefined()
  })

  it("expire marks the onboarding expired and keeps the worker", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const { state: next, result } = expireWorkerOnboarding(created.result.id)(created.state, as(manager))
    expect(result.status).toBe("expired")
    expect(next.workers.find((w) => w.id === workerId)).toBeDefined()
  })

  it("refuses to cancel an onboarding that is no longer invited", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const cancelled = cancelWorkerOnboarding(created.result.id)(created.state, as(manager)).state
    expect(() => cancelWorkerOnboarding(created.result.id)(cancelled, as(manager))).toThrow(ConflictError)
  })
})

describe("acceptWorkerOnboarding", () => {
  it("activates the worker and marks the onboarding accepted", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "supervisor-assisted" })(state, as(manager))
    const { state: next, result } = acceptWorkerOnboarding(created.result.id)(created.state, as(manager))
    expect(result.status).toBe("active")
    expect(next.workerOnboardings.find((o) => o.id === created.result.id)!.status).toBe("accepted")
    expect(next.workerOnboardings.find((o) => o.id === created.result.id)!.acceptedAt).toBeDefined()
  })

  it("requires the matching join code for a qr onboarding", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    expect(() => acceptWorkerOnboarding(created.result.id, "WRONG1")(created.state, as(manager))).toThrow(ConflictError)
    expect(() => acceptWorkerOnboarding(created.result.id)(created.state, as(manager))).toThrow(ConflictError)
  })

  it("refuses a qr onboarding with no stored join code, even when none is given", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const stripped = {
      ...created.state,
      workerOnboardings: created.state.workerOnboardings.map((o) => ({ ...o, joinCode: undefined })),
    }
    expect(() => acceptWorkerOnboarding(created.result.id)(stripped, as(manager))).toThrow(ConflictError)
  })

  it("a wrong join code changes nothing", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    expect(() => acceptWorkerOnboarding(created.result.id, "WRONG1")(created.state, as(manager))).toThrow(ConflictError)
    expect(created.state.workerOnboardings.find((o) => o.id === created.result.id)!.status).toBe("invited")
    const { state: next } = acceptWorkerOnboarding(created.result.id, created.result.joinCode!)(created.state, as(manager))
    expect(next.workerOnboardings.find((o) => o.id === created.result.id)!.status).toBe("accepted")
  })

  it("accepts with the correct join code", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const code = created.result.joinCode!
    const { result } = acceptWorkerOnboarding(created.result.id, code)(created.state, as(manager))
    expect(result.status).toBe("active")
  })

  it("refuses an onboarding that is not invited", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "supervisor-assisted" })(state, as(manager))
    const accepted = acceptWorkerOnboarding(created.result.id)(created.state, as(manager)).state
    expect(() => acceptWorkerOnboarding(created.result.id)(accepted, as(manager))).toThrow(ConflictError)
  })

  it("starts the worker's invited assignments and leaves ended ones alone", () => {
    const { state, workerId } = withWorker()
    const invitedAssignment = {
      id: "assignment-invited",
      workerId,
      projectId: seed.projects[0].id,
      projectUnitIds: [],
      tradeIds: [],
      role: "worker" as const,
      status: "invited" as const,
      startedAt: "2026-09-01T09:00:00.000Z",
      assignedAt: "2026-09-01T09:00:00.000Z",
    }
    const endedAssignment = {
      ...invitedAssignment,
      id: "assignment-ended",
      status: "inactive" as const,
      endedAt: "2026-09-02T09:00:00.000Z",
      endReason: "removed" as const,
    }
    const withAssignments = {
      ...state,
      workerProjectAssignments: [...state.workerProjectAssignments, invitedAssignment, endedAssignment],
    }
    const created = createWorkerOnboarding({ workerId, method: "supervisor-assisted" })(withAssignments, as(manager))
    const { state: next } = acceptWorkerOnboarding(created.result.id)(created.state, as(manager))
    const started = next.workerProjectAssignments.find((a) => a.id === "assignment-invited")!
    expect(started.status).toBe("active")
    expect(started.startedAt).toBe("2026-10-06T10:00:00.000Z")
    expect(next.workerProjectAssignments.find((a) => a.id === "assignment-ended")!.status).toBe("inactive")
  })
})

describe("inviteProjectMember for the worker role", () => {
  it("creates a worker in invited status and links the person to it", () => {
    const { state, result } = inviteProjectMember({
      projectId: seed.projects[0].id,
      name: "New Worker",
      phone: "+91 90000 00099",
      role: "worker",
      projectUnitIds: [],
    } as never)(seed, as(manager))
    const worker = state.workers.find((w) => w.userId === result.principalId)
    expect(worker).toBeDefined()
    expect(worker!.status).toBe("invited")
    expect(state.workerOnboardings.some((o) => o.workerId === worker!.id && o.method === "manual")).toBe(true)
  })

  it("does not create a worker for a non-worker role", () => {
    const before = seed.workers.length
    const { state } = inviteProjectMember({
      projectId: seed.projects[0].id,
      name: "Site Engineer",
      phone: "+91 90000 00098",
      role: "project-manager",
      projectUnitIds: [],
    } as never)(seed, as(manager))
    expect(state.workers.length).toBe(before)
  })
})
