import { ConflictError } from "./errors"
import type { ConstructionLevel, Estimate, EstimateLine, EstimateLineCategory, EntityId } from "./models"
import type { Command, CommandContext } from "./ports"
import { buildCatalogLines } from "./rateCard"

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

const RANGE_LOW = 0.92
const RANGE_HIGH = 1.08

const CONFIDENCE_RANK: Record<EstimateLine["confidence"], number> = { low: 0, medium: 1, high: 2 }

export interface GenerateEstimateInput {
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
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
    const lines = buildCatalogLines(ctx, input.builtUpAreaSqft, input.constructionLevel)
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
