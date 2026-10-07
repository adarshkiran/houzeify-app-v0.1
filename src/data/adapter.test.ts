import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { afterAll, describe, expect, it } from "vitest"
import { ConflictError } from "../domain/errors"
import {
  acceptWorkerOnboarding,
  addLibraryStage,
  addLibraryTrade,
  addLibraryWorkType,
  addProjectUnit,
  addProjectUnits,
  createProject,
  loadState,
  selectProposal,
  setStageBaselines,
  submitProposal,
  unlockRequirement,
  updateOrganizationProfile,
} from "./adapter"
import { createSupabaseClient } from "./supabaseClient"

/** A minimal fake client whose `.rpc` always resolves with the given row, for
 * testing the adapter's write-wrapper mapping without the local stack. */
function fakeRpcClient(row: Record<string, unknown>): SupabaseClient {
  return {
    rpc: async () => ({ data: row, error: null }),
  } as unknown as SupabaseClient
}

// Runs only against the local Supabase stack (VITE_SUPABASE_URL on 127.0.0.1).
// RLS hides construction rows from the anon key until someone signs in (task 13),
// so the load assertions use the local service-role key, read at runtime from
// SUPABASE_SERVICE_ROLE_KEY (`npx supabase status -o env`). They skip without it.
const url = import.meta.env.VITE_SUPABASE_URL ?? ""
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""
const localStack = /^https?:\/\/127\.0\.0\.1[:/]/.test(url)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

describe.skipIf(!localStack || !serviceKey)(
  "supabase adapter: seeded load (local stack)",
  () => {
    it("loadState returns the seeded organization and Ravi", async () => {
      const state = await loadState(createClient(url, serviceKey))
      expect(state.organizations.map((o) => o.id)).toContain("org-buildright")
      const ravi = state.workers.find((w) => w.name === "Ravi Naik")
      expect(ravi?.id).toBe("worker-2")
      expect(ravi?.userId).toBe("person-ravi")
    })

    // The task 11 seed (supabase/seed.sql) has no rows at all for most of the
    // phase-11 collections (no stages/tasks/progress, per the ledger's task 12
    // report). loadState must still return [] for them, never undefined, so a
    // screen reading `state.tasks.length` etc. does not crash before any of
    // this data exists.
    it("returns [] (not undefined) for every collection the seed does not populate", async () => {
      const state = await loadState(createClient(url, serviceKey))
      const emptyForNow: (keyof typeof state)[] = [
        "workTypes",
        "taskTemplates",
        "workPlanItems",
        "tasks",
        "assignments",
        "dailyProgress",
        "evidence",
        "documents",
        "issues",
        "threads",
        "messages",
        "threadReads",
        "callLogs",
        "estimates",
        "unlocks",
        "proposals",
        "plans",
        "subscriptions",
        "wallets",
        "creditTransactions",
      ]
      for (const key of emptyForNow) {
        expect(Array.isArray(state[key]), `${key} should be an array`).toBe(
          true,
        )
        expect(state[key], `${key} has no seed data yet`).toEqual([])
      }
      // The seed has no posted marketplace_requirements either (none of the
      // seeded memberships are organization-level, so none can act as a
      // business/partner caller against the view); see the business-session
      // test below, which creates its own fixtures for that.
      expect(state.requirements).toEqual([])
    })
  },
)

describe.skipIf(!localStack || !serviceKey)(
  "supabase adapter: business session reads the partner preview (local stack)",
  () => {
    // None of the seed's memberships are organization-level (project_id is
    // null), so no seeded phone can act as a "business member" for
    // is_business_member/the marketplace_requirement_previews view (see
    // supabase/migrations/0006). This test grants person-arjun one directly,
    // posts a requirement under the demo homeowner, signs in as Arjun with
    // the local test_otp code, and cleans both up afterwards.
    const legacyIds = {
      membership: "test-task17-biz-membership",
      estimate: "test-task17-estimate",
      requirement: "test-task17-requirement",
    }
    let signedInClient: SupabaseClient | undefined
    const createdUnitIds: string[] = []

    afterAll(async () => {
      await signedInClient?.auth.signOut()
      const admin = createClient(url, serviceKey)
      await admin
        .from("marketplace_requirements")
        .delete()
        .eq("legacy_id", legacyIds.requirement)
      await admin.from("estimates").delete().eq("legacy_id", legacyIds.estimate)
      await admin
        .from("memberships")
        .delete()
        .eq("legacy_id", legacyIds.membership)
      if (createdUnitIds.length) {
        await admin.from("project_units").delete().in("id", createdUnitIds)
      }
    })

    it("loadState shows the preview-shaped fields for a partner who has not unlocked the requirement", async () => {
      const admin = createClient(url, serviceKey)
      const { data: org, error: orgError } = await admin
        .from("organizations")
        .select("id")
        .eq("legacy_id", "org-buildright")
        .single()
      if (orgError || !org)
        throw new Error(
          orgError?.message ?? "org-buildright is missing; run db reset",
        )

      const { data: arjun, error: arjunError } = await admin
        .from("people")
        .select("id")
        .eq("legacy_id", "person-arjun")
        .single()
      if (arjunError || !arjun)
        throw new Error(
          arjunError?.message ?? "person-arjun is missing; run db reset",
        )

      const { data: homeowner, error: homeownerError } = await admin
        .from("people")
        .select("id")
        .eq("legacy_id", "person-demo-homeowner")
        .single()
      if (homeownerError || !homeowner) {
        throw new Error(
          homeownerError?.message ??
            "person-demo-homeowner is missing; run db reset",
        )
      }

      // Make Arjun a business member of org-buildright (organization-level
      // membership: project_id null), so he passes is_business_member and the
      // partner preview view's own-membership check.
      const { error: membershipError } = await admin
        .from("memberships")
        .insert({
          legacy_id: legacyIds.membership,
          person_id: arjun.id,
          organization_id: org.id,
          project_id: null,
          role: "owner",
          permissions: [],
          status: "active",
        })
      if (membershipError) throw new Error(membershipError.message)

      const { data: estimate, error: estimateError } = await admin
        .from("estimates")
        .insert({
          legacy_id: legacyIds.estimate,
          homeowner_person_id: homeowner.id,
          project_name: "Task 17 Villa",
          property_type: "independent",
          location: "Plot 12, Road 3, Hyderabad, Telangana",
          built_up_area_sqft: 1200,
          construction_level: "standard",
          total_low: 1000000,
          total_high: 1200000,
          review_status: "confirmed",
        })
        .select("id")
        .single()
      if (estimateError || !estimate) throw new Error(estimateError?.message)

      const { error: requirementError } = await admin
        .from("marketplace_requirements")
        .insert({
          legacy_id: legacyIds.requirement,
          estimate_id: estimate.id,
          homeowner_person_id: homeowner.id,
          project_name: "Task 17 Villa",
          location: "Plot 12, Road 3, Hyderabad, Telangana",
          built_up_area_sqft: 1200,
          construction_level: "standard",
          property_type: "independent",
          estimate_total_low: 1050000,
          estimate_total_high: 1230000,
          status: "posted",
          posted_at: new Date().toISOString(),
        })
      if (requirementError) throw new Error(requirementError.message)

      // Sign in as Arjun with the local test_otp code (supabase/config.toml).
      signedInClient = createClient(url, anonKey)
      const { error: otpError } = await signedInClient.auth.signInWithOtp({
        phone: "+919000011101",
      })
      if (otpError) throw new Error(otpError.message)
      const { error: verifyError } = await signedInClient.auth.verifyOtp({
        phone: "+919000011101",
        token: "123456",
        type: "sms",
      })
      if (verifyError) throw new Error(verifyError.message)

      const state = await loadState(signedInClient)
      const requirement = state.requirements.find(
        (r) => r.location === "Hyderabad",
      )
      expect(
        requirement,
        "the posted requirement should load from the preview view",
      ).toBeDefined()
      expect(requirement?.status).toBe("posted")
      expect(requirement?.propertyType).toBe("independent")
      // Preview-shaped: rounded to the lakh, exact fields hidden until unlock.
      expect(requirement?.estimateTotalLow).toBe(1000000)
      expect(requirement?.estimateTotalHigh).toBe(1300000)
      expect(requirement?.builtUpAreaSqft).toBe(0)
      expect(requirement?.projectName).toBe("")
    })

    // Reuses the Arjun session above rather than signing in again: supabase/
    // config.toml rate-limits SMS OTP per phone (max_frequency = 5s), and a
    // second sign-in here would race parityCheck.test.ts's own sign-in as Arjun
    // under vitest's default file parallelism.
    it("addProjectUnit(s) insert rows governed by the existing project_units RLS policy", async () => {
      if (!signedInClient) throw new Error("the preview test above must sign in first")

      const unit = await addProjectUnit(signedInClient, {
        projectId: "project-sharma",
        kind: "location",
        code: "T21",
        name: "Task 21 Unit",
      })
      createdUnitIds.push(unit.id)
      expect(unit.name).toBe("Task 21 Unit")

      const units = await addProjectUnits(signedInClient, [
        { projectId: "project-sharma", kind: "location", code: "T21A", name: "Task 21 Unit A" },
        { projectId: "project-sharma", kind: "location", code: "T21B", name: "Task 21 Unit B" },
      ])
      createdUnitIds.push(...units.map((u) => u.id))
      expect(units.map((u) => u.name)).toEqual(["Task 21 Unit A", "Task 21 Unit B"])

      // The write's immediate return keeps raw uuid foreign keys (same accepted
      // characteristic as unlockRequirement etc., task-15-report.md); a reload
      // maps everything back through legacy ids, where the project reference
      // resolves to the seed's domain id.
      const reloaded = await loadState(signedInClient)
      expect(reloaded.projectUnits.find((u) => u.id === unit.id)?.projectId).toBe("project-sharma")
    })
  },
)

describe.skipIf(!localStack)("supabase adapter: refusals (local stack)", () => {
  it("maps a refused rpc call to ConflictError", async () => {
    const client = createSupabaseClient()
    await expect(
      acceptWorkerOnboarding(client, {
        onboardingId: crypto.randomUUID(),
        joinCode: "000000",
      }),
    ).rejects.toBeInstanceOf(ConflictError)
  })
})

// Unit tests (no local stack needed): the B4 RPC functions return
// to_jsonb(row) — snake_case Postgres columns — but the adapter's wrapper
// must hand the caller the domain's camelCase shape (see task-15-report.md's
// "Parity findings" and task-20-report.md). A caller that reads a field off
// the write's immediate return value (not just `.id`) would otherwise get
// `undefined` in supabase mode, even though a subsequent loadState() shows
// correct data.
describe("supabase adapter: write results are mapped to the domain shape", () => {
  it("unlockRequirement returns a MarketplaceUnlock, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "unlock-row-id",
      legacy_id: null,
      requirement_id: "requirement-row-id",
      partner_organization_id: "org-row-id",
      unlocked_at: "2026-01-01T00:00:00.000Z",
      credit_transaction_id: "txn-row-id",
    })

    const result = await unlockRequirement(client, {
      requirementId: "req-1",
      organizationId: "org-1",
    })

    expect(result).toEqual({
      id: "unlock-row-id",
      requirementId: "requirement-row-id",
      partnerOrganizationId: "org-row-id",
      unlockedAt: "2026-01-01T00:00:00.000Z",
      creditTransactionId: "txn-row-id",
    })
    expect(result).not.toHaveProperty("requirement_id")
    expect(result).not.toHaveProperty("partner_organization_id")
  })

  it("submitProposal returns a Proposal, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "proposal-row-id",
      legacy_id: null,
      requirement_id: "requirement-row-id",
      partner_organization_id: "org-row-id",
      submitted_by_person_id: "person-row-id",
      lines: [],
      total: 150000,
      assumptions: ["Standard soil"],
      exclusions: [],
      status: "submitted",
      submitted_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await submitProposal(client, {
      requirementId: "req-1",
      organizationId: "org-1",
      assumptions: ["Standard soil"],
      exclusions: [],
    })

    expect(result.requirementId).toBe("requirement-row-id")
    expect(result.partnerOrganizationId).toBe("org-row-id")
    expect(result.submittedByPersonId).toBe("person-row-id")
    expect(result.status).toBe("submitted")
    expect(result).not.toHaveProperty("requirement_id")
    expect(result).not.toHaveProperty("partner_organization_id")
  })

  it("selectProposal returns a Project, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "project-row-id",
      legacy_id: null,
      organization_id: "org-row-id",
      name: "Task 15 Villa",
      status: "planning",
      require_checkout: false,
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await selectProposal(client, { proposalId: "proposal-1" })

    expect(result.organizationId).toBe("org-row-id")
    expect(result.status).toBe("planning")
    expect(result.requireCheckout).toBe(false)
    expect(result).not.toHaveProperty("organization_id")
    expect(result).not.toHaveProperty("require_checkout")
  })
})

// Task 21 (project setup): the same row-shape concern as above, for the batch's
// RPC-backed wrappers. fakeRpcClient needs no local stack.
describe("supabase adapter: project setup write results are mapped to the domain shape", () => {
  it("createProject returns a Project, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "project-row-id",
      legacy_id: null,
      organization_id: "org-row-id",
      name: "New Build",
      status: "planning",
      location: "Chennai",
      kind: "individual-house",
      require_checkout: false,
      stage_baselines: {},
      progress: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await createProject(client, {
      organizationId: "org-1",
      name: "New Build",
      code: "NB-1",
      kind: "individual-house",
      status: "planning",
      location: "Chennai",
      trackingStartedMidProject: false,
    })

    expect(result.organizationId).toBe("org-row-id")
    expect(result.name).toBe("New Build")
    expect(result.location).toBe("Chennai")
    expect(result.kind).toBe("individual-house")
    expect(result).not.toHaveProperty("organization_id")
  })

  it("updateOrganizationProfile resolves without a return value", async () => {
    const client = fakeRpcClient({})
    await expect(
      updateOrganizationProfile(client, {
        organizationId: "org-1",
        profile: { name: "BuildRight", kind: "contractor", city: "Hyderabad", phone: "+919000000001", teamSize: "6-10" },
      }),
    ).resolves.toBeUndefined()
  })

  it("setStageBaselines returns a Project with the recalculated progress", async () => {
    const client = fakeRpcClient({
      id: "project-row-id",
      legacy_id: null,
      organization_id: "org-row-id",
      name: "Project",
      status: "active",
      location: "",
      kind: "individual-house",
      require_checkout: false,
      stage_baselines: { "stage-row-id": 40 },
      progress: 18,
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await setStageBaselines(client, { projectId: "proj-1", baselines: { "stage-1": 40 } })

    expect(result.progress).toBe(18)
    expect(result.stageBaselines).toEqual({ "stage-row-id": 40 })
  })

  it("addLibraryStage returns a ConstructionStage, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "stage-row-id",
      legacy_id: "stage-site-preparation",
      project_id: null,
      name: "Site Preparation",
      sort_order: 1,
      code: "SITEPR",
    })

    const result = await addLibraryStage(client, { name: "Site Preparation" })

    expect(result.id).toBe("stage-site-preparation")
    expect(result.name).toBe("Site Preparation")
    expect(result.code).toBe("SITEPR")
    expect(result).not.toHaveProperty("sort_order")
  })

  it("addLibraryTrade returns a Trade, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "trade-row-id",
      legacy_id: "trade-civil-work",
      project_id: null,
      name: "Civil Work",
    })

    const result = await addLibraryTrade(client, { name: "Civil Work" })

    expect(result.id).toBe("trade-civil-work")
    expect(result.name).toBe("Civil Work")
  })

  it("addLibraryWorkType returns a WorkType and TaskTemplate, not raw rows", async () => {
    const client = fakeRpcClient({
      workType: {
        id: "work-row-id",
        legacy_id: "work-foundation-digging",
        project_id: null,
        stage_id: "stage-row-id",
        trade_id: "trade-row-id",
        name: "Foundation Digging",
        default_unit: "m3",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      template: {
        id: "template-row-id",
        legacy_id: "template-foundation-digging",
        project_id: null,
        work_type_id: "work-row-id",
        name: "Foundation Digging — Standard",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    })

    const result = await addLibraryWorkType(client, {
      name: "Foundation Digging",
      stageId: "stage-1",
      tradeId: "trade-1",
      defaultUnit: "m3",
    })

    expect(result.workType.id).toBe("work-foundation-digging")
    expect(result.workType.defaultUnit).toBe("m3")
    expect(result.template.id).toBe("template-foundation-digging")
    expect(result.template.name).toBe("Foundation Digging — Standard")
    expect(result.workType).not.toHaveProperty("default_unit")
  })

  it("addLibraryWorkType returns an unsaved result when the stage/trade id does not resolve to a library row", async () => {
    const client = fakeRpcClient({
      workType: { id: null, stageId: "stage-1", tradeId: "trade-1", name: "Bad Work Type", skipped: true },
      template: null,
    })

    const result = await addLibraryWorkType(client, {
      name: "Bad Work Type",
      stageId: "stage-1",
      tradeId: "trade-1",
      defaultUnit: "nos",
    })

    expect(result.workType.name).toBe("Bad Work Type")
    expect(result.workType.stageId).toBe("stage-1")
  })
})
