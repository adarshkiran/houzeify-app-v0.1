import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { afterAll, describe, expect, it } from "vitest"
import { ConflictError } from "../domain/errors"
import { acceptWorkerOnboarding, loadState } from "./adapter"
import { createSupabaseClient } from "./supabaseClient"

// Runs only against the local Supabase stack (VITE_SUPABASE_URL on 127.0.0.1).
// RLS hides construction rows from the anon key until someone signs in (task 13),
// so the load assertions use the local service-role key, read at runtime from
// SUPABASE_SERVICE_ROLE_KEY (`npx supabase status -o env`). They skip without it.
const url = import.meta.env.VITE_SUPABASE_URL ?? ""
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""
const localStack = /^https?:\/\/127\.0\.0\.1[:/]/.test(url)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

describe.skipIf(!localStack || !serviceKey)("supabase adapter: seeded load (local stack)", () => {
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
      expect(Array.isArray(state[key]), `${key} should be an array`).toBe(true)
      expect(state[key], `${key} has no seed data yet`).toEqual([])
    }
    // The seed has no posted marketplace_requirements either (none of the
    // seeded memberships are organization-level, so none can act as a
    // business/partner caller against the view); see the business-session
    // test below, which creates its own fixtures for that.
    expect(state.requirements).toEqual([])
  })
})

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

    afterAll(async () => {
      await signedInClient?.auth.signOut()
      const admin = createClient(url, serviceKey)
      await admin.from("marketplace_requirements").delete().eq("legacy_id", legacyIds.requirement)
      await admin.from("estimates").delete().eq("legacy_id", legacyIds.estimate)
      await admin.from("memberships").delete().eq("legacy_id", legacyIds.membership)
    })

    it("loadState shows the preview-shaped fields for a partner who has not unlocked the requirement", async () => {
      const admin = createClient(url, serviceKey)
      const { data: org, error: orgError } = await admin
        .from("organizations")
        .select("id")
        .eq("legacy_id", "org-buildright")
        .single()
      if (orgError || !org) throw new Error(orgError?.message ?? "org-buildright is missing; run db reset")

      const { data: arjun, error: arjunError } = await admin
        .from("people")
        .select("id")
        .eq("legacy_id", "person-arjun")
        .single()
      if (arjunError || !arjun) throw new Error(arjunError?.message ?? "person-arjun is missing; run db reset")

      const { data: homeowner, error: homeownerError } = await admin
        .from("people")
        .select("id")
        .eq("legacy_id", "person-demo-homeowner")
        .single()
      if (homeownerError || !homeowner) {
        throw new Error(homeownerError?.message ?? "person-demo-homeowner is missing; run db reset")
      }

      // Make Arjun a business member of org-buildright (organization-level
      // membership: project_id null), so he passes is_business_member and the
      // partner preview view's own-membership check.
      const { error: membershipError } = await admin.from("memberships").insert({
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

      const { error: requirementError } = await admin.from("marketplace_requirements").insert({
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
      const { error: otpError } = await signedInClient.auth.signInWithOtp({ phone: "+919000011101" })
      if (otpError) throw new Error(otpError.message)
      const { error: verifyError } = await signedInClient.auth.verifyOtp({
        phone: "+919000011101",
        token: "123456",
        type: "sms",
      })
      if (verifyError) throw new Error(verifyError.message)

      const state = await loadState(signedInClient)
      const requirement = state.requirements.find((r) => r.location === "Hyderabad")
      expect(requirement, "the posted requirement should load from the preview view").toBeDefined()
      expect(requirement?.status).toBe("posted")
      expect(requirement?.propertyType).toBe("independent")
      // Preview-shaped: rounded to the lakh, exact fields hidden until unlock.
      expect(requirement?.estimateTotalLow).toBe(1000000)
      expect(requirement?.estimateTotalHigh).toBe(1300000)
      expect(requirement?.builtUpAreaSqft).toBe(0)
      expect(requirement?.projectName).toBe("")
    })
  },
)

describe.skipIf(!localStack)("supabase adapter: refusals (local stack)", () => {
  it("maps a refused rpc call to ConflictError", async () => {
    const client = createSupabaseClient()
    await expect(
      acceptWorkerOnboarding(client, { onboardingId: crypto.randomUUID(), joinCode: "000000" }),
    ).rejects.toBeInstanceOf(ConflictError)
  })
})
