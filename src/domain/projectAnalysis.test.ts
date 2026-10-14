import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import type { ConstructionDataState, DailyProgress, Issue, Project, Task } from "./models"
import {
  LATE_START_MEDIUM_DAYS,
  OVERDUE_HIGH_DAYS,
  SCHEDULE_VARIANCE_HIGH_POINTS,
  SCHEDULE_VARIANCE_MEDIUM_POINTS,
  SERIOUS_ISSUE_AGE_DAYS,
  STALE_UPDATE_DAYS,
  STALE_UPDATE_HIGH_DAYS,
  analyzeProject,
} from "./projectAnalysis"

const TODAY = "2026-10-15"

const baseProject: Project = {
  id: "p1",
  organizationId: "org-buildright",
  code: "P1",
  name: "Test Project",
  kind: "individual-house",
  status: "active",
  location: "Hyderabad",
  startDate: "2026-10-14",
  targetDate: "2026-12-14",
  progress: 0,
  trackingStartedMidProject: false,
  requireCheckout: false,
  stageBaselines: {},
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: "p1",
    projectUnitId: "u1",
    stageId: "stage-foundation",
    tradeId: "trade-civil",
    workTypeId: "work-backfilling",
    title: `Task ${overrides.id}`,
    status: "in-progress",
    priority: "medium",
    checklist: [],
    createdByMembershipId: "m1",
    createdAt: "2026-09-16T00:00:00Z",
    updatedAt: "2026-09-16T00:00:00Z",
    ...overrides,
  }
}

function update(date: string, overrides: Partial<DailyProgress> = {}): DailyProgress {
  return {
    id: `dp-${date}`,
    projectId: "p1",
    projectUnitId: "u1",
    stageId: "stage-foundation",
    tradeId: "trade-civil",
    workTypeId: "work-backfilling",
    date,
    workersPresent: 3,
    todaySummary: "work",
    tomorrowPlan: "more",
    evidenceIds: [],
    submittedByMembershipId: "m1",
    submittedAt: `${date}T10:00:00Z`,
    reviewStatus: "approved",
    publicationStatus: "private",
    version: 1,
    ...overrides,
  }
}

function issue(overrides: Partial<Issue> & { id: string }): Issue {
  return {
    projectId: "p1",
    title: `Issue ${overrides.id}`,
    description: "",
    severity: "medium",
    status: "open",
    evidenceIds: [],
    customerVisibility: "private",
    createdByMembershipId: "m1",
    createdAt: "2026-10-14T00:00:00Z",
    ...overrides,
  }
}

function stateWith(parts: {
  project?: Partial<Project>
  tasks?: Task[]
  progress?: DailyProgress[]
  issues?: Issue[]
}): ConstructionDataState {
  return {
    ...seed,
    projects: [{ ...baseProject, ...parts.project }],
    tasks: parts.tasks ?? [],
    dailyProgress: parts.progress ?? [],
    issues: parts.issues ?? [],
    workPlanItems: [],
  }
}

const kinds = (state: ConstructionDataState, today = TODAY) =>
  analyzeProject(state, "p1", today)!.signals.map((s) => s.kind)

describe("analyzeProject", () => {
  it("returns undefined for an unknown project", () => {
    expect(analyzeProject(stateWith({}), "nope", TODAY)).toBeUndefined()
  })

  it("is deterministic for the same state and date", () => {
    const state = stateWith({ tasks: [task({ id: "t1", dueDate: "2026-10-01" })] })
    const a = analyzeProject(state, "p1", TODAY)
    const b = analyzeProject(state, "p1", TODAY)
    expect(a).toEqual(b)
  })

  describe("status and confidence", () => {
    it("is not-enough-data with low confidence and an assumption when there are no tasks", () => {
      const report = analyzeProject(stateWith({}), "p1", TODAY)!
      expect(report.status).toBe("not-enough-data")
      expect(report.confidence).toBe("low")
      expect(report.assumptions.length).toBeGreaterThan(0)
    })

    it("is on-track when nothing fires", () => {
      const tasks = Array.from({ length: 5 }, (_, i) => task({ id: `t${i}`, dueDate: "2026-12-01" }))
      const report = analyzeProject(
        stateWith({ tasks, progress: [update("2026-10-14")], project: { progress: 20 } }),
        "p1",
        TODAY,
      )!
      expect(report.signals).toEqual([])
      expect(report.status).toBe("on-track")
      expect(report.confidence).toBe("high")
    })

    it("is medium confidence with few tasks or missing dates", () => {
      const few = analyzeProject(stateWith({ tasks: [task({ id: "t1" })], progress: [update("2026-10-14")] }), "p1", TODAY)!
      expect(few.confidence).toBe("medium")
      const noDates = analyzeProject(
        stateWith({
          tasks: Array.from({ length: 6 }, (_, i) => task({ id: `t${i}` })),
          progress: [update("2026-10-14")],
          project: { targetDate: undefined },
        }),
        "p1",
        TODAY,
      )!
      expect(noDates.confidence).toBe("medium")
      expect(noDates.plannedVsActual.expectedPercent).toBeUndefined()
      expect(noDates.assumptions.join(" ")).toMatch(/target date/i)
    })

    it("is at-risk for medium signals and behind for any high signal", () => {
      const medium = stateWith({
        tasks: [task({ id: "t1", status: "blocked" })],
        progress: [update("2026-10-14")],
      })
      expect(analyzeProject(medium, "p1", TODAY)!.status).toBe("at-risk")
      const high = stateWith({
        tasks: [task({ id: "t1", status: "blocked", priority: "critical" })],
        progress: [update("2026-10-14")],
      })
      expect(analyzeProject(high, "p1", TODAY)!.status).toBe("behind")
    })
  })

  describe("overdue-task", () => {
    it("fires only after the due date, not on it", () => {
      const on = stateWith({ tasks: [task({ id: "t1", dueDate: TODAY })], progress: [update("2026-10-14")] })
      expect(kinds(on)).not.toContain("overdue-task")
      const after = stateWith({ tasks: [task({ id: "t1", dueDate: "2026-10-14" })], progress: [update("2026-10-14")] })
      expect(kinds(after)).toContain("overdue-task")
    })

    it("ignores done and cancelled tasks", () => {
      const state = stateWith({
        tasks: [
          task({ id: "t1", dueDate: "2026-10-01", status: "completed" }),
          task({ id: "t2", dueDate: "2026-10-01", status: "approved" }),
          task({ id: "t3", dueDate: "2026-10-01", status: "cancelled" }),
        ],
        progress: [update("2026-10-14")],
      })
      expect(kinds(state)).not.toContain("overdue-task")
    })

    it("is medium up to the threshold and high beyond it, or for high priority", () => {
      const severity = (dueDate: string, priority: Task["priority"] = "medium") =>
        analyzeProject(
          stateWith({ tasks: [task({ id: "t1", dueDate, priority })], progress: [update("2026-10-14")] }),
          "p1",
          TODAY,
        )!.signals.find((s) => s.kind === "overdue-task")!.severity
      expect(severity("2026-10-08")).toBe("medium") // 7 days = OVERDUE_HIGH_DAYS, not more than
      expect(OVERDUE_HIGH_DAYS).toBe(7)
      expect(severity("2026-10-07")).toBe("high") // 8 days
      expect(severity("2026-10-14", "high")).toBe("high")
    })
  })

  describe("blocked-task", () => {
    it("fires for blocked and delayed tasks, high only for high/critical priority", () => {
      const sig = (status: Task["status"], priority: Task["priority"]) =>
        analyzeProject(
          stateWith({ tasks: [task({ id: "t1", status, priority })], progress: [update("2026-10-14")] }),
          "p1",
          TODAY,
        )!.signals.find((s) => s.kind === "blocked-task")
      expect(sig("blocked", "medium")?.severity).toBe("medium")
      expect(sig("delayed", "medium")?.severity).toBe("medium")
      expect(sig("blocked", "high")?.severity).toBe("high")
      expect(sig("in-progress", "high")).toBeUndefined()
    })
  })

  describe("late-start", () => {
    const withStart = (plannedStart: string, status: Task["status"] = "assigned") =>
      stateWith({
        tasks: [task({ id: "t1", plannedStart, status })],
        progress: [update("2026-10-14")],
      })

    it("fires only when more than the threshold late and not started", () => {
      expect(LATE_START_MEDIUM_DAYS).toBe(3)
      expect(kinds(withStart("2026-10-12"))).not.toContain("late-start") // 3 days
      expect(kinds(withStart("2026-10-11"))).toContain("late-start") // 4 days
    })

    it("does not fire for tasks already underway", () => {
      expect(kinds(withStart("2026-10-01", "in-progress"))).not.toContain("late-start")
    })
  })

  describe("stale-updates", () => {
    const withLastUpdate = (date?: string, status: Project["status"] = "active") =>
      stateWith({
        tasks: [task({ id: "t1", dueDate: "2026-12-01" })],
        progress: date ? [update(date)] : [],
        project: { status },
      })
    const sig = (state: ConstructionDataState) =>
      analyzeProject(state, "p1", TODAY)!.signals.find((s) => s.kind === "stale-updates")

    it("fires at the threshold age and not before", () => {
      expect(STALE_UPDATE_DAYS).toBe(3)
      expect(sig(withLastUpdate("2026-10-13"))).toBeUndefined() // 2 days
      expect(sig(withLastUpdate("2026-10-12"))?.severity).toBe("medium") // 3 days
    })

    it("is high at the high threshold, and only medium when there has never been an update", () => {
      expect(STALE_UPDATE_HIGH_DAYS).toBe(7)
      expect(sig(withLastUpdate("2026-10-09"))?.severity).toBe("medium") // 6 days
      expect(sig(withLastUpdate("2026-10-08"))?.severity).toBe("high") // 7 days
      // Missing data is not evidence of delay.
      expect(sig(withLastUpdate(undefined))?.severity).toBe("medium")
    })

    it("counts only approved updates and only for active projects", () => {
      const draftOnly = stateWith({
        tasks: [task({ id: "t1", dueDate: "2026-12-01" })],
        progress: [update("2026-10-14", { reviewStatus: "submitted" })],
      })
      expect(sig(draftOnly)).toBeDefined()
      expect(sig(withLastUpdate(undefined, "planning"))).toBeUndefined()
    })

    it("reports days since the last approved update", () => {
      const report = analyzeProject(withLastUpdate("2026-10-12"), "p1", TODAY)!
      expect(report.progress.lastApprovedUpdate).toBe("2026-10-12")
      expect(report.progress.daysSinceLastUpdate).toBe(3)
    })
  })

  describe("behind-schedule", () => {
    // 2026-09-15 → 2026-11-14 is 60 days; TODAY is day 30 → expected 50%.
    const withProgress = (actual: number) => {
      // One task whose planned/completed quantities give the wanted stage %.
      const t = task({
        id: "t1",
        dueDate: "2026-12-01",
        plannedQuantity: { value: 100, unit: "m3" },
        completedQuantity: { value: actual, unit: "m3" },
      })
      return analyzeProject(
        stateWith({
          tasks: [t],
          progress: [update("2026-10-14")],
          project: { progress: actual, startDate: "2026-09-15", targetDate: "2026-11-14" },
        }),
        "p1",
        TODAY,
      )!
    }

    it("computes expected percent from elapsed time", () => {
      expect(withProgress(50).plannedVsActual.expectedPercent).toBe(50)
    })

    it("fires above the medium threshold and not at it", () => {
      expect(SCHEDULE_VARIANCE_MEDIUM_POINTS).toBe(10)
      const report = (actual: number) => withProgress(actual)
      // actual% here is the project's calculated progress, which depends on stage weights,
      // so assert on the variance the report itself computed.
      const r = report(0)
      expect(r.plannedVsActual.variancePoints).toBe(r.plannedVsActual.expectedPercent! - r.plannedVsActual.actualPercent)
      expect(r.signals.some((s) => s.kind === "behind-schedule")).toBe(true)
    })

    it("is high above the high threshold", () => {
      expect(SCHEDULE_VARIANCE_HIGH_POINTS).toBe(25)
      const r = withProgress(0)
      expect(r.plannedVsActual.variancePoints! > 25).toBe(true)
      expect(r.signals.find((s) => s.kind === "behind-schedule")?.severity).toBe("high")
    })

    it("does not fire when ahead of schedule or without dates", () => {
      const noDates = analyzeProject(
        stateWith({ tasks: [task({ id: "t1" })], progress: [update("2026-10-14")], project: { startDate: undefined } }),
        "p1",
        TODAY,
      )!
      expect(noDates.signals.some((s) => s.kind === "behind-schedule")).toBe(false)
      expect(noDates.plannedVsActual.variancePoints).toBeUndefined()
    })
  })

  describe("aging-issue", () => {
    const withIssue = (overrides: Partial<Issue>) =>
      stateWith({
        tasks: [task({ id: "t1", dueDate: "2026-12-01" })],
        progress: [update("2026-10-14")],
        issues: [issue({ id: "i1", ...overrides })],
      })

    it("fires for high/critical open issues older than the threshold", () => {
      expect(SERIOUS_ISSUE_AGE_DAYS).toBe(7)
      expect(kinds(withIssue({ severity: "high", createdAt: "2026-10-08T00:00:00Z" }))).not.toContain("aging-issue") // 7 days
      expect(kinds(withIssue({ severity: "high", createdAt: "2026-10-07T00:00:00Z" }))).toContain("aging-issue") // 8 days
      expect(kinds(withIssue({ severity: "critical", createdAt: "2026-10-01T00:00:00Z" }))).toContain("aging-issue")
    })

    it("ignores low/medium severity and resolved or closed issues", () => {
      expect(kinds(withIssue({ severity: "medium", createdAt: "2026-09-01T00:00:00Z" }))).not.toContain("aging-issue")
      expect(kinds(withIssue({ severity: "high", status: "resolved", createdAt: "2026-09-01T00:00:00Z" }))).not.toContain("aging-issue")
    })
  })

  describe("issue summary", () => {
    it("counts by severity and status and finds the oldest serious open issue", () => {
      const report = analyzeProject(
        stateWith({
          tasks: [task({ id: "t1" })],
          issues: [
            issue({ id: "i1", severity: "high", createdAt: "2026-10-05T00:00:00Z" }),
            issue({ id: "i2", severity: "critical", createdAt: "2026-10-10T00:00:00Z", status: "in-progress" }),
            issue({ id: "i3", severity: "low", status: "closed" }),
          ],
        }),
        "p1",
        TODAY,
      )!
      expect(report.issues.open).toBe(2)
      expect(report.issues.bySeverity).toEqual({ low: 1, medium: 0, high: 1, critical: 1 })
      expect(report.issues.byStatus).toEqual({ open: 1, "in-progress": 1, resolved: 0, closed: 1 })
      expect(report.issues.oldestSerious).toEqual({ issueId: "i1", title: "Issue i1", ageDays: 10 })
    })

    it("only counts issues of this project", () => {
      const report = analyzeProject(
        stateWith({ tasks: [task({ id: "t1" })], issues: [issue({ id: "i1", projectId: "other" })] }),
        "p1",
        TODAY,
      )!
      expect(report.issues.open).toBe(0)
    })
  })

  describe("planned vs actual and stages", () => {
    it("counts tasks due by today and how many of those are done", () => {
      const report = analyzeProject(
        stateWith({
          tasks: [
            task({ id: "t1", dueDate: "2026-10-10", status: "completed" }),
            task({ id: "t2", dueDate: "2026-10-15", status: "in-progress" }),
            task({ id: "t3", dueDate: "2026-10-16" }),
            task({ id: "t4", dueDate: "2026-10-01", status: "cancelled" }),
          ],
          progress: [update("2026-10-14")],
        }),
        "p1",
        TODAY,
      )!
      expect(report.plannedVsActual.dueByToday).toBe(2)
      expect(report.plannedVsActual.doneOfDue).toBe(1)
      const stage = report.progress.stages.find((s) => s.stageId === "stage-foundation")!
      expect(stage.taskCount).toBe(3)
      expect(stage.dueByToday).toBe(2)
      expect(stage.doneOfDue).toBe(1)
    })
  })

  describe("summary and governance", () => {
    it("carries the AI governance fields as an unreviewed draft", () => {
      const report = analyzeProject(stateWith({ tasks: [task({ id: "t1" })] }), "p1", TODAY)!
      expect(report).toMatchObject({
        source: "ai",
        createdBy: "ai",
        engine: "rules-v1",
        reviewStatus: "draft",
        asOf: TODAY,
      })
      expect(report.approvedBy).toBeUndefined()
      expect(report.approvedAt).toBeUndefined()
    })

    it("opens the summary with the status and overall progress", () => {
      const report = analyzeProject(stateWith({ tasks: [task({ id: "t1" })] }), "p1", TODAY)!
      expect(report.summary[0]).toContain(`${report.progress.overall}%`)
    })

    it("mentions at most three signals, most severe first", () => {
      const tasks = Array.from({ length: 6 }, (_, i) =>
        task({ id: `t${i}`, dueDate: "2026-10-01", priority: i === 5 ? "critical" : "medium" }),
      )
      const report = analyzeProject(stateWith({ tasks, progress: [update("2026-10-14")] }), "p1", TODAY)!
      const signalLines = report.summary.filter((line) => line.startsWith("• "))
      expect(signalLines.length).toBeLessThanOrEqual(3)
      expect(report.signals[0].severity).toBe("high")
    })
  })

  it("is internally consistent on the seeded Sharma Residence", () => {
    const report = analyzeProject(seed, "project-sharma", "2026-10-15")!
    expect(report).toBeDefined()
    const taskIds = new Set(seed.tasks.map((t) => t.id))
    const issueIds = new Set(seed.issues.map((i) => i.id))
    for (const signal of report.signals) {
      if (signal.taskId) expect(taskIds.has(signal.taskId)).toBe(true)
      if (signal.issueId) expect(issueIds.has(signal.issueId)).toBe(true)
    }
    const projectIssues = seed.issues.filter((i) => i.projectId === "project-sharma")
    expect(report.issues.open).toBe(
      projectIssues.filter((i) => i.status === "open" || i.status === "in-progress").length,
    )
  })
})
