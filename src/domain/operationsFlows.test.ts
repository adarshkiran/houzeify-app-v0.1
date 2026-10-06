import { describe, expect, it } from "vitest"
import { getWorkersForProject } from "../mock/selectors"
import { seedConstructionData } from "../mock/seed"
import * as commands from "./constructionCommands"
import { IntegrityError } from "./errors"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

/**
 * Command-level walkthrough of the flows behind Task Detail, Workforce and
 * Daily Progress. This exercises the same commands and selectors the screens
 * use, but not the rendered UI.
 */

const manager: Session = {
  accountType: "business",
  personId: "person-arjun",
  organizationId: "org-buildright",
}
const clock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-${++n}`, short: () => `s${++n}` }
}
const ctx = (): CommandContext => ({ actor: manager, clock, ids: ids() })

const state = seedConstructionData
const projectsWithTasks = state.projects.filter((p) =>
  state.tasks.some((t) => t.projectId === p.id),
)

describe("Task Detail assignee dropdown", () => {
  it("has projects to check", () => {
    expect(projectsWithTasks.length).toBeGreaterThan(1)
  })

  it("every worker the dropdown offers can be assigned to every task in that project", () => {
    let checked = 0
    for (const project of projectsWithTasks) {
      const offered = getWorkersForProject(state, project.id)
      for (const task of state.tasks.filter((t) => t.projectId === project.id)) {
        for (const worker of offered) {
          expect(
            () => commands.assignTask(task.id, "worker", worker.id)(state, ctx()),
            `${worker.id} -> ${task.id} (${project.id})`,
          ).not.toThrow()
          checked++
        }
      }
    }
    // Guard against a vacuous pass: the seed must give us real pairs to check.
    expect(checked).toBeGreaterThan(3)
  })

  it("a worker the dropdown does not offer is rejected", () => {
    for (const project of projectsWithTasks) {
      const offeredIds = new Set(getWorkersForProject(state, project.id).map((w) => w.id))
      const outsider = state.workers.find((w) => !offeredIds.has(w.id))!
      const task = state.tasks.find((t) => t.projectId === project.id)!
      expect(() =>
        commands.assignTask(task.id, "worker", outsider.id)(state, ctx()),
      ).toThrow(IntegrityError)
    }
  })
})

describe("Workforce: add and assign", () => {
  const target = state.projects.find((p) => p.id === "project-krishna")!

  it("adds a worker as invited; they are not offered for assignment until accepted", () => {
    const { state: after, result } = commands.addWorker({
      organizationId: target.organizationId,
      name: "  New Worker  ",
      tradeIds: [state.trades[0].id],
      projectId: target.id,
    })(state, ctx())
    expect(result.worker.name).toBe("New Worker")
    expect(result.worker.status).toBe("invited")
    expect(result.assignment?.projectId).toBe(target.id)
    expect(getWorkersForProject(after, target.id).map((w) => w.id)).not.toContain(result.worker.id)
  })

  it("assigns an existing worker to a project; assigning again does not duplicate", () => {
    const worker = state.workers.find(
      (w) => !getWorkersForProject(state, target.id).some((x) => x.id === w.id),
    )!
    const c = ctx()
    const first = commands.assignWorkerToProject({ workerId: worker.id, projectId: target.id })(state, c)
    const again = commands.assignWorkerToProject({ workerId: worker.id, projectId: target.id })(first.state, c)
    expect(again.result.id).toBe(first.result.id)
    const active = again.state.workerProjectAssignments.filter(
      (a) => a.workerId === worker.id && a.projectId === target.id && a.status === "active",
    )
    expect(active).toHaveLength(1)
  })
})

describe("Daily progress: submit then approve", () => {
  it("moves the task forward and raises project progress", () => {
    const project = projectsWithTasks[0]
    const task = state.tasks.find((t) => t.projectId === project.id && t.status !== "approved")!
    const c = ctx()
    const submitted = commands.submitDailyProgress({
      projectId: project.id,
      projectUnitId: task.projectUnitId,
      taskId: task.id,
      stageId: task.stageId,
      tradeId: task.tradeId,
      workTypeId: task.workTypeId,
      workersPresent: 5,
      progressAfter: 80,
      todaySummary: "Done",
      tomorrowPlan: "Next",
      evidence: [{ type: "photo", url: "u" }],
    })(state, c)
    expect(submitted.result.reviewStatus).toBe("submitted")

    const approved = commands.reviewDailyProgress(submitted.result.id, "approve")(submitted.state, c)
    const item = approved.state.dailyProgress.find((p) => p.id === submitted.result.id)!
    expect(item.publicationStatus).toBe("private")
    expect(approved.state.evidence.filter((e) => e.dailyProgressId === item.id).every((e) => e.customerVisibility === "review-required")).toBe(true)
    const before = state.projects.find((p) => p.id === project.id)!.progress
    const after = approved.state.projects.find((p) => p.id === project.id)!.progress
    expect(after).toBeGreaterThanOrEqual(before)
  })
})
