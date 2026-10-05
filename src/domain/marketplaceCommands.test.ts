import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { generateEstimate, confirmEstimate } from "./estimateCommands"
import { ConflictError } from "./errors"
import { postRequirement, selectProposal, submitProposal, unlockRequirement } from "./marketplaceCommands"
import { viewRequirement } from "./marketplaceVisibility"
import { permissionsForRole } from "./permissions"
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
const withPartner: ConstructionDataState = {
  ...seed,
  organizations: [...seed.organizations, contractorOrg],
  subscriptions: [
    ...seed.subscriptions,
    {
      id: "subscription-contractor",
      organizationId: "org-contractor",
      planId: "plan-contractor-starter",
      status: "active",
      startedAt: "2026-01-10T09:00:00+05:30",
    },
  ],
  wallets: [...seed.wallets, { organizationId: "org-contractor", balance: 30 }],
}
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

  it("refuses a business actor posting a requirement", () => {
    const { state, estimateId } = confirmedState(withPartner)
    expect(() => run(state, contractorPartner, postRequirement(estimateId))).toThrow(ConflictError)
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

  it("refuses an unlock on a requirement that is no longer posted", () => {
    const { state, requirementId } = postedState()
    const awarded = { ...state, requirements: state.requirements.map((r) => (r.id === requirementId ? { ...r, status: "awarded" as const } : r)) }
    expect(() => run(awarded, contractorPartner, unlockRequirement(requirementId, "org-contractor"))).toThrow(ConflictError)
  })

  it("refuses a homeowner trying to unlock", () => {
    const { state, requirementId } = postedState()
    expect(() => run(state, homeowner, unlockRequirement(requirementId, "org-contractor"))).toThrow(ConflictError)
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

  it("refuses a proposal on a requirement that is not posted", () => {
    const { state, requirementId } = unlockedState()
    const closed = { ...state, requirements: state.requirements.map((r) => (r.id === requirementId ? { ...r, status: "closed" as const } : r)) }
    expect(() => run(closed, contractorPartner, submitProposal(requirementId, "org-contractor", { assumptions: [], exclusions: [] }))).toThrow(ConflictError)
  })

  it("refuses a business actor submitting for another organization", () => {
    const { state, requirementId } = unlockedState()
    expect(() => run(state, contractorPartner, submitProposal(requirementId, "org-buildright", { assumptions: [], exclusions: [] }))).toThrow(ConflictError)
  })

  it("refuses a second proposal from the same organization", () => {
    const { state, requirementId } = unlockedState()
    const once = run(state, contractorPartner, submitProposal(requirementId, "org-contractor", { assumptions: [], exclusions: [] }))
    expect(() => run(once.state, contractorPartner, submitProposal(requirementId, "org-contractor", { assumptions: [], exclusions: [] }))).toThrow(ConflictError)
  })
})

function proposedState() {
  const { state: s, estimateId } = confirmedState(withPartner)
  const posted = run(s, homeowner, postRequirement(estimateId))
  const unlocked = run(posted.state, contractorPartner, unlockRequirement(posted.result.id, "org-contractor"))
  const proposed = run(unlocked.state, contractorPartner, submitProposal(posted.result.id, "org-contractor", { assumptions: [], exclusions: [] }))
  return { state: proposed.state, requirementId: posted.result.id, proposalId: proposed.result.id }
}

describe("selectProposal", () => {
  it("awards the requirement and creates one project linked to the homeowner", () => {
    const { state, requirementId, proposalId } = proposedState()
    const { state: after } = run(state, homeowner, selectProposal(proposalId))
    expect(after.requirements.find((r) => r.id === requirementId)?.status).toBe("awarded")
    expect(after.proposals.find((p) => p.id === proposalId)?.status).toBe("selected")
    const created = after.projects.filter((p) => p.organizationId === "org-contractor" && p.name === "My New Home")
    expect(created).toHaveLength(1)
    const link = after.memberships.find((m) => m.projectId === created[0].id && m.principalId === "person-demo-homeowner")
    expect(link?.role).toBe("homeowner")
  })

  it("gives the submitting partner a project-manager membership on the new project", () => {
    const { state, proposalId } = proposedState()
    const { state: after, result } = run(state, homeowner, selectProposal(proposalId))
    const link = after.memberships.find((m) => m.projectId === result.id && m.principalId === "person-arjun")
    expect(link?.role).toBe("project-manager")
    expect(link?.permissions).toEqual(permissionsForRole("project-manager"))
  })

  it("rejects the other proposals on the same requirement", () => {
    const { state, requirementId, proposalId } = proposedState()
    const other = {
      id: "proposal-other",
      requirementId,
      partnerOrganizationId: "org-other",
      submittedByPersonId: "person-arjun",
      lines: [],
      total: 0,
      assumptions: [],
      exclusions: [],
      status: "submitted" as const,
      submittedAt: "2026-10-04T10:00:00.000Z",
    }
    const seeded = { ...state, proposals: [...state.proposals, other] }
    const { state: after } = run(seeded, homeowner, selectProposal(proposalId))
    expect(after.proposals.find((p) => p.id === "proposal-other")?.status).toBe("rejected")
    expect(after.requirements.find((r) => r.id === requirementId)?.awardedProposalId).toBe(proposalId)
  })

  it("refuses a second selection on an awarded requirement", () => {
    const { state, proposalId } = proposedState()
    const once = run(state, homeowner, selectProposal(proposalId))
    expect(() => run(once.state, homeowner, selectProposal(proposalId))).toThrow(ConflictError)
  })

  it("refuses a homeowner who does not own the requirement", () => {
    const { state, proposalId } = proposedState()
    const other: Session = { accountType: "homeowner", personId: "person-someone-else" }
    expect(() => run(state, other, selectProposal(proposalId))).toThrow(ConflictError)
  })

  it("gives the homeowner membership the homeowner role permissions", () => {
    const { state, proposalId } = proposedState()
    const { state: after, result } = run(state, homeowner, selectProposal(proposalId))
    const link = after.memberships.find((m) => m.projectId === result.id && m.principalId === "person-demo-homeowner")
    expect(link?.permissions).toEqual(permissionsForRole("homeowner"))
  })

  it("refuses a business actor selecting a proposal", () => {
    const { state, proposalId } = proposedState()
    expect(() => run(state, contractorPartner, selectProposal(proposalId))).toThrow(ConflictError)
  })
})

describe("viewRequirement visibility", () => {
  it("returns only a preview to an organization that has not unlocked", () => {
    const { state, requirementId } = proposedState()
    const view = viewRequirement(state, requirementId, "org-other")
    expect(view?.kind).toBe("preview")
    expect(view).not.toHaveProperty("builtUpAreaSqft")
    expect(view).not.toHaveProperty("projectName")
    expect(view).not.toHaveProperty("lines")
  })

  it("returns full details to an organization that has unlocked", () => {
    const { state, requirementId } = proposedState()
    const view = viewRequirement(state, requirementId, "org-contractor")
    expect(view?.kind).toBe("full")
    expect(view).toHaveProperty("builtUpAreaSqft", 2000)
  })
})
