import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import {
  getCustomerVisibleEvidence,
  getEvidenceForProgress,
  getPublishedForCustomer,
} from "../mock/selectors"
import { Permissions, hasPermission, permissionsForRole } from "./permissions"

describe("published-only customer visibility", () => {
  it("returns only approved + published progress for customers", () => {
    const published = getPublishedForCustomer(
      seedConstructionData,
      "project-sharma",
    )
    expect(published.every((item) => item.reviewStatus === "approved")).toBe(
      true,
    )
    expect(
      published.every((item) => item.publicationStatus === "published"),
    ).toBe(true)
  })

  it("keeps tech-park submitted progress out of the customer feed", () => {
    const published = getPublishedForCustomer(
      seedConstructionData,
      "project-tech-park",
    )
    expect(published).toHaveLength(0)
  })

  it("filters evidence to customer-visible only", () => {
    const progress = seedConstructionData.dailyProgress.find(
      (item) => item.id === "progress-sharma-2009",
    )!
    const evidence = getEvidenceForProgress(seedConstructionData, progress)
    const visible = getCustomerVisibleEvidence(evidence)
    expect(visible.length).toBeGreaterThan(0)
    expect(
      visible.every((item) => item.customerVisibility === "customer-visible"),
    ).toBe(true)
  })
})

describe("permissions", () => {
  it("gives project managers review + publish rights", () => {
    const granted = permissionsForRole("project-manager")
    expect(hasPermission(granted, Permissions.PROGRESS_REVIEW)).toBe(true)
    expect(hasPermission(granted, Permissions.CUSTOMER_PUBLISH)).toBe(true)
  })

  it("does not give workers publish rights", () => {
    const granted = permissionsForRole("worker")
    expect(hasPermission(granted, Permissions.CUSTOMER_PUBLISH)).toBe(false)
    expect(hasPermission(granted, Permissions.EVIDENCE_CAPTURE)).toBe(true)
  })
})
