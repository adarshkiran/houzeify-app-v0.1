import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import {
  getCustomerVisibleEvidence,
  getEvidenceForProgress,
  getPublishedDocuments,
  getPublishedEvidence,
  getPublishedForCustomer,
  getPublishedIssues,
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

  it("shows the homeowner only what was chosen at publishing", () => {
    const progress = seedConstructionData.dailyProgress.find((item) => item.id === "progress-sharma-2009")!
    const narrowed = {
      ...seedConstructionData,
      dailyProgress: seedConstructionData.dailyProgress.map((item) =>
        item.id === progress.id
          ? { ...item, publication: { ...item.publication!, evidenceIds: ["evidence-sharma-1"] } }
          : item,
      ),
    }
    const shown = getPublishedEvidence(narrowed, narrowed.dailyProgress.find((item) => item.id === progress.id)!)
    expect(shown.map((item) => item.id)).toEqual(["evidence-sharma-1"])
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

describe("published issues and documents", () => {
  // All seeded issues default to private (Task 1) — build a local override with
  // issue-3 published, the same way the "shows the homeowner only what was chosen
  // at publishing" test above overrides state rather than relying on a seeded default.
  const issuePublished = {
    ...seedConstructionData,
    issues: seedConstructionData.issues.map((item) =>
      item.id === "issue-3" ? { ...item, customerVisibility: "customer-visible" as const } : item,
    ),
  }

  it("returns only customer-visible issues for the project", () => {
    const published = getPublishedIssues(issuePublished, "project-sharma")
    expect(published.every((item) => item.customerVisibility === "customer-visible")).toBe(true)
    expect(published.some((item) => item.id === "issue-3")).toBe(true)
  })

  it("excludes private issues", () => {
    const published = getPublishedIssues(seedConstructionData, "project-sharma")
    expect(published).toHaveLength(0)
  })

  it("returns only customer-visible documents for the project", () => {
    const published = getPublishedDocuments(seedConstructionData, "project-sharma")
    expect(published.every((item) => item.customerVisibility === "customer-visible")).toBe(true)
    expect(published.some((item) => item.id === "document-sharma-1")).toBe(true)
    expect(published.some((item) => item.id === "document-sharma-2")).toBe(false) // private
  })
})
