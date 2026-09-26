import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import * as commands from "./constructionCommands"
import type {
  ConstructionDataState,
  PermissionScope,
  ProjectMembership,
  ProjectUnit,
  Task,
} from "./models"
import { permissionsForRole } from "./permissions"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, scopeCovers, type Session } from "./session"

const clock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }
function ids(): IdGenerator {
  let n = 0
  return { next: (p) => `${p}-${++n}`, short: () => `s${++n}` }
}
const ctxFor = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

const P = "project-sharma"
const base = seedConstructionData
const root = base.projectUnits.find((u) => u.projectId === P)!

/** Sharma with a block containing two floors, plus a sibling block. */
const unit = (id: string, parentUnitId: string | undefined, seq: number): ProjectUnit => ({
  id, projectId: P, parentUnitId, kind: "block", code: id, name: id, status: "active", sequence: seq,
})
const units: ProjectUnit[] = [
  unit("block-a", root.id, 10),
  unit("floor-a1", "block-a", 11),
  unit("floor-a2", "block-a", 12),
  unit("block-b", root.id, 20),
]

const template = base.tasks.find((t) => t.projectId === P)!
const taskIn = (id: string, projectUnitId: string, extra: Partial<Task> = {}): Task => ({
  ...template, id, projectUnitId, status: "in-progress", ...extra,
})

const scoped = (
  scope: Partial<PermissionScope>,
  role = "supervisor",
  id = "membership-scoped",
  personId = "person-sup",
): ProjectMembership => ({
  id, projectId: P, principalType: "person", principalId: personId,
  role: role as ProjectMembership["role"],
  scope: { projectUnitIds: [], stageIds: [], tradeIds: [], ...scope },
  permissions: permissionsForRole(role), status: "active",
})

function world(memberships: ProjectMembership[]): ConstructionDataState {
  return {
    ...base,
    people: [...base.people, { id: "person-sup", name: "Sup" }],
    projectUnits: [...base.projectUnits, ...units],
    tasks: [
      ...base.tasks,
      taskIn("task-a1", "floor-a1"),
      taskIn("task-b", "block-b"),
    ],
    memberships: [...base.memberships, ...memberships],
  }
}
const sup: Session = { accountType: "business", personId: "person-sup", organizationId: "org-buildright" }
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }

const taskInput = (projectUnitId: string) => ({
  projectId: P, projectUnitId, stageId: template.stageId, tradeId: template.tradeId,
  workTypeId: template.workTypeId, title: "T", priority: "medium" as const,
})

describe("scopeCovers (pure)", () => {
  const empty: PermissionScope = { projectUnitIds: [], stageIds: [], tradeIds: [] }
  it("an empty scope covers everything, including unit-less targets", () => {
    expect(scopeCovers(empty, { projectUnitId: "block-b" }, units)).toBe(true)
    expect(scopeCovers(empty, {}, units)).toBe(true)
  })
  it("a unit scope covers that unit and its descendants, not siblings", () => {
    const s = { ...empty, projectUnitIds: ["block-a"] }
    expect(scopeCovers(s, { projectUnitId: "block-a" }, units)).toBe(true)
    expect(scopeCovers(s, { projectUnitId: "floor-a2" }, units)).toBe(true)
    expect(scopeCovers(s, { projectUnitId: "block-b" }, units)).toBe(false)
    expect(scopeCovers(s, { projectUnitId: root.id }, units)).toBe(false)
  })
  it("a unit scope does not cover a target with no unit (whole-project operation)", () => {
    expect(scopeCovers({ ...empty, projectUnitIds: ["block-a"] }, {}, units)).toBe(false)
  })
  it("stage and trade scopes restrict their own dimension", () => {
    const s = { ...empty, stageIds: ["stage-x"], tradeIds: ["trade-y"] }
    expect(scopeCovers(s, { stageId: "stage-x", tradeId: "trade-y" }, units)).toBe(true)
    expect(scopeCovers(s, { stageId: "stage-z", tradeId: "trade-y" }, units)).toBe(false)
    expect(scopeCovers(s, { stageId: "stage-x", tradeId: "trade-z" }, units)).toBe(false)
    expect(scopeCovers(s, { stageId: "stage-x" }, units)).toBe(false)
  })
  it("all dimensions must hold together", () => {
    const s = { ...empty, projectUnitIds: ["block-a"], stageIds: ["stage-x"] }
    expect(scopeCovers(s, { projectUnitId: "floor-a1", stageId: "stage-x" }, units)).toBe(true)
    expect(scopeCovers(s, { projectUnitId: "floor-a1", stageId: "stage-z" }, units)).toBe(false)
    expect(scopeCovers(s, { projectUnitId: "block-b", stageId: "stage-x" }, units)).toBe(false)
  })
  it("terminates on a cyclic unit chain", () => {
    const cyclic = [unit("c1", "c2", 1), unit("c2", "c1", 2)]
    expect(scopeCovers({ ...empty, projectUnitIds: ["elsewhere"] }, { projectUnitId: "c1" }, cyclic)).toBe(false)
  })
})

describe("scoped supervisor: tasks and plans", () => {
  const state = world([scoped({ projectUnitIds: ["block-a"] })])

  it("can create tasks and plan work inside scope, including descendants", () => {
    for (const u of ["block-a", "floor-a1", "floor-a2"]) {
      expect(() => commands.createTask(taskInput(u))(state, ctxFor(sup))).not.toThrow()
    }
    expect(() =>
      commands.addWorkPlanItem({ ...taskInput("floor-a1"), plannedQuantity: { value: 1, unit: "m3" } })(state, ctxFor(sup)),
    ).not.toThrow()
  })

  it("cannot create tasks or plan work outside scope", () => {
    expect(() => commands.createTask(taskInput("block-b"))(state, ctxFor(sup))).toThrow(PermissionError)
    expect(() => commands.createTask(taskInput(root.id))(state, ctxFor(sup))).toThrow(PermissionError)
    expect(() =>
      commands.addWorkPlanItem({ ...taskInput("block-b"), plannedQuantity: { value: 1, unit: "m3" } })(state, ctxFor(sup)),
    ).toThrow(PermissionError)
  })

  it("can move a task inside scope but not one outside", () => {
    expect(() => commands.transitionTask("task-a1", "blocked")(state, ctxFor(sup))).not.toThrow()
    expect(() => commands.transitionTask("task-b", "blocked")(state, ctxFor(sup))).toThrow(PermissionError)
  })

  it("can assign a project worker to an in-scope task but not an out-of-scope one", () => {
    const worker = base.workers.find((w) => w.id === "worker-2")!
    expect(() => commands.assignTask("task-a1", "worker", worker.id)(state, ctxFor(sup))).not.toThrow()
    expect(() => commands.assignTask("task-b", "worker", worker.id)(state, ctxFor(sup))).toThrow(PermissionError)
  })

  it("an unscoped manager is unaffected", () => {
    expect(() => commands.createTask(taskInput("block-b"))(state, ctxFor(manager))).not.toThrow()
    expect(() => commands.transitionTask("task-b", "blocked")(state, ctxFor(manager))).not.toThrow()
  })
})

describe("scoped supervisor: progress and evidence", () => {
  const state = world([scoped({ projectUnitIds: ["block-a"] })])
  const progress = (taskId: string, projectUnitId: string) => ({
    projectId: P, projectUnitId, taskId, stageId: template.stageId, tradeId: template.tradeId,
    workTypeId: template.workTypeId, workersPresent: 2, progressAfter: 10,
    todaySummary: "x", tomorrowPlan: "y", evidence: [],
  })

  it("submits inside scope and is denied outside", () => {
    expect(() => commands.submitDailyProgress(progress("task-a1", "floor-a1"))(state, ctxFor(sup))).not.toThrow()
    expect(() => commands.submitDailyProgress(progress("task-b", "block-b"))(state, ctxFor(sup))).toThrow(PermissionError)
  })

  it("cannot review an item outside scope", () => {
    const submitted = commands.submitDailyProgress(progress("task-b", "block-b"))(state, ctxFor(manager))
    expect(() =>
      commands.reviewDailyProgress(submitted.result.id, "approve")(submitted.state, ctxFor(sup)),
    ).toThrow(PermissionError)
    const inScope = commands.submitDailyProgress(progress("task-a1", "floor-a1"))(state, ctxFor(manager))
    expect(() =>
      commands.reviewDailyProgress(inScope.result.id, "approve")(inScope.state, ctxFor(sup)),
    ).not.toThrow()
  })

  it("evidence must attach to an in-scope unit or task", () => {
    expect(() =>
      commands.addEvidence({ projectId: P, taskId: "task-a1", type: "photo", url: "u" })(state, ctxFor(sup)),
    ).not.toThrow()
    expect(() =>
      commands.addEvidence({ projectId: P, taskId: "task-b", type: "photo", url: "u" })(state, ctxFor(sup)),
    ).toThrow(PermissionError)
    expect(() =>
      commands.addEvidence({ projectId: P, type: "photo", url: "u" })(state, ctxFor(sup)),
    ).toThrow(PermissionError)
  })
})

describe("scoped members and whole-project operations", () => {
  const state = world([scoped({ projectUnitIds: ["block-a"] }, "project-manager")])

  it("cannot invite members (a whole-project operation)", () => {
    expect(() =>
      commands.inviteProjectMember({ projectId: P, name: "N", role: "worker" })(state, ctxFor(sup)),
    ).toThrow(PermissionError)
  })

  it("can add locations only beneath a unit in scope", () => {
    const add = (parentUnitId?: string) =>
      commands.addProjectUnit({ projectId: P, parentUnitId, kind: "floor", code: "F", name: "F" })
    expect(() => add("block-a")(state, ctxFor(sup))).not.toThrow()
    expect(() => add("floor-a2")(state, ctxFor(sup))).not.toThrow()
    expect(() => add("block-b")(state, ctxFor(sup))).toThrow(PermissionError)
    expect(() => add(undefined)(state, ctxFor(sup))).toThrow(PermissionError)
  })

  it("can assign workers only to units in scope, and not with 'entire project'", () => {
    const wf = scoped({ projectUnitIds: ["block-a"] }, "supervisor", "m-wf")
    const s2 = world([wf])
    const worker = base.workers.find((w) => w.organizationId === "org-buildright")!
    const assign = (projectUnitIds: string[]) =>
      commands.assignWorkerToProject({ workerId: worker.id, projectId: P, projectUnitIds })
    expect(() => assign(["floor-a1"])(s2, ctxFor(sup))).not.toThrow()
    expect(() => assign(["block-b"])(s2, ctxFor(sup))).toThrow(PermissionError)
    expect(() => assign([])(s2, ctxFor(sup))).toThrow(PermissionError)
  })
})

describe("stage and trade scope", () => {
  it("a stage-scoped member can act only on that stage", () => {
    const state = world([scoped({ stageIds: [template.stageId] })])
    expect(() => commands.createTask(taskInput("block-a"))(state, ctxFor(sup))).not.toThrow()
    const otherStage = base.workTypes.find((w) => w.stageId !== template.stageId)!
    expect(() =>
      commands.createTask({
        ...taskInput("block-a"), stageId: otherStage.stageId, tradeId: otherStage.tradeId, workTypeId: otherStage.id,
      })(state, ctxFor(sup)),
    ).toThrow(PermissionError)
  })

  it("a trade-scoped member can act only on that trade", () => {
    const state = world([scoped({ tradeIds: ["trade-not-this-one"] })])
    expect(() => commands.createTask(taskInput("block-a"))(state, ctxFor(sup))).toThrow(PermissionError)
  })
})

describe("several memberships on one project", () => {
  const a = scoped({ projectUnitIds: ["block-a"] }, "supervisor", "m-a")
  const b = scoped({ projectUnitIds: ["block-b"] }, "supervisor", "m-b")
  const state = world([a, b])

  it("allows what any one active membership covers", () => {
    expect(() => commands.createTask(taskInput("floor-a1"))(state, ctxFor(sup))).not.toThrow()
    expect(() => commands.createTask(taskInput("block-b"))(state, ctxFor(sup))).not.toThrow()
    expect(() => commands.createTask(taskInput(root.id))(state, ctxFor(sup))).toThrow(PermissionError)
  })

  it("attributes the record to the membership that covered it", () => {
    expect(commands.createTask(taskInput("floor-a1"))(state, ctxFor(sup)).result.createdByMembershipId).toBe("m-a")
    expect(commands.createTask(taskInput("block-b"))(state, ctxFor(sup)).result.createdByMembershipId).toBe("m-b")
  })

  it("ignores an inactive membership's scope", () => {
    const inactive = { ...b, status: "inactive" as const }
    const s2 = world([a, inactive])
    expect(() => commands.createTask(taskInput("block-b"))(s2, ctxFor(sup))).toThrow(PermissionError)
  })
})
