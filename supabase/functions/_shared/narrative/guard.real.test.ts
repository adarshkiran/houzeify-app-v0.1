import { describe, expect, it } from "vitest"
import { checkNarrative } from "./guard.ts"
import { sampleReportFacts, sampleWeeklyFacts } from "./testFacts.ts"

// Real model output (claude-opus-5-5), captured from live checks.

const zeroWeek = sampleWeeklyFacts({
  kind: "weekly-company",
  from: "2026-10-11",
  to: "2026-10-17",
  windowDays: 7,
  confidence: "low",
  daysReported: 0,
  updates: 0,
  peakWorkers: 0,
  evidence: 0,
  issuesRaised: 0,
  issuesResolved: 0,
  issuesOpen: 0,
  tasksCompleted: 0,
  workerDays: 0,
  awaitingReview: 0,
  blockerCount: 0,
})

const zeroReport = sampleReportFacts({
  asOf: "2026-10-17",
  status: "at-risk",
  confidence: "medium",
  overallPercent: 0,
  stages: [{ name: "Foundation", percent: 0, baselinePercent: 0, dueByToday: 0, doneOfDue: 0 }],
  plannedVsActual: { dueByToday: 0, doneOfDue: 0, actualPercent: 0 },
  issues: {
    open: 0,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    byStatus: { open: 0, "in-progress": 0, resolved: 0, closed: 0 },
  },
  signals: [{ kind: "stale-updates", severity: "medium" }],
  daysSinceLastUpdate: undefined,
  assumptionCount: 3,
})

const weeklyA = [
  "For the week from 2026-10-11 to 2026-10-17, a 7-day window, no activity was reported. There were 0 updates, 0 days reported, 0 tasks completed, 0 worker-days and a peak of 0 workers. Confidence in this picture is low.",
  "There is not enough data to say what is behind or at risk. No delay signals were reported, the blocker count is 0, and 0 issues were raised, 0 resolved and 0 remain open. With 0 evidence items and 0 updates awaiting review, the absence of problems cannot be confirmed.",
  "The main point needing attention is the lack of reporting. The site team should be asked to confirm whether work took place during this period and to submit daily updates and evidence so that progress, issues and risks can be assessed.",
]

const weeklyB = [
  "For the week from 2026-10-11 to 2026-10-17, a 7-day window, no site activity was reported. There were 0 days reported, 0 updates and 0 evidence items, so confidence in this summary is low. Recorded figures show 0 tasks completed, 0 worker-days and a peak of 0 workers.",
  "There is not enough data to say whether any work is behind or at risk. No delay signals or blockers were recorded, with a blocker count of 0. Issues raised, resolved and open all stand at 0, and 0 items are awaiting review.",
  "The main point needing attention is the absence of reporting for the whole week. The site team should confirm whether work took place and make sure daily updates and evidence are submitted, so that progress and risks can be assessed properly in the next period.",
]

const report = [
  "As of 2026-10-17, the project is rated at-risk with medium confidence. Overall progress stands at 0 percent, and the actual percent against plan is 0. The summary rests on 3 assumptions.",
  "The Foundation stage shows 0 percent complete against a baseline of 0 percent, with 0 of 0 items due by today done. There are no issues recorded, with 0 open. There is not enough data to show how far the work is behind plan. A medium-severity signal shows that progress updates have gone stale.",
  "The site team should bring progress updates up to date so the position can be confirmed. The 3 assumptions should be reviewed to raise confidence in this report.",
]

describe("real model output regressions", () => {
  it("accepts weekly text A", () => {
    expect(checkNarrative(weeklyA, zeroWeek)).toMatchObject({ ok: true })
  })

  it("accepts weekly text B (opened a sentence with 'Recorded')", () => {
    expect(checkNarrative(weeklyB, zeroWeek)).toMatchObject({ ok: true })
  })

  it("accepts the report text", () => {
    expect(checkNarrative(report, zeroReport)).toMatchObject({ ok: true })
  })
})

describe("names stay rejected with the wider opener vocabulary", () => {
  const names = ["Ramesh", "Priya", "Suresh", "Arjun", "Ravi", "Sharma", "Reddy", "Krishna", "Mehta", "Naik", "Rao", "Kumar"]

  it.each(names)("rejects %s at the start of a sentence", (name) => {
    expect(checkNarrative([`${name} noted that the delay is minor.`], zeroReport)).toEqual({ ok: false, reason: "name" })
    expect(checkNarrative([`Recorded figures are low. ${name} says the site is fine.`], zeroReport)).toEqual({
      ok: false,
      reason: "name",
    })
  })

  it.each(names)("rejects %s in the middle of a sentence", (name) => {
    expect(checkNarrative([`The delay was reported by ${name} on site.`], zeroReport)).toEqual({ ok: false, reason: "name" })
  })

  it("rejects titles before names", () => {
    for (const text of ["Mr. Ramesh reported the delay.", "Dr. Rao reviewed it.", "Recorded by Mrs. Priya."]) {
      expect(checkNarrative([text], zeroReport)).toEqual({ ok: false, reason: "name" })
    }
  })
})
