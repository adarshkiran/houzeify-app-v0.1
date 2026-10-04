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
