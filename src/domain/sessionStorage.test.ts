import { describe, expect, it } from "vitest"
import { parseStoredSession } from "./session"

const business = { accountType: "business", personId: "p1", organizationId: "org-1" }

describe("parseStoredSession", () => {
  it("accepts a valid business session", () => {
    expect(parseStoredSession(JSON.stringify(business))).toEqual(business)
  })

  it("accepts a homeowner session without an organization", () => {
    const homeowner = { accountType: "homeowner", personId: "p2" }
    expect(parseStoredSession(JSON.stringify(homeowner))).toEqual(homeowner)
  })

  it("rejects a business session with no organization", () => {
    expect(parseStoredSession(JSON.stringify({ accountType: "business", personId: "p1" }))).toBeNull()
  })

  it("rejects unknown account types, missing person, bad JSON and empty input", () => {
    expect(parseStoredSession(JSON.stringify({ accountType: "admin", personId: "p1" }))).toBeNull()
    expect(parseStoredSession(JSON.stringify({ accountType: "homeowner" }))).toBeNull()
    expect(parseStoredSession("{not json")).toBeNull()
    expect(parseStoredSession("null")).toBeNull()
    expect(parseStoredSession(null)).toBeNull()
  })
})
