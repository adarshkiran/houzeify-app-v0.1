import { ConflictError } from "./errors"
import type { ConstructionLevel, Estimate } from "./models"
import type { Command, CommandContext } from "./ports"

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

/** ₹/sq-ft. Kept in sync with the identical table in src/mock/seed.ts — domain code never imports from mock. */
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

export interface GenerateEstimateInput {
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
}

/**
 * Computes a self-serve homeowner estimate: rate table x built-up area, split
 * into the standard four cost buckets. Not a Project — no company involved yet.
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

    const rate = ESTIMATE_RATES[input.constructionLevel]
    const totalLow = rate.low * input.builtUpAreaSqft
    const totalHigh = rate.high * input.builtUpAreaSqft
    const midpoint = (totalLow + totalHigh) / 2

    const estimate: Estimate = {
      id: ctx.ids.next("estimate"),
      homeownerPersonId: ctx.actor.personId,
      projectName,
      propertyType: input.propertyType,
      location,
      builtUpAreaSqft: input.builtUpAreaSqft,
      floors: input.floors,
      constructionLevel: input.constructionLevel,
      totalLow,
      totalHigh,
      breakdown: {
        materials: midpoint * BREAKDOWN_SHARE.materials,
        labour: midpoint * BREAKDOWN_SHARE.labour,
        finishing: midpoint * BREAKDOWN_SHARE.finishing,
        contingency: midpoint * BREAKDOWN_SHARE.contingency,
      },
      createdAt: iso(ctx),
    }
    return { state: { ...state, estimates: [...state.estimates, estimate] }, result: estimate }
  }
