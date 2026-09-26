import { beforeEach, describe, expect, it } from "vitest"
import { getPublishedForCustomer } from "../mock/selectors"
import { seedConstructionData as seed } from "../mock/seed"
import * as commands from "./constructionCommands"
import type { SubmitDailyProgressInput } from "./commandInputs"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const clock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }

// One id sequence per test, shared by every command, so ids never collide.
let ids: IdGenerator
beforeEach(() => {
  let n = 0
  ids = { next: (prefix) => `${prefix}-${++n}`, short: () => `s${++n}` }
})
const as = (actor: Session): CommandContext => ({ actor, clock, ids })

function run<T>(
  state: ConstructionDataState,
  actor: Session,
  command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T },
) {
  return command(state, as(actor))
}

const find = (state: ConstructionDataState, id: string) =>
  state.dailyProgress.find((p) => p.id === id)!

function raviInput(extra: Partial<SubmitDailyProgressInput> = {}): SubmitDailyProgressInput {
  const t = seed.tasks.find((item) => item.id === "task-13")!
  return {
    projectId: t.projectId,
    projectUnitId: t.projectUnitId,
    taskId: t.id,
    stageId: t.stageId,
    tradeId: t.tradeId,
    workTypeId: t.workTypeId,
    workersPresent: 3,
    completedQuantity: { value: 8, unit: "m3" },
    todaySummary: "Backfilled Grid A east",
    tomorrowPlan: "Grid A west",
    evidence: [
      { type: "photo", url: "blob:photo-1", caption: "East side" },
      { type: "photo", url: "blob:photo-2", caption: "Compaction" },
      { type: "audio", url: "blob:voice", caption: "Voice note" },
    ],
    ...extra,
  }
}

/** Ravi accepts, starts and submits task-13. */
function raviSubmitted() {
  let state = run(seed, ravi, commands.acceptTaskAssignment("task-13")).state
  state = run(state, ravi, commands.startTask("task-13")).state
  return run(state, ravi, commands.submitDailyProgress(raviInput()))
}

describe("reviewDailyProgress", () => {
  it("approve records the reviewer but does not publish", () => {
    const submitted = raviSubmitted()
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve", "Good work"))
    const item = find(state, submitted.result.id)
    expect(item.reviewStatus).toBe("approved")
    expect(item.publicationStatus).toBe("private")
    expect(item.review).toEqual({
      decision: "approve",
      note: "Good work",
      reviewedByMembershipId: "membership-manager-1",
      reviewedAt: "2026-09-27T09:30:00.000Z",
    })
    expect(state.evidence.filter((e) => e.dailyProgressId === item.id).map((e) => e.customerVisibility))
      .toEqual(["review-required", "review-required", "private"])
    expect(getPublishedForCustomer(state, "project-sharma").some((p) => p.id === item.id)).toBe(false)
  })

  it("approve recalculates project progress from tasks, ignoring the typed %", () => {
    const submitted = raviSubmitted()
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve"))
    // task-13: 8 of 24 m3 → Foundation 90 + 10 × avg(0, 33.3)% = 91.67 → project 34.25 → 34
    expect(state.projects.find((p) => p.id === "project-sharma")!.progress).toBe(34)
  })

  it("request changes needs a note, then sends the task back to in progress", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "request-changes", "  ")))
      .toThrow("Add a note so the worker knows what to fix.")
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "request-changes", "Add a photo of the west side"))
    const item = find(state, submitted.result.id)
    expect(item.reviewStatus).toBe("changes-requested")
    expect(item.review?.note).toBe("Add a photo of the west side")
    expect(state.tasks.find((t) => t.id === "task-13")!.status).toBe("in-progress")
  })

  it("reject needs a note and reopens the task", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "reject")))
      .toThrow(ConflictError)
    const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "reject", "Wrong task"))
    expect(find(state, submitted.result.id).reviewStatus).toBe("rejected")
    expect(state.tasks.find((t) => t.id === "task-13")!.status).toBe("reopened")
  })

  it("ignores a second review of the same update", () => {
    const submitted = raviSubmitted()
    const once = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve"))
    const twice = run(once.state, manager, commands.reviewDailyProgress(submitted.result.id, "reject", "Late"))
    expect(twice.state).toBe(once.state)
  })

  it("a worker can't review", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, ravi, commands.reviewDailyProgress(submitted.result.id, "approve")))
      .toThrow(PermissionError)
  })
})
