import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { CREDIT_PACKS, UNLOCK_COST_CREDITS, debitCredits, purchaseCredits } from "./billingCommands"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const ORG = "org-buildright"
const business: Session = { accountType: "business", personId: "person-arjun", organizationId: ORG }
const clock: Clock = { now: () => new Date("2026-10-06T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

describe("constants", () => {
  it("unlock costs 10 credits and packs are 50, 150, 500", () => {
    expect(UNLOCK_COST_CREDITS).toBe(10)
    expect([...CREDIT_PACKS]).toEqual([50, 150, 500])
  })
})

describe("purchaseCredits", () => {
  it("adds the credits and records a purchase transaction", () => {
    const { state, result } = purchaseCredits(ORG, 50)(seed, as(business))
    expect(result.balance).toBe(80)
    expect(state.creditTransactions).toHaveLength(2)
    expect(state.creditTransactions[state.creditTransactions.length - 1]).toMatchObject({
      kind: "purchase",
      amount: 50,
      balanceAfter: 80,
      organizationId: ORG,
    })
  })

  it("refuses a pack size that is not 50, 150, or 500", () => {
    expect(() => purchaseCredits(ORG, 40)(seed, as(business))).toThrow(ConflictError)
  })

  it("refuses a caller from another organization", () => {
    const other: Session = { accountType: "business", personId: "person-x", organizationId: "org-other" }
    expect(() => purchaseCredits(ORG, 50)(seed, as(other))).toThrow(ConflictError)
  })
})

describe("debitCredits", () => {
  it("debits the balance and records an unlock transaction", () => {
    const { state, transaction } = debitCredits(seed, as(business), ORG, 10, "unlock", "requirement-1")
    expect(state.wallets.find((w) => w.organizationId === ORG)!.balance).toBe(20)
    expect(transaction).toMatchObject({ kind: "unlock", amount: -10, balanceAfter: 20, requirementId: "requirement-1" })
  })

  it("refuses when the balance is short and leaves the state untouched", () => {
    const low: ConstructionDataState = { ...seed, wallets: [{ organizationId: ORG, balance: 9 }] }
    expect(() => debitCredits(low, as(business), ORG, 10, "unlock")).toThrow(ConflictError)
  })
})
