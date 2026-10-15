import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import type { ConstructionDataState, MarketplaceRequirement, Proposal } from "./models"
import type { CommandContext } from "./ports"
import {
  SHARE_LINK_DAYS,
  activeShareFor,
  createProposalShare,
  getSharedProposal,
  revokeProposalShare,
} from "./proposalShareCommands"
import type { Session } from "./session"

const partner: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const otherOrg: Session = { accountType: "business", personId: "person-x", organizationId: "org-other" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const T0 = new Date("2026-10-15T09:00:00.000Z")

let counter = 0
const ctx = (actor: Session | null, at: Date = T0): CommandContext => ({
  actor,
  clock: { now: () => at },
  ids: { next: (prefix) => `${prefix}-${++counter}-aaaa-bbbb-cccc-dddddddddddd`, short: () => "s" },
})

const requirement: MarketplaceRequirement = {
  id: "req-1",
  estimateId: "est-1",
  homeownerPersonId: "person-demo-homeowner",
  projectName: "Confidential Villa Name",
  location: "Plot 9, Road 3, Hyderabad, Telangana",
  builtUpAreaSqft: 3200,
  constructionLevel: "premium",
  propertyType: "independent",
  estimateTotalLow: 4_200_000,
  estimateTotalHigh: 5_100_000,
  status: "posted",
  createdAt: "2026-10-01T00:00:00.000Z",
}

function proposal(status: Proposal["status"] = "submitted"): Proposal {
  return {
    id: "prop-1",
    requirementId: "req-1",
    partnerOrganizationId: "org-buildright",
    submittedByPersonId: "person-arjun",
    lines: [
      { id: "l1", category: "materials", item: "Cement", quantity: 100, unit: "bags", rate: 400, amount: 40000, source: "rate-card", effectiveDate: "2026-10-01T00:00:00Z", confidence: "medium" },
    ],
    total: 40000,
    assumptions: ["Soil is firm"],
    exclusions: ["Landscaping"],
    status,
    submittedAt: "2026-10-10T00:00:00.000Z",
  }
}

const base = (status: Proposal["status"] = "submitted"): ConstructionDataState => ({
  ...seed,
  requirements: [requirement],
  proposals: [proposal(status)],
  proposalShares: [],
})

describe("createProposalShare", () => {
  it("creates a link that expires in 14 days and returns the token once", () => {
    const { state, result } = createProposalShare("prop-1")(base(), ctx(partner))
    expect(SHARE_LINK_DAYS).toBe(14)
    expect(result.token.length).toBeGreaterThanOrEqual(32)
    expect(result.share.expiresAt).toBe("2026-10-29T09:00:00.000Z")
    expect(result.share.createdByPersonId).toBe("person-arjun")
    expect(state.proposalShares).toHaveLength(1)
    expect(activeShareFor(state, "prop-1", T0.toISOString())?.id).toBe(result.share.id)
  })

  it("replaces the previous link, which stops working", () => {
    const first = createProposalShare("prop-1")(base(), ctx(partner))
    const second = createProposalShare("prop-1")(first.state, ctx(partner))
    expect(getSharedProposal(first.result.token)(second.state, ctx(null)).result).toBeNull()
    expect(getSharedProposal(second.result.token)(second.state, ctx(null)).result).not.toBeNull()
    expect(second.state.proposalShares.filter((s) => !s.revokedAt)).toHaveLength(1)
  })

  it("refuses another organization, a homeowner and a signed-out actor", () => {
    for (const actor of [otherOrg, homeowner, null]) {
      expect(() => createProposalShare("prop-1")(base(), ctx(actor))).toThrow(
        new ConflictError("Only this organization's team can act for it."),
      )
    }
  })

  it("refuses an unknown proposal and a rejected one", () => {
    expect(() => createProposalShare("nope")(base(), ctx(partner))).toThrow(ConflictError)
    expect(() => createProposalShare("prop-1")(base("rejected"), ctx(partner))).toThrow(
      new ConflictError("This proposal is no longer open, so it cannot be shared."),
    )
  })
})

describe("getSharedProposal", () => {
  const shared = createProposalShare("prop-1")(base(), ctx(partner))

  it("returns exactly the allowlisted fields and nothing identifying the homeowner", () => {
    const view = getSharedProposal(shared.result.token)(shared.state, ctx(null)).result!
    expect(Object.keys(view).sort()).toEqual([
      "areaBand", "assumptions", "exclusions", "expiresAt", "lines", "location",
      "partnerName", "propertyType", "submittedAt", "total",
    ])
    expect(view.partnerName).toBe("BuildRight Construction")
    expect(view.location).toBe("Hyderabad")
    expect(view.areaBand).toBe("3,000–3,500 sq ft")
    expect(Object.keys(view.lines[0]).sort()).toEqual(["amount", "category", "item", "quantity", "rate", "unit"])
    const text = JSON.stringify(view)
    expect(text).not.toContain("Confidential Villa Name")
    expect(text).not.toContain("person-demo-homeowner")
    expect(text).not.toContain("3200")
  })

  it("needs no signed-in actor", () => {
    expect(getSharedProposal(shared.result.token)(shared.state, ctx(null)).result).not.toBeNull()
  })

  it("returns null for an unknown, malformed or empty token", () => {
    for (const token of ["", "short", "f".repeat(64)]) {
      expect(getSharedProposal(token)(shared.state, ctx(null)).result).toBeNull()
    }
  })

  it("returns null once expired, but not a moment before", () => {
    const edge = new Date("2026-10-29T09:00:00.000Z")
    const before = new Date(edge.getTime() - 1000)
    expect(getSharedProposal(shared.result.token)(shared.state, ctx(null, before)).result).not.toBeNull()
    expect(getSharedProposal(shared.result.token)(shared.state, ctx(null, edge)).result).toBeNull()
  })

  it("returns null after the contractor revokes", () => {
    const revoked = revokeProposalShare("prop-1")(shared.state, ctx(partner))
    expect(revoked.result.revokedAt).toBe(T0.toISOString())
    expect(getSharedProposal(shared.result.token)(revoked.state, ctx(null)).result).toBeNull()
  })
})

describe("revokeProposalShare", () => {
  it("refuses when there is no active link", () => {
    expect(() => revokeProposalShare("prop-1")(base(), ctx(partner))).toThrow(
      new ConflictError("There is no active link to revoke."),
    )
  })

  it("refuses another organization", () => {
    const shared = createProposalShare("prop-1")(base(), ctx(partner))
    expect(() => revokeProposalShare("prop-1")(shared.state, ctx(otherOrg))).toThrow(ConflictError)
  })
})
