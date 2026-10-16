import { describe, expect, it } from "vitest"
import { analyzeProject } from "../domain/projectAnalysis"
import { seedConstructionData as seed } from "./seed"
import { buildNarrativeFacts } from "./narrativeFacts"
import { summarizeWeek } from "./weeklySummary"

const TODAY = "2026-10-15"

describe("buildNarrativeFacts", () => {
  const report = analyzeProject(seed, "project-sharma", TODAY, "2026-10-15T09:00:00.000Z")!

  it("builds report facts from the analyzer output", () => {
    const facts = buildNarrativeFacts(report)
    expect(facts).toMatchObject({
      kind: "report",
      asOf: TODAY,
      status: report.status,
      overallPercent: report.progress.overall,
      confidence: report.confidence,
      assumptionCount: report.assumptions.length,
    })
    expect(facts?.kind === "report" && facts.signals).toEqual(
      report.signals.map((s) => ({ kind: s.kind, severity: s.severity })),
    )
  })

  it("never carries names, titles, ids, messages or free text", () => {
    const poisoned = structuredClone(report)
    poisoned.signals = poisoned.signals.map((s) => ({
      ...s,
      message: "Ravi Kumar +919876543210 is late",
      taskId: "task-secret-id",
      issueId: "issue-secret-id",
      stageId: "stage-secret-id",
    }))
    poisoned.summary = ["Ravi Kumar said call +919876543210"]
    poisoned.assumptions = ["Contact priya@example.com"]
    poisoned.issues.oldestSerious = { issueId: "issue-secret-id", title: "Leak at Sharma house", ageDays: 9 }
    const text = JSON.stringify(buildNarrativeFacts(poisoned))
    for (const leak of ["Ravi", "Kumar", "9876543210", "priya", "secret-id", "Leak at", "Sharma house", "message"]) {
      expect(text).not.toContain(leak)
    }
    expect(text).toContain('"oldestSeriousAgeDays":9')
  })

  it("builds company weekly facts and refuses the homeowner audience", () => {
    // The seed has no Sharma update inside the 7-day window ending TODAY, so add one
    // here so the note and blocker checks below have real free text to guard.
    const weekly = {
      ...seed,
      dailyProgress: [
        ...seed.dailyProgress,
        {
          ...seed.dailyProgress[0],
          id: "progress-sharma-week",
          date: "2026-10-14",
          submittedAt: "2026-10-14T17:30:00+05:30",
          reviewStatus: "approved" as const,
          todaySummary: "Plinth beam shuttering checked for grid C1 and C2.",
          blockerSummary: "Cement delivery delayed until Thursday.",
        },
      ],
    }
    const company = summarizeWeek(weekly, "project-sharma", TODAY, { audience: "company", today: TODAY })!
    const facts = buildNarrativeFacts(company)
    expect(facts).toMatchObject({
      kind: "weekly-company",
      from: company.from,
      to: company.to,
      windowDays: 7,
      updates: company.totals.updates,
      blockerCount: company.blockers?.length ?? 0,
    })
    const notes = company.days.flatMap((d) => d.notes)
    expect(notes.length).toBeGreaterThan(0)
    const text = JSON.stringify(facts)
    for (const note of [...notes, ...(company.blockers ?? [])]) expect(text).not.toContain(note)

    const homeowner = summarizeWeek(seed, "project-sharma", TODAY, { audience: "homeowner", today: TODAY })!
    expect(buildNarrativeFacts(homeowner)).toBeUndefined()
  })
})
