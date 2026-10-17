import type { ReportFacts, WeeklyFacts } from "./types.ts"

export function sampleReportFacts(overrides: Partial<ReportFacts> = {}): ReportFacts {
  return {
    kind: "report",
    asOf: "2026-10-15",
    status: "at-risk",
    confidence: "medium",
    overallPercent: 42,
    stages: [
      { name: "Foundation", percent: 80, baselinePercent: 20, dueByToday: 5, doneOfDue: 4 },
      { name: "Brickwork", percent: 10, baselinePercent: 0, dueByToday: 3, doneOfDue: 1 },
    ],
    plannedVsActual: { dueByToday: 8, doneOfDue: 5, expectedPercent: 55, actualPercent: 42, variancePoints: 13 },
    issues: {
      open: 3,
      bySeverity: { low: 1, medium: 1, high: 1, critical: 0 },
      byStatus: { open: 2, "in-progress": 1, resolved: 4, closed: 0 },
      oldestSeriousAgeDays: 9,
    },
    signals: [
      { kind: "overdue-task", severity: "high" },
      { kind: "stale-updates", severity: "medium" },
    ],
    daysSinceLastUpdate: 4,
    assumptionCount: 2,
    ...overrides,
  }
}

export function sampleWeeklyFacts(overrides: Partial<WeeklyFacts> = {}): WeeklyFacts {
  return {
    kind: "weekly-company",
    from: "2026-10-10",
    to: "2026-10-16",
    windowDays: 7,
    confidence: "high",
    daysReported: 6,
    updates: 9,
    peakWorkers: 14,
    evidence: 12,
    issuesRaised: 2,
    issuesResolved: 1,
    issuesOpen: 3,
    tasksCompleted: 5,
    workerDays: 61,
    awaitingReview: 2,
    blockerCount: 1,
    ...overrides,
  }
}
