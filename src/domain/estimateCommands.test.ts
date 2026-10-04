import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { confirmEstimate, generateEstimate } from "./estimateCommands"
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

const sumOf = (lines: { amount: number }[]) => lines.reduce((sum, l) => sum + l.amount, 0)

describe("generateEstimate totals", () => {
  it("sums the lines into the total and applies the ±8% range", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const total = sumOf(result.lines)
    expect(result.totalLow).toBeCloseTo(total * 0.92, 5)
    expect(result.totalHigh).toBeCloseTo(total * 1.08, 5)
  })

  it("breakdown categories equal the sum of their lines", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const cat = (c: string) => sumOf(result.lines.filter((l) => l.category === c))
    expect(result.breakdown.materials).toBeCloseTo(cat("materials"), 5)
    expect(result.breakdown.labour).toBeCloseTo(cat("labour"), 5)
    expect(result.breakdown.finishing).toBeCloseTo(cat("finishing"), 5)
    expect(result.breakdown.contingency).toBeCloseTo(cat("contingency"), 5)
  })

  it("contingency is 5% of materials + labour + finishing", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const base = result.breakdown.materials + result.breakdown.labour + result.breakdown.finishing
    expect(result.breakdown.contingency).toBeCloseTo(base * 0.05, 5)
  })

  it("higher construction levels cost more for the same area", () => {
    const total = (level: "basic" | "standard" | "premium") =>
      run(seed, homeowner, generateEstimate({ ...input, constructionLevel: level })).result.lines.reduce((s, l) => s + l.amount, 0)
    expect(total("basic")).toBeLessThan(total("standard"))
    expect(total("standard")).toBeLessThan(total("premium"))
  })

  it("percentages vary with construction level (not fixed)", () => {
    const share = (level: "basic" | "standard" | "premium") => {
      const { result } = run(seed, homeowner, generateEstimate({ ...input, constructionLevel: level }))
      return result.breakdown.materials / sumOf(result.lines)
    }
    expect(share("basic")).not.toBeCloseTo(share("premium"), 3)
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

  it("requires a positive built-up area and at least 1 floor", () => {
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: 0 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: -5 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: 1.5 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: 0 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: -1 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: 1.5 }))).toThrow(ConflictError)
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

  it("every line's amount equals quantity x rate", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    for (const line of result.lines) {
      expect(line.amount).toBeCloseTo(line.quantity * line.rate, 5)
    }
  })

  it("uses the rate card value for cement at standard level", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const cement = result.lines.find((l) => l.item.startsWith("Cement"))!
    expect(cement.rate).toBe(380)
  })

  it("no line has zero quantity or a non-finite rate, even for tiny areas", () => {
    for (const area of [1, 8, 9]) {
      const { result } = run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: area }))
      for (const line of result.lines) {
        expect(line.quantity).toBeGreaterThan(0)
        expect(Number.isFinite(line.rate)).toBe(true)
      }
    }
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

  it("overall confidence is medium (lines are medium, contingency high)", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.confidence).toBe("medium")
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
