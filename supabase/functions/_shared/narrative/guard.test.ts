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
      expect(checkNarrative([text], facts)).toEqual({ ok: false, reason: "link" })
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

  it("an invented name at the start of a sentence", () => {
    expect(checkNarrative(["Ramesh says the delay is minor."], facts)).toEqual({ ok: false, reason: "name" })
  })

  it("a name after an abbreviation", () => {
    for (const text of ["Mr. Ramesh reported the delay.", "Dr. Rao reviewed it.", "Some delay, e.g. Ramesh again."]) {
      expect(checkNarrative([text], facts)).toEqual({ ok: false, reason: "name" })
    }
  })

  it("larger spelled-out numbers, including hyphenated compounds", () => {
    for (const text of ["Twelve issues are open.", "There are thirty-three issues.", "About a hundred tasks remain."]) {
      expect(checkNarrative([text], facts)).toEqual({ ok: false, reason: "number" })
    }
  })

  it("fullwidth digits", () => {
    expect(checkNarrative(["Overall progress is \uFF14\uFF13 percent."], facts)).toEqual({ ok: false, reason: "number" })
  })

  it("accented names", () => {
    expect(checkNarrative(["The delay was raised by José."], facts)).toEqual({ ok: false, reason: "name" })
  })

  it("bare domains", () => {
    for (const text of ["Visit houzeify.com for details.", "See example.com/page now.", "Try foo.in today."]) {
      expect(checkNarrative([text], facts)).toEqual({ ok: false, reason: "link" })
    }
  })

  it("an invented number in weekly prose", () => {
    expect(checkNarrative(["Over the past 7 days, 99 updates were filed."], sampleWeeklyFacts())).toEqual({
      ok: false,
      reason: "number",
    })
  })
})

describe("checkNarrative still accepts", () => {
  it("a stage word at the start of a sentence", () => {
    expect(checkNarrative(["Foundation is 80 percent complete."], facts).ok).toBe(true)
  })

  it("possessive and hyphenated stage words", () => {
    const hyphen = sampleReportFacts({
      stages: [{ name: "Plumbing-Rough", percent: 80, baselinePercent: 20, dueByToday: 5, doneOfDue: 4 }],
    })
    expect(checkNarrative(["The project is at risk. Foundation's progress is 80 percent."], facts).ok).toBe(true)
    expect(checkNarrative(["The project is at risk, and Plumbing and Rough work is 80 percent."], hyphen).ok).toBe(true)
  })

  it("typographic punctuation", () => {
    expect(
      checkNarrative(["The project\u2019s status is at risk \u2014 overall progress is 42 percent \u2026"], facts).ok,
    ).toBe(true)
  })

  it("one and zero as ordinary words", () => {
    expect(checkNarrative(["One issue is critical, but zero are closed."], facts).ok).toBe(true)
  })
})
