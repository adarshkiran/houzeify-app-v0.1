import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { Permissions, permissionsForRole } from "./permissions"

describe("seed after Daily Progress v2", () => {
  it("gives every update a version and no leftover 'ready' publication state", () => {
    for (const item of seed.dailyProgress) {
      expect(item.version).toBeGreaterThanOrEqual(1)
      expect(["private", "published"]).toContain(item.publicationStatus)
    }
  })

  it("links the resent Reddy update to the version it replaced", () => {
    const v1 = seed.dailyProgress.find((p) => p.id === "progress-reddy-2409")!
    const v2 = seed.dailyProgress.find((p) => p.id === "progress-reddy-2509")!
    expect(v1).toMatchObject({ version: 1, reviewStatus: "superseded", supersededById: v2.id })
    expect(v1.review?.decision).toBe("request-changes")
    expect(v2).toMatchObject({ version: 2, reviewStatus: "submitted", supersedesId: v1.id })
    // Kept evidence belongs to the newer version.
    expect(seed.evidence.find((e) => e.id === "evidence-reddy-2")?.dailyProgressId).toBe(v2.id)
  })

  it("records what the published Sharma update shared", () => {
    const item = seed.dailyProgress.find((p) => p.id === "progress-sharma-2009")!
    expect(item.publication?.evidenceIds).toEqual(["evidence-sharma-1", "evidence-sharma-2"])
    expect(item.review?.decision).toBe("approve")
  })

  it("gives every project stage baselines between 0 and 100", () => {
    for (const project of seed.projects) {
      for (const value of Object.values(project.stageBaselines)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
  })

  it("lets supervisors publish to the homeowner", () => {
    expect(permissionsForRole("supervisor")).toContain(Permissions.CUSTOMER_PUBLISH)
  })
})
