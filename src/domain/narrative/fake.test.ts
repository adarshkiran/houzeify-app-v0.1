import { describe, expect, it } from "vitest"
import { sampleReportFacts, sampleWeeklyFacts } from "../../../supabase/functions/_shared/narrative/testFacts"
import { checkNarrative } from "../../../supabase/functions/_shared/narrative/guard"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
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
})
