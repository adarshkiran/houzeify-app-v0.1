import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { generateEstimate, confirmEstimate } from "./estimateCommands"
import { ConflictError } from "./errors"
import { postRequirement, submitProposal, unlockRequirement } from "./marketplaceCommands"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const partner: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
// Test-only partner: the seeded org-buildright is a construction-company, which the
// spec does not allow to unlock. Seed data is intentionally left unchanged.
const contractorOrg = {
  id: "org-contractor",
  name: "ABC Civil Works",
  kind: "contractor" as const,
  status: "active" as const,
  city: "Hyderabad",
  phone: "+91 90000 00000",
  teamSize: "1–20",
  createdAt: "2026-01-10T09:00:00+05:30",
}
const withPartner: ConstructionDataState = { ...seed, organizations: [...seed.organizations, contractorOrg] }
const contractorPartner: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-contractor" }
const clock: Clock = { now: () => new Date("2026-10-04T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })
const run = <T,>(state: ConstructionDataState, actor: Session | null, command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T }) =>
  command(state, as(actor))

const input = {
  projectName: "My New Home",
  propertyType: "House",
  location: "Hyderabad, Telangana",
  builtUpAreaSqft: 2000,
  floors: 2,
  constructionLevel: "standard" as const,
}

/** A confirmed estimate in a fresh state, returning the state and the estimate id. */
function confirmedState(base: ConstructionDataState = seed) {
  const generated = run(base, homeowner, generateEstimate(input))
  const confirmed = run(generated.state, homeowner, confirmEstimate(generated.result.id))
  return { state: confirmed.state, estimateId: generated.result.id }
}

describe("postRequirement", () => {
  it("posts a requirement from a confirmed estimate", () => {
    const { state, estimateId } = confirmedState()
    const { result } = run(state, homeowner, postRequirement(estimateId))
    expect(result.status).toBe("posted")
    expect(result.estimateId).toBe(estimateId)
    expect(result.homeownerPersonId).toBe("person-demo-homeowner")
    expect(result.postedAt).toBe("2026-10-04T10:00:00.000Z")
  })

  it("refuses a draft estimate", () => {
    const generated = run(seed, homeowner, generateEstimate(input))
    expect(() => run(generated.state, homeowner, postRequirement(generated.result.id))).toThrow(ConflictError)
  })

  it("refuses a second requirement from the same estimate", () => {
    const { state, estimateId } = confirmedState()
    const posted = run(state, homeowner, postRequirement(estimateId))
    expect(() => run(posted.state, homeowner, postRequirement(estimateId))).toThrow(ConflictError)
  })

  it("refuses an estimate the caller does not own", () => {
    const { state, estimateId } = confirmedState()
    const other: Session = { accountType: "homeowner", personId: "person-someone-else" }
    expect(() => run(state, other, postRequirement(estimateId))).toThrow(ConflictError)
  })
})

describe("unlockRequirement", () => {
  function postedState() {
    const { state, estimateId } = confirmedState(withPartner)
    const posted = run(state, homeowner, postRequirement(estimateId))
    return { state: posted.state, requirementId: posted.result.id }
  }

  it("records an unlock for a contractor organization", () => {
    const { state, requirementId } = postedState()
    const { state: after, result } = run(state, contractorPartner, unlockRequirement(requirementId, "org-contractor"))
    expect(result.requirementId).toBe(requirementId)
    expect(after.unlocks).toContainEqual(result)
  })

  it("refuses a second unlock by the same organization", () => {
    const { state, requirementId } = postedState()
    const once = run(state, contractorPartner, unlockRequirement(requirementId, "org-contractor"))
    expect(() => run(once.state, contractorPartner, unlockRequirement(requirementId, "org-contractor"))).toThrow(ConflictError)
  })

  it("refuses a caller acting for a different organization", () => {
    const { state, requirementId } = postedState()
    expect(() => run(state, contractorPartner, unlockRequirement(requirementId, "org-other"))).toThrow(ConflictError)
  })

  it("refuses a homeowner trying to unlock", () => {
    const { state, requirementId } = postedState()
    expect(() => run(state, homeowner, unlockRequirement(requirementId, "org-contractor"))).toThrow()
  })
})

describe("submitProposal", () => {
  function unlockedState() {
    const { state, estimateId } = confirmedState(withPartner)
    const posted = run(state, homeowner, postRequirement(estimateId))
    const unlocked = run(posted.state, contractorPartner, unlockRequirement(posted.result.id, "org-contractor"))
    return { state: unlocked.state, requirementId: posted.result.id }
  }

  it("submits a proposal with rate-card lines and a total", () => {
    const { state, requirementId } = unlockedState()
    const { result } = run(state, contractorPartner, submitProposal(requirementId, "org-contractor", { assumptions: ["Soil test done"], exclusions: ["Landscaping"] }))
    expect(result.status).toBe("submitted")
    expect(result.lines).toHaveLength(7)
    expect(result.total).toBeCloseTo(result.lines.reduce((s, l) => s + l.amount, 0), 5)
    expect(result.assumptions).toEqual(["Soil test done"])
  })

  it("refuses a proposal without an unlock", () => {
    const { state, estimateId } = confirmedState(withPartner)
    const posted = run(state, homeowner, postRequirement(estimateId))
    expect(() => run(posted.state, contractorPartner, submitProposal(posted.result.id, "org-contractor", { assumptions: [], exclusions: [] }))).toThrow(ConflictError)
  })

  it("refuses a second proposal from the same organization", () => {
    const { state, requirementId } = unlockedState()
    const once = run(state, contractorPartner, submitProposal(requirementId, "org-contractor", { assumptions: [], exclusions: [] }))
    expect(() => run(once.state, contractorPartner, submitProposal(requirementId, "org-contractor", { assumptions: [], exclusions: [] }))).toThrow(ConflictError)
  })
})
