import { describe, expect, it } from "vitest"
import type { Session } from "../domain/session"
import { sessionDataKey } from "./dataKey"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }

describe("sessionDataKey", () => {
  it("is stable across a new session object for the same person (token refresh)", () => {
    expect(sessionDataKey({ ...arjun })).toBe(sessionDataKey({ ...arjun, phone: "+919000011101" }))
  })

  it("differs between signed-out and signed-in", () => {
    expect(sessionDataKey(null)).not.toBe(sessionDataKey(arjun))
  })

  it("differs between people, accounts and organizations", () => {
    const keys = new Set([
      sessionDataKey(arjun),
      sessionDataKey({ ...arjun, personId: "person-other" }),
      sessionDataKey({ ...arjun, accountType: "worker" }),
      sessionDataKey({ ...arjun, organizationId: "org-other" }),
      sessionDataKey({ accountType: "homeowner", personId: "person-arjun" }),
    ])
    expect(keys.size).toBe(5)
  })
})
