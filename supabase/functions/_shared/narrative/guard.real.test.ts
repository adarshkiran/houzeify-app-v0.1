import { describe, expect, it } from "vitest"
import { checkNarrative, looksLikeOrdinaryOpener, NAME_COLLISIONS } from "./guard.ts"
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

const weeklyC = [
  "This summary covers the period from 2026-10-11 to 2026-10-17, a window of 7 days. There is not enough data to confirm activity on site, as no updates, evidence, or worker-day records were reported for this period.",
  "No tasks completed, no issues raised or resolved, and no blockers were recorded. There is not enough data to assess what is behind schedule or at risk, since no workers, reports, or progress figures were logged for the period. Confidence in this report is low given the absence of data.",
  "Attention is needed to confirm whether reporting for this period was missed or whether no activity actually took place on site. Establishing reliable data flow for the next reporting window should be a priority before any assessment of progress or risk can be made.",
]

describe("real model output regressions", () => {
  it("accepts weekly text C (opened a sentence with 'Establishing')", () => {
    expect(checkNarrative(weeklyC, zeroWeek)).toMatchObject({ ok: true })
  })

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

describe("sentence-initial structure check", () => {
  it.each([
    "Establishing a routine of 4 daily updates would help.",
    "Absence of updates for 4 days is a concern.",
    "Reliable data covers 4 days.",
    "Weekly updates number 9.",
    "Reviewing 2 open issues is the next step.",
    "Missing updates span 4 days.",
    "Confirmation of 3 open issues is needed.",
    "Improvement is needed on 2 delay signals.",
    "Limited evidence covers 4 days.",
    "Understanding why 4 days passed without an update matters.",
    "Documentation of 3 open issues is thin.",
  ])("accepts %s", (sentence) => {
    expect(checkNarrative([sentence], sampleReportFacts({ daysSinceLastUpdate: 4 })), sentence).toMatchObject({ ok: true })
  })

  // Every name is six or more letters and ends in a kept suffix, so only NAME_COLLISIONS stops it.
  const suffixNames = [
    "Mohammed", "Naveed", "Sterling", "Rasheed", "Lawrence", "Waleed", "Khaled", "Jamshed", "Dominic", "Cedric", "Manfred", "Wilfred",
  ]

  it.each(suffixNames)("%s would pass the bare heuristic, and is rejected only because it is a listed name", (name) => {
    expect(looksLikeOrdinaryOpener(name.toLowerCase(), new Set())).toBe(true)
    expect(looksLikeOrdinaryOpener(name.toLowerCase())).toBe(false)
    expect(checkNarrative([`${name} reported a delay.`], zeroReport)).toEqual({ ok: false, reason: "name" })
    expect(checkNarrative([`${name} remained on site.`], zeroReport)).toEqual({ ok: false, reason: "name" })
    expect(checkNarrative([`The delay was reported by ${name}.`], zeroReport)).toEqual({ ok: false, reason: "name" })
  })

  it("keeps NAME_COLLISIONS honest: every entry is 6+ letters and matches a kept suffix", () => {
    for (const name of NAME_COLLISIONS) {
      expect(looksLikeOrdinaryOpener(name, new Set()), name).toBe(true)
    }
  })

  it.each(["Ahmed", "Kelly", "Ashley", "Bradley", "Sunny", "Pradeepkumar", "Venkatesan", "Rajpal", "Dhanapal"])(
    "rejects %s without needing a collision entry",
    (name) => {
      expect(checkNarrative([`${name} reported a delay.`], zeroReport)).toEqual({ ok: false, reason: "name" })
      expect(checkNarrative([`${name} remained on site.`], zeroReport)).toEqual({ ok: false, reason: "name" })
    },
  )

  it("documents the accepted residual risk: an unlisted suffix-shaped single-token name can pass at sentence start", () => {
    // "Sameed" is six letters and ends in "ed" but is not in NAME_COLLISIONS.
    expect(looksLikeOrdinaryOpener("sameed")).toBe(true)
    expect(checkNarrative(["Sameed remained on site."], zeroReport).ok).toBe(true)
    // ...but never in the middle of a sentence, and never doing something.
    expect(checkNarrative(["The delay was reported by Sameed."], zeroReport)).toEqual({ ok: false, reason: "name" })
  })

  it.each([
    "Sameed reported a delay.",
    "Sameed said work is late.",
    "Sameed's crew was late.",
    "Sameed\u2019s crew was late.",
    "Sameed-led work stalled.",
    "Khaled's crew was late.",
    "Agarwal-led work stalled.",
    "Rajpal reported a delay.",
    "Dhanapal said work is late.",
  ])("rejects a name-and-action shape: %s", (text) => {
    expect(checkNarrative([text], zeroReport)).toEqual({ ok: false, reason: "name" })
  })

  it.each([
    "Activity e.g. Agarwal reported it.",
    "Overall i.e. Agarwal flagged it.",
    "Work etc. Mittal flagged it.",
    "Progress vs. Bansal is low.",
    "Overall, approx. Sameed was on site.",
    "Work incl. Sameed is late.",
    "Phase A. Sameed remained on site.",
  ])("rejects a name after an abbreviation: %s", (text) => {
    expect(checkNarrative([text], zeroReport)).toEqual({ ok: false, reason: "name" })
  })

  it("still accepts ordinary multi-sentence prose and heuristic openers", () => {
    expect(
      checkNarrative(["Establishing a routine helps. Confirmation of updates is needed. Documentation is thin."], zeroReport).ok,
    ).toBe(true)
  })

  it.each([
    "Approval of the plan is pending.",
    "Overall progress is low.",
    "Initial figures are low.",
    "Structural work is behind.",
  ])("accepts -al openers: %s", (text) => {
    expect(checkNarrative([text], zeroReport).ok, text).toBe(true)
  })

  it.each([
    "Doubling the crew would help.",
    "Halved output is a concern.",
    "Tripled costs are a concern.",
    "Dozens of tasks are late.",
    "Millions of bricks are needed.",
    "Costs trebled.",
    "A threefold rise in delays.",
    "Delays grew tenfold.",
    "Progress is behind in the fourth stage.",
    "The twentieth task is late.",
    "Output halves each week.",
    "A quadruple increase is likely.",
  ])("rejects quantity words: %s", (text) => {
    expect(checkNarrative([text], zeroReport)).toEqual({ ok: false, reason: "number" })
  })
})
