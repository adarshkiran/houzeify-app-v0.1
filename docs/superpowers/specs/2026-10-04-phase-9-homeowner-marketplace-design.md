# Phase 9 — Homeowner Construction Marketplace Design

**Status:** Approved in brainstorming — pending final spec review

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §11 (Phase 9). Product rules from `Houzeify_Master_Plan_v0_2_FINAL.md` §5 Scenario A, §13 (visibility and paid unlock), FR-021 to FR-026, and §30.2/§30.4 screens.

## Goal

A homeowner turns a confirmed AI estimate into a requirement, posts it, and gets proposals from partner contractors. A partner discovers requirements, unlocks one (simulated, no payment), submits a proposal, and if selected the homeowner gets a project linked to the partner's organization.

## Explicitly out of scope

- Real payments and billing (Phase 10). Unlock is simulated: no money moves, but the gate, visibility, and ledger are real.
- Backend and persistence (Phase 11). State stays in the in-memory mock.
- Secure proposal share links (FR-025), partner messaging, and contact disclosure rules.
- Partner profiles, verification, and reputation signals.
- Partner-side AI generation beyond the rate-card line items described below.

## Global constraints

- `src/domain/*.ts` never imports from `src/mock/*`.
- Legacy-style files keep single quotes and no semicolons; new files use double quotes and no semicolons.
- Ambient background, the Hozie mascot, and existing CSS animations are preserved on every new screen.
- Homeowner screens reuse `HomeownerLayout`; partner screens reuse `CompanyLayout`. No new layout components.

## 1. Data model

Added to `src/domain/models.ts`:

```ts
export type RequirementStatus = "draft" | "posted" | "awarded" | "closed"
export type ProposalStatus = "submitted" | "selected" | "rejected"

export interface MarketplaceRequirement {
  id: EntityId
  estimateId: EntityId
  homeownerPersonId: EntityId
  projectName: string
  location: string
  builtUpAreaSqft: number
  constructionLevel: ConstructionLevel
  propertyType: string
  estimateTotalLow: number
  estimateTotalHigh: number
  status: RequirementStatus
  postedAt?: ISODateTime
  awardedProposalId?: EntityId
  createdAt: ISODateTime
}

export interface MarketplaceUnlock {
  id: EntityId
  requirementId: EntityId
  partnerOrganizationId: EntityId
  unlockedAt: ISODateTime
}

export interface Proposal {
  id: EntityId
  requirementId: EntityId
  partnerOrganizationId: EntityId
  lines: EstimateLine[]
  total: number
  assumptions: string[]
  exclusions: string[]
  status: ProposalStatus
  submittedAt: ISODateTime
}
```

`ConstructionDataState` gains `requirements`, `unlocks`, `proposals`, and `projects` already exists.

**Visibility rule.** A partner organization's view of a requirement is either a preview (`location` at city level, `propertyType`, an area band, and the estimate range) or full (exact `builtUpAreaSqft`, `projectName`, line items). Full view requires a `MarketplaceUnlock` for that partner and requirement. The domain has a `viewRequirement(state, requirementId, partnerOrganizationId)` selector that returns only what the caller may see.

**Selection creates a project.** Selecting a proposal creates a `Project` under the partner's organization, with the homeowner recorded as the customer (through the existing customer membership used by the Phase 7 customer view). The requirement moves to `awarded` and the other proposals to `rejected`.

## 2. Commands

New file `src/domain/marketplaceCommands.ts`:

- `postRequirement(estimateId)` — homeowner only. The estimate must be owned by the caller and `reviewStatus === "confirmed"`. Creates a `MarketplaceRequirement` with status `posted`, copying the estimate's fields and total range. Refuses a second requirement from the same confirmed estimate.
- `unlockRequirement(requirementId, partnerOrganizationId)` — business accounts whose organization is a contractor or builder. Requirement must be `posted`. Refuses if already unlocked by that organization. Appends a `MarketplaceUnlock`.
- `submitProposal(requirementId, partnerOrganizationId, input)` — requires an unlock. Input is `{ assumptions: string[], exclusions: string[] }`. Lines are generated from the rate card for the requirement's construction level and area, reusing the rate-card generation from `estimateCommands.ts` (extracted into a shared helper, so the rate card lives in one place). Refuses a second proposal from the same organization.
- `selectProposal(proposalId)` — homeowner who owns the requirement. Requirement must be `posted`. Marks the proposal `selected`, rejects the rest, sets the requirement to `awarded`, and creates the project.

Every command refuses with `ConflictError` and a plain message, as the estimate commands do.

## 3. Screens

Routes are added to `src/domain/navigation.ts`:

- `marketplace-post` (homeowner, `estimate_id`) — preview of what partners will see, then a Post button.
- `marketplace-responses` (homeowner, `requirement_id`) — proposal list with amount, partner name, and status. Selecting a proposal from this list opens its detail and a Select button, both on this route with `proposal_id` in the URL.
- `marketplace-opportunities` (business, partner organization) — posted requirements as preview cards, with a location filter. Unlocked requirements are marked.
- `marketplace-requirement` (business, `requirement_id`) — preview and Unlock before unlocking; full scope and a proposal builder after. Submit posts the proposal.

The partner sidebar gets one new entry, Opportunities, in `companyNav`.

Each screen gets a Hozie insight card with factual copy only, following the Phase 8 rule. Homeowner screens use `HomeownerLayout`; partner screens use `CompanyLayout`.

## 4. Error handling

- Refused commands show the `ConflictError` message through `useCommand`'s toast.
- Unknown requirement, proposal, or estimate ids show the standard `Empty` state with a recovery button.
- A partner opening a requirement it hasn't unlocked sees only the preview, never a not-found error.

## 5. Testing

- Domain tests (Vitest): posting only confirmed estimates; no second requirement per estimate; unlock requires `posted`; single unlock per organization; preview vs full visibility; proposal requires unlock; single proposal per organization; selection rejects others, awards the requirement once, and creates exactly one project linked to the homeowner.
- Visibility is tested as a domain property: `viewRequirement` for a non-unlocked organization never includes `builtUpAreaSqft`, `projectName`, or line items.
- Browser walkthrough: post → unlock as a partner → submit proposal → select as homeowner → confirm the project appears in the homeowner's customer view.

## 6. Build-plan alignment

- Marketplace identity and project execution stay separate: a partner is a marketplace participant until selection, and only then gets project access.
- The rate card is shared with Phase 8, so a partner's proposal uses the same placeholder prices. Real partner pricing is future work.
