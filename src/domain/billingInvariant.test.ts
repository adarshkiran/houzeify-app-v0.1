import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { confirmEstimate, generateEstimate } from "./estimateCommands"
import { getWallet } from "./entitlements"
import { purchaseCredits } from "./billingCommands"
import { postRequirement, unlockRequirement } from "./marketplaceCommands"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const ORG = "org-buildright"
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const business: Session = { accountType: "business", personId: "person-arjun", organizationId: ORG }
const clock: Clock = { now: () => new Date("2026-10-06T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

const sumTransactions = (state: ConstructionDataState, orgId: string) =>
  state.creditTransactions.filter((t) => t.organizationId === orgId).reduce((s, t) => s + t.amount, 0)

describe("credit ledger invariant", () => {
  it("wallet balance equals the sum of its transactions after purchases and unlocks", () => {
    // The seed already contains a grant transaction for org-buildright (balanceAfter 30),
    // so the ledger sum includes it: balance === sum of all transaction amounts.
    let state: ConstructionDataState = seed
    expect(getWallet(state, ORG).balance).toBe(sumTransactions(state, ORG))

    state = purchaseCredits(ORG, 50)(state, as(business)).state
    expect(getWallet(state, ORG).balance).toBe(sumTransactions(state, ORG))
    expect(state.creditTransactions.some((t) => t.organizationId === ORG && t.amount === 50)).toBe(true)

    const gen = generateEstimate({
      projectName: "A", propertyType: "House", location: "Hyderabad, Telangana",
      builtUpAreaSqft: 1200, floors: 1, constructionLevel: "basic",
    })(state, as(homeowner))
    state = gen.state
    state = confirmEstimate(gen.result.id)(state, as(homeowner)).state
    const post = postRequirement(gen.result.id)(state, as(homeowner))
    state = post.state

    state = unlockRequirement(post.result.id, ORG)(state, as(business)).state
    expect(getWallet(state, ORG).balance).toBe(sumTransactions(state, ORG))
    expect(state.creditTransactions.some((t) => t.organizationId === ORG && t.amount === -10)).toBe(true)
  })
})
