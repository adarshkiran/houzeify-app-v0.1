import { createClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { ConflictError } from "../domain/errors"
import { acceptWorkerOnboarding, loadState } from "./adapter"
import { createSupabaseClient } from "./supabaseClient"

// Runs only against the local Supabase stack (VITE_SUPABASE_URL on 127.0.0.1).
// RLS hides construction rows from the anon key until someone signs in (task 13),
// so the load assertions use the local service-role key, read at runtime from
// SUPABASE_SERVICE_ROLE_KEY (`npx supabase status -o env`). They skip without it.
const url = import.meta.env.VITE_SUPABASE_URL ?? ""
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
})

describe.skipIf(!localStack)("supabase adapter: refusals (local stack)", () => {
  it("maps a refused rpc call to ConflictError", async () => {
    const client = createSupabaseClient()
    await expect(
      acceptWorkerOnboarding(client, { onboardingId: crypto.randomUUID(), joinCode: "000000" }),
    ).rejects.toBeInstanceOf(ConflictError)
  })
})
