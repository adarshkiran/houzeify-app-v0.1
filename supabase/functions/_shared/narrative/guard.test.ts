import { describe, expect, it } from "vitest"
import { checkNarrative, MAX_CHARS } from "./guard.ts"
import { sampleReportFacts, sampleWeeklyFacts } from "./testFacts.ts"

const facts = sampleReportFacts()

describe("checkNarrative accepts faithful prose", () => {
  it("joins paragraphs and passes numbers that are in the facts", () => {
    const result = checkNarrative(
      [
        "The project is at risk. Overall progress is 42 percent against an expected 55 percent, a gap of 13 points.",
        "Foundation is 80 percent complete while Brickwork is at 10 percent. Three issues are open and two delay signals need attention. The last update was 4 days ago.",
      ],
      facts,
    )
    expect(result).toEqual({
      ok: true,
      text: expect.stringContaining("Overall progress is 42 percent"),
    })
  })

  it("accepts an ISO date and does not mistake it for a phone number", () => {
    expect(checkNarrative(["The project is at risk as of 2026-10-15 with 42 percent done."], facts).ok).toBe(true)
  })

  it("accepts a date written with a month name", () => {
    expect(checkNarrative(["As of 15 October the project is at risk with 42 percent done."], facts).ok).toBe(true)
  })

  it("accepts a rounded form of a decimal fact", () => {
    const decimal = sampleReportFacts({ overallPercent: 41.6 })
    expect(checkNarrative(["Overall progress is about 42 percent."], decimal).ok).toBe(true)
  })

  it("accepts weekly prose using the window length", () => {
    expect(
      checkNarrative(["Over the past 7 days, 9 updates were filed and 5 tasks were completed."], sampleWeeklyFacts()).ok,
    ).toBe(true)
  })
})

describe("checkNarrative rejects", () => {
  it("a number that is not in the facts", () => {
    expect(checkNarrative(["Overall progress is 43 percent."], facts)).toEqual({ ok: false, reason: "number" })
  })

  it("a spelled-out number that is not in the facts", () => {
    expect(checkNarrative(["Seven issues are open."], facts)).toEqual({ ok: false, reason: "number" })
  })

  it("an invented name", () => {
    expect(checkNarrative(["The project is at risk. Contact Ramesh about the delay."], facts)).toEqual({
      ok: false,
      reason: "name",
    })
  })

  it("links, emails and phone-like numbers", () => {
    for (const text of ["See https://example.com for more.", "Write to a@b.co soon.", "Call 98765 43210 now."]) {
      const result = checkNarrative([text], facts)
      expect(result.ok).toBe(false)
    }
  })

  it("the wrong shape", () => {
    for (const bad of [undefined, "text", [], [""], ["a", "b", "c", "d", "e"], [1], ["  "]]) {
      expect(checkNarrative(bad, facts)).toEqual({ ok: false, reason: "shape" })
    }
  })

  it("text over the length cap", () => {
    expect(checkNarrative(["The project is at risk. ".repeat(Math.ceil(MAX_CHARS / 20))], facts)).toEqual({
      ok: false,
      reason: "too-long",
    })
  })
})
