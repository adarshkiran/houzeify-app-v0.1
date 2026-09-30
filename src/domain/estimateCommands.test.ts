import { describe, expect, it } from "vitest"
import { ESTIMATE_RATES, seedConstructionData as seed } from "../mock/seed"
import { confirmEstimate, generateEstimate } from "./estimateCommands"
import { ConflictError } from "./errors"
import type { ConstructionDataState, EstimateLine } from "./models"
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
    expect(result.breakdown.materials).toBeCloseTo(midpoint * 0.56, 5)
    expect(result.breakdown.labour).toBeCloseTo(midpoint * 0.26, 5)
    expect(result.breakdown.finishing).toBeCloseTo(midpoint * 0.13, 5)
    expect(result.breakdown.contingency).toBeCloseTo(midpoint * 0.05, 5)
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

describe("generateEstimate line items", () => {
  it("builds 7 lines across materials/labour/finishing/contingency", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.lines).toHaveLength(7)
    expect(result.lines.filter((l) => l.category === "materials")).toHaveLength(3)
    expect(result.lines.filter((l) => l.category === "labour")).toHaveLength(2)
    expect(result.lines.filter((l) => l.category === "finishing")).toHaveLength(1)
    expect(result.lines.filter((l) => l.category === "contingency")).toHaveLength(1)
  })

  it("each line's amount equals quantity x rate", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    for (const line of result.lines) {
      expect(line.rate * line.quantity).toBeCloseTo(line.amount, 5)
    }
  })

  it("sums lines per category to the matching breakdown bucket", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const sumOf = (category: string) =>
      result.lines.filter((l) => l.category === category).reduce((sum, l) => sum + l.amount, 0)
    expect(sumOf("materials")).toBeCloseTo(result.breakdown.materials, 5)
    expect(sumOf("labour")).toBeCloseTo(result.breakdown.labour, 5)
    expect(sumOf("finishing")).toBeCloseTo(result.breakdown.finishing, 5)
    expect(sumOf("contingency")).toBeCloseTo(result.breakdown.contingency, 5)
  })
})

describe("generateEstimate AI governance fields", () => {
  it("marks the estimate as an unconfirmed AI draft", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.source).toBe("ai")
    expect(result.createdBy).toBe("ai")
    expect(result.reviewStatus).toBe("draft")
    expect(result.approvedBy).toBeUndefined()
    expect(result.approvedAt).toBeUndefined()
  })

  it("derives overall confidence as the lowest confidence among its lines", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const ranks = { low: 0, medium: 1, high: 2 } as const
    const lowest = result.lines.reduce<EstimateLine["confidence"]>(
      (min, l) => (ranks[l.confidence] < ranks[min] ? l.confidence : min),
      "high",
    )
    expect(result.confidence).toBe(lowest)
  })
})

describe("confirmEstimate", () => {
  it("confirms a draft estimate and records who/when", () => {
    const { state: afterGenerate, result: draft } = run(seed, homeowner, generateEstimate(input))
    const { result: confirmed } = run(afterGenerate, homeowner, confirmEstimate(draft.id))
    expect(confirmed.reviewStatus).toBe("confirmed")
    expect(confirmed.approvedBy).toBe("person-demo-homeowner")
    expect(confirmed.approvedAt).toBe("2026-09-29T10:00:00.000Z")
  })

  it("refuses to confirm someone else's estimate", () => {
    const { state: afterGenerate, result: draft } = run(seed, homeowner, generateEstimate(input))
    const otherHomeowner: Session = { accountType: "homeowner", personId: "person-someone-else" }
    expect(() => run(afterGenerate, otherHomeowner, confirmEstimate(draft.id))).toThrow(ConflictError)
  })

  it("refuses to confirm an already-confirmed estimate", () => {
    const { state: afterGenerate, result: draft } = run(seed, homeowner, generateEstimate(input))
    const { state: afterConfirm } = run(afterGenerate, homeowner, confirmEstimate(draft.id))
    expect(() => run(afterConfirm, homeowner, confirmEstimate(draft.id))).toThrow(ConflictError)
  })

  it("refuses an unknown estimate id", () => {
    expect(() => run(seed, homeowner, confirmEstimate("estimate-nope"))).toThrow(ConflictError)
  })
})
