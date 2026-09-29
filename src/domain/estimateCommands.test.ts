import { describe, expect, it } from "vitest"
import { ESTIMATE_RATES, seedConstructionData as seed } from "../mock/seed"
import { generateEstimate } from "./estimateCommands"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const business: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const clock: Clock = { now: () => new Date("2026-09-29T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })
const run = <T,>(state: ConstructionDataState, actor: Session | null, command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T }) =>
  command(state, as(actor))

const input = {
  projectName: "My New Home",
  propertyType: "House",
  location: "Hyderabad, Telangana",
  builtUpAreaSqft: 2000,
  floors: 2,
  constructionLevel: "standard" as const,
}

describe("generateEstimate", () => {
  it("computes totalLow/totalHigh from the rate table and area", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.totalLow).toBe(1650 * 2000)
    expect(result.totalHigh).toBe(1950 * 2000)
  })

  it("computes the breakdown as 56/26/13/5 of the midpoint total", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const midpoint = (result.totalLow + result.totalHigh) / 2
    expect(result.breakdown.materials).toBe(midpoint * 0.56)
    expect(result.breakdown.labour).toBe(midpoint * 0.26)
    expect(result.breakdown.finishing).toBe(midpoint * 0.13)
    expect(result.breakdown.contingency).toBe(midpoint * 0.05)
  })

  it("uses the correct rate tier for basic and premium", () => {
    const basic = run(seed, homeowner, generateEstimate({ ...input, constructionLevel: "basic" })).result
    expect(basic.totalLow).toBe(1450 * 2000)
    expect(basic.totalHigh).toBe(1650 * 2000)
    const premium = run(seed, homeowner, generateEstimate({ ...input, constructionLevel: "premium" })).result
    expect(premium.totalLow).toBe(1950 * 2000)
    expect(premium.totalHigh).toBe(2400 * 2000)
  })

  it("attributes the estimate to the caller and stores it", () => {
    const { state, result } = run(seed, homeowner, generateEstimate(input))
    expect(result.homeownerPersonId).toBe("person-demo-homeowner")
    expect(state.estimates).toContainEqual(result)
  })

  it("refuses a non-homeowner caller", () => {
    expect(() => run(seed, business, generateEstimate(input))).toThrow(/homeowner/i)
    expect(() => run(seed, null, generateEstimate(input))).toThrow(/homeowner/i)
  })

  it("requires a non-empty project name and location", () => {
    expect(() => run(seed, homeowner, generateEstimate({ ...input, projectName: "   " }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, location: "" }))).toThrow(ConflictError)
  })

  it("requires a positive built-up area", () => {
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: 0 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: -5 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: 1.5 }))).toThrow(ConflictError)
  })

  it("requires at least 1 floor", () => {
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: 0 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: 1.5 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: -1 }))).toThrow(ConflictError)
  })

  it("sums the four breakdown buckets to the midpoint total", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.breakdown.materials + result.breakdown.labour + result.breakdown.finishing + result.breakdown.contingency).toBeCloseTo((result.totalLow + result.totalHigh) / 2)
  })
})

describe("ESTIMATE_RATES stays in sync with seed", () => {
  it("matches the rate table documented in the plan/spec", () => {
    expect(ESTIMATE_RATES).toEqual({
      basic: { low: 1450, high: 1650 },
      standard: { low: 1650, high: 1950 },
      premium: { low: 1950, high: 2400 },
    })
  })
})
