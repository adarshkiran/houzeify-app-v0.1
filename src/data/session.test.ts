import { describe, expect, it } from "vitest"
import { resolveSession } from "./session"

const person = { id: "person-ravi", phone: "+919000011122" }

describe("resolveSession", () => {
  it("resolves a worker row in one organization to a worker session", () => {
    const session = resolveSession({
      person,
      workers: [
        { userId: "person-ravi", organizationId: "org-1", phone: "+919000011122", status: "active" },
      ],
      memberships: [],
    })
    expect(session).toEqual({
      accountType: "worker",
      personId: "person-ravi",
      organizationId: "org-1",
      phone: "+919000011122",
    })
  })

  it("resolves a business membership to a business session", () => {
    const session = resolveSession({
      person: { id: "person-arjun", phone: "+919000011101" },
      workers: [],
      memberships: [
        { personId: "person-arjun", organizationId: "org-1", role: "project-manager", status: "active" },
      ],
    })
    expect(session).toEqual({
      accountType: "business",
      personId: "person-arjun",
      organizationId: "org-1",
    })
  })

  it("resolves a person with no worker row and no membership to a homeowner session", () => {
    const session = resolveSession({
      person,
      workers: [{ userId: null, organizationId: "org-1", phone: "+919000011122", status: "active" }],
      memberships: [{ personId: "someone-else", organizationId: "org-1", role: "project-manager", status: "active" }],
    })
    expect(session).toEqual({
      accountType: "homeowner",
      personId: "person-ravi",
    })
  })

  it("returns null for an unknown phone (no person row)", () => {
    expect(resolveSession({ person: null, workers: [], memberships: [] })).toBeNull()
  })

  // T1 (progress.md FINAL TS-LAYER REVIEW): resolveSession used to treat ANY
  // membership row as proof of a business session, ignoring role and status.
  // select_proposal (0006_functions_billing_marketplace.sql) gives an awarded
  // homeowner a project membership with role='homeowner'; the seeded demo
  // homeowner (membership-homeowner-sharma) is exactly this shape. Such a
  // person must still resolve to "homeowner", not "business".
  it("resolves a person whose only membership has role='homeowner' to a homeowner session", () => {
    const session = resolveSession({
      person: { id: "person-demo-homeowner", phone: "+919000099999" },
      workers: [],
      memberships: [
        {
          personId: "person-demo-homeowner",
          organizationId: "org-buildright",
          role: "homeowner",
          status: "active",
        },
      ],
    })
    expect(session).toEqual({
      accountType: "homeowner",
      personId: "person-demo-homeowner",
    })
  })

  it("still resolves an active non-homeowner, non-worker membership to a business session", () => {
    const session = resolveSession({
      person: { id: "person-arjun", phone: "+919000011101" },
      workers: [],
      memberships: [
        { personId: "person-arjun", organizationId: "org-1", role: "project-manager", status: "active" },
      ],
    })
    expect(session).toEqual({
      accountType: "business",
      personId: "person-arjun",
      organizationId: "org-1",
    })
  })

  it("falls through to homeowner for a person with only an invited (not active) membership", () => {
    const session = resolveSession({
      person: { id: "person-invitee", phone: "+919000055555" },
      workers: [],
      memberships: [
        { personId: "person-invitee", organizationId: "org-1", role: "project-manager", status: "invited" },
      ],
    })
    expect(session).toEqual({
      accountType: "homeowner",
      personId: "person-invitee",
    })
  })

  it("falls through to homeowner for a worker row that is not active", () => {
    const session = resolveSession({
      person: { id: "person-ravi", phone: "+919000011122" },
      workers: [
        { userId: "person-ravi", organizationId: "org-1", phone: "+919000011122", status: "inactive" },
      ],
      memberships: [],
    })
    expect(session).toEqual({
      accountType: "homeowner",
      personId: "person-ravi",
    })
  })
})
