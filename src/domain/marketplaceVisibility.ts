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
 * Location shown to partners before unlock: the text before the first comma, so
 * "Hyderabad, Telangana" shows as "Hyderabad". Without a comma, the trimmed input.
 * Note: this does not extract the city from long addresses; "Plot 12, Road 3, ..."
 * yields "Plot 12".
 */
export function cityOf(location: string): string {
  const comma = location.indexOf(",")
  return (comma === -1 ? location : location.slice(0, comma)).trim()
}

/** Area shown to partners before unlock, rounded to a band so exact size is not revealed. */
export function areaBand(area: number): string {
  const low = Math.floor(area / 500) * 500
  return `${low.toLocaleString("en-IN")}–${(low + 500).toLocaleString("en-IN")} sq ft`
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
    estimateTotalLow: requirement.estimateTotalLow,
    estimateTotalHigh: requirement.estimateTotalHigh,
    status: requirement.status,
  }
  if (!unlocked) {
    return { kind: "preview", ...base, areaBand: areaBand(requirement.builtUpAreaSqft) }
  }
  const estimate = state.estimates.find((e) => e.id === requirement.estimateId)
  return {
    kind: "full",
    ...base,
    projectName: requirement.projectName,
    builtUpAreaSqft: requirement.builtUpAreaSqft,
    constructionLevel: requirement.constructionLevel,
    lines: estimate?.lines ?? [],
  }
}
