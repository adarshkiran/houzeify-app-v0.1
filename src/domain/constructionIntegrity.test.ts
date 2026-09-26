import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import * as commands from "./constructionCommands"
import { IntegrityError } from "./errors"
import type { ConstructionDataState, ProjectMembership, Worker } from "./models"
import { permissionsForRole } from "./permissions"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const clock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }
function ids(): IdGenerator {
  let n = 0
  return { next: (prefix) => `${prefix}-${++n}`, short: () => `s${++n}` }
}
const ctxFor = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

const manager: Session = {
  accountType: "business",
  personId: "person-arjun",
  organizationId: "org-buildright",
}

const base: ConstructionDataState = seedConstructionData
const A = "project-sharma"
const B = "project-reddy"

const unitOf = (projectId: string) =>
  base.projectUnits.find((u) => u.projectId === projectId)!
const taskOf = (projectId: string) =>
  base.tasks.find((t) => t.projectId === projectId)!

function progressFor(taskProjectId: string, projectId = A) {
  const task = taskOf(taskProjectId)
  return {
    projectId,
    projectUnitId: unitOf(projectId).id,
    taskId: task.id,
    stageId: task.stageId,
    tradeId: task.tradeId,
    workTypeId: task.workTypeId,
    workersPresent: 3,
    progressAfter: 20,
    todaySummary: "x",
    tomorrowPlan: "y",
    evidence: [],
  }
}

/** A second person who manages only project A (a supervisor). */
function withSupervisor(): { state: ConstructionDataState; session: Session; membership: ProjectMembership } {
  const membership: ProjectMembership = {
    id: "membership-supervisor-a",
    projectId: A,
    principalType: "person",
    principalId: "person-sup",
    role: "supervisor",
    scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
    permissions: permissionsForRole("supervisor"),
    status: "active",
  }
  return {
    state: {
      ...base,
      people: [...base.people, { id: "person-sup", name: "Sup" }],
      memberships: [...base.memberships, membership],
    },
    session: { accountType: "business", personId: "person-sup", organizationId: "org-buildright" },
    membership,
  }
}

describe("cross-project references are rejected", () => {
  it("submit: a task from another project cannot be updated", () => {
    expect(() =>
      commands.submitDailyProgress(progressFor(B, A))(base, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("submit: a unit from another project is rejected", () => {
    expect(() =>
      commands.submitDailyProgress({
        ...progressFor(A),
        projectUnitId: unitOf(B).id,
      })(base, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("submit: stage/trade must match the work type", () => {
    const input = progressFor(A)
    const other = base.stages.find((s) => s.id !== input.stageId)!
    expect(() =>
      commands.submitDailyProgress({ ...input, stageId: other.id })(base, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("createTask / addWorkPlanItem: unit must belong to the project", () => {
    const t = taskOf(A)
    const common = {
      projectId: A,
      projectUnitId: unitOf(B).id,
      stageId: t.stageId,
      tradeId: t.tradeId,
      workTypeId: t.workTypeId,
    }
    expect(() =>
      commands.createTask({ ...common, title: "T", priority: "medium" })(base, ctxFor(manager)),
    ).toThrow(IntegrityError)
    expect(() =>
      commands.addWorkPlanItem({
        ...common,
        plannedQuantity: { value: 1, unit: "m3" },
      })(base, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("addEvidence: task must belong to the project", () => {
    expect(() =>
      commands.addEvidence({
        projectId: A,
        taskId: taskOf(B).id,
        type: "photo",
        url: "u",
      })(base, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("review never touches a task from another project", () => {
    // Simulate a legacy/corrupt record pointing at a foreign task.
    const ctx = ctxFor(manager)
    // Approval advances a "submitted" task, so put the foreign task there.
    const foreign = { ...taskOf(B), status: "submitted" as const }
    const submitted = commands.submitDailyProgress(progressFor(A, A))(base, ctx)
    const corrupted: ConstructionDataState = {
      ...submitted.state,
      tasks: submitted.state.tasks.map((t) => (t.id === foreign.id ? foreign : t)),
      dailyProgress: submitted.state.dailyProgress.map((p) =>
        p.id === submitted.result.id ? { ...p, taskId: foreign.id } : p,
      ),
    }
    const after = commands.reviewDailyProgress(submitted.result.id, "approve")(corrupted, ctx)
    expect(after.state.tasks.find((t) => t.id === foreign.id)).toEqual(foreign)
  })
})

describe("records are attributed to the acting person", () => {
  it("createTask records the actor's membership, not the project manager's", () => {
    const { state, session, membership } = withSupervisor()
    const t = taskOf(A)
    const { result } = commands.createTask({
      projectId: A,
      projectUnitId: unitOf(A).id,
      stageId: t.stageId,
      tradeId: t.tradeId,
      workTypeId: t.workTypeId,
      title: "T",
      priority: "medium",
    })(state, ctxFor(session))
    expect(result.createdByMembershipId).toBe(membership.id)
  })

  it("submitDailyProgress and its evidence are attributed to the actor", () => {
    const { state, session, membership } = withSupervisor()
    const { result, state: after } = commands.submitDailyProgress({
      ...progressFor(A),
      evidence: [{ type: "photo", url: "u" }],
    })(state, ctxFor(session))
    expect(result.submittedByMembershipId).toBe(membership.id)
    const ev = after.evidence.find((e) => e.dailyProgressId === result.id)!
    expect(ev.capturedByMembershipId).toBe(membership.id)
  })

  it("assignTask records the actor as the assigner", () => {
    const { state, session, membership } = withSupervisor()
    const task = taskOf(A)
    const worker = workerOnProject(state, A)
    const { result } = commands.assignTask(task.id, "worker", worker.id)(state, ctxFor(session))
    expect(result.assignedByMembershipId).toBe(membership.id)
  })
})

function workerOnProject(state: ConstructionDataState, projectId: string): Worker {
  const assignment = state.workerProjectAssignments.find(
    (a) => a.projectId === projectId && a.status === "active",
  )!
  return state.workers.find((w) => w.id === assignment.workerId)!
}

describe("workers and organizations", () => {
  it("cannot assign a worker from another organization to a project", () => {
    const foreign: Worker = { ...base.workers[0], id: "worker-foreign", organizationId: "org-other" }
    const state = { ...base, workers: [...base.workers, foreign] }
    expect(() =>
      commands.assignWorkerToProject({ workerId: foreign.id, projectId: A })(state, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("cannot assign an unknown worker", () => {
    expect(() =>
      commands.assignWorkerToProject({ workerId: "nope", projectId: A })(base, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("addWorker with a project requires the project to be in the same organization", () => {
    const state: ConstructionDataState = {
      ...base,
      projects: base.projects.map((p) => (p.id === A ? { ...p, organizationId: "org-other" } : p)),
    }
    expect(() =>
      commands.addWorker({
        organizationId: "org-buildright",
        name: "New",
        tradeIds: [],
        projectId: A,
      })(state, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("assignTask: the worker must be actively assigned to the task's project", () => {
    const task = taskOf(A)
    const onB = workerOnProject(base, B)
    const alreadyOnA = base.workerProjectAssignments.some(
      (a) => a.workerId === onB.id && a.projectId === A && a.status === "active",
    )
    // Only meaningful if the seed keeps these disjoint; otherwise build the case.
    const state = alreadyOnA
      ? {
          ...base,
          workerProjectAssignments: base.workerProjectAssignments.filter(
            (a) => !(a.workerId === onB.id && a.projectId === A),
          ),
        }
      : base
    expect(() =>
      commands.assignTask(task.id, "worker", onB.id)(state, ctxFor(manager)),
    ).toThrow(IntegrityError)
  })

  it("assignTask: assigning the same worker twice returns the existing assignment", () => {
    const task = taskOf(A)
    const worker = workerOnProject(base, A)
    const ctx = ctxFor(manager)
    const first = commands.assignTask(task.id, "worker", worker.id)(base, ctx)
    const second = commands.assignTask(task.id, "worker", worker.id)(first.state, ctx)
    expect(second.result.id).toBe(first.result.id)
    expect(second.state).toBe(first.state)
  })
})
