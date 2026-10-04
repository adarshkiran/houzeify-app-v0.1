import { ConflictError } from "./errors"
import { buildCatalogLines } from "./rateCard"
import type { EntityId, MarketplaceRequirement, MarketplaceUnlock, Project, ProjectMembership, Proposal } from "./models"
import type { Command, CommandContext } from "./ports"

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

const CONTRACTOR_KINDS = ["contractor", "builder"] as const

function requireBusinessFor(ctx: CommandContext, organizationId: EntityId) {
  if (ctx.actor?.accountType !== "business" || ctx.actor.organizationId !== organizationId) {
    throw new ConflictError("Only this organization's team can act for it.")
  }
}

export interface SubmitProposalInput {
  assumptions: string[]
  exclusions: string[]
}

/** Homeowner posts a confirmed estimate as a requirement. One requirement per estimate. */
export const postRequirement =
  (estimateId: EntityId): Command<MarketplaceRequirement> =>
  (state, ctx) => {
    if (ctx.actor?.accountType !== "homeowner") {
      throw new ConflictError("Only homeowners can post a requirement.")
    }
    const estimate = state.estimates.find((item) => item.id === estimateId)
    if (!estimate) throw new ConflictError("That estimate no longer exists.")
    if (estimate.homeownerPersonId !== ctx.actor.personId) {
      throw new ConflictError("You can only post your own estimate.")
    }
    if (estimate.reviewStatus !== "confirmed") {
      throw new ConflictError("Confirm the estimate before posting it.")
    }
    if (state.requirements.some((r) => r.estimateId === estimateId)) {
      throw new ConflictError("This estimate has already been posted.")
    }
    const timestamp = iso(ctx)
    const requirement: MarketplaceRequirement = {
      id: ctx.ids.next("requirement"),
      estimateId,
      homeownerPersonId: estimate.homeownerPersonId,
      projectName: estimate.projectName,
      location: estimate.location,
      builtUpAreaSqft: estimate.builtUpAreaSqft,
      constructionLevel: estimate.constructionLevel,
      propertyType: estimate.propertyType,
      estimateTotalLow: estimate.totalLow,
      estimateTotalHigh: estimate.totalHigh,
      status: "posted",
      postedAt: timestamp,
      createdAt: timestamp,
    }
    return { state: { ...state, requirements: [...state.requirements, requirement] }, result: requirement }
  }

/** A contractor or builder organization unlocks a posted requirement. Simulated: no payment. */
export const unlockRequirement =
  (requirementId: EntityId, partnerOrganizationId: EntityId): Command<MarketplaceUnlock> =>
  (state, ctx) => {
    requireBusinessFor(ctx, partnerOrganizationId)
    const org = state.organizations.find((o) => o.id === partnerOrganizationId)
    if (!org || !(CONTRACTOR_KINDS as readonly string[]).includes(org.kind)) {
      throw new ConflictError("Only contractor or builder organizations can unlock requirements.")
    }
    const requirement = state.requirements.find((r) => r.id === requirementId)
    if (!requirement) throw new ConflictError("That requirement no longer exists.")
    if (requirement.status !== "posted") {
      throw new ConflictError("This requirement is no longer open.")
    }
    if (state.unlocks.some((u) => u.requirementId === requirementId && u.partnerOrganizationId === partnerOrganizationId)) {
      throw new ConflictError("You have already unlocked this requirement.")
    }
    const unlock: MarketplaceUnlock = {
      id: ctx.ids.next("unlock"),
      requirementId,
      partnerOrganizationId,
      unlockedAt: iso(ctx),
    }
    return { state: { ...state, unlocks: [...state.unlocks, unlock] }, result: unlock }
  }

/** An unlocking organization submits a proposal priced from the shared rate card. */
export const submitProposal =
  (requirementId: EntityId, partnerOrganizationId: EntityId, input: SubmitProposalInput): Command<Proposal> =>
  (state, ctx) => {
    requireBusinessFor(ctx, partnerOrganizationId)
    const requirement = state.requirements.find((r) => r.id === requirementId)
    if (!requirement) throw new ConflictError("That requirement no longer exists.")
    if (requirement.status !== "posted") {
      throw new ConflictError("This requirement is no longer open.")
    }
    const unlocked = state.unlocks.some((u) => u.requirementId === requirementId && u.partnerOrganizationId === partnerOrganizationId)
    if (!unlocked) throw new ConflictError("Unlock the requirement before submitting a proposal.")
    if (state.proposals.some((p) => p.requirementId === requirementId && p.partnerOrganizationId === partnerOrganizationId)) {
      throw new ConflictError("You have already submitted a proposal for this requirement.")
    }
    const lines = buildCatalogLines(ctx, requirement.builtUpAreaSqft, requirement.constructionLevel)
    const proposal: Proposal = {
      id: ctx.ids.next("proposal"),
      requirementId,
      partnerOrganizationId,
      lines,
      total: lines.reduce((sum, l) => sum + l.amount, 0),
      assumptions: input.assumptions,
      exclusions: input.exclusions,
      status: "submitted",
      submittedAt: iso(ctx),
    }
    return { state: { ...state, proposals: [...state.proposals, proposal] }, result: proposal }
  }

/** Homeowner selects a proposal: awards the requirement, rejects the rest, creates the project. */
export const selectProposal =
  (proposalId: EntityId): Command<Project> =>
  (state, ctx) => {
    if (ctx.actor?.accountType !== "homeowner") {
      throw new Error("Only homeowners can select a proposal.")
    }
    const proposal = state.proposals.find((p) => p.id === proposalId)
    if (!proposal) throw new ConflictError("That proposal no longer exists.")
    const requirement = state.requirements.find((r) => r.id === proposal.requirementId)
    if (!requirement) throw new ConflictError("That requirement no longer exists.")
    if (requirement.homeownerPersonId !== ctx.actor.personId) {
      throw new ConflictError("You can only select proposals for your own requirement.")
    }
    if (requirement.status !== "posted") {
      throw new ConflictError("This requirement has already been awarded.")
    }

    const timestamp = iso(ctx)
    const projectId = ctx.ids.next("project")
    const project: Project = {
      id: projectId,
      organizationId: proposal.partnerOrganizationId,
      code: `MKT-${projectId.slice(-6).toUpperCase()}`,
      name: requirement.projectName,
      kind: "individual-house",
      status: "planning",
      location: requirement.location,
      progress: 0,
      trackingStartedMidProject: false,
      stageBaselines: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const homeownerLink: ProjectMembership = {
      id: ctx.ids.next("membership"),
      projectId,
      principalType: "person",
      principalId: requirement.homeownerPersonId,
      role: "homeowner",
      scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
      permissions: [],
      status: "active",
    }
    const proposals = state.proposals.map((p) => {
      if (p.requirementId !== requirement.id) return p
      return p.id === proposalId ? { ...p, status: "selected" as const } : { ...p, status: "rejected" as const }
    })
    const requirements = state.requirements.map((r) =>
      r.id === requirement.id ? { ...r, status: "awarded" as const, awardedProposalId: proposalId } : r,
    )
    return {
      state: {
        ...state,
        projects: [...state.projects, project],
        memberships: [...state.memberships, homeownerLink],
        proposals,
        requirements,
      },
      result: project,
    }
  }
