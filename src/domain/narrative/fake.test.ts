import { describe, expect, it } from "vitest"
import { sampleReportFacts, sampleWeeklyFacts } from "../../../supabase/functions/_shared/narrative/testFacts"
import { checkNarrative } from "../../../supabase/functions/_shared/narrative/guard"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
import type { ReportFacts } from "../../../supabase/functions/_shared/narrative/types"
import { createFakeNarrativeService } from "./fake"

const now = () => "2026-10-17T09:00:00.000Z"

describe("fake narrative service", () => {
  it("writes guard-clean, labelled, hashed prose for a report", async () => {
    const facts = sampleReportFacts()
    const result = await createFakeNarrativeService({ now }).narrate({ projectId: "p", kind: "report", facts })
    if (!("narrative" in result)) throw new Error("expected a narrative")
    expect(result.narrative).toEqual({
      text: expect.any(String),
      engine: "claude:fake",
      generatedAt: now(),
      factsHash: await hashFacts(facts),
    })
    expect(checkNarrative(result.narrative.text.split("\n\n"), facts).ok).toBe(true)
  })

  it("writes guard-clean prose for a weekly summary", async () => {
    const facts = sampleWeeklyFacts()
    const result = await createFakeNarrativeService({ now }).narrate({ projectId: "p", kind: "weekly-company", facts })
    if (!("narrative" in result)) throw new Error("expected a narrative")
    expect(checkNarrative(result.narrative.text.split("\n\n"), facts).ok).toBe(true)
  })

  it("can be told to fail", async () => {
    const result = await createFakeNarrativeService({ failWith: "limit-reached" }).narrate({
      projectId: "p",
      kind: "report",
      facts: sampleReportFacts(),
    })
    expect(result).toEqual({ error: "limit-reached" })
  })

  it("stays guard-clean for every status, fractional percent, singular counts and zero signals", async () => {
    const statuses: ReportFacts["status"][] = ["on-track", "at-risk", "behind", "not-enough-data"]
    const service = createFakeNarrativeService({ now })
    for (const status of statuses) {
      for (const facts of [
        sampleReportFacts({ status }),
        sampleReportFacts({ status, overallPercent: 41.6, signals: [] }),
        sampleReportFacts({
          status,
          signals: [{ kind: "overdue-task", severity: "high" }],
          issues: { ...sampleReportFacts().issues, open: 1 },
        }),
      ]) {
        const result = await service.narrate({ projectId: "p", kind: "report", facts })
        expect(result, status).toHaveProperty("narrative")
      }
    }
    const single = sampleReportFacts({
      signals: [{ kind: "overdue-task", severity: "high" }],
      issues: { ...sampleReportFacts().issues, open: 1 },
    })
    const result = await service.narrate({ projectId: "p", kind: "report", facts: single })
    if (!("narrative" in result)) throw new Error("expected a narrative")
    expect(result.narrative.text).toContain("1 issue is open and 1 delay signal was raised")
  })

  it("handles singular weekly counts", async () => {
    const facts = sampleWeeklyFacts({ updates: 1, daysReported: 1, peakWorkers: 1, tasksCompleted: 1, issuesOpen: 1 })
    const result = await createFakeNarrativeService({ now }).narrate({ projectId: "p", kind: "weekly-company", facts })
    expect(result).toHaveProperty("narrative")
  })
})
