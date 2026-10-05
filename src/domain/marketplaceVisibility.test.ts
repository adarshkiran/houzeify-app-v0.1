import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { cityOf, viewRequirement } from "./marketplaceVisibility"
import type { ConstructionDataState, MarketplaceRequirement } from "./models"

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
