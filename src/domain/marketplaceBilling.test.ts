import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import { confirmEstimate, generateEstimate } from "./estimateCommands"
import { postRequirement, submitProposal, unlockRequirement } from "./marketplaceCommands"
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

const input = {
  projectName: "Lake View",
  propertyType: "House",
  location: "Hyderabad, Telangana",
  builtUpAreaSqft: 1500,
  floors: 1,
  constructionLevel: "standard" as const,
}

/** A state with one posted requirement, built through the real commands. */
function postedState(): { state: ConstructionDataState; requirementId: string } {
  const gen = generateEstimate(input)(seed, as(homeowner))
  const conf = confirmEstimate(gen.result.id)(gen.state, as(homeowner))
  const post = postRequirement(gen.result.id)(conf.state, as(homeowner))
  return { state: post.state, requirementId: post.result.id }
}

describe("unlockRequirement billing", () => {
  it("debits exactly 10 credits and links the transaction to the unlock", () => {
    const { state, requirementId } = postedState()
    const next = unlockRequirement(requirementId, ORG)(state, as(business))
    expect(next.state.wallets.find((w) => w.organizationId === ORG)!.balance).toBe(20)
    const tx = next.state.creditTransactions.find((t) => t.id === next.result.creditTransactionId)
    expect(tx).toBeDefined()
    expect(tx!.amount).toBe(-10)
    expect(tx!.kind).toBe("unlock")
  })

  it("refuses without marketplace.unlock, even with a high balance", () => {
    const { state, requirementId } = postedState()
    const noPlan: ConstructionDataState = {
      ...state,
      subscriptions: state.subscriptions.map((s) => ({ ...s, status: "cancelled" as const })),
      wallets: [{ organizationId: ORG, balance: 999 }],
    }
    expect(() => unlockRequirement(requirementId, ORG)(noPlan, as(business))).toThrow(ConflictError)
  })

  it("refuses at 9 credits and succeeds at 10, leaving the balance at 0", () => {
    const { state, requirementId } = postedState()
    const nine: ConstructionDataState = { ...state, wallets: [{ organizationId: ORG, balance: 9 }] }
    expect(() => unlockRequirement(requirementId, ORG)(nine, as(business))).toThrow(ConflictError)
    const ten: ConstructionDataState = { ...state, wallets: [{ organizationId: ORG, balance: 10 }] }
    const ok = unlockRequirement(requirementId, ORG)(ten, as(business))
    expect(ok.state.wallets.find((w) => w.organizationId === ORG)!.balance).toBe(0)
  })

  it("a refused unlock records no debit and no unlock", () => {
    const { state, requirementId } = postedState()
    const nine: ConstructionDataState = { ...state, wallets: [{ organizationId: ORG, balance: 9 }] }
    expect(() => unlockRequirement(requirementId, ORG)(nine, as(business))).toThrow(ConflictError)
    expect(nine.unlocks).toHaveLength(0)
    expect(nine.creditTransactions).toHaveLength(state.creditTransactions.length)
  })
})

describe("submitProposal entitlement", () => {
  it("refuses without marketplace.propose", () => {
    const { state, requirementId } = postedState()
    const unlocked = unlockRequirement(requirementId, ORG)(state, as(business)).state
    const noPlan: ConstructionDataState = {
      ...unlocked,
      subscriptions: unlocked.subscriptions.map((s) => ({ ...s, status: "cancelled" as const })),
    }
    expect(() =>
      submitProposal(requirementId, ORG, { assumptions: [], exclusions: [] })(noPlan, as(business)),
    ).toThrow(ConflictError)
  })
})
