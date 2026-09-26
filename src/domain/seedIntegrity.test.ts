import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { Permissions, permissionsForRole } from "./permissions"

describe("seed after Daily Progress v2", () => {
  it("gives every update a version and no leftover 'ready' publication state", () => {
    for (const item of seed.dailyProgress) {
      expect(item.version).toBe(1)
      expect(["private", "published"]).toContain(item.publicationStatus)
    }
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
