import { describe, expect, it } from "vitest"
import type { DailyProgress, Project } from "./models"
import { calculateProjectProgress } from "./progress"

const baseProject: Project = {
  id: "project-a",
  organizationId: "org-1",
  code: "A",
  name: "Project A",
  kind: "individual-house",
  status: "active",
  location: "Hyderabad",
  progress: 20,
  trackingStartedMidProject: false,
  createdAt: "2026-09-01T00:00:00+05:30",
  updatedAt: "2026-09-01T00:00:00+05:30",
}

function progress(
  partial: Pick<DailyProgress, "id" | "reviewStatus" | "progressAfter" | "date" | "submittedAt">,
): DailyProgress {
  return {
    projectId: "project-a",
    projectUnitId: "unit-a",
    stageId: "stage-1",
    tradeId: "trade-1",
    workTypeId: "work-1",
    workersPresent: 4,
    todaySummary: "Work",
    tomorrowPlan: "More work",
    evidenceIds: [],
    submittedByMembershipId: "membership-1",
    publicationStatus:
      partial.reviewStatus === "approved" ? "published" : "private",
    ...partial,
  }
}

describe("calculateProjectProgress", () => {
  it("keeps stored progress when no approved daily progress exists", () => {
    const result = calculateProjectProgress(baseProject, [
      progress({
        id: "p1",
        reviewStatus: "submitted",
        progressAfter: 55,
        date: "2026-09-20",
        submittedAt: "2026-09-20T17:00:00+05:30",
      }),
    ])
    expect(result).toBe(20)
  })

  it("uses the latest approved progressAfter", () => {
    const result = calculateProjectProgress(baseProject, [
      progress({
        id: "p1",
        reviewStatus: "approved",
        progressAfter: 34,
        date: "2026-09-18",
        submittedAt: "2026-09-18T17:00:00+05:30",
      }),
      progress({
        id: "p2",
        reviewStatus: "approved",
        progressAfter: 41,
        date: "2026-09-20",
        submittedAt: "2026-09-20T17:00:00+05:30",
      }),
    ])
    expect(result).toBe(41)
  })

  it("ignores unapproved higher values", () => {
    const result = calculateProjectProgress(baseProject, [
      progress({
        id: "p1",
        reviewStatus: "approved",
        progressAfter: 34,
        date: "2026-09-20",
        submittedAt: "2026-09-20T17:00:00+05:30",
      }),
      progress({
        id: "p2",
        reviewStatus: "submitted",
        progressAfter: 90,
        date: "2026-09-21",
        submittedAt: "2026-09-21T17:00:00+05:30",
      }),
    ])
    expect(result).toBe(34)
  })
})
