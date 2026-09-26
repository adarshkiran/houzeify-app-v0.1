import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import * as commands from "./constructionCommands"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

const manager: Session = {
  accountType: "business",
  personId: "person-arjun",
  organizationId: "org-buildright",
}
const homeowner: Session = {
  accountType: "homeowner",
  personId: "person-demo-homeowner",
}

const fixedClock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }

function sequentialIds(): IdGenerator {
  let n = 0
  return { next: (prefix) => `${prefix}-${++n}`, short: () => `s${++n}` }
}

const ctxFor = (actor: Session | null): CommandContext => ({
  actor,
  clock: fixedClock,
  ids: sequentialIds(),
})

const state: ConstructionDataState = seedConstructionData
const PROJECT = "project-sharma"

function submitInput() {
  const unit = state.projectUnits.find((item) => item.projectId === PROJECT)!
  const task = state.tasks.find((item) => item.projectId === PROJECT)!
  return {
    projectId: PROJECT,
    projectUnitId: unit.id,
    taskId: task.id,
    stageId: task.stageId,
    tradeId: task.tradeId,
    workTypeId: task.workTypeId,
    workersPresent: 4,
    progressAfter: 30,
    todaySummary: "Poured slab",
    tomorrowPlan: "Curing",
    evidence: [],
  }
}

describe("authorization", () => {
  it("rejects signed-out and homeowner actors on project mutations", () => {
    for (const actor of [null, homeowner]) {
      expect(() =>
        commands.submitDailyProgress(submitInput())(state, ctxFor(actor)),
      ).toThrow(PermissionError)
      expect(() =>
        commands.addProjectUnit({
          projectId: PROJECT,
          kind: "block",
          code: "B",
          name: "Block B",
        })(state, ctxFor(actor)),
      ).toThrow(PermissionError)
    }
  })

  it("rejects a homeowner on company-only commands", () => {
    expect(() =>
      commands.createProject({
        organizationId: "org-buildright",
        name: "X",
        code: "X",
        kind: "individual-house",
        status: "planning",
        location: "Pune",
        trackingStartedMidProject: false,
      })(state, ctxFor(homeowner)),
    ).toThrow(PermissionError)
    expect(() =>
      commands.addLibraryTrade({ name: "Glazing" })(state, ctxFor(homeowner)),
    ).toThrow(PermissionError)
  })

  it("rejects a business user from a different organization", () => {
    const other: Session = { ...manager, organizationId: "org-other" }
    expect(() =>
      commands.addWorker({
        organizationId: "org-buildright",
        name: "A",
        tradeIds: [],
      })(state, ctxFor(other)),
    ).toThrow(PermissionError)
  })

  it("lets an authorized manager succeed", () => {
    const { result } = commands.submitDailyProgress(submitInput())(
      state,
      ctxFor(manager),
    )
    expect(result.reviewStatus).toBe("submitted")
  })

  it("authorizes review against the stored item's project", () => {
    const ctx = ctxFor(manager)
    const { state: after, result } = commands.submitDailyProgress(submitInput())(
      state,
      ctx,
    )
    // Same item, but the actor loses access to its project.
    const revoked: ConstructionDataState = {
      ...after,
      memberships: after.memberships.filter(
        (m) => !(m.projectId === PROJECT && m.principalId === manager.personId),
      ),
    }
    expect(() =>
      commands.reviewDailyProgress(result.id, "approve")(revoked, ctx),
    ).toThrow(PermissionError)
    expect(() =>
      commands.reviewDailyProgress("missing", "approve")(after, ctx),
    ).toThrow(PermissionError)
  })
})

describe("determinism and purity", () => {
  it("uses the injected clock and id generator", () => {
    const { result } = commands.submitDailyProgress(submitInput())(
      state,
      ctxFor(manager),
    )
    expect(result.id).toBe("progress-1")
    expect(result.submittedAt).toBe("2026-09-27T09:30:00.000Z")
  })

  it("returns identical output for identical input", () => {
    const run = () =>
      commands.createTask({
        projectId: PROJECT,
        projectUnitId: submitInput().projectUnitId,
        stageId: submitInput().stageId,
        tradeId: submitInput().tradeId,
        workTypeId: submitInput().workTypeId,
        title: "T",
        priority: "medium",
      })(state, ctxFor(manager))
    expect(run()).toEqual(run())
  })

  it("never mutates the state it is given", () => {
    const before = structuredClone(state)
    commands.submitDailyProgress(submitInput())(state, ctxFor(manager))
    commands.addProjectUnits([
      { projectId: PROJECT, kind: "block", code: "B", name: "B" },
    ])(state, ctxFor(manager))
    expect(state).toEqual(before)
  })
})

describe("addProjectUnits", () => {
  const input = (code: string) => ({
    projectId: PROJECT,
    kind: "block" as const,
    code,
    name: code,
  })

  it("numbers a batch sequentially and adds each unit exactly once", () => {
    const base = state.projectUnits.filter(
      (u) => u.projectId === PROJECT && u.parentUnitId === undefined,
    ).length
    const { state: after, result } = commands.addProjectUnits([
      input("A"),
      input("B"),
      input("C"),
    ])(state, ctxFor(manager))
    expect(result.map((u) => u.sequence)).toEqual([base + 1, base + 2, base + 3])
    expect(after.projectUnits).toHaveLength(state.projectUnits.length + 3)
  })

  it("running the same command twice on the same state gives the same result", () => {
    // React may invoke updaters twice; a pure command must not accumulate.
    const command = commands.addProjectUnits([input("A"), input("B")])
    const first = command(state, ctxFor(manager))
    const second = command(state, ctxFor(manager))
    expect(second.result).toEqual(first.result)
    expect(second.state.projectUnits).toHaveLength(first.state.projectUnits.length)
  })
})

describe("daily progress review", () => {
  it("approve keeps the item private and is idempotent", () => {
    const ctx = ctxFor(manager)
    const submitted = commands.submitDailyProgress(submitInput())(state, ctx)
    const approved = commands.reviewDailyProgress(
      submitted.result.id,
      "approve",
    )(submitted.state, ctx)
    const item = approved.state.dailyProgress.find(
      (p) => p.id === submitted.result.id,
    )!
    expect(item.reviewStatus).toBe("approved")
    expect(item.publicationStatus).toBe("private")

    const again = commands.reviewDailyProgress(
      submitted.result.id,
      "reject",
      "Late",
    )(approved.state, ctx)
    expect(again.state).toBe(approved.state)
  })
})

describe("workforce", () => {
  it("returns the existing active assignment instead of a phantom one", () => {
    const ctx = ctxFor(manager)
    const worker = state.workers[0]
    const first = commands.assignWorkerToProject({
      workerId: worker.id,
      projectId: "project-lakeside",
    })(state, ctx)
    const second = commands.assignWorkerToProject({
      workerId: worker.id,
      projectId: "project-lakeside",
    })(first.state, ctx)
    expect(second.result.id).toBe(first.result.id)
    expect(second.state).toBe(first.state)
  })
})

describe("work library", () => {
  it("is idempotent for an existing stage or trade", () => {
    const ctx = ctxFor(manager)
    const once = commands.addLibraryTrade({ name: "Glazing" })(state, ctx)
    const twice = commands.addLibraryTrade({ name: "Glazing" })(once.state, ctx)
    expect(twice.state.trades).toHaveLength(once.state.trades.length)
    expect(twice.result.id).toBe(once.result.id)
  })
})
