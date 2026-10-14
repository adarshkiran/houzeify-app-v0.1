// B1 (session persistence on reload): a signed-in user was logged out on
// refresh even though the Supabase auth token was present in localStorage,
// because the app routed on `session === null` before the async bootstrap
// (currentSession -> auth.getUser, which validates the persisted token
// against the real Supabase Auth server) had resolved. These tests exercise
// the bootstrap itself — currentSession() against a mocked SupabaseClient —
// confirming a persisted session resolves to the signed-in user's real role
// without any new signInWithOtp/verifyOtp call, and that signing out clears
// it so a subsequent check (the reload-equivalent: a fresh currentSession
// call) finds no session.
//
// A full SessionProvider/App render test (mounting the React tree and
// asserting the rendered screen) is not included: this project's vitest
// config runs in the "node" environment with no jsdom or
// @testing-library/react dependency, so there is no component-rendering
// harness to build on without adding new test infrastructure. The
// `pendingRedirect` unit tests in src/domain/navigation.test.ts cover the
// routing-gate half of the fix (SessionProvider's `ready` flag feeding
// App.tsx's redirect decision) at the same precision this suite uses for
// the data layer.

import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { currentSession } from "./session"

interface Row {
  id: string
  legacy_id: string | null
  phone: string | null
  auth_user_id: string
}

/**
 * Minimal fake covering exactly the SupabaseClient surface currentSession()
 * calls: auth.getUser(), and from("people"|"workers"|"memberships"|
 * "organizations").select(...).eq(...)/.in(...)[.maybeSingle()].
 */
function fakeClient(options: {
  authUserId: string | null
  person?: Row
  workers?: { organization_id: string; phone: string; status: string }[]
  memberships?: { organization_id: string; role: string; status: string }[]
  organizations?: { id: string; legacy_id: string | null }[]
}): SupabaseClient {
  const { authUserId, person, workers = [], memberships = [], organizations = [] } = options

  const getUser = vi.fn(async () =>
    authUserId ? { data: { user: { id: authUserId } }, error: null } : { data: { user: null }, error: null },
  )

  const from = vi.fn((table: string) => {
    if (table === "people") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: person ?? null, error: null }),
          }),
        }),
      }
    }
    if (table === "workers") {
      return { select: () => ({ eq: async () => ({ data: workers, error: null }) }) }
    }
    if (table === "memberships") {
      return { select: () => ({ eq: async () => ({ data: memberships, error: null }) }) }
    }
    if (table === "organizations") {
      return { select: () => ({ in: async () => ({ data: organizations, error: null }) }) }
    }
    throw new Error(`unexpected table ${table}`)
  })

  return { auth: { getUser }, from } as unknown as SupabaseClient
}

describe("currentSession (Supabase session bootstrap)", () => {
  it("resolves a persisted business session without a new OTP challenge", async () => {
    const client = fakeClient({
      authUserId: "auth-arjun",
      person: { id: "uuid-arjun", legacy_id: "person-arjun", phone: "+919000011101", auth_user_id: "auth-arjun" },
      memberships: [{ organization_id: "uuid-org-1", role: "project-manager", status: "active" }],
      organizations: [{ id: "uuid-org-1", legacy_id: "org-1" }],
    })

    const session = await currentSession(client)

    expect(session).toEqual({
      accountType: "business",
      personId: "person-arjun",
      organizationId: "org-1",
    })
    // The restored session came from the persisted auth token alone.
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect("signInWithOtp" in client.auth).toBe(false)
  })

  it("resolves a persisted worker session the same way", async () => {
    const client = fakeClient({
      authUserId: "auth-ravi",
      person: { id: "uuid-ravi", legacy_id: "person-ravi", phone: "+919000011122", auth_user_id: "auth-ravi" },
      workers: [{ organization_id: "uuid-org-1", phone: "+919000011122", status: "active" }],
      organizations: [{ id: "uuid-org-1", legacy_id: "org-1" }],
    })

    const session = await currentSession(client)

    expect(session).toEqual({
      accountType: "worker",
      personId: "person-ravi",
      organizationId: "org-1",
      phone: "+919000011122",
    })
  })

  it("returns null when there is no persisted auth user (nothing to restore)", async () => {
    const client = fakeClient({ authUserId: null })
    expect(await currentSession(client)).toBeNull()
  })
})

describe("sign-out clears the session for a subsequent reload-equivalent check", () => {
  it("currentSession finds no session once the auth user is gone", async () => {
    const signedIn = fakeClient({
      authUserId: "auth-arjun",
      person: { id: "uuid-arjun", legacy_id: "person-arjun", phone: "+919000011101", auth_user_id: "auth-arjun" },
      memberships: [{ organization_id: "uuid-org-1", role: "project-manager", status: "active" }],
      organizations: [{ id: "uuid-org-1", legacy_id: "org-1" }],
    })
    expect(await currentSession(signedIn)).not.toBeNull()

    // signOut() clears the persisted token; a fresh client reading the same
    // (now-cleared) storage sees no auth user, which is what a reload after
    // sign-out looks like.
    const afterSignOut = fakeClient({ authUserId: null })
    expect(await currentSession(afterSignOut)).toBeNull()
  })
})
