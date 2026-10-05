import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { areaBand, cityOf, previewRange, viewRequirement } from "./marketplaceVisibility"
import type { ConstructionDataState, MarketplaceRequirement } from "./models"

const rangeRequirement: MarketplaceRequirement = {
  id: "requirement-range-test",
  estimateId: "estimate-range-test",
  homeownerPersonId: "person-demo-homeowner",
  projectName: "Range Home",
  location: "Plot 4, Road 9, Hyderabad, Telangana",
  builtUpAreaSqft: 2000,
  constructionLevel: "standard",
  propertyType: "House",
  estimateTotalLow: 2_540_000,
  estimateTotalHigh: 2_940_000,
  status: "posted",
  createdAt: "2026-10-04T10:00:00.000Z",
}

describe("previewRange", () => {
  it("rounds low down and high up to the lakh", () => {
    expect(previewRange(2_540_000, 2_940_000)).toEqual({ low: 2_500_000, high: 3_000_000 })
  })

  it("leaves an exact lakh multiple unchanged", () => {
    expect(previewRange(3_000_000, 3_000_000)).toEqual({ low: 3_000_000, high: 3_000_000 })
  })
})

describe("viewRequirement estimate range", () => {
  it("previews a range rounded outward to the lakh, never the exact estimate", () => {
    const state: ConstructionDataState = { ...seed, requirements: [rangeRequirement], unlocks: [] }
    const view = viewRequirement(state, rangeRequirement.id, "org-other")
    expect(view?.kind).toBe("preview")
    expect(view!.estimateTotalLow).toBeLessThanOrEqual(rangeRequirement.estimateTotalLow)
    expect(view!.estimateTotalHigh).toBeGreaterThanOrEqual(rangeRequirement.estimateTotalHigh)
    expect(view!.estimateTotalLow % 100_000).toBe(0)
    expect(view!.estimateTotalHigh % 100_000).toBe(0)
  })

  it("keeps the exact estimate in the full view for an unlocked organization", () => {
    const state: ConstructionDataState = {
      ...seed,
      requirements: [rangeRequirement],
      unlocks: [
        {
          id: "unlock-range-test",
          requirementId: rangeRequirement.id,
          partnerOrganizationId: "org-unlocked",
          unlockedAt: "2026-10-05T10:00:00.000Z",
          creditTransactionId: "tx-range-test",
        },
      ],
    }
    const view = viewRequirement(state, rangeRequirement.id, "org-unlocked")
    expect(view?.kind).toBe("full")
    expect(view!.estimateTotalLow).toBe(2_540_000)
    expect(view!.estimateTotalHigh).toBe(2_940_000)
  })
})

describe("cityOf", () => {
  it("returns the segment before the state", () => {
    expect(cityOf("Hyderabad, Telangana")).toBe("Hyderabad")
  })

  it("returns the single part when there is no comma", () => {
    expect(cityOf("Hyderabad")).toBe("Hyderabad")
  })

  it("trims parts and ignores spacing and empty segments", () => {
    expect(cityOf("  Plot 12 ,  Hyderabad ,Telangana ")).toBe("Hyderabad")
  })

  it("picks the city from a street-level address, not the street", () => {
    expect(cityOf("Plot 12, Road 3, Hyderabad, Telangana")).toBe("Hyderabad")
  })
})

describe("viewRequirement preview location", () => {
  it("shows the city segment, not the raw street-level location", () => {
    const requirement: MarketplaceRequirement = {
      id: "requirement-vis-test",
      estimateId: "estimate-vis-test",
      homeownerPersonId: "person-demo-homeowner",
      projectName: "Test Home",
      location: "Plot 12, Road 3, Hyderabad, Telangana",
      builtUpAreaSqft: 2000,
      constructionLevel: "standard",
      propertyType: "House",
      estimateTotalLow: 1000000,
      estimateTotalHigh: 1200000,
      status: "posted",
      createdAt: "2026-10-04T10:00:00.000Z",
    }
    const state: ConstructionDataState = { ...seed, requirements: [requirement], unlocks: [] }
    const view = viewRequirement(state, requirement.id, "org-other")
    expect(view?.kind).toBe("preview")
    expect(view?.location).toBe("Hyderabad")
    expect(view).not.toHaveProperty("projectName")
  })
})

describe("areaBand", () => {
  it("rounds down to a 500 sq ft band with en-IN separators", () => {
    expect(areaBand(1500)).toBe("1,500–2,000 sq ft")
  })

  it("uses the band that contains the area, including on a boundary", () => {
    expect(areaBand(1999)).toBe("1,500–2,000 sq ft")
    expect(areaBand(2000)).toBe("2,000–2,500 sq ft")
  })
})
