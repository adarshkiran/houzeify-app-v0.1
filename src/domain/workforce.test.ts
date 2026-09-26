import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import {
  getActiveAssignmentsForWorker,
  getOrganizationWorkers,
  workerMatchesProject,
} from "./workforce"

describe("workforce", () => {
  it("lists organization workers", () => {
    const workers = getOrganizationWorkers(
      seedConstructionData,
      "org-buildright",
    )
    expect(workers.length).toBeGreaterThan(0)
    expect(workers.every((worker) => worker.organizationId === "org-buildright")).toBe(
      true,
    )
  })

  it("resolves active project assignments for a worker", () => {
    const assignments = getActiveAssignmentsForWorker(
      seedConstructionData,
      "worker-2",
    )
    expect(assignments.some((item) => item.projectId === "project-sharma")).toBe(
      true,
    )
    expect(workerMatchesProject(seedConstructionData, "worker-2", "project-sharma")).toBe(
      true,
    )
  })
})
