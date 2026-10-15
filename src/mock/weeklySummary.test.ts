import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "./seed"
import type {
  ConstructionDataState,
  DailyProgress,
  Evidence,
  Issue,
  Project,
  Task,
  WorkerAttendance,
} from "../domain/models"
import { summarizeWeek } from "./weeklySummary"

const TODAY = "2026-10-16"
const WEEK_END = "2026-10-16" // window 2026-10-10 … 2026-10-16

const project: Project = {
  id: "p1",
  organizationId: "org-buildright",
  code: "P1",
  name: "Test Project",
  kind: "individual-house",
  status: "active",
  location: "Hyderabad",
  progress: 0,
  trackingStartedMidProject: false,
  requireCheckout: false,
  stageBaselines: {},
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
}

function update(date: string, overrides: Partial<DailyProgress> = {}): DailyProgress {
  return {
    id: `dp-${date}-${overrides.version ?? 1}`,
    projectId: "p1",
    projectUnitId: "u1",
    stageId: "stage-foundation",
    tradeId: "trade-civil",
    workTypeId: "work-backfilling",
    date,
    workersPresent: 4,
    todaySummary: `Work on ${date}`,
    tomorrowPlan: "More",
    evidenceIds: [],
    submittedByMembershipId: "m1",
    submittedAt: `${date}T10:00:00Z`,
    reviewStatus: "approved",
    publicationStatus: "published",
    version: 1,
    ...overrides,
  }
}

function evidence(id: string, visibility: Evidence["customerVisibility"], dailyProgressId?: string): Evidence {
  return {
    id,
    projectId: "p1",
    dailyProgressId,
    type: "photo",
    url: `blob:${id}`,
    capturedAt: "2026-10-12T10:00:00Z",
    customerVisibility: visibility,
  }
}

function issue(id: string, overrides: Partial<Issue> = {}): Issue {
  return {
    id,
    projectId: "p1",
    title: `Issue ${id}`,
    description: "",
    severity: "medium",
    status: "open",
    evidenceIds: [],
    customerVisibility: "customer-visible",
    createdByMembershipId: "m1",
    createdAt: "2026-10-12T00:00:00Z",
    ...overrides,
  }
}

function stateWith(parts: {
  progress?: DailyProgress[]
  issues?: Issue[]
  tasks?: Task[]
  evidence?: Evidence[]
  attendance?: WorkerAttendance[]
}): ConstructionDataState {
  return {
    ...seed,
    projects: [project],
    dailyProgress: parts.progress ?? [],
    issues: parts.issues ?? [],
    tasks: parts.tasks ?? [],
    evidence: parts.evidence ?? [],
    workerAttendance: parts.attendance ?? [],
  }
}

const company = (state: ConstructionDataState, weekEnd = WEEK_END) =>
  summarizeWeek(state, "p1", weekEnd, { audience: "company", today: TODAY })!
const homeowner = (state: ConstructionDataState, weekEnd = WEEK_END) =>
  summarizeWeek(state, "p1", weekEnd, { audience: "homeowner", today: TODAY })!

describe("summarizeWeek window", () => {
  it("returns undefined for an unknown project", () => {
    expect(summarizeWeek(stateWith({}), "nope", WEEK_END, { audience: "company", today: TODAY })).toBeUndefined()
  })

  it("covers seven days ending on the chosen date, oldest first", () => {
    const summary = company(stateWith({}))
    expect(summary.from).toBe("2026-10-10")
    expect(summary.to).toBe("2026-10-16")
    expect(summary.days.map((d) => d.date)).toEqual([
      "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16",
    ])
  })

  it("includes the first and last day and excludes the day before and after", () => {
    const state = stateWith({
      progress: [update("2026-10-09"), update("2026-10-10"), update("2026-10-16"), update("2026-10-17")],
    })
    const summary = company(state)
    expect(summary.totals.updates).toBe(2)
    expect(summary.days.find((d) => d.date === "2026-10-10")!.notes).toEqual(["Work on 2026-10-10"])
    expect(summary.days.find((d) => d.date === "2026-10-16")!.notes).toEqual(["Work on 2026-10-16"])
  })

  it("steps by a week", () => {
    const state = stateWith({ progress: [update("2026-10-05")] })
    expect(company(state, "2026-10-16").totals.updates).toBe(0)
    expect(company(state, "2026-10-09").totals.updates).toBe(1)
  })

  it("is deterministic", () => {
    const state = stateWith({ progress: [update("2026-10-12")] })
    expect(company(state)).toEqual(company(state))
  })
})

describe("summarizeWeek counts", () => {
  it("counts updates, reported days, peak workers and notes", () => {
    const state = stateWith({
      progress: [
        update("2026-10-12", { workersPresent: 3, todaySummary: "Footing steel tied" }),
        update("2026-10-12", { id: "dp-b", workersPresent: 9, todaySummary: "Shuttering" }),
        update("2026-10-14", { workersPresent: 5 }),
      ],
    })
    const summary = company(state)
    expect(summary.totals.updates).toBe(3)
    expect(summary.totals.daysReported).toBe(2)
    expect(summary.totals.peakWorkers).toBe(9)
    expect(summary.days.find((d) => d.date === "2026-10-12")!.notes).toEqual(["Footing steel tied", "Shuttering"])
  })

  it("counts issues raised, resolved and open", () => {
    const state = stateWith({
      issues: [
        issue("i1", { createdAt: "2026-10-11T00:00:00Z" }),
        issue("i2", { createdAt: "2026-09-01T00:00:00Z", status: "resolved", updatedAt: "2026-10-13T00:00:00Z" }),
        issue("i3", { createdAt: "2026-09-01T00:00:00Z", status: "closed", updatedAt: "2026-09-20T00:00:00Z" }),
        issue("i4", { createdAt: "2026-10-12T00:00:00Z", status: "in-progress" }),
      ],
    })
    const totals = company(state).totals
    expect(totals.issuesRaised).toBe(2)
    expect(totals.issuesResolved).toBe(1)
    expect(totals.issuesOpen).toBe(2)
  })

  it("counts completed tasks, worker-days and updates awaiting review for the company", () => {
    const task = (id: string, status: Task["status"], updatedAt: string): Task => ({
      id,
      projectId: "p1",
      projectUnitId: "u1",
      stageId: "stage-foundation",
      tradeId: "trade-civil",
      workTypeId: "work-backfilling",
      title: id,
      status,
      priority: "medium",
      checklist: [],
      createdByMembershipId: "m1",
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt,
    })
    const att = (id: string, date: string, status: WorkerAttendance["status"]): WorkerAttendance => ({
      id,
      workerId: "w1",
      projectId: "p1",
      assignmentId: "a1",
      date,
      status,
      recordedBy: "supervisor",
      createdAt: "x",
      updatedAt: "x",
    })
    const state = stateWith({
      tasks: [
        task("t1", "completed", "2026-10-13T00:00:00Z"),
        task("t2", "approved", "2026-10-02T00:00:00Z"),
        task("t3", "in-progress", "2026-10-13T00:00:00Z"),
      ],
      attendance: [
        att("a1", "2026-10-12", "present"),
        att("a2", "2026-10-13", "half-day"),
        att("a3", "2026-10-14", "absent"),
        att("a4", "2026-10-01", "present"),
      ],
      progress: [update("2026-10-14", { reviewStatus: "submitted", publicationStatus: "private" })],
    })
    const totals = company(state).totals
    expect(totals.tasksCompleted).toBe(1)
    expect(totals.workerDays).toBe(2)
    expect(totals.awaitingReview).toBe(1)
  })

  it("derives confidence from how many days were reported", () => {
    const dates = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]
    expect(company(stateWith({})).confidence).toBe("low")
    expect(company(stateWith({ progress: [update("2026-10-12")] })).confidence).toBe("medium")
    expect(company(stateWith({ progress: dates.map((d) => update(d)) })).confidence).toBe("high")
  })

  it("says plainly when nothing was reported", () => {
    const summary = company(stateWith({}))
    expect(summary.lines[0]).toMatch(/no site updates/i)
    expect(summary.assumptions.length).toBeGreaterThan(0)
  })
})

describe("audience isolation", () => {
  const secretTask: Task = {
    id: "secret-task",
    projectId: "p1",
    projectUnitId: "u1",
    stageId: "stage-foundation",
    tradeId: "trade-civil",
    workTypeId: "work-backfilling",
    title: "INTERNAL-TASK-TITLE",
    status: "completed",
    priority: "medium",
    checklist: [],
    createdByMembershipId: "m1",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-10-13T00:00:00Z",
  }
  const state = stateWith({
    progress: [
      update("2026-10-12", { todaySummary: "PUBLISHED-NOTE", blockerSummary: "PUBLISHED-BUT-BLOCKER-TEXT" }),
      update("2026-10-13", {
        id: "dp-draft",
        todaySummary: "DRAFT-NOTE",
        reviewStatus: "draft",
        publicationStatus: "private",
      }),
      update("2026-10-14", {
        id: "dp-submitted",
        todaySummary: "SUBMITTED-NOTE",
        reviewStatus: "submitted",
        publicationStatus: "private",
      }),
      update("2026-10-15", {
        id: "dp-approved-private",
        todaySummary: "APPROVED-NOT-PUBLISHED-NOTE",
        reviewStatus: "approved",
        publicationStatus: "private",
      }),
      update("2026-10-11", {
        id: "dp-rejected",
        todaySummary: "REJECTED-NOTE",
        reviewStatus: "rejected",
        publicationStatus: "private",
      }),
    ],
    issues: [
      issue("shared", { title: "SHARED-ISSUE", customerVisibility: "customer-visible" }),
      issue("private", { title: "PRIVATE-ISSUE", customerVisibility: "private", severity: "critical" }),
    ],
    tasks: [secretTask],
    evidence: [
      evidence("ev-visible", "customer-visible", "dp-2026-10-12-1"),
      evidence("ev-private", "private", "dp-2026-10-12-1"),
      evidence("ev-draft", "private", "dp-draft"),
    ],
    attendance: [
      {
        id: "a1",
        workerId: "w1",
        projectId: "p1",
        assignmentId: "a1",
        date: "2026-10-12",
        status: "present",
        recordedBy: "supervisor",
        createdAt: "x",
        updatedAt: "x",
      },
    ],
  })
  // Publish only evidence ev-visible on the published update.
  state.dailyProgress = state.dailyProgress.map((item) =>
    item.id === "dp-2026-10-12-1"
      ? {
          ...item,
          evidenceIds: ["ev-visible", "ev-private"],
          publication: { publishedByMembershipId: "m1", publishedAt: "2026-10-12T12:00:00Z", evidenceIds: ["ev-visible"] },
        }
      : item,
  )

  it("shows the homeowner only published updates and shared issues", () => {
    const summary = homeowner(state)
    const text = JSON.stringify(summary)
    expect(text).toContain("PUBLISHED-NOTE")
    for (const secret of [
      "DRAFT-NOTE",
      "SUBMITTED-NOTE",
      "APPROVED-NOT-PUBLISHED-NOTE",
      "REJECTED-NOTE",
      "PUBLISHED-BUT-BLOCKER-TEXT",
      "PRIVATE-ISSUE",
      "INTERNAL-TASK-TITLE",
    ]) {
      expect(text, secret).not.toContain(secret)
    }
    expect(summary.totals.updates).toBe(1)
    expect(summary.totals.issuesRaised).toBe(1)
    expect(summary.totals.evidence).toBe(1)
  })

  it("never computes company-only figures for a homeowner", () => {
    const summary = homeowner(state)
    expect(summary.blockers).toBeUndefined()
    expect(summary.totals.tasksCompleted).toBeUndefined()
    expect(summary.totals.workerDays).toBeUndefined()
    expect(summary.totals.awaitingReview).toBeUndefined()
  })

  it("gives the company the live picture, including blockers and tasks", () => {
    const summary = company(state)
    const text = JSON.stringify(summary)
    expect(text).toContain("PUBLISHED-NOTE")
    expect(text).toContain("SUBMITTED-NOTE")
    expect(text).not.toContain("DRAFT-NOTE")
    expect(text).not.toContain("REJECTED-NOTE")
    expect(summary.blockers).toContain("PUBLISHED-BUT-BLOCKER-TEXT")
    expect(summary.totals.tasksCompleted).toBe(1)
    expect(summary.totals.workerDays).toBe(1)
    expect(summary.totals.issuesRaised).toBe(2)
  })

  it("does not let a superseded version double count", () => {
    const withSuperseded = {
      ...state,
      dailyProgress: [
        ...state.dailyProgress,
        update("2026-10-12", { id: "dp-old", reviewStatus: "superseded", todaySummary: "OLD-VERSION" }),
      ],
    }
    expect(JSON.stringify(company(withSuperseded))).not.toContain("OLD-VERSION")
  })
})

describe("summarizeWeek wording", () => {
  it("pluralises counts correctly", () => {
    const one = summarizeWeek(
      stateWith({
        progress: [update("2026-10-12", { evidenceIds: ["e1"] })],
        evidence: [evidence("e1", "customer-visible", "dp-2026-10-12-1")],
      }),
      "p1",
      WEEK_END,
      { audience: "company", today: TODAY },
    )!
    expect(one.lines.join("\n")).toContain("1 site update across 1 of 7 days, with up to 4 workers on site.")
    expect(one.lines.join("\n")).toContain("1 attachment (photos or files) shared")
    const two = company(
      stateWith({
        progress: [update("2026-10-12"), update("2026-10-13")],
        evidence: [evidence("e1", "private", "dp-2026-10-12-1"), evidence("e2", "private", "dp-2026-10-13-1")],
      }),
    )
    expect(two.lines.join("\n")).toContain("2 site updates across 2 of 7 days")
    expect(two.lines.join("\n")).toContain("2 attachments (photos or files) shared")
  })
})
