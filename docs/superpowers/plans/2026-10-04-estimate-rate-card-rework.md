# Estimate Rate-Card Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 56/26/13/5 back-computed line items with a real per-item rate card; totals and percentages are summed from lines.

**Architecture:** `generateEstimate` builds lines from a fixed rate card (rate per item per construction level) × quantity per sq ft × built-up area. Category breakdown, total, and the ±8% range all derive from line amounts. `ESTIMATE_RATES` and `BREAKDOWN_SHARE` are removed.

**Tech Stack:** TypeScript, Vitest (existing).

**Spec:** `docs/superpowers/specs/2026-09-30-phase-8-ai-construction-advisor-homeowner-design.md` — see "Revision 2" (supersedes §1–§3).

## Global Constraints

- `src/domain/*.ts` never imports from `src/mock/*`.
- Keep `estimateCommands.ts` style: double quotes, no semicolons.
- Rate values are illustrative placeholders, not market data.
- `confirmEstimate`, governance fields, and the public `generateEstimate` signature are unchanged.

---

### Task 1: Rate-card generation, derived totals, tests

**Files:**
- Modify: `src/domain/estimateCommands.ts` (full replacement)
- Modify: `src/domain/estimateCommands.test.ts` (full replacement)
- Modify: `src/mock/seed.ts` (remove the `ESTIMATE_RATES` export only)

**Interfaces:**
- Consumes: `Estimate`, `EstimateLine`, `EstimateLineCategory`, `ConstructionLevel`, `EntityId` from `./models`; `Command`, `CommandContext` from `./ports`; `ConflictError` from `./errors`.
- Produces: `generateEstimate(input: GenerateEstimateInput): Command<Estimate>` (unchanged signature); `confirmEstimate(estimateId: EntityId): Command<Estimate>` (unchanged); `GenerateEstimateInput` (unchanged).

- [ ] **Step 1: Replace `src/domain/estimateCommands.ts`**

```ts
import { ConflictError } from "./errors"
import type { ConstructionLevel, Estimate, EstimateLine, EstimateLineCategory, EntityId } from "./models"
import type { Command, CommandContext } from "./ports"

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

const CATALOG_EFFECTIVE_DATE = "2026-09-01T00:00:00.000Z"
const CATALOG_SOURCE = "Houzeify regional rate card"
const CONTINGENCY_SOURCE = "Houzeify policy — 5% contingency"
const CONTINGENCY_RATE = 0.05
const RANGE_LOW = 0.92
const RANGE_HIGH = 1.08

/** Unit rate per construction level. Illustrative placeholders, not market data. */
const RATE_CARD = {
  cement: { basic: 350, standard: 380, premium: 420 }, // ₹ per bag
  steel: { basic: 62000, standard: 70000, premium: 78000 }, // ₹ per MT
  blocks: { basic: 60, standard: 70, premium: 85 }, // ₹ per block
  mason: { basic: 850, standard: 950, premium: 1100 }, // ₹ per day
  helper: { basic: 550, standard: 600, premium: 680 }, // ₹ per day
  finishing: { basic: 180, standard: 234, premium: 320 }, // ₹ per sq ft
} as const

/** Quantity consumed per sq ft of built-up area. */
const QTY_PER_SQFT = {
  cement: 0.93, // bags
  steel: 0.006, // MT
  blocks: 3.6, // blocks
  mason: 0.27, // days
  helper: 0.35, // days
}

const CONFIDENCE_RANK: Record<EstimateLine["confidence"], number> = { low: 0, medium: 1, high: 2 }

export interface GenerateEstimateInput {
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
}

function catalogLine(
  ctx: CommandContext,
  category: EstimateLineCategory,
  item: string,
  quantity: number,
  unit: string,
  rate: number,
  confidence: EstimateLine["confidence"],
): EstimateLine {
  return {
    id: ctx.ids.next("estimate-line"),
    category,
    item,
    quantity,
    unit,
    rate,
    amount: quantity * rate,
    source: CATALOG_SOURCE,
    effectiveDate: CATALOG_EFFECTIVE_DATE,
    confidence,
  }
}

function buildLines(ctx: CommandContext, area: number, level: ConstructionLevel): EstimateLine[] {
  const steelQty = Math.max(0.1, Math.round(QTY_PER_SQFT.steel * area * 10) / 10)
  const body: EstimateLine[] = [
    catalogLine(ctx, "materials", "Cement (OPC 53 Grade)", Math.max(1, Math.round(QTY_PER_SQFT.cement * area)), "bags", RATE_CARD.cement[level], "medium"),
    catalogLine(ctx, "materials", "TMT Steel (Fe 500)", steelQty, "MT", RATE_CARD.steel[level], "medium"),
    catalogLine(ctx, "materials", "AAC Blocks", Math.max(1, Math.round(QTY_PER_SQFT.blocks * area)), "blocks", RATE_CARD.blocks[level], "medium"),
    catalogLine(ctx, "labour", "Mason (skilled)", Math.max(1, Math.round(QTY_PER_SQFT.mason * area)), "days", RATE_CARD.mason[level], "medium"),
    catalogLine(ctx, "labour", "Helper (unskilled)", Math.max(1, Math.round(QTY_PER_SQFT.helper * area)), "days", RATE_CARD.helper[level], "medium"),
    catalogLine(ctx, "finishing", "Finishing works (flooring, painting, fixtures)", area, "sqft", RATE_CARD.finishing[level], "medium"),
  ]
  const subtotal = body.reduce((sum, l) => sum + l.amount, 0)
  const contingency: EstimateLine = {
    id: ctx.ids.next("estimate-line"),
    category: "contingency",
    item: "Contingency (5% policy buffer)",
    quantity: 1,
    unit: "lump sum",
    rate: subtotal * CONTINGENCY_RATE,
    amount: subtotal * CONTINGENCY_RATE,
    source: CONTINGENCY_SOURCE,
    effectiveDate: CATALOG_EFFECTIVE_DATE,
    confidence: "high",
  }
  return [...body, contingency]
}

function sumCategory(lines: EstimateLine[], category: EstimateLineCategory): number {
  return lines.filter((l) => l.category === category).reduce((sum, l) => sum + l.amount, 0)
}

/**
 * Computes a self-serve homeowner estimate from a per-item rate card × quantity
 * × built-up area. Totals and category breakdown are summed from the lines.
 * Not a Project — no company involved yet. Governance fields mark it as an
 * unconfirmed AI-generated draft — see confirmEstimate.
 */
export const generateEstimate =
  (input: GenerateEstimateInput): Command<Estimate> =>
  (state, ctx) => {
    if (ctx.actor?.accountType !== "homeowner") {
      throw new Error("Only homeowners can generate an estimate.")
    }
    const projectName = input.projectName.trim()
    if (!projectName) throw new ConflictError("Give the project a name.")
    const location = input.location.trim()
    if (!location) throw new ConflictError("Add a location.")
    if (!Number.isInteger(input.builtUpAreaSqft) || input.builtUpAreaSqft <= 0) {
      throw new ConflictError("Enter a built-up area greater than zero.")
    }
    if (!Number.isInteger(input.floors) || input.floors < 1) {
      throw new ConflictError("Enter at least 1 floor.")
    }

    const id = ctx.ids.next("estimate")
    const lines = buildLines(ctx, input.builtUpAreaSqft, input.constructionLevel)
    const total = lines.reduce((sum, l) => sum + l.amount, 0)
    const breakdown = {
      materials: sumCategory(lines, "materials"),
      labour: sumCategory(lines, "labour"),
      finishing: sumCategory(lines, "finishing"),
      contingency: sumCategory(lines, "contingency"),
    }
    const confidence = lines.reduce<EstimateLine["confidence"]>(
      (lowest, l) => (CONFIDENCE_RANK[l.confidence] < CONFIDENCE_RANK[lowest] ? l.confidence : lowest),
      "high",
    )

    const estimate: Estimate = {
      id,
      homeownerPersonId: ctx.actor.personId,
      projectName,
      propertyType: input.propertyType,
      location,
      builtUpAreaSqft: input.builtUpAreaSqft,
      floors: input.floors,
      constructionLevel: input.constructionLevel,
      totalLow: total * RANGE_LOW,
      totalHigh: total * RANGE_HIGH,
      breakdown,
      lines,
      source: "ai",
      confidence,
      createdBy: "ai",
      reviewStatus: "draft",
      createdAt: iso(ctx),
    }
    return { state: { ...state, estimates: [...state.estimates, estimate] }, result: estimate }
  }

/**
 * Marks a draft AI estimate as reviewed by the homeowner it belongs to.
 * Confirming twice is refused rather than accepted silently.
 */
export const confirmEstimate =
  (estimateId: EntityId): Command<Estimate> =>
  (state, ctx) => {
    if (ctx.actor?.accountType !== "homeowner") {
      throw new Error("Only homeowners can confirm an estimate.")
    }
    const estimate = state.estimates.find((item) => item.id === estimateId)
    if (!estimate) throw new ConflictError("That estimate no longer exists.")
    if (estimate.homeownerPersonId !== ctx.actor.personId) {
      throw new ConflictError("You can only confirm your own estimate.")
    }
    if (estimate.reviewStatus === "confirmed") {
      throw new ConflictError("This estimate is already confirmed.")
    }

    const confirmed: Estimate = {
      ...estimate,
      reviewStatus: "confirmed",
      approvedBy: ctx.actor.personId,
      approvedAt: iso(ctx),
    }
    return {
      state: {
        ...state,
        estimates: state.estimates.map((item) => (item.id === estimateId ? confirmed : item)),
      },
      result: confirmed,
    }
  }
```

- [ ] **Step 2: Remove `ESTIMATE_RATES` from `src/mock/seed.ts`**

Delete the exported `ESTIMATE_RATES` constant (the block starting `export const ESTIMATE_RATES` through its closing `}`). Leave `const estimates: Estimate[] = []` and everything else unchanged. Check nothing else imports it: `grep -rn "ESTIMATE_RATES" src` should show only the test file, which Step 3 replaces.

- [ ] **Step 3: Replace `src/domain/estimateCommands.test.ts`**

```ts
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
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: 0 }))).toThrow(ConflictError)
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
```

- [ ] **Step 4: Run checks**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS. If the `visibility.test.ts` or any other test still imports `ESTIMATE_RATES`, remove that import only. Count of tests will differ from 396; report the actual number.

- [ ] **Step 5: Commit**

```bash
git add src/domain/estimateCommands.ts src/domain/estimateCommands.test.ts src/mock/seed.ts
git commit -m "feat: per-item rate card; totals and percentages summed from lines"
```
