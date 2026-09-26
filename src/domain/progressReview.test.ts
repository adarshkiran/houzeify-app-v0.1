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

function sentBack() {
  const submitted = raviSubmitted()
  const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "request-changes", "Add the west side"))
  return { state, previous: find(state, submitted.result.id) }
}

describe("resubmitDailyProgress", () => {
  it("creates version 2, supersedes version 1 and carries kept evidence", () => {
    const { state, previous } = sentBack()
    const [keep] = previous.evidenceIds
    const next = run(state, ravi, commands.resubmitDailyProgress(previous.id, {
      workersPresent: 3,
      completedQuantity: { value: 8, unit: "m3" },
      todaySummary: "Backfilled Grid A east and west",
      tomorrowPlan: "Grid B",
      keepEvidenceIds: [keep],
      evidence: [{ type: "photo", url: "blob:west", caption: "West side" }],
    }))
    const v1 = find(next.state, previous.id)
    const v2 = next.result
    expect(v2.version).toBe(2)
    expect(v2.supersedesId).toBe(previous.id)
    expect(v2.reviewStatus).toBe("submitted")
    expect(v1.reviewStatus).toBe("superseded")
    expect(v1.supersededById).toBe(v2.id)
    expect(v1.todaySummary).toBe("Backfilled Grid A east") // never overwritten
    expect(v2.evidenceIds[0]).toBe(keep)
    expect(v2.evidenceIds).toHaveLength(2)
    expect(next.state.evidence.find((e) => e.id === keep)!.dailyProgressId).toBe(v2.id)
    expect(v2.taskId).toBe("task-13")
    // Sent back put it in progress; resending moves it to submitted again.
    expect(next.state.tasks.find((t) => t.id === "task-13")!.status).toBe("submitted")
  })

  it("only works on an update sent back for changes", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, ravi, commands.resubmitDailyProgress(submitted.result.id, {
      workersPresent: 1, todaySummary: "x", tomorrowPlan: "y", keepEvidenceIds: [], evidence: [],
    }))).toThrow("Only an update sent back for changes can be resubmitted.")
  })

  it("only the original submitter can resubmit", () => {
    const { state, previous } = sentBack()
    expect(() => run(state, manager, commands.resubmitDailyProgress(previous.id, {
      workersPresent: 1, todaySummary: "x", tomorrowPlan: "y", keepEvidenceIds: [], evidence: [],
    }))).toThrow(PermissionError)
  })

  it("an outsider with no access to the project gets a PermissionError, not a status/evidence leak", () => {
    const { state, previous } = sentBack()
    const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
    expect(() => run(state, homeowner, commands.resubmitDailyProgress(previous.id, {
      workersPresent: 1, todaySummary: "x", tomorrowPlan: "y", keepEvidenceIds: [], evidence: [],
    }))).toThrow(PermissionError)
  })

  it("can't keep evidence from another update", () => {
    const { state, previous } = sentBack()
    expect(() => run(state, ravi, commands.resubmitDailyProgress(previous.id, {
      workersPresent: 1, todaySummary: "x", tomorrowPlan: "y", keepEvidenceIds: ["evidence-sharma-1"], evidence: [],
    }))).toThrow()
  })
})

function approved() {
  const submitted = raviSubmitted()
  const { state } = run(submitted.state, manager, commands.reviewDailyProgress(submitted.result.id, "approve"))
  return { state, item: find(state, submitted.result.id) }
}

describe("publishDailyProgress", () => {
  it("shares only the chosen evidence with the homeowner", () => {
    const { state, item } = approved()
    const [first] = item.evidenceIds
    const published = run(state, manager, commands.publishDailyProgress(item.id, [first])).state
    const after = find(published, item.id)
    expect(after.publicationStatus).toBe("published")
    expect(after.publication).toEqual({
      publishedByMembershipId: "membership-manager-1",
      publishedAt: "2026-09-27T09:30:00.000Z",
      evidenceIds: [first],
    })
    expect(published.evidence.filter((e) => e.dailyProgressId === item.id).map((e) => e.customerVisibility))
      .toEqual(["customer-visible", "review-required", "private"])
    expect(getPublishedForCustomer(published, "project-sharma").some((p) => p.id === item.id)).toBe(true)
  })

  it("does not change project progress", () => {
    const { state, item } = approved()
    const published = run(state, manager, commands.publishDailyProgress(item.id, [])).state
    expect(published.projects).toBe(state.projects)
  })

  it("refuses voice notes", () => {
    const { state, item } = approved()
    const audio = state.evidence.find((e) => e.dailyProgressId === item.id && e.type === "audio")!
    expect(() => run(state, manager, commands.publishDailyProgress(item.id, [audio.id])))
      .toThrow("Voice notes can't be shared with the homeowner.")
  })

  it("refuses evidence from another update", () => {
    const { state, item } = approved()
    expect(() => run(state, manager, commands.publishDailyProgress(item.id, ["evidence-sharma-1"]))).toThrow()
  })

  it("only publishes approved updates", () => {
    const submitted = raviSubmitted()
    expect(() => run(submitted.state, manager, commands.publishDailyProgress(submitted.result.id, [])))
      .toThrow("Only approved updates can be published.")
  })

  it("needs the publish permission", () => {
    const { state, item } = approved()
    expect(() => run(state, ravi, commands.publishDailyProgress(item.id, []))).toThrow(PermissionError)
  })

  it("publishing twice is a no-op", () => {
    const { state, item } = approved()
    const once = run(state, manager, commands.publishDailyProgress(item.id, []))
    const twice = run(once.state, manager, commands.publishDailyProgress(item.id, [item.evidenceIds[0]]))
    expect(twice.state).toBe(once.state)
  })
})
