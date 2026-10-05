import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import type { ConstructionDataState } from "./models"
import { getEntitlements, getWallet, hasEntitlement } from "./entitlements"

const ORG = "org-buildright"

describe("getEntitlements", () => {
  it("returns the active plan's entitlements", () => {
    expect(getEntitlements(seed, ORG)).toEqual(["marketplace.unlock", "marketplace.propose"])
  })

  it("returns none when the subscription is cancelled", () => {
    const state: ConstructionDataState = {
      ...seed,
      subscriptions: seed.subscriptions.map((s) => ({ ...s, status: "cancelled" as const })),
    }
    expect(getEntitlements(state, ORG)).toEqual([])
  })

  it("returns none for an organization without a subscription", () => {
    expect(getEntitlements(seed, "org-nobody")).toEqual([])
  })
})

describe("hasEntitlement", () => {
  it("is false for a key the plan does not include", () => {
    expect(hasEntitlement(seed, ORG, "team.members.unlimited")).toBe(false)
  })

  it("is true for a key the plan includes", () => {
    expect(hasEntitlement(seed, ORG, "marketplace.unlock")).toBe(true)
  })
})

describe("getWallet", () => {
  it("returns the wallet balance", () => {
    expect(getWallet(seed, ORG)).toEqual({ organizationId: ORG, balance: 30 })
  })

  it("returns a zero balance when there is no wallet", () => {
    expect(getWallet(seed, "org-nobody")).toEqual({ organizationId: "org-nobody", balance: 0 })
  })
})
