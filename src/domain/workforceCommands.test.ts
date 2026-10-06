import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import { endWorkerProjectAssignment } from "./constructionCommands"
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
