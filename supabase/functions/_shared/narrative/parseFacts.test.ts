import { describe, expect, it } from "vitest"
import { parseNarrativeFacts } from "./parseFacts.ts"
import { sampleReportFacts, sampleWeeklyFacts } from "./testFacts.ts"

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value))

describe("parseNarrativeFacts", () => {
  it("round-trips report and weekly facts into fresh objects", () => {
    const report = sampleReportFacts()
    const parsed = parseNarrativeFacts(roundTrip(report))
    expect(parsed).toEqual(roundTrip(report))
    expect(parsed).not.toBe(report)
    const weekly = sampleWeeklyFacts()
    expect(parseNarrativeFacts(roundTrip(weekly))).toEqual(weekly)
  })

  it("drops unknown keys at every level", () => {
    const dirty = roundTrip(sampleReportFacts()) as Record<string, any>
    dirty.projectName = "Sharma house"
    dirty.stages[0].owner = "Ravi"
    dirty.signals[0].message = "call 9876543210"
    dirty.issues.title = "Leak"
    const text = JSON.stringify(parseNarrativeFacts(dirty))
    for (const leak of ["Sharma", "Ravi", "9876543210", "Leak", "owner", "message", "title"]) {
      expect(text).not.toContain(leak)
    }
  })

  it("rejects stage names carrying phone numbers, emails or punctuation", () => {
    for (const name of ["Call 9876543210", "Call 98765 43210", "a@b.co", "", "x".repeat(41), "Stage.", "A, B", " Phase", "-Phase"]) {
      const bad = roundTrip(sampleReportFacts()) as any
      bad.stages[0].name = name
      expect(parseNarrativeFacts(bad), name).toBeUndefined()
    }
    const ok = roundTrip(sampleReportFacts()) as any
    ok.stages[0].name = "Plumbing & Rough-in/Fit"
    expect(parseNarrativeFacts(ok)).toBeDefined()
  })

  it("accepts stage names with short numbers", () => {
    for (const name of ["Phase 2", "1st Floor Slab", "G+1 Structure", "Block (A)"]) {
      const ok = roundTrip(sampleReportFacts()) as any
      ok.stages[0].name = name
      expect(parseNarrativeFacts(ok), name).toBeDefined()
    }
  })

  it("rejects wrong enums and kinds", () => {
    const status = roundTrip(sampleReportFacts()) as any
    status.status = "great"
    expect(parseNarrativeFacts(status)).toBeUndefined()
    const signal = roundTrip(sampleReportFacts()) as any
    signal.signals[0].kind = "ravi-is-late"
    expect(parseNarrativeFacts(signal)).toBeUndefined()
    expect(parseNarrativeFacts({ ...sampleWeeklyFacts(), kind: "other" })).toBeUndefined()
    expect(parseNarrativeFacts("text")).toBeUndefined()
    expect(parseNarrativeFacts(null)).toBeUndefined()
  })

  it("rejects non-finite, out-of-range and fractional-count numbers", () => {
    for (const patch of [{ overallPercent: NaN }, { overallPercent: Infinity }, { overallPercent: -1 }, { overallPercent: 2_000_000 }]) {
      expect(parseNarrativeFacts({ ...sampleReportFacts(), ...patch })).toBeUndefined()
    }
    expect(parseNarrativeFacts({ ...sampleWeeklyFacts(), updates: 2.5 })).toBeUndefined()
    expect(parseNarrativeFacts({ ...sampleWeeklyFacts(), updates: "9" })).toBeUndefined()
  })

  it("allows a negative variance but nothing below -1000", () => {
    const ok = sampleReportFacts()
    ok.plannedVsActual.variancePoints = -12.5
    expect(parseNarrativeFacts(roundTrip(ok))).toBeDefined()
    ok.plannedVsActual.variancePoints = -1001
    expect(parseNarrativeFacts(roundTrip(ok))).toBeUndefined()
  })

  it("rejects oversize arrays and missing required keys", () => {
    const stage = sampleReportFacts().stages[0]
    expect(parseNarrativeFacts({ ...sampleReportFacts(), stages: Array(51).fill(stage) })).toBeUndefined()
    const signals = Array(51).fill({ kind: "overdue-task", severity: "high" })
    expect(parseNarrativeFacts({ ...sampleReportFacts(), signals })).toBeUndefined()
    const missing = roundTrip(sampleWeeklyFacts()) as any
    delete missing.updates
    expect(parseNarrativeFacts(missing)).toBeUndefined()
  })
})
