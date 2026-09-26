import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import type { ConstructionStage, Project, Task } from "./models"
import {
  calculateProjectProgress,
  STAGE_WEIGHTS,
  stagePercent,
  taskPercent,
} from "./progress"

const stages: ConstructionStage[] = [
  { id: "s-fnd", code: "FND", name: "Foundation", sequence: 1 },
  { id: "s-rcc", code: "RCC", name: "RCC", sequence: 2 },
  { id: "s-x", code: "CUSTOM", name: "Custom", sequence: 3 },
]

const project = (stageBaselines: Record<string, number> = {}): Project => ({
  id: "p",
  organizationId: "o",
  code: "P",
  name: "P",
  kind: "individual-house",
  status: "active",
  location: "Hyderabad",
  progress: 0,
  trackingStartedMidProject: false,
  stageBaselines,
  createdAt: "2026-09-01T00:00:00+05:30",
  updatedAt: "2026-09-01T00:00:00+05:30",
})

const task = (partial: Partial<Task> & Pick<Task, "id" | "stageId">): Task => ({
  projectId: "p",
  projectUnitId: "u1",
  tradeId: "t",
  workTypeId: "w",
  title: partial.id,
  status: "in-progress",
  priority: "medium",
  checklist: [],
  createdByMembershipId: "m",
  createdAt: "2026-09-01T00:00:00+05:30",
  updatedAt: "2026-09-01T00:00:00+05:30",
  ...partial,
})

describe("STAGE_WEIGHTS", () => {
  it("adds up to 100", () => {
    expect(Object.values(STAGE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe("taskPercent", () => {
  it("uses approved quantity against the plan, capped at 100", () => {
    expect(taskPercent(task({ id: "a", stageId: "s-fnd", plannedQuantity: { value: 20, unit: "m3" }, completedQuantity: { value: 5, unit: "m3" } }))).toBe(25)
    expect(taskPercent(task({ id: "b", stageId: "s-fnd", plannedQuantity: { value: 20, unit: "m3" }, completedQuantity: { value: 30, unit: "m3" } }))).toBe(100)
  })

  it("ignores quantity in a different unit", () => {
    expect(taskPercent(task({ id: "a", stageId: "s-fnd", plannedQuantity: { value: 20, unit: "m3" }, completedQuantity: { value: 5, unit: "nos" } }))).toBe(0)
  })

  it("falls back to status when there is no planned quantity", () => {
    expect(taskPercent(task({ id: "a", stageId: "s-fnd", status: "approved" }))).toBe(100)
    expect(taskPercent(task({ id: "b", stageId: "s-fnd", status: "completed" }))).toBe(100)
    expect(taskPercent(task({ id: "c", stageId: "s-fnd", status: "review" }))).toBe(0)
  })
})

describe("stagePercent", () => {
  it("is the baseline when the stage has no tasks", () => {
    expect(stagePercent(40, [])).toBe(40)
  })

  it("spreads task work over what the baseline leaves", () => {
    const tasks = [
      task({ id: "a", stageId: "s-rcc", status: "approved" }),
      task({ id: "b", stageId: "s-rcc" }),
    ]
    expect(stagePercent(40, tasks)).toBe(70) // 40 + 60 × 50%
  })
})

describe("calculateProjectProgress", () => {
  it("weights stages by code and rounds", () => {
    // FND 100% × 12 + RCC 50% × 25 = 24.5 → 25 (custom stage weighs 0)
    const tasks = [
      task({ id: "a", stageId: "s-rcc", status: "approved" }),
      task({ id: "b", stageId: "s-rcc" }),
      task({ id: "c", stageId: "s-x", status: "approved" }),
    ]
    expect(calculateProjectProgress(project({ "s-fnd": 100 }), stages, tasks)).toBe(25)
  })

  it("excludes cancelled tasks", () => {
    const tasks = [
      task({ id: "a", stageId: "s-rcc", status: "approved" }),
      task({ id: "b", stageId: "s-rcc", status: "cancelled" }),
    ]
    expect(calculateProjectProgress(project(), stages, tasks)).toBe(25)
  })

  it("counts tasks in every unit, so one unit can't overwrite the project", () => {
    const tasks = [
      task({ id: "a", stageId: "s-rcc", projectUnitId: "u1", status: "approved" }),
      task({ id: "b", stageId: "s-rcc", projectUnitId: "u2" }),
    ]
    expect(calculateProjectProgress(project(), stages, tasks)).toBe(13) // 50% × 25 = 12.5 → 13
  })

  it("only counts this project's tasks", () => {
    const other = task({ id: "a", stageId: "s-rcc", projectId: "other", status: "approved" })
    expect(calculateProjectProgress(project(), stages, [other])).toBe(0)
  })

  it("reproduces the seed projects' current percentages", () => {
    const expected: Record<string, number> = {
      "project-sharma": 34,
      "project-reddy": 67,
      "project-tech-park": 81,
      "project-krishna": 8,
      "project-lakeside": 4,
    }
    for (const item of seed.projects) {
      expect(calculateProjectProgress(item, seed.stages, seed.tasks), item.id).toBe(expected[item.id])
    }
  })
})
