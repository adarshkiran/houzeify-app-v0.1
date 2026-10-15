import { ConflictError } from "./errors"
import type {
  ConstructionDataState,
  EntityId,
  ISODateTime,
  ProposalShare,
  SharedProposal,
} from "./models"
import { areaBand, cityOf } from "./marketplaceVisibility"
import type { Command, CommandContext } from "./ports"

// FR-025: a contractor shares a submitted proposal through a secure link; the
// recipient sees only the fields intended for sharing. The database path is
// supabase/migrations/0030_proposal_shares.sql; this is the in-memory twin, so
// both data sources behave the same.
// Spec: docs/superpowers/specs/2026-10-15-proposal-share-link-design.md

export const SHARE_LINK_DAYS = 14

const DAY_MS = 86_400_000
const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

export interface ProposalShareLink {
  share: ProposalShare
  /** The raw token, shown once at creation. */
  token: string
}

/** The link currently usable for a proposal: not revoked and not expired. */
export function activeShareFor(
  state: ConstructionDataState,
  proposalId: EntityId,
  now: ISODateTime,
): ProposalShare | undefined {
  return state.proposalShares.find(
    (share) => share.proposalId === proposalId && !share.revokedAt && share.expiresAt > now,
  )
}

function authorize(state: ConstructionDataState, ctx: CommandContext, proposalId: EntityId) {
  const proposal = state.proposals.find((item) => item.id === proposalId)
  if (
    !proposal ||
    ctx.actor?.accountType !== "business" ||
    ctx.actor.organizationId !== proposal.partnerOrganizationId
  ) {
    throw new ConflictError("Only this organization's team can act for it.")
  }
  return { proposal, actor: ctx.actor }
}

export const createProposalShare =
  (proposalId: EntityId): Command<ProposalShareLink> =>
  (state, ctx) => {
    const { proposal, actor } = authorize(state, ctx, proposalId)
    if (proposal.status === "rejected") {
      throw new ConflictError("This proposal is no longer open, so it cannot be shared.")
    }
    const now = ctx.clock.now()
    const token = ctx.ids.next("share-token").replace(/-/g, "")
    const share: ProposalShare = {
      id: ctx.ids.next("proposal-share"),
      proposalId,
      createdByPersonId: actor.personId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SHARE_LINK_DAYS * DAY_MS).toISOString(),
      token,
    }
    const nowIso = now.toISOString()
    const proposalShares = [
      ...state.proposalShares.map((existing) =>
        existing.proposalId === proposalId && !existing.revokedAt
          ? { ...existing, revokedAt: nowIso }
          : existing,
      ),
      share,
    ]
    return { state: { ...state, proposalShares }, result: { share, token } }
  }

export const revokeProposalShare =
  (proposalId: EntityId): Command<ProposalShare> =>
  (state, ctx) => {
    authorize(state, ctx, proposalId)
    const nowIso = iso(ctx)
    const active = activeShareFor(state, proposalId, nowIso)
    if (!active) throw new ConflictError("There is no active link to revoke.")
    const revoked: ProposalShare = { ...active, revokedAt: nowIso }
    return {
      state: {
        ...state,
        proposalShares: state.proposalShares.map((share) => (share.id === active.id ? revoked : share)),
      },
      result: revoked,
    }
  }

/**
 * What a link-holder may see, or null for an unknown, revoked or expired token
 * (the same answer for each, so existence is not confirmed). Read-only; needs no
 * actor, because the link itself is the credential.
 */
export const getSharedProposal =
  (token: string): Command<SharedProposal | null> =>
  (state, ctx) => {
    const none = { state, result: null }
    if (!token || token.length < 16) return none
    const nowIso = iso(ctx)
    const share = state.proposalShares.find(
      (item) => item.token === token && !item.revokedAt && item.expiresAt > nowIso,
    )
    if (!share) return none
    const proposal = state.proposals.find((item) => item.id === share.proposalId)
    const requirement = state.requirements.find((item) => item.id === proposal?.requirementId)
    const partner = state.organizations.find((item) => item.id === proposal?.partnerOrganizationId)
    if (!proposal || !requirement || !partner) return none
    return {
      state,
      result: {
        partnerName: partner.name,
        location: cityOf(requirement.location),
        propertyType: requirement.propertyType,
        areaBand: requirement.areaBand ?? areaBand(requirement.builtUpAreaSqft),
        lines: proposal.lines.map((line) => ({
          category: line.category,
          item: line.item,
          quantity: line.quantity,
          unit: line.unit,
          rate: line.rate,
          amount: line.amount,
        })),
        total: proposal.total,
        assumptions: proposal.assumptions,
        exclusions: proposal.exclusions,
        submittedAt: proposal.submittedAt,
        expiresAt: share.expiresAt,
      },
    }
  }
