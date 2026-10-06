import { describe, expect, it } from "vitest"
import {
  workerFromRow,
  workerToRow,
  workerProjectAssignmentFromRow,
  workerOnboardingFromRow,
  workerOnboardingToRow,
} from "./rows"

describe("worker row mapping", () => {
  it("maps a worker row to a Worker with languages and tradeIds arrays", () => {
    const worker = workerFromRow({
      id: "11111111-1111-1111-1111-111111111111",
      legacy_id: "worker-2",
      organization_id: "org-uuid",
      user_id: "person-uuid",
      phone: "+919000011122",
      name: "Ravi Naik",
      trade_ids: ["trade-civil"],
      languages: ["hi", "en"],
      onboarding_method: "otp",
      status: "active",
    })
    expect(worker).toEqual({
      id: "worker-2",
      organizationId: "org-uuid",
      userId: "person-uuid",
      phone: "+919000011122",
      name: "Ravi Naik",
      tradeIds: ["trade-civil"],
      languages: ["hi", "en"],
      onboardingMethod: "otp",
      status: "active",
    })
  })

  it("round-trips every Worker field through the row shape", () => {
    const worker = {
      id: "worker-9",
      organizationId: "org-buildright",
      userId: "person-ravi",
      name: "Meera Dsouza",
      phone: "+919000022233",
      tradeIds: ["trade-civil", "trade-tiling"],
      languages: ["kn", "en"],
      onboardingMethod: "qr" as const,
      status: "invited" as const,
    }
    expect(workerFromRow({ id: "row-uuid", ...workerToRow(worker) })).toEqual(worker)
  })
})

describe("assignment row mapping", () => {
  it("maps startedAt, endedAt and endReason", () => {
    const assignment = workerProjectAssignmentFromRow({
      id: "a-uuid",
      legacy_id: "assignment-1",
      project_id: "p-uuid",
      worker_id: "w-uuid",
      project_unit_ids: [],
      started_at: "2026-10-01T03:30:00Z",
      ended_at: "2026-10-05T12:00:00Z",
      end_reason: "reassigned",
      status: "inactive",
      created_at: "2026-09-30T10:00:00Z",
    })
    expect(assignment.startedAt).toBe("2026-10-01T03:30:00Z")
    expect(assignment.endedAt).toBe("2026-10-05T12:00:00Z")
    expect(assignment.endReason).toBe("reassigned")
    expect(assignment.status).toBe("inactive")
  })
})

describe("onboarding row mapping", () => {
  it("maps acceptedAt and expiresAt", () => {
    const onboarding = workerOnboardingFromRow({
      id: "o-uuid",
      legacy_id: "onboarding-1",
      worker_id: "w-uuid",
      organization_id: "org-uuid",
      method: "qr",
      status: "accepted",
      join_code: null,
      invited_at: "2026-10-01T00:00:00Z",
      accepted_at: "2026-10-02T09:00:00Z",
      expires_at: "2026-10-08T00:00:00Z",
    })
    expect(onboarding.acceptedAt).toBe("2026-10-02T09:00:00Z")
    expect(onboarding.expiresAt).toBe("2026-10-08T00:00:00Z")
    expect(onboarding.joinCode).toBeUndefined()
  })

  it("round-trips an onboarding through its row shape", () => {
    const onboarding = {
      id: "onboarding-7",
      workerId: "worker-7",
      organizationId: "org-buildright",
      method: "qr" as const,
      status: "invited" as const,
      joinCode: "482913",
      invitedAt: "2026-10-01T00:00:00Z",
      expiresAt: "2026-10-08T00:00:00Z",
    }
    expect(workerOnboardingFromRow({ id: "row-uuid", ...workerOnboardingToRow(onboarding) })).toEqual(onboarding)
  })
})
