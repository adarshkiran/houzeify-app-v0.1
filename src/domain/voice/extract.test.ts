import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../../mock/seed"
import type { ProjectUnit } from "../models"
import { voiceExtractor as x } from "./extract"
import type { VoiceContext } from "./types"

const units: ProjectUnit[] = [
  { id: "u-main", projectId: "project-sharma", kind: "house", code: "HOUSE", name: "Main House", status: "active", sequence: 1 },
  { id: "u-b", projectId: "project-sharma", kind: "block", code: "BLK-B", name: "Block B", status: "planned", sequence: 2 },
]
const ctx: VoiceContext = {
  today: "2026-09-28",
  units,
  workTypes: seed.workTypes,
  people: [
    { id: "w-ravi-n", name: "Ravi Naik" },
    { id: "w-ravi-k", name: "Ravi Kumar" },
    { id: "w-suresh", name: "Suresh Kumar" },
  ],
  tasks: seed.tasks.filter((t) => t.projectId === "project-sharma"),
}

describe("task drafts", () => {
  it("fills a full instruction", () => {
    const d = x.task("Suresh, pour the Block B columns tomorrow, urgent", ctx)
    expect(d.values).toMatchObject({
      assigneeId: "w-suresh",
      projectUnitId: "u-b",
      workTypeId: "work-column-casting",
      priority: "high",
      dueDate: "2026-09-29",
      title: "Pour the Block B columns",
    })
    expect(d.fields.assigneeId).toEqual({ state: "heard" })
    expect(d.fields.workTypeId?.state).toBe("guessed")
  })

  it("asks to choose between two people with the same first name", () => {
    const d = x.task("Ravi, cure the footings in Main House", ctx)
    expect(d.values.assigneeId).toBeUndefined()
    expect(d.fields.assigneeId).toMatchObject({ state: "choose" })
  })

  it("marks unknown people, missing work type and location", () => {
    const d = x.task("assign to Mahesh, sort out the site office", ctx)
    expect(d.fields.assigneeId).toMatchObject({ state: "missing", note: "Nobody named 'Mahesh' on this project" })
    expect(d.fields.workTypeId).toEqual({ state: "missing" })
    expect(d.fields.projectUnitId).toEqual({ state: "missing" })
  })

  it("reads planned quantity and a start date", () => {
    const d = x.task("Start Main House slab casting on Friday, 42 cubic metres", ctx)
    expect(d.values).toMatchObject({ plannedStart: "2026-10-02", plannedValue: 42, unit: "m3", workTypeId: "work-slab-casting" })
    expect(d.values.dueDate).toBeUndefined()
    expect(d.fields.unit).toEqual({ state: "heard" })
  })

  it("defaults priority to medium as a guess, and the unit from the work type", () => {
    const d = x.task("Main House curing for 3", ctx)
    expect(d.values.priority).toBe("medium")
    expect(d.fields.priority?.state).toBe("guessed")
    expect(d.values.unit).toBe("day")
    expect(d.fields.unit).toEqual({ state: "guessed", reason: "The work type's usual unit" })
  })

  it("keeps an ordinal like '2nd floor' in the title instead of reading a date", () => {
    const d = x.task("Plaster the 2nd floor walls in Main House", ctx)
    expect(d.values.dueDate).toBeUndefined()
    expect(d.values.plannedStart).toBeUndefined()
    expect(d.values.title).toContain("2nd floor")
  })
})

describe("issue drafts", () => {
  it("fills title, severity, description and location", () => {
    const d = x.issue("Water leak in the Block B basement. Pump stopped.", ctx)
    expect(d.values).toMatchObject({ severity: "high", projectUnitId: "u-b", description: "Water leak in the Block B basement. Pump stopped." })
    expect(d.values.title).toBe("Water leak in the Block B basement")
    expect(d.fields.description).toEqual({ state: "heard" })
  })
  it("links the current task when started from one", () => {
    const d = x.issue("hessian is drying out", { ...ctx, currentTaskId: "task-4" })
    expect(d.values.taskId).toBe("task-4")
    expect(d.fields.taskId).toEqual({ state: "heard" })
  })
  it("marks severity guessed when no signal word", () => {
    expect(x.issue("something is off with the lintel", ctx).fields.severity?.state).toBe("guessed")
  })
})

describe("progress drafts", () => {
  it("splits the day and reads people and quantity", () => {
    const d = x.progress("Laid 200 blocks on the east wall, 5 of us. Tomorrow we start the lintel. Waiting for cement", ctx)
    expect(d.values.todaySummary).toBe("Laid 200 blocks on the east wall, 5 of us")
    expect(d.values.tomorrowPlan).toBe("Tomorrow we start the lintel")
    expect(d.values.blockerSummary).toBe("Waiting for cement")
    expect(d.values.workersPresent).toBe(5)
    expect(d.values.completedQuantity).toBe(200)
    expect(d.values.unit).toBe("nos")
  })
  it("says which unit the quantity was spoken in", () => {
    expect(x.progress("Worked 8 hours on the slab", ctx).values).toMatchObject({ completedQuantity: 8, unit: "hour" })
    expect(x.progress("Poured 12 cubic metres", ctx).values).toMatchObject({ completedQuantity: 12, unit: "m3" })
    expect(x.progress("finished curing the footings", ctx).values.unit).toBeUndefined()
  })
  it("leaves tomorrow missing when not said", () => {
    const d = x.progress("finished curing the footings", ctx)
    expect(d.fields.tomorrowPlan).toEqual({ state: "missing" })
  })
})

describe("empty input", () => {
  it("returns empty drafts", () => {
    expect(x.task("   ", ctx).values).toEqual({})
    expect(x.issue("", ctx).values).toEqual({})
    expect(x.progress("", ctx).values).toEqual({})
  })
})
