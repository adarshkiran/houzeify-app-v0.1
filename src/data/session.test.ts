import { describe, expect, it } from "vitest"
import { resolveSession } from "./session"

const person = { id: "person-ravi", phone: "+919000011122" }

describe("resolveSession", () => {
  it("resolves a worker row in one organization to a worker session", () => {
    const session = resolveSession({
      person,
      workers: [{ userId: "person-ravi", organizationId: "org-1", phone: "+919000011122" }],
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
      memberships: [{ personId: "person-arjun", organizationId: "org-1" }],
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
      workers: [{ userId: null, organizationId: "org-1", phone: "+919000011122" }],
      memberships: [{ personId: "someone-else", organizationId: "org-1" }],
    })
    expect(session).toEqual({
      accountType: "homeowner",
      personId: "person-ravi",
    })
  })

  it("returns null for an unknown phone (no person row)", () => {
    expect(resolveSession({ person: null, workers: [], memberships: [] })).toBeNull()
  })
})
