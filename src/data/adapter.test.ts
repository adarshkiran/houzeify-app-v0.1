import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { afterAll, describe, expect, it } from "vitest"
import { ConflictError } from "../domain/errors"
import {
  acceptTaskAssignment,
  acceptWorkerOnboarding,
  addLibraryStage,
  addLibraryTrade,
  addLibraryWorkType,
  addProjectUnit,
  addProjectUnits,
  addWorker,
  addWorkPlanItem,
  assignTask,
  assignWorkerToProject,
  cancelWorkerOnboarding,
  createProject,
  createTask,
  inviteProjectMember,
  loadState,
  logCall,
  markThreadRead,
  markThreadUnread,
  openDirectThread,
  postMessage,
  publishDocument,
  selectProposal,
  setStageBaselines,
  startTask,
  submitProposal,
  transitionTask,
  unlockRequirement,
  updateOrganizationProfile,
  uploadDocument,
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
      stage: "test-task22-stage",
      trade: "test-task22-trade",
      workType: "test-task22-work-type",
    }
    const workforcePhones = {
      added: "+919000099001",
      invitedContractor: "+919000099002",
      invitedWorker: "+919000099003",
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
      await admin.from("tasks").delete().eq("title", "Task 22 Wiring")
      await admin.from("work_types").delete().eq("legacy_id", legacyIds.workType)
      await admin.from("trades").delete().eq("legacy_id", legacyIds.trade)
      await admin.from("stages").delete().eq("legacy_id", legacyIds.stage)
      // Task 23 (workforce extras) fixtures: delete children before parents.
      const { data: workforceWorkers } = await admin
        .from("workers")
        .select("id")
        .in("phone", Object.values(workforcePhones))
      const workforceWorkerIds = (workforceWorkers ?? []).map((w) => w.id)
      if (workforceWorkerIds.length) {
        await admin.from("worker_project_assignments").delete().in("worker_id", workforceWorkerIds)
        await admin.from("worker_onboardings").delete().in("worker_id", workforceWorkerIds)
        await admin.from("workers").delete().in("id", workforceWorkerIds)
      }
      const { data: workforcePeople } = await admin
        .from("people")
        .select("id")
        .in("phone", Object.values(workforcePhones))
      const workforcePersonIds = (workforcePeople ?? []).map((p) => p.id)
      if (workforcePersonIds.length) {
        await admin.from("memberships").delete().in("person_id", workforcePersonIds)
        await admin.from("people").delete().in("id", workforcePersonIds)
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

    // Reuses the Arjun session above (same rate-limit reasoning as addProjectUnit
    // above). Arjun is Sharma's unscoped project-manager (task.manage,
    // progress.submit); worker-2 (Ravi) is already assigned to unit-sharma-house.
    it("createTask -> assignTask -> transitionTask drive a real task through Postgres (local stack)", async () => {
      if (!signedInClient) throw new Error("the preview test above must sign in first")
      const admin = createClient(url, serviceKey)

      const { data: project } = await admin.from("projects").select("id").eq("legacy_id", "project-sharma").single()
      const { data: unit } = await admin.from("project_units").select("id").eq("legacy_id", "unit-sharma-house").single()
      const { data: worker2 } = await admin.from("workers").select("id").eq("legacy_id", "worker-2").single()
      if (!project || !unit || !worker2) throw new Error("project-sharma fixtures are missing; run db reset")

      const { data: stage, error: stageError } = await admin
        .from("stages")
        .insert({ legacy_id: legacyIds.stage, project_id: project.id, name: "RCC", sort_order: 1, code: "RCC" })
        .select()
        .single()
      if (stageError || !stage) throw new Error(stageError?.message)
      const { data: trade, error: tradeError } = await admin
        .from("trades")
        .insert({ legacy_id: legacyIds.trade, project_id: null, name: "Electrical" })
        .select()
        .single()
      if (tradeError || !trade) throw new Error(tradeError?.message)
      const { data: workType, error: workTypeError } = await admin
        .from("work_types")
        .insert({
          legacy_id: legacyIds.workType,
          project_id: null,
          name: "Wiring",
          stage_id: stage.id,
          trade_id: trade.id,
          default_unit: "nos",
        })
        .select()
        .single()
      if (workTypeError || !workType) throw new Error(workTypeError?.message)

      const task = await createTask(signedInClient, {
        projectId: project.id,
        projectUnitId: unit.id,
        stageId: stage.id,
        tradeId: trade.id,
        workTypeId: workType.id,
        title: "Task 22 Wiring",
        priority: "medium",
        plannedQuantity: { value: 5, unit: "nos" },
      })
      expect(task.status).toBe("draft")

      const assignment = await assignTask(signedInClient, {
        taskId: task.id,
        assigneeType: "worker",
        assigneeId: worker2.id,
      })
      expect(assignment.assigneeId).toBe(worker2.id)

      const { data: afterAssign } = await admin.from("tasks").select("status").eq("id", task.id).single()
      expect(afterAssign?.status).toBe("assigned")

      await transitionTask(signedInClient, { taskId: task.id, nextStatus: "accepted" })
      const { data: afterTransition } = await admin.from("tasks").select("status").eq("id", task.id).single()
      expect(afterTransition?.status).toBe("accepted")

      // An illegal move is refused with the exact domain message (ported from
      // src/domain/constructionCommands.ts transitionTask).
      await expect(transitionTask(signedInClient, { taskId: task.id, nextStatus: "completed" })).rejects.toThrow(
        "A task can't move from accepted to completed.",
      )
    })

    // Reuses the Arjun session above. Arjun has workforce.manage both on
    // org-buildright (organization-level checks) and on project-sharma
    // (project-scoped checks).
    it("addWorker -> assignWorkerToProject -> inviteProjectMember -> cancelWorkerOnboarding drive real workforce writes through Postgres (local stack)", async () => {
      if (!signedInClient) throw new Error("the preview test above must sign in first")
      const admin = createClient(url, serviceKey)

      const { data: org } = await admin.from("organizations").select("id").eq("legacy_id", "org-buildright").single()
      const { data: project } = await admin.from("projects").select("id").eq("legacy_id", "project-sharma").single()
      if (!org || !project) throw new Error("org-buildright/project-sharma fixtures are missing; run db reset")

      const added = await addWorker(signedInClient, {
        organizationId: org.id,
        name: "Task 23 Worker",
        phone: workforcePhones.added,
        tradeIds: [],
      })
      expect(added.worker.status).toBe("invited")
      expect(added.assignment).toBeUndefined()

      // The shared duplicate-phone check (assert_phone_free) refuses a second
      // worker with the same phone in the organization.
      await expect(
        addWorker(signedInClient, {
          organizationId: org.id,
          name: "Dup Worker",
          phone: workforcePhones.added,
          tradeIds: [],
        }),
      ).rejects.toThrow("A worker with this phone number already exists in your organization.")

      // An invited worker's assignment starts invited (R12), not active.
      const assignment = await assignWorkerToProject(signedInClient, {
        workerId: added.worker.id,
        projectId: project.id,
      })
      expect(assignment.status).toBe("invited")
      expect(assignment.startedAt).toBeUndefined()

      // Assigning the same worker to the same project again is refused.
      await expect(
        assignWorkerToProject(signedInClient, { workerId: added.worker.id, projectId: project.id }),
      ).rejects.toThrow("This worker is already assigned to this project.")

      // inviteProjectMember: a non-worker role creates no worker record.
      const contractorMembership = await inviteProjectMember(signedInClient, {
        projectId: project.id,
        name: "Task 23 Contractor",
        phone: workforcePhones.invitedContractor,
        role: "contractor",
      })
      expect(contractorMembership.role).toBe("contractor")
      expect(contractorMembership.status).toBe("invited")

      // inviteProjectMember's worker role shares assert_phone_free with addWorker.
      await expect(
        inviteProjectMember(signedInClient, {
          projectId: project.id,
          name: "Dup Via Invite",
          phone: workforcePhones.added,
          role: "worker",
        }),
      ).rejects.toThrow("A worker with this phone number already exists in your organization.")

      const workerMembership = await inviteProjectMember(signedInClient, {
        projectId: project.id,
        name: "Task 23 Invited Worker",
        phone: workforcePhones.invitedWorker,
        role: "worker",
      })
      expect(workerMembership.role).toBe("worker")

      // cancelWorkerOnboarding: only an invited (not yet accepted) onboarding
      // can be cancelled. addWorker already created a manual onboarding for
      // `added.worker` (newWorkerRecord), so reuse it rather than starting a
      // second one -- a worker has at most one open onboarding.
      const { data: onboardingRow } = await admin
        .from("worker_onboardings")
        .select("id")
        .eq("worker_id", added.worker.id)
        .single()
      if (!onboardingRow) throw new Error("addWorker should have created a manual onboarding")

      const cancelled = await cancelWorkerOnboarding(signedInClient, { onboardingId: onboardingRow.id })
      expect(cancelled.status).toBe("cancelled")

      await expect(
        cancelWorkerOnboarding(signedInClient, { onboardingId: onboardingRow.id }),
      ).rejects.toThrow("Only an invitation that hasn't been accepted can be cancelled.")
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

// Task 22 (task engine): the same row-shape concern as task 21, for this batch's
// RPC-backed wrappers. fakeRpcClient needs no local stack.
describe("supabase adapter: task engine write results are mapped to the domain shape", () => {
  it("addWorkPlanItem returns a WorkPlanItem, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "plan-row-id",
      legacy_id: null,
      project_id: "project-row-id",
      project_unit_id: "unit-row-id",
      stage_id: "stage-row-id",
      trade_id: "trade-row-id",
      work_type_id: "work-row-id",
      title: "Wiring",
      planned_start: null,
      planned_end: null,
      status: "planned",
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await addWorkPlanItem(client, {
      projectId: "proj-1",
      projectUnitId: "unit-1",
      stageId: "stage-1",
      tradeId: "trade-1",
      workTypeId: "work-1",
      plannedQuantity: { value: 10, unit: "nos" },
    })

    expect(result.projectId).toBe("project-row-id")
    expect(result.status).toBe("planned")
    expect(result).not.toHaveProperty("project_unit_id")
  })

  it("createTask returns a Task, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "task-row-id",
      legacy_id: null,
      project_id: "project-row-id",
      work_plan_item_id: null,
      project_unit_id: "unit-row-id",
      stage_id: "stage-row-id",
      trade_id: "trade-row-id",
      title: "Wire first floor",
      status: "draft",
      planned_quantity: 10,
      planned_quantity_unit: "nos",
      completed_quantity: null,
      completed_quantity_unit: null,
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await createTask(client, {
      projectId: "proj-1",
      projectUnitId: "unit-1",
      stageId: "stage-1",
      tradeId: "trade-1",
      workTypeId: "work-1",
      title: "Wire first floor",
      priority: "medium",
      plannedQuantity: { value: 10, unit: "nos" },
    })

    expect(result.projectId).toBe("project-row-id")
    expect(result.status).toBe("draft")
    expect(result.plannedQuantity).toEqual({ value: 10, unit: "nos" })
    expect(result).not.toHaveProperty("planned_quantity")
  })

  it("assignTask returns a TaskAssignment, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "assignment-row-id",
      legacy_id: null,
      project_id: "project-row-id",
      task_id: "task-row-id",
      worker_id: "worker-row-id",
      assigned_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await assignTask(client, { taskId: "task-1", assigneeType: "worker", assigneeId: "worker-1" })

    expect(result.taskId).toBe("task-row-id")
    expect(result.assigneeId).toBe("worker-row-id")
    expect(result.assigneeType).toBe("worker")
    expect(result.status).toBe("assigned")
    expect(result).not.toHaveProperty("worker_id")
  })

  it("acceptTaskAssignment resolves without a return value", async () => {
    const client = fakeRpcClient({})
    await expect(acceptTaskAssignment(client, { taskId: "task-1" })).resolves.toBeUndefined()
  })

  it("startTask resolves without a return value", async () => {
    const client = fakeRpcClient({})
    await expect(startTask(client, { taskId: "task-1" })).resolves.toBeUndefined()
  })

  it("transitionTask resolves without a return value", async () => {
    const client = fakeRpcClient({})
    await expect(transitionTask(client, { taskId: "task-1", nextStatus: "accepted" })).resolves.toBeUndefined()
  })
})

// Task 23 (workforce extras): the same row-shape concern as tasks 21/22, for
// this batch's RPC-backed wrappers. fakeRpcClient needs no local stack.
describe("supabase adapter: workforce extras write results are mapped to the domain shape", () => {
  it("addWorker returns { worker, assignment }, not the raw nested row", async () => {
    const client = fakeRpcClient({
      worker: {
        id: "worker-row-id",
        legacy_id: null,
        organization_id: "org-row-id",
        user_id: null,
        phone: "+919000000001",
        name: "New Worker",
        trade_ids: [],
        languages: ["en"],
        onboarding_method: "manual",
        status: "invited",
      },
      assignment: {
        id: "assignment-row-id",
        legacy_id: null,
        project_id: "project-row-id",
        worker_id: "worker-row-id",
        project_unit_ids: [],
        started_at: null,
        ended_at: null,
        end_reason: null,
        status: "invited",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    })

    const result = await addWorker(client, {
      organizationId: "org-1",
      name: "New Worker",
      phone: "+919000000001",
      tradeIds: [],
      projectId: "project-1",
    })

    expect(result.worker.organizationId).toBe("org-row-id")
    expect(result.worker.status).toBe("invited")
    expect(result.assignment?.projectId).toBe("project-row-id")
    expect(result.assignment?.status).toBe("invited")
    expect(result).not.toHaveProperty("organization_id")
  })

  it("addWorker with no project returns an undefined assignment", async () => {
    const client = fakeRpcClient({
      worker: {
        id: "worker-row-id",
        legacy_id: null,
        organization_id: "org-row-id",
        user_id: null,
        phone: "+919000000002",
        name: "Unassigned Worker",
        trade_ids: [],
        languages: ["en"],
        onboarding_method: "manual",
        status: "invited",
      },
      assignment: null,
    })

    const result = await addWorker(client, {
      organizationId: "org-1",
      name: "Unassigned Worker",
      phone: "+919000000002",
      tradeIds: [],
    })

    expect(result.assignment).toBeUndefined()
  })

  it("inviteProjectMember returns a ProjectMembership, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "membership-row-id",
      legacy_id: null,
      person_id: "person-row-id",
      project_id: "project-row-id",
      role: "contractor",
      permissions: ["project.read", "task.manage", "progress.submit", "evidence.capture"],
      scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
      status: "invited",
    })

    const result = await inviteProjectMember(client, {
      projectId: "proj-1",
      name: "New Contractor",
      phone: "+919000000003",
      role: "contractor",
    })

    expect(result.projectId).toBe("project-row-id")
    expect(result.principalId).toBe("person-row-id")
    expect(result.status).toBe("invited")
    expect(result).not.toHaveProperty("person_id")
  })

  it("assignWorkerToProject returns a WorkerProjectAssignment, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "assignment-row-id",
      legacy_id: null,
      project_id: "project-row-id",
      worker_id: "worker-row-id",
      project_unit_ids: [],
      started_at: null,
      ended_at: null,
      end_reason: null,
      status: "invited",
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await assignWorkerToProject(client, { workerId: "worker-1", projectId: "proj-1" })

    expect(result.projectId).toBe("project-row-id")
    expect(result.workerId).toBe("worker-row-id")
    expect(result.status).toBe("invited")
    expect(result.startedAt).toBeUndefined()
    expect(result).not.toHaveProperty("worker_id")
  })

  it("cancelWorkerOnboarding returns a WorkerOnboarding, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "onboarding-row-id",
      legacy_id: null,
      worker_id: "worker-row-id",
      organization_id: "org-row-id",
      method: "manual",
      status: "cancelled",
      join_code: null,
      invited_at: "2026-01-01T00:00:00.000Z",
      accepted_at: null,
      expires_at: null,
    })

    const result = await cancelWorkerOnboarding(client, { onboardingId: "onboarding-1" })

    expect(result.workerId).toBe("worker-row-id")
    expect(result.status).toBe("cancelled")
    expect(result).not.toHaveProperty("worker_id")
  })
})

describe("supabase adapter: documents and conversations write results are mapped to the domain shape", () => {
  it("uploadDocument returns a Document starting private, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "document-row-id",
      legacy_id: null,
      project_id: "project-row-id",
      title: "Site plan",
      category: "drawing",
      url: "https://example.com/d.pdf",
      uploaded_by_membership_id: "membership-row-id",
      shared_with_homeowner: false,
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await uploadDocument(client, {
      projectId: "proj-1",
      title: "Site plan",
      category: "drawing",
      url: "https://example.com/d.pdf",
    })

    expect(result.projectId).toBe("project-row-id")
    expect(result.customerVisibility).toBe("private")
    expect(result.uploadedByMembershipId).toBe("membership-row-id")
    expect(result).not.toHaveProperty("shared_with_homeowner")
  })

  it("publishDocument maps shared_with_homeowner to customerVisibility", async () => {
    const client = fakeRpcClient({
      id: "document-row-id",
      legacy_id: null,
      project_id: "project-row-id",
      title: "Site plan",
      category: "drawing",
      url: "https://example.com/d.pdf",
      uploaded_by_membership_id: "membership-row-id",
      shared_with_homeowner: true,
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await publishDocument(client, { documentId: "document-1", visible: true })

    expect(result.customerVisibility).toBe("customer-visible")
  })

  it("postMessage returns a Message with the voice note mapped, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "message-row-id",
      legacy_id: null,
      thread_id: "thread-row-id",
      author_membership_id: "membership-row-id",
      body: null,
      voice_url: "https://example.com/v.m4a",
      voice_duration_sec: 12,
      voice_transcript: "hello there",
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await postMessage(client, {
      projectId: "proj-1",
      subject: "project",
      voice: { url: "https://example.com/v.m4a", durationSec: 12, transcript: "hello there" },
    })

    expect(result.threadId).toBe("thread-row-id")
    expect(result.body).toBeUndefined()
    expect(result.voice).toEqual({ url: "https://example.com/v.m4a", durationSec: 12, transcript: "hello there" })
    expect(result).not.toHaveProperty("voice_url")
  })

  it("openDirectThread returns a Thread with participantMembershipIds mapped, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "thread-row-id",
      legacy_id: null,
      project_id: "project-row-id",
      subject: "direct",
      target_id: null,
      audience: "internal",
      participant_membership_ids: ["membership-a-row-id", "membership-b-row-id"],
      created_at: "2026-01-01T00:00:00.000Z",
      last_message_at: null,
    })

    const result = await openDirectThread(client, { projectId: "proj-1", otherMembershipId: "membership-b" })

    expect(result.subject).toBe("direct")
    expect(result.participantMembershipIds).toEqual(["membership-a-row-id", "membership-b-row-id"])
    expect(result).not.toHaveProperty("participant_membership_ids")
  })

  it("logCall returns a CallLog with the other participant mapped, not the raw row", async () => {
    const client = fakeRpcClient({
      id: "call-row-id",
      legacy_id: null,
      thread_id: "thread-row-id",
      logged_by_membership_id: "membership-a-row-id",
      other_membership_id: "membership-b-row-id",
      type: "voice",
      started_at: "2026-01-01T00:00:00.000Z",
      duration_minutes: 7,
      note: "quick sync",
      created_at: "2026-01-01T00:00:00.000Z",
    })

    const result = await logCall(client, {
      threadId: "thread-1",
      type: "voice",
      startedAt: "2026-01-01T00:00:00.000Z",
      durationMinutes: 7,
      note: "quick sync",
    })

    expect(result.loggedByMembershipId).toBe("membership-a-row-id")
    expect(result.otherMembershipId).toBe("membership-b-row-id")
    expect(result).not.toHaveProperty("other_membership_id")
  })

  it("markThreadRead and markThreadUnread resolve without returning the raw row", async () => {
    const client = fakeRpcClient({ ignored: "row" })

    await expect(markThreadRead(client, { threadId: "thread-1" })).resolves.toBeUndefined()
    await expect(markThreadUnread(client, { threadId: "thread-1" })).resolves.toBeUndefined()
  })
})
