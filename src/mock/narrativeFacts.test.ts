import { describe, expect, it } from "vitest"
import { analyzeProject } from "../domain/projectAnalysis"
import { seedConstructionData as seed } from "./seed"
import { buildNarrativeFacts } from "./narrativeFacts"
import { summarizeWeek } from "./weeklySummary"
import { parseNarrativeFacts } from "../../supabase/functions/_shared/narrative/parseFacts"
import type { SignalKindName } from "../../supabase/functions/_shared/narrative/types"
import type { SignalKind } from "../domain/projectAnalysis"

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

  it("keeps the signal kind union in sync with the analyzer", () => {
    // Fails to compile if either union gains or loses a member.
    const both: Record<SignalKind, SignalKindName> & Record<SignalKindName, SignalKind> = {
      "overdue-task": "overdue-task",
      "blocked-task": "blocked-task",
      "late-start": "late-start",
      "stale-updates": "stale-updates",
      "behind-schedule": "behind-schedule",
      "aging-issue": "aging-issue",
    }
    expect(Object.keys(both)).toHaveLength(6)
  })

  it("round-trips through the server-side parser unchanged", () => {
    const facts = buildNarrativeFacts(report)!
    expect(parseNarrativeFacts(JSON.parse(JSON.stringify(facts)))).toEqual(JSON.parse(JSON.stringify(facts)))
  })

  it("pins the exact set of keys sent, so a new field is a deliberate change", () => {
    const facts = buildNarrativeFacts(report)!
    const weekly = summarizeWeek(seed, "project-sharma", TODAY, { audience: "company", today: TODAY })!
    const weeklyFacts = buildNarrativeFacts(weekly)!
    const keys = (value: unknown): string[] =>
      Object.keys(value as object)
        .sort()
    expect(keys(facts)).toMatchInlineSnapshot(`
      [
        "asOf",
        "assumptionCount",
        "confidence",
        "daysSinceLastUpdate",
        "issues",
        "kind",
        "overallPercent",
        "plannedVsActual",
        "signals",
        "stages",
        "status",
      ]
    `)
    expect(keys(weeklyFacts)).toMatchInlineSnapshot(`
      [
        "awaitingReview",
        "blockerCount",
        "confidence",
        "daysReported",
        "evidence",
        "from",
        "issuesOpen",
        "issuesRaised",
        "issuesResolved",
        "kind",
        "peakWorkers",
        "tasksCompleted",
        "to",
        "updates",
        "windowDays",
        "workerDays",
      ]
    `)
    expect(parseNarrativeFacts(JSON.parse(JSON.stringify(weeklyFacts)))).toEqual(JSON.parse(JSON.stringify(weeklyFacts)))
  })

  it("sends stage names verbatim (ruling: they are staff-managed library vocabulary, not typed by customers)", () => {
    // Ledger ruling: stage names come from the staff-managed work library, so they are
    // part of the packet by design. The server parser still restricts them to plain words.
    const poisoned = structuredClone(report)
    poisoned.progress.stages[0] = { ...poisoned.progress.stages[0], name: "Plinth Beam" }
    const facts = buildNarrativeFacts(poisoned)
    expect(facts?.kind === "report" && facts.stages[0].name).toBe("Plinth Beam")
    const phoneName = structuredClone(poisoned)
    phoneName.progress.stages[0] = { ...phoneName.progress.stages[0], name: "Call 9876543210" }
    expect(parseNarrativeFacts(JSON.parse(JSON.stringify(buildNarrativeFacts(phoneName))))).toBeUndefined()
  })
})
