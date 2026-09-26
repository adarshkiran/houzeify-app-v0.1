import { describe, expect, it } from "vitest"
import { getPublishedForCustomer } from "../mock/selectors"
import { DEMO_WORKER_PHONE, seedConstructionData } from "../mock/seed"
import * as commands from "./constructionCommands"
import type { SubmitDailyProgressInput } from "./commandInputs"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import { homeScreenFor, resolveRoute, type AccessContext } from "./navigation"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { parseStoredSession, PermissionError, type Session } from "./session"
import {
  findWorkerByPhone,
  pathToInProgress,
  workerDay,
  workerForSession,
  workerNextAction,
} from "./workerTasks"

const manager: Session = {
  accountType: "business",
  personId: "person-arjun",
  organizationId: "org-buildright",
}
const ravi: Session = {
  accountType: "worker",
  personId: "person-ravi",
  organizationId: "org-buildright",
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

const seed: ConstructionDataState = seedConstructionData

/** Runs a command and returns the next state. */
function apply<T>(
  state: ConstructionDataState,
  actor: Session,
  command: (
    s: ConstructionDataState,
    c: CommandContext,
  ) => { state: ConstructionDataState; result: T },
) {
  return command(state, ctxFor(actor)).state
}

const task = (state: ConstructionDataState, id: string) =>
  state.tasks.find((item) => item.id === id)!

function workerSubmit(
  taskId: string,
  extra: Partial<SubmitDailyProgressInput> = {},
): SubmitDailyProgressInput {
  const t = task(seed, taskId)
  return {
    projectId: t.projectId,
    projectUnitId: t.projectUnitId,
    taskId: t.id,
    stageId: t.stageId,
    tradeId: t.tradeId,
    workTypeId: t.workTypeId,
    workersPresent: 3,
    completedQuantity: { value: 8, unit: "m3" },
    todaySummary: "Backfilled and compacted Grid A east side",
    tomorrowPlan: "Finish Grid A west side",
    evidence: [
      {
        type: "photo",
        url: "blob:photo",
        caption: "Compaction",
        capturedByWorkerId: "worker-9",
      },
      { type: "audio", url: "blob:voice", caption: "Voice note" },
    ],
    ...extra,
  }
}

/** Ravi accepts and starts task-13 (the fresh backfill task). */
function started(): ConstructionDataState {
  let state = apply(seed, ravi, commands.acceptTaskAssignment("task-13"))
  state = apply(state, ravi, commands.startTask("task-13"))
  return state
}

describe("worker sessions and routes", () => {
  it("accepts a stored worker session only with its organization", () => {
    expect(parseStoredSession(JSON.stringify(ravi))).toEqual(ravi)
    expect(
      parseStoredSession(
        JSON.stringify({ accountType: "worker", personId: "person-ravi" }),
      ),
    ).toBeNull()
  })

  it("lands workers on Today and keeps them out of company screens", () => {
    const ctx: AccessContext = {
      session: ravi,
      memberships: seed.memberships,
      knownProjectIds: new Set(seed.projects.map((p) => p.id)),
    }
    expect(homeScreenFor(ravi)).toBe("worker-today")
    expect(resolveRoute({ screen: "worker-today", params: {} }, ctx)).toEqual({
      ok: true,
    })
    expect(
      resolveRoute({ screen: "company-dashboard", params: {} }, ctx),
    ).toMatchObject({ ok: false, redirect: { screen: "worker-today" } })
    expect(
      resolveRoute(
        {
          screen: "task-detail",
          params: { project_id: "project-sharma", task_id: "task-13" },
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, reason: "wrong-account-type" })
    // Own project: allowed. A project they are not on: back to Today.
    expect(
      resolveRoute(
        {
          screen: "worker-submit",
          params: { project_id: "project-sharma", task_id: "task-13" },
        },
        ctx,
      ),
    ).toEqual({ ok: true })
    expect(
      resolveRoute(
        {
          screen: "worker-task",
          params: { project_id: "project-tech-park", task_id: "task-2" },
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, redirect: { screen: "worker-today" } })
  })

  it("keeps business users out of the worker app", () => {
    const ctx: AccessContext = {
      session: manager,
      memberships: seed.memberships,
      knownProjectIds: new Set(seed.projects.map((p) => p.id)),
    }
    expect(
      resolveRoute({ screen: "worker-today", params: {} }, ctx),
    ).toMatchObject({ ok: false, redirect: { screen: "company-dashboard" } })
  })
})

describe("worker selectors", () => {
  it("finds the signed-in worker and signs in by phone", () => {
    expect(workerForSession(seed, ravi)?.id).toBe("worker-2")
    expect(workerForSession(seed, manager)).toBeUndefined()
    expect(findWorkerByPhone(seed, "9000011122")?.id).toBe("worker-2")
    expect(findWorkerByPhone(seed, DEMO_WORKER_PHONE)?.id).toBe("worker-2")
    // Workers without a linked person can't sign in yet.
    expect(findWorkerByPhone(seed, "+91 99999 00000")).toBeUndefined()
  })

  it("groups today's work by what the worker does next", () => {
    const day = workerDay(seed, "worker-2")
    expect(day.toAccept.map((t) => t.id)).toEqual(["task-13"])
    expect(day.today.map((t) => t.id)).toEqual(["task-4"])
    expect(day.waiting).toEqual([])
  })

  it("maps statuses to one next action and legal start paths", () => {
    expect(workerNextAction("assigned")).toBe("accept")
    expect(workerNextAction("accepted")).toBe("start")
    expect(workerNextAction("blocked")).toBe("start")
    expect(workerNextAction("in-progress")).toBe("submit")
    expect(workerNextAction("submitted")).toBe("waiting")
    expect(workerNextAction("approved")).toBe("done")
    expect(pathToInProgress("accepted")).toEqual(["ready", "in-progress"])
    expect(pathToInProgress("reopened")).toEqual(["in-progress"])
    expect(pathToInProgress("submitted")).toBeNull()
  })
})

describe("worker task commands", () => {
  it("lets the assigned worker accept, then start", () => {
    expect(() => commands.startTask("task-13")(seed, ctxFor(ravi))).toThrow(
      ConflictError,
    )
    let state = apply(seed, ravi, commands.acceptTaskAssignment("task-13"))
    expect(task(state, "task-13").status).toBe("accepted")
    expect(
      state.assignments.find((a) => a.id === "assignment-task-13-ravi")?.status,
    ).toBe("accepted")
    state = apply(state, ravi, commands.startTask("task-13"))
    expect(task(state, "task-13").status).toBe("in-progress")
    expect(task(state, "task-13").updatedAt).toBe(
      fixedClock.now().toISOString(),
    )
  })

  it("refuses tasks that aren't assigned to the worker", () => {
    // task-1 is in Ravi's scope (Sharma, civil) but assigned to the manager.
    expect(() =>
      commands.acceptTaskAssignment("task-1")(seed, ctxFor(ravi)),
    ).toThrow(ConflictError)
    expect(() => commands.startTask("task-1")(seed, ctxFor(ravi))).toThrow(
      ConflictError,
    )
    // Only worker accounts accept assignments.
    expect(() =>
      commands.acceptTaskAssignment("task-13")(seed, ctxFor(manager)),
    ).toThrow(PermissionError)
  })

  it("won't start a task that is already under way or in review", () => {
    expect(() => commands.startTask("task-4")(seed, ctxFor(ravi))).toThrow(
      ConflictError,
    )
  })

  it("limits progress-only members to site moves", () => {
    const state = started()
    expect(
      task(
        apply(state, ravi, commands.transitionTask("task-13", "blocked")),
        "task-13",
      ).status,
    ).toBe("blocked")
    for (const next of ["submitted", "cancelled", "delayed"] as const) {
      expect(() =>
        commands.transitionTask("task-13", next)(state, ctxFor(ravi)),
      ).toThrow(PermissionError)
    }
    // Review outcomes need task.manage: the worker can't approve, the manager can.
    const inReview = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === "task-13" ? { ...t, status: "review" as const } : t,
      ),
    }
    expect(() =>
      commands.transitionTask("task-13", "approved")(inReview, ctxFor(ravi)),
    ).toThrow(PermissionError)
    expect(
      task(
        apply(
          inReview,
          manager,
          commands.transitionTask("task-13", "approved"),
        ),
        "task-13",
      ).status,
    ).toBe("approved")
  })
})

describe("worker progress submission and supervisor review", () => {
  it("attributes the update and evidence to the worker and keeps it private", () => {
    const { state, result } = commands.submitDailyProgress(
      workerSubmit("task-13"),
    )(started(), ctxFor(ravi))
    expect(result.submittedByMembershipId).toBe("membership-worker-ravi-sharma")
    expect(result.completedQuantity).toEqual({ value: 8, unit: "m3" })
    expect(result.plannedQuantity).toEqual({ value: 24, unit: "m3" })
    expect(result.progressAfter).toBeUndefined()
    expect(result.progressBefore).toBeUndefined()
    const evidence = state.evidence.filter(
      (e) => e.dailyProgressId === result.id,
    )
    expect(evidence.map((e) => e.capturedByWorkerId)).toEqual([
      "worker-2",
      "worker-2",
    ])
    expect(evidence.map((e) => e.customerVisibility)).toEqual([
      "review-required",
      "private",
    ])
    expect(task(state, "task-13").status).toBe("submitted")
    expect(
      getPublishedForCustomer(state, "project-sharma").some(
        (p) => p.id === result.id,
      ),
    ).toBe(false)
  })

  it("approval keeps the update private until it is published", () => {
    const submitted = commands.submitDailyProgress(workerSubmit("task-13"))(
      started(),
      ctxFor(ravi),
    )
    const progressId = submitted.result.id
    // The worker can't approve their own update.
    expect(() =>
      commands.reviewDailyProgress(progressId, "approve")(
        submitted.state,
        ctxFor(ravi),
      ),
    ).toThrow(PermissionError)
    const state = apply(
      submitted.state,
      manager,
      commands.reviewDailyProgress(progressId, "approve"),
    )
    expect(
      getPublishedForCustomer(state, "project-sharma").some(
        (p) => p.id === progressId,
      ),
    ).toBe(false)
    const evidence = state.evidence.filter(
      (e) => e.dailyProgressId === progressId,
    )
    expect(evidence.map((e) => e.customerVisibility)).toEqual([
      "review-required",
      "private",
    ])
    expect(
      state.projects.find((p) => p.id === "project-sharma")?.progress,
    ).toBe(seed.projects.find((p) => p.id === "project-sharma")?.progress)
    expect(task(state, "task-13").status).toBe("approved")
    expect(task(state, "task-13").completedQuantity).toEqual({
      value: 8,
      unit: "m3",
    })
  })

  it("keeps a rejected worker update off the customer record", () => {
    const submitted = commands.submitDailyProgress(workerSubmit("task-13"))(
      started(),
      ctxFor(ravi),
    )
    const state = apply(
      submitted.state,
      manager,
      commands.reviewDailyProgress(submitted.result.id, "reject", "Wrong grid"),
    )
    expect(
      getPublishedForCustomer(state, "project-sharma").some(
        (p) => p.id === submitted.result.id,
      ),
    ).toBe(false)
    expect(task(state, "task-13").status).toBe("reopened")
  })

  it("rejects worker updates on unassigned or out-of-scope tasks", () => {
    expect(() =>
      commands.submitDailyProgress(workerSubmit("task-1"))(seed, ctxFor(ravi)),
    ).toThrow(ConflictError)
    expect(() =>
      commands.submitDailyProgress({
        ...workerSubmit("task-13"),
        taskId: undefined,
      })(seed, ctxFor(ravi)),
    ).toThrow(ConflictError)
    expect(() =>
      commands.submitDailyProgress(workerSubmit("task-2"))(seed, ctxFor(ravi)),
    ).toThrow(PermissionError)
  })

  it("rejects a negative quantity", () => {
    expect(() =>
      commands.submitDailyProgress(
        workerSubmit("task-13", {
          completedQuantity: { value: -1, unit: "m3" },
        }),
      )(started(), ctxFor(ravi)),
    ).toThrow(ConflictError)
  })
})

describe("assigning sign-in-capable workers", () => {
  it("gives a linked worker a scoped worker membership on the project", () => {
    const { state } = commands.assignWorkerToProject({
      workerId: "worker-2",
      projectId: "project-reddy",
      projectUnitIds: ["unit-reddy-villa"],
      tradeIds: ["trade-civil"],
    })(seed, ctxFor(manager))
    const membership = state.memberships.find(
      (m) => m.projectId === "project-reddy" && m.principalId === "person-ravi",
    )
    expect(membership).toMatchObject({
      role: "worker",
      status: "active",
      scope: {
        projectUnitIds: ["unit-reddy-villa"],
        stageIds: [],
        tradeIds: ["trade-civil"],
      },
    })
  })

  it("adds no membership for workers who can't sign in", () => {
    const { state } = commands.assignWorkerToProject({
      workerId: "worker-5",
      projectId: "project-reddy",
    })(seed, ctxFor(manager))
    expect(state.memberships).toHaveLength(seed.memberships.length)
  })
})
