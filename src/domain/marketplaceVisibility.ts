import type { ConstructionDataState, EntityId, EstimateLine, MarketplaceRequirement } from "./models"

export interface RequirementPreview {
  kind: "preview"
  id: EntityId
  location: string
  propertyType: string
  areaBand: string
  estimateTotalLow: number
  estimateTotalHigh: number
  status: MarketplaceRequirement["status"]
}

export interface RequirementFull extends Omit<RequirementPreview, "kind" | "areaBand"> {
  kind: "full"
  projectName: string
  builtUpAreaSqft: number
  constructionLevel: MarketplaceRequirement["constructionLevel"]
  lines: EstimateLine[]
}

/**
 * Location shown to partners before unlock: the city segment before the state.
 * Splits on commas, trims each part, and drops empty parts. With two or more
 * parts it returns the second-to-last ("Plot 12, Road 3, Hyderabad, Telangana"
 * gives "Hyderabad"); with one part it returns that part.
 */
export function cityOf(location: string): string {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length === 0) return ""
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0]
}

/** Area shown to partners before unlock, rounded to a band so exact size is not revealed. */
export function areaBand(area: number): string {
  const low = Math.floor(area / 500) * 500
  return `${low.toLocaleString("en-IN")}–${(low + 500).toLocaleString("en-IN")} sq ft`
}

/**
 * Estimate range shown to partners before unlock. Low rounds down and high
 * rounds up to the nearest ₹1 lakh (100000), so the range always contains the
 * exact estimate while the exact figures stay hidden until unlock.
 */
export function previewRange(low: number, high: number): { low: number; high: number } {
  const lakh = 100_000
  return { low: Math.floor(low / lakh) * lakh, high: Math.ceil(high / lakh) * lakh }
}

/**
 * What an organization may see of a requirement: a preview by default, full
 * details only after that organization has unlocked it. Enforced here so the
 * UI cannot reveal what the domain withholds.
 */
export function viewRequirement(
  state: ConstructionDataState,
  requirementId: EntityId,
  partnerOrganizationId: EntityId,
): RequirementPreview | RequirementFull | undefined {
  const requirement = state.requirements.find((r) => r.id === requirementId)
  if (!requirement) return undefined
  const unlocked = state.unlocks.some(
    (u) => u.requirementId === requirementId && u.partnerOrganizationId === partnerOrganizationId,
  )
  const base = {
    id: requirement.id,
    location: cityOf(requirement.location),
    propertyType: requirement.propertyType,
    status: requirement.status,
  }
  if (!unlocked) {
    const range = previewRange(requirement.estimateTotalLow, requirement.estimateTotalHigh)
    return {
      kind: "preview",
      ...base,
      estimateTotalLow: range.low,
      estimateTotalHigh: range.high,
      areaBand: areaBand(requirement.builtUpAreaSqft),
    }
  }
  const exact = {
    estimateTotalLow: requirement.estimateTotalLow,
    estimateTotalHigh: requirement.estimateTotalHigh,
  }
  const estimate = state.estimates.find((e) => e.id === requirement.estimateId)
  return {
    kind: "full",
    ...base,
    ...exact,
    projectName: requirement.projectName,
    builtUpAreaSqft: requirement.builtUpAreaSqft,
    constructionLevel: requirement.constructionLevel,
    lines: estimate?.lines ?? [],
  }
}
