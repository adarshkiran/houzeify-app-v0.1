import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "./seed"

describe("billing seed", () => {
  it("seeds the two plans with the spec entitlements", () => {
    const starter = seed.plans.find((p) => p.name === "Contractor Starter")!
    const pro = seed.plans.find((p) => p.name === "Contractor Pro")!
    expect(starter.entitlements).toEqual(["marketplace.unlock", "marketplace.propose"])
    expect(pro.entitlements).toEqual(["marketplace.unlock", "marketplace.propose", "team.members.unlimited"])
  })

  it("puts the demo contractor on Starter with a 30-credit wallet", () => {
    const sub = seed.subscriptions.find((s) => s.organizationId === "org-buildright")!
    const starter = seed.plans.find((p) => p.name === "Contractor Starter")!
    expect(sub.planId).toBe(starter.id)
    expect(sub.status).toBe("active")
    expect(seed.wallets.find((w) => w.organizationId === "org-buildright")!.balance).toBe(30)
  })

  it("seeds one 30-credit grant for the demo contractor", () => {
    const grants = seed.creditTransactions.filter((t) => t.organizationId === "org-buildright")
    expect(grants).toHaveLength(1)
    expect(grants[0]).toMatchObject({ kind: "grant", amount: 30, balanceAfter: 30 })
  })
})
