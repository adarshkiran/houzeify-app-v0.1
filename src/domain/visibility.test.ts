import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import {
  getCustomerVisibleEvidence,
  getEstimate,
  getEvidenceForProgress,
  getLatestEstimate,
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

  it("excludes a published issue or document from a different project", () => {
    const crossProject = {
      ...seedConstructionData,
      issues: seedConstructionData.issues.map((item) =>
        item.id === "issue-1" ? { ...item, customerVisibility: "customer-visible" as const } : item,
      ),
      documents: [
        ...seedConstructionData.documents,
        {
          id: "document-tech-park-1",
          projectId: "project-tech-park",
          title: "Tech Park approval",
          category: "approval" as const,
          url: "/mock-evidence/tech-park-approval.pdf",
          uploadedByMembershipId: "membership-manager-3",
          customerVisibility: "customer-visible" as const,
          createdAt: "2026-09-10T10:00:00+05:30",
        },
      ],
    }

    const publishedIssues = getPublishedIssues(crossProject, "project-sharma")
    expect(publishedIssues.some((item) => item.id === "issue-1")).toBe(false)

    const publishedDocuments = getPublishedDocuments(crossProject, "project-sharma")
    expect(publishedDocuments.some((item) => item.id === "document-tech-park-1")).toBe(false)
  })
})

describe("estimate selectors", () => {
  const withEstimates = {
    ...seedConstructionData,
    estimates: [
      {
        id: "estimate-1",
        homeownerPersonId: "person-demo-homeowner",
        projectName: "First House",
        propertyType: "House",
        location: "Hyderabad",
        builtUpAreaSqft: 2000,
        floors: 2,
        constructionLevel: "standard" as const,
        totalLow: 3300000,
        totalHigh: 3900000,
        breakdown: { materials: 2016000, labour: 936000, finishing: 468000, contingency: 180000 },
        createdAt: "2026-09-20T10:00:00.000Z",
      },
      {
        id: "estimate-2",
        homeownerPersonId: "person-demo-homeowner",
        projectName: "Second House",
        propertyType: "Villa",
        location: "Hyderabad",
        builtUpAreaSqft: 2500,
        floors: 3,
        constructionLevel: "premium" as const,
        totalLow: 4875000,
        totalHigh: 6000000,
        breakdown: { materials: 3045000, labour: 1413000, finishing: 706500, contingency: 271500 },
        createdAt: "2026-09-28T10:00:00.000Z",
      },
      {
        id: "estimate-other",
        homeownerPersonId: "person-someone-else",
        projectName: "Not mine",
        propertyType: "House",
        location: "Chennai",
        builtUpAreaSqft: 1000,
        floors: 1,
        constructionLevel: "basic" as const,
        totalLow: 1450000,
        totalHigh: 1650000,
        breakdown: { materials: 868000, labour: 403000, finishing: 201500, contingency: 77500 },
        createdAt: "2026-09-29T10:00:00.000Z",
      },
    ],
  }

  it("getEstimate returns the matching record", () => {
    expect(getEstimate(withEstimates, "estimate-1")?.projectName).toBe("First House")
    expect(getEstimate(withEstimates, "nope")).toBeUndefined()
  })

  it("getLatestEstimate returns the newest for that homeowner, ignoring others", () => {
    const latest = getLatestEstimate(withEstimates, "person-demo-homeowner")
    expect(latest?.id).toBe("estimate-2")
  })

  it("getLatestEstimate returns undefined when the homeowner has none", () => {
    expect(getLatestEstimate(withEstimates, "person-nobody")).toBeUndefined()
  })
})
