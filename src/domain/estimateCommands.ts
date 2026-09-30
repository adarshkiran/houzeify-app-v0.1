import { ConflictError } from "./errors"
import type { ConstructionLevel, Estimate, EstimateLine, EstimateLineCategory, EntityId } from "./models"
import type { Command, CommandContext } from "./ports"

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

/**
 * ₹/sq-ft. Seeds the generated line items below — not stored on the Estimate
 * record itself (totalLow/totalHigh are, computed directly from this table,
 * unchanged from before line items existed). Kept in sync with the identical
 * table in src/mock/seed.ts — domain code never imports from mock.
 */
const ESTIMATE_RATES: Record<ConstructionLevel, { low: number; high: number }> = {
  basic: { low: 1450, high: 1650 },
  standard: { low: 1650, high: 1950 },
  premium: { low: 1950, high: 2400 },
}

const BREAKDOWN_SHARE = {
  materials: 0.56,
  labour: 0.26,
  finishing: 0.13,
  contingency: 0.05,
}

/**
 * Fixed rate-card catalog: one representative item per line. Multi-brand
 * selection (e.g. choosing between cement brands at different rates) is
 * explicit future scope — see the Phase 8 spec.
 */
const CATALOG_EFFECTIVE_DATE = "2026-09-01T00:00:00.000Z"
const CATALOG_SOURCE = "Houzeify regional rate card"

/** How much of one sq-ft of built-up area each catalog item consumes. Fixed across construction levels — only the rate (derived below) scales with level. */
const QTY_PER_SQFT = {
  cement: 0.93, // bags
  steel: 0.006, // MT
  blocks: 3.6, // AAC blocks
  mason: 0.27, // days
  helper: 0.35, // days
}

/** How a category's bucket amount splits across its catalog items. Each group must sum to 1. */
const MATERIALS_SHARE = { cement: 0.35, steel: 0.4, blocks: 0.25 }
const LABOUR_SHARE = { mason: 0.55, helper: 0.45 }

const CONFIDENCE_RANK: Record<EstimateLine["confidence"], number> = { low: 0, medium: 1, high: 2 }

export interface GenerateEstimateInput {
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
}

function buildLines(ctx: CommandContext, area: number, midpoint: number): EstimateLine[] {
  const materialsBucket = midpoint * BREAKDOWN_SHARE.materials
  const labourBucket = midpoint * BREAKDOWN_SHARE.labour
  const finishingBucket = midpoint * BREAKDOWN_SHARE.finishing
  const contingencyBucket = midpoint * BREAKDOWN_SHARE.contingency

  const line = (
    category: EstimateLineCategory,
    item: string,
    quantity: number,
    unit: string,
    amount: number,
    confidence: EstimateLine["confidence"],
    source: string = CATALOG_SOURCE,
  ): EstimateLine => ({
    id: ctx.ids.next("estimate-line"),
    category,
    item,
    quantity,
    unit,
    rate: amount / quantity,
    amount,
    source,
    effectiveDate: CATALOG_EFFECTIVE_DATE,
    confidence,
  })

  const cementQty = Math.round(QTY_PER_SQFT.cement * area)
  const steelQty = Math.round(QTY_PER_SQFT.steel * area * 10) / 10
  const blocksQty = Math.round(QTY_PER_SQFT.blocks * area)
  const masonQty = Math.round(QTY_PER_SQFT.mason * area)
  const helperQty = Math.round(QTY_PER_SQFT.helper * area)

  return [
    line("materials", "Cement (OPC 53 Grade)", cementQty, "bags", materialsBucket * MATERIALS_SHARE.cement, "medium"),
    line("materials", "TMT Steel (Fe 500)", steelQty, "MT", materialsBucket * MATERIALS_SHARE.steel, "medium"),
    line("materials", "AAC Blocks", blocksQty, "blocks", materialsBucket * MATERIALS_SHARE.blocks, "medium"),
    line("labour", "Mason (skilled)", masonQty, "days", labourBucket * LABOUR_SHARE.mason, "medium"),
    line("labour", "Helper (unskilled)", helperQty, "days", labourBucket * LABOUR_SHARE.helper, "medium"),
    line("finishing", "Finishing works (flooring, painting, fixtures)", area, "sqft", finishingBucket, "medium"),
    line(
      "contingency",
      "Contingency (5% policy buffer)",
      1,
      "lump sum",
      contingencyBucket,
      "high",
      "Houzeify policy — 5% contingency",
    ),
  ]
}

function sumCategory(lines: EstimateLine[], category: EstimateLineCategory): number {
  return lines.filter((l) => l.category === category).reduce((sum, l) => sum + l.amount, 0)
}

/**
 * Computes a self-serve homeowner estimate: rate table x built-up area,
 * decomposed into real line items under the standard four cost buckets. Not
 * a Project — no company involved yet. Governance fields mark this as an
 * unconfirmed AI-generated draft — see confirmEstimate below.
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
    const rate = ESTIMATE_RATES[input.constructionLevel]
    const totalLow = rate.low * input.builtUpAreaSqft
    const totalHigh = rate.high * input.builtUpAreaSqft
    const midpoint = (totalLow + totalHigh) / 2

    const lines = buildLines(ctx, input.builtUpAreaSqft, midpoint)
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
      totalLow,
      totalHigh,
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
 * Idempotency is deliberately refused (not silently accepted) — confirming
 * twice almost always means the caller lost track of the estimate's state.
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
