# Phase 9 — Homeowner Construction Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A homeowner posts a confirmed estimate as a requirement; a partner organization unlocks it (simulated), submits a proposal; the homeowner selects one, which creates a project under the partner's organization linked to the homeowner.

**Architecture:** New domain entities (`MarketplaceRequirement`, `MarketplaceUnlock`, `Proposal`) in `ConstructionDataState`. Commands in `src/domain/marketplaceCommands.ts`. Visibility enforced by a domain selector `viewRequirement`. The rate-card line generator moves out of `estimateCommands.ts` into `src/domain/rateCard.ts` so partner proposals use the same card.

**Tech Stack:** TypeScript, React 19, Ant Design 6, Vitest (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-04-phase-9-homeowner-marketplace-design.md`

## Global Constraints

- `src/domain/*.ts` never imports from `src/mock/*`.
- Domain files and new screens use double quotes, no semicolons. Legacy screens keep single quotes.
- Ambient background, Hozie insight card (factual copy only), and existing animations on every new screen.
- Homeowner screens use `HomeownerLayout`; partner screens use `CompanyLayout`.
- Simulated unlock: no payment code anywhere.
- Partner = business organization of kind `contractor` or `builder`.

---

### Task 1: Entities, state fields, and seed

**Files:**
- Modify: `src/domain/models.ts` (add types; extend `ConstructionDataState`)
- Modify: `src/mock/seed.ts` (add three empty arrays to `seedConstructionData`)

**Interfaces:**
- Produces: `RequirementStatus`, `ProposalStatus`, `MarketplaceRequirement`, `MarketplaceUnlock`, `Proposal` types exactly as in the spec §1; `ConstructionDataState.requirements`, `.unlocks`, `.proposals`.

- [ ] **Step 1: Add the types to `src/domain/models.ts`**

Add after the `Estimate` interface:

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

In `ConstructionDataState`, add after `callLogs: CallLog[]`:

```ts
  requirements: MarketplaceRequirement[]
  unlocks: MarketplaceUnlock[]
  proposals: Proposal[]
```

- [ ] **Step 2: Add empty arrays to the seed**

In `src/mock/seed.ts`, find the `seedConstructionData` object (it ends with `callLogs: []` or similar). Add:

```ts
  requirements: [],
  unlocks: [],
  proposals: [],
```

- [ ] **Step 3: Run typecheck and find fixtures that now need the arrays**

Run: `pnpm run typecheck`
Expected: errors only where a full `ConstructionDataState` literal is built without the new keys. For each reported file, add `requirements: [], unlocks: [], proposals: []` to that literal. Do not change any other behavior.

- [ ] **Step 4: Run tests**

Run: `pnpm run test`
Expected: all pass (count unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/domain/models.ts src/mock/seed.ts
git commit -m "feat: marketplace entities and state fields"
```
(Include any fixture files fixed in Step 3 in the same commit.)

---

### Task 2: Extract the rate card into `src/domain/rateCard.ts`

**Files:**
- Create: `src/domain/rateCard.ts`
- Modify: `src/domain/estimateCommands.ts` (import instead of inline definitions)

**Interfaces:**
- Produces: `buildCatalogLines(ctx: CommandContext, area: number, level: ConstructionLevel): EstimateLine[]` — returns the 7 lines (materials, labour, finishing, contingency) exactly as `estimateCommands.ts` builds them today. `CONTINGENCY_RATE` and the card constants move with it.

- [ ] **Step 1: Create `src/domain/rateCard.ts`**

Move these from `src/domain/estimateCommands.ts` into the new file, unchanged in value: `CATALOG_EFFECTIVE_DATE`, `CATALOG_SOURCE`, `CONTINGENCY_SOURCE`, `CONTINGENCY_RATE`, `RATE_CARD`, `QTY_PER_SQFT`, `catalogLine`, and `buildLines` (renamed to `buildCatalogLines`, exported). The file header:

```ts
import type { ConstructionLevel, EstimateLine, EstimateLineCategory } from "./models"
import type { CommandContext } from "./ports"
```

Export `buildCatalogLines` and keep `catalogLine` and the constants module-private.

- [ ] **Step 2: Update `estimateCommands.ts`**

Delete the moved definitions. Add `import { buildCatalogLines } from "./rateCard"` and replace `buildLines(ctx, input.builtUpAreaSqft, input.constructionLevel)` with `buildCatalogLines(ctx, input.builtUpAreaSqft, input.constructionLevel)`. Keep `RANGE_LOW`, `RANGE_HIGH`, `sumCategory`, and the governance logic where they are.

- [ ] **Step 3: Run checks**

Run: `pnpm run typecheck && pnpm run test`
Expected: all pass with the same count as before this task. The estimate tests are the regression check.

- [ ] **Step 4: Commit**

```bash
git add src/domain/rateCard.ts src/domain/estimateCommands.ts
git commit -m "refactor: extract rate card into rateCard.ts for marketplace reuse"
```

---

### Task 3: Requirement posting, unlock, and proposal commands

**Files:**
- Create: `src/domain/marketplaceCommands.ts`
- Create: `src/domain/marketplaceCommands.test.ts`

**Interfaces:**
- Consumes: `buildCatalogLines` (Task 2); `Estimate`, `MarketplaceRequirement`, `MarketplaceUnlock`, `Proposal`, `EntityId` from `./models`; `ConflictError` from `./errors`; `Command`, `CommandContext` from `./ports`.
- Produces: `postRequirement(estimateId)`, `unlockRequirement(requirementId, partnerOrganizationId)`, `submitProposal(requirementId, partnerOrganizationId, input)` — all `Command<...>`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/marketplaceCommands.test.ts`:

```ts
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
function confirmedState() {
  const generated = run(seed, homeowner, generateEstimate(input))
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
    const { state, estimateId } = confirmedState()
    const posted = run(state, homeowner, postRequirement(estimateId))
    return { state: posted.state, requirementId: posted.result.id }
  }

  it("records an unlock for a contractor organization", () => {
    const { state, requirementId } = postedState()
    const { state: after, result } = run(state, partner, unlockRequirement(requirementId, "org-buildright"))
    expect(result.requirementId).toBe(requirementId)
    expect(after.unlocks).toContainEqual(result)
  })

  it("refuses a second unlock by the same organization", () => {
    const { state, requirementId } = postedState()
    const once = run(state, partner, unlockRequirement(requirementId, "org-buildright"))
    expect(() => run(once.state, partner, unlockRequirement(requirementId, "org-buildright"))).toThrow(ConflictError)
  })

  it("refuses a caller acting for a different organization", () => {
    const { state, requirementId } = postedState()
    expect(() => run(state, partner, unlockRequirement(requirementId, "org-other"))).toThrow(ConflictError)
  })

  it("refuses a homeowner trying to unlock", () => {
    const { state, requirementId } = postedState()
    expect(() => run(state, homeowner, unlockRequirement(requirementId, "org-buildright"))).toThrow()
  })
})

describe("submitProposal", () => {
  function unlockedState() {
    const { state, estimateId } = confirmedState()
    const posted = run(state, homeowner, postRequirement(estimateId))
    const unlocked = run(posted.state, partner, unlockRequirement(posted.result.id, "org-buildright"))
    return { state: unlocked.state, requirementId: posted.result.id }
  }

  it("submits a proposal with rate-card lines and a total", () => {
    const { state, requirementId } = unlockedState()
    const { result } = run(state, partner, submitProposal(requirementId, "org-buildright", { assumptions: ["Soil test done"], exclusions: ["Landscaping"] }))
    expect(result.status).toBe("submitted")
    expect(result.lines).toHaveLength(7)
    expect(result.total).toBeCloseTo(result.lines.reduce((s, l) => s + l.amount, 0), 5)
    expect(result.assumptions).toEqual(["Soil test done"])
  })

  it("refuses a proposal without an unlock", () => {
    const { state, estimateId } = confirmedState()
    const posted = run(state, homeowner, postRequirement(estimateId))
    expect(() => run(posted.state, partner, submitProposal(posted.result.id, "org-buildright", { assumptions: [], exclusions: [] }))).toThrow(ConflictError)
  })

  it("refuses a second proposal from the same organization", () => {
    const { state, requirementId } = unlockedState()
    const once = run(state, partner, submitProposal(requirementId, "org-buildright", { assumptions: [], exclusions: [] }))
    expect(() => run(once.state, partner, submitProposal(requirementId, "org-buildright", { assumptions: [], exclusions: [] }))).toThrow(ConflictError)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm run test -- marketplaceCommands`
Expected: FAIL — `./marketplaceCommands` does not exist yet.

- [ ] **Step 3: Implement `src/domain/marketplaceCommands.ts`**

```ts
import { ConflictError } from "./errors"
import { buildCatalogLines } from "./rateCard"
import type { EntityId, MarketplaceRequirement, MarketplaceUnlock, Proposal } from "./models"
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
      throw new Error("Only homeowners can post a requirement.")
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
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `pnpm run test -- marketplaceCommands`
Expected: PASS, all new tests green. Then `pnpm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/marketplaceCommands.ts src/domain/marketplaceCommands.test.ts
git commit -m "feat: post, unlock, and propose marketplace commands"
```

---

### Task 4: Selection creates the project; visibility selector

**Files:**
- Modify: `src/domain/marketplaceCommands.ts` (add `selectProposal`)
- Create: `src/domain/marketplaceVisibility.ts` (`viewRequirement`)
- Modify: `src/domain/marketplaceCommands.test.ts` (add tests)

**Interfaces:**
- Consumes: `Project`, `ProjectMembership`, `Proposal`, `MarketplaceRequirement` from `./models`.
- Produces: `selectProposal(proposalId)` command; `viewRequirement(state, requirementId, partnerOrganizationId)` returning `{ kind: "preview", ... } | { kind: "full", ... } | undefined`.

- [ ] **Step 1: Add failing tests**

Append to `src/domain/marketplaceCommands.test.ts`:

```ts
import { selectProposal } from "./marketplaceCommands"
import { viewRequirement } from "./marketplaceVisibility"

function proposedState() {
  const { state, requirementId } = (() => {
    const { state: s, estimateId } = confirmedState()
    const posted = run(s, homeowner, postRequirement(estimateId))
    const unlocked = run(posted.state, partner, unlockRequirement(posted.result.id, "org-buildright"))
    return { state: unlocked.state, requirementId: posted.result.id }
  })()
  const proposed = run(state, partner, submitProposal(requirementId, "org-buildright", { assumptions: [], exclusions: [] }))
  return { state: proposed.state, requirementId, proposalId: proposed.result.id }
}

describe("selectProposal", () => {
  it("awards the requirement and creates one project linked to the homeowner", () => {
    const { state, requirementId, proposalId } = proposedState()
    const { state: after } = run(state, homeowner, selectProposal(proposalId))
    expect(after.requirements.find((r) => r.id === requirementId)?.status).toBe("awarded")
    expect(after.proposals.find((p) => p.id === proposalId)?.status).toBe("selected")
    const created = after.projects.filter((p) => p.organizationId === "org-buildright" && p.name === "My New Home")
    expect(created).toHaveLength(1)
    const link = after.memberships.find((m) => m.projectId === created[0].id && m.principalId === "person-demo-homeowner")
    expect(link?.role).toBe("homeowner")
  })

  it("rejects the other proposals on the same requirement", () => {
    const { state, requirementId, proposalId } = proposedState()
    const other = { ...state.proposals[0], id: "proposal-other", partnerOrganizationId: "org-other", status: "submitted" as const }
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
    const view = viewRequirement(state, requirementId, "org-buildright")
    expect(view?.kind).toBe("full")
    expect(view).toHaveProperty("builtUpAreaSqft", 2000)
  })
})
```

- [ ] **Step 2: Run to see failure**

Run: `pnpm run test -- marketplaceCommands`
Expected: FAIL — `selectProposal` and `viewRequirement` not exported.

- [ ] **Step 3: Implement `selectProposal`**

Append to `src/domain/marketplaceCommands.ts`. Add `Project`, `ProjectMembership` to the models import line.

```ts
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
```

If `ProjectMembership.scope` has fields beyond `projectUnitIds`, `stageIds`, `tradeIds`, the implementer must read `PermissionScope` in `models.ts` and add them with empty values.

- [ ] **Step 4: Implement `viewRequirement`**

Create `src/domain/marketplaceVisibility.ts`:

```ts
import type { ConstructionDataState, EntityId, EstimateLine, MarketplaceRequirement } from "./models"

export interface RequirementPreview {
  kind: "preview"
  id: EntityId
  location: string
  propertyType: string
  areaBand: string
  estimateTotalLow: number
  estimateTotalHigh: number
  status: MarketplaceRequirement["status"]
}

export interface RequirementFull extends Omit<RequirementPreview, "kind" | "areaBand"> {
  kind: "full"
  projectName: string
  builtUpAreaSqft: number
  constructionLevel: MarketplaceRequirement["constructionLevel"]
  lines: EstimateLine[]
}

/** Area shown to partners before unlock, rounded to a band so exact size is not revealed. */
function areaBand(area: number): string {
  const low = Math.floor(area / 500) * 500
  return `${low.toLocaleString("en-IN")}–${(low + 500).toLocaleString("en-IN")} sq ft`
}

/**
 * What an organization may see of a requirement: a preview by default, full
 * details only after that organization has unlocked it. Enforced here so the
 * UI cannot reveal what the domain withholds.
 */
export function viewRequirement(
  state: ConstructionDataState,
  requirementId: EntityId,
  partnerOrganizationId: EntityId,
): RequirementPreview | RequirementFull | undefined {
  const requirement = state.requirements.find((r) => r.id === requirementId)
  if (!requirement) return undefined
  const unlocked = state.unlocks.some(
    (u) => u.requirementId === requirementId && u.partnerOrganizationId === partnerOrganizationId,
  )
  const base = {
    id: requirement.id,
    location: requirement.location,
    propertyType: requirement.propertyType,
    estimateTotalLow: requirement.estimateTotalLow,
    estimateTotalHigh: requirement.estimateTotalHigh,
    status: requirement.status,
  }
  if (!unlocked) {
    return { kind: "preview", ...base, areaBand: areaBand(requirement.builtUpAreaSqft) }
  }
  const estimate = state.estimates.find((e) => e.id === requirement.estimateId)
  return {
    kind: "full",
    ...base,
    projectName: requirement.projectName,
    builtUpAreaSqft: requirement.builtUpAreaSqft,
    constructionLevel: requirement.constructionLevel,
    lines: estimate?.lines ?? [],
  }
}
```

- [ ] **Step 5: Run tests, then commit**

Run: `pnpm run test -- marketplaceCommands && pnpm run typecheck`
Expected: PASS.

```bash
git add src/domain/marketplaceCommands.ts src/domain/marketplaceCommands.test.ts src/domain/marketplaceVisibility.ts
git commit -m "feat: select proposal creates project; visibility-gated requirement view"
```

---

### Task 5: Provider wiring

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx` (context interface, value object, imports)

**Interfaces:**
- Consumes: `postRequirement`, `unlockRequirement`, `submitProposal`, `selectProposal` from `../domain/marketplaceCommands`; `viewRequirement` from `../domain/marketplaceVisibility`.
- Produces on context: `postRequirement(estimateId)`, `unlockRequirement(requirementId, partnerOrganizationId)`, `submitProposal(requirementId, partnerOrganizationId, input)`, `selectProposal(proposalId)`, `viewRequirement(requirementId, partnerOrganizationId)`.

- [ ] **Step 1: Add imports**

In `src/mock/ConstructionDataProvider.tsx`, next to `import * as estimateCommands from "../domain/estimateCommands"`, add:

```ts
import * as marketplaceCommands from "../domain/marketplaceCommands"
import { viewRequirement as selectViewRequirement } from "../domain/marketplaceVisibility"
import type { SubmitProposalInput } from "../domain/marketplaceCommands"
```

- [ ] **Step 2: Add to the context interface**

After `confirmEstimate: (estimateId: EntityId) => Estimate` add:

```ts
  postRequirement: (estimateId: EntityId) => MarketplaceRequirement
  unlockRequirement: (requirementId: EntityId, partnerOrganizationId: EntityId) => MarketplaceUnlock
  submitProposal: (requirementId: EntityId, partnerOrganizationId: EntityId, input: SubmitProposalInput) => Proposal
  selectProposal: (proposalId: EntityId) => Project
  viewRequirement: (requirementId: EntityId, partnerOrganizationId: EntityId) => ReturnType<typeof selectViewRequirement>
```

Add `MarketplaceRequirement`, `MarketplaceUnlock`, `Proposal` to the existing `models` type import in that file if not already present; `Project` is already imported.

- [ ] **Step 3: Wire the implementation**

After `confirmEstimate: (estimateId) => run(estimateCommands.confirmEstimate(estimateId)),` add:

```ts
      postRequirement: (estimateId) => run(marketplaceCommands.postRequirement(estimateId)),
      unlockRequirement: (requirementId, partnerOrganizationId) =>
        run(marketplaceCommands.unlockRequirement(requirementId, partnerOrganizationId)),
      submitProposal: (requirementId, partnerOrganizationId, input) =>
        run(marketplaceCommands.submitProposal(requirementId, partnerOrganizationId, input)),
      selectProposal: (proposalId) => run(marketplaceCommands.selectProposal(proposalId)),
      viewRequirement: (requirementId, partnerOrganizationId) =>
        selectViewRequirement(state, requirementId, partnerOrganizationId),
```

If the provider's `state` variable has a different name in scope, use the name the provider uses for the current state. Read the file first.

- [ ] **Step 4: Run checks and commit**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

```bash
git add src/mock/ConstructionDataProvider.tsx
git commit -m "feat: expose marketplace commands on ConstructionDataProvider"
```

---

### Task 6: Routes, partner nav entry, ambient variant

**Files:**
- Modify: `src/domain/navigation.ts` (four routes)
- Modify: `src/components/company/companyNav.tsx` (Opportunities entry)
- Modify: `src/components/homeowner/AmbientBg.tsx` (variant `"marketplace"`)

**Interfaces:**
- Produces: routes `marketplace-post` (HOMEOWNER), `marketplace-responses` (HOMEOWNER, requires `requirement_id`), `marketplace-opportunities` (BUSINESS), `marketplace-requirement` (BUSINESS, requires `requirement_id`); `AmbientBgVariant` gains `"marketplace"`.

- [ ] **Step 1: Routes**

In `src/domain/navigation.ts`, after `"boq": { access: HOMEOWNER },` add:

```ts
  "marketplace-post": { access: HOMEOWNER },
  "marketplace-responses": { access: HOMEOWNER, requires: ["requirement_id"] },
```

After `workforce: { access: BUSINESS },` add:

```ts
  "marketplace-opportunities": { access: BUSINESS },
  "marketplace-requirement": { access: BUSINESS, requires: ["requirement_id"] },
```

- [ ] **Step 2: Partner nav entry**

In `src/components/company/companyNav.tsx`, find the `COMPANY_NAV` array. Add an item after the Work Library entry, using the existing `NavItem` shape in that file (read the file for the exact field names: key, label, icon, `to`). Key `opportunities`, label `Opportunities`, icon `ShopOutlined` (import it from `@ant-design/icons`), `to: { screen: "marketplace-opportunities" }`.

- [ ] **Step 3: Ambient variant**

In `src/components/homeowner/AmbientBg.tsx`, add `"marketplace"` to the `AmbientBgVariant` union and a new `"marketplace"` entry in `VARIANTS` with three blob values distinct from the existing variants (copy the shape of the others; use a different `top`/`left` mix such as `top: -110, left: -140` and `bottom: -150, right: -120`).

- [ ] **Step 4: Run checks and commit**

Run: `pnpm run typecheck && pnpm run test`
Expected: PASS. If a navigation test enumerates routes with a fixed count, update the count in that test only.

```bash
git add src/domain/navigation.ts src/components/company/companyNav.tsx src/components/homeowner/AmbientBg.tsx
git commit -m "feat: marketplace routes, partner nav entry, ambient variant"
```

---

### Task 7: Homeowner screens — post and responses

**Files:**
- Create: `src/screens/MarketplacePostScreen.tsx`
- Create: `src/screens/MarketplaceResponsesScreen.tsx`
- Modify: `src/screens/EstimateDashboardScreen.tsx` (add "Post to marketplace" button, shown only when confirmed)
- Modify: `src/App.tsx` (two route blocks, two imports)

**Interfaces:**
- Consumes: `useConstructionData()` → `postRequirement`, `state`; `useCommand`; `HomeownerLayout`; `AmbientBg` variant `"marketplace"`; `formatRupees` from `EstimateTotalSummary`.
- `MarketplacePostScreen({ onNavigate, estimateId })`: shows the preview partners will see (location, property type, area band, estimate range; never the project name) and a Post button. On success navigates to `marketplace-responses` with `requirement_id`.
- `MarketplaceResponsesScreen({ onNavigate, requirementId })`: lists `state.proposals` for that requirement with partner org name, total, and status. Each row navigates to the same route with `proposal_id` to select.

- [ ] **Step 1: Create `MarketplacePostScreen.tsx`**

Model it on `BOQScreen.tsx` (double quotes, no semicolons, `HomeownerLayout` with both found and not-found branches, `AmbientBg variant="marketplace"`). Compute the area band with the same rule as `marketplaceVisibility.ts`. Show the preview card and a primary "Post requirement" button that calls `run(() => postRequirement(estimate.id), { success: "Requirement posted." })` and, on `outcome.ok`, navigates to `marketplace-responses` with `{ requirement_id: outcome.value.id }`. Add a Hozie insight card with factual copy only, e.g. "Partners see your location, property type, a size range, and your estimate range. Your exact project name and address stay private until a partner unlocks."

- [ ] **Step 2: Create `MarketplaceResponsesScreen.tsx`**

Model it on `BOQScreen.tsx`. Read the requirement from `state.requirements` by id and the proposals from `state.proposals` filtered by `requirementId`. Show a table with partner organization name (look up in `state.organizations`), total (`formatRupees`), and status. Each row is a button that navigates to `marketplace-responses` with `{ requirement_id, proposal_id }`. When `proposal_id` is present, show a selected-proposal panel with a Select button that calls `selectProposal`, then navigates to `customer-daily-update` with `{ project_id: outcome.value.id }`. Not-found and no-responses states use `Empty`.

- [ ] **Step 3: Add the entry point on the estimate dashboard**

In `src/screens/EstimateDashboardScreen.tsx`, next to the Confirm banner's action area, add a `Button` labelled "Post to marketplace" that is rendered only when `estimate.reviewStatus === "confirmed"`. Its `onClick` is `onNavigate("marketplace-post", { estimate_id: estimate.id })`. Keep the existing file style (single quotes, no semicolons).

- [ ] **Step 4: Wire routes in `App.tsx`**

Add the two imports next to the existing estimate screen imports, then add two route blocks after the `boq` block, following the same `<div style={{ ...slide }}>` pattern and passing `onNavigate={navigateTo}` plus `estimateId={params.estimate_id}` or `requirementId={params.requirement_id}` and, for responses, `proposalId={params.proposal_id}`.

- [ ] **Step 5: Run checks and commit**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

```bash
git add src/screens/MarketplacePostScreen.tsx src/screens/MarketplaceResponsesScreen.tsx src/screens/EstimateDashboardScreen.tsx src/App.tsx
git commit -m "feat: homeowner marketplace post and responses screens"
```

---

### Task 8: Partner screens — opportunities and requirement

**Files:**
- Create: `src/screens/MarketplaceOpportunitiesScreen.tsx`
- Create: `src/screens/MarketplaceRequirementScreen.tsx`
- Modify: `src/App.tsx` (two route blocks, two imports)

**Interfaces:**
- Consumes: `useConstructionData()` → `state`, `unlockRequirement`, `submitProposal`, `viewRequirement`; `useSession()` for the business organization id; `useCommand`; `CompanyLayout` for chrome.
- `MarketplaceOpportunitiesScreen({ onNavigate })`: lists `state.requirements` with status `posted`, each as a preview card via `viewRequirement(id, orgId)`, with a location text filter and an "Unlocked" tag when this organization has unlocked it. Each card navigates to `marketplace-requirement` with `{ requirement_id }`.
- `MarketplaceRequirementScreen({ onNavigate, requirementId })`: calls `viewRequirement`. If `kind === "preview"`, shows the preview and an Unlock button (`unlockRequirement`). If `kind === "full"`, shows the scope and line items, and a proposal builder: assumptions and exclusions as line-separated text areas, and a Submit button (`submitProposal`). Not-found shows `Empty`.

- [ ] **Step 1: Create `MarketplaceOpportunitiesScreen.tsx`**

Use `CompanyLayout` with `nav={{ menu: "company", active: "opportunities" }}` and `onNavigate`, following the pattern of an existing company screen (read `src/screens/WorkLibraryScreen.tsx` or `WorkforceScreen.tsx` for the exact props). Get the organization id with `session?.organizationId`. Filter with `useState` for the location text.

- [ ] **Step 2: Create `MarketplaceRequirementScreen.tsx`**

Follow the same `CompanyLayout` pattern. For the proposal builder, the assumptions and exclusions inputs are `Input.TextArea` split on newlines before calling `submitProposal`. On success show `message.success` via `useCommand` and stay on the page; the proposal then appears as submitted.

- [ ] **Step 3: Wire routes in `App.tsx`**

Add the two imports and two route blocks, using `CompanyLayout`-based screens inside the same slide wrapper pattern used by the existing company routes in `App.tsx`. Read the existing company route blocks first and match them.

- [ ] **Step 4: Run checks and commit**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

```bash
git add src/screens/MarketplaceOpportunitiesScreen.tsx src/screens/MarketplaceRequirementScreen.tsx src/App.tsx
git commit -m "feat: partner opportunities and requirement screens"
```

---

### Task 9: End-to-end walkthrough and spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-10-04-phase-9-homeowner-marketplace-design.md` (status line only)

- [ ] **Step 1: Full checks**

Run: `pnpm run typecheck && pnpm run test && pnpm run build` — all PASS.

- [ ] **Step 2: Browser walkthrough**

Dev server on localhost:5174. Set the homeowner session, generate and confirm an estimate, click "Post to marketplace", confirm the preview hides the project name and shows the area band, post, and confirm it lands on responses with no proposals yet. Then switch to the business session (`accountType: "business"`, `personId: "person-arjun"`, `organizationId: "org-buildright"`) and open Opportunities: the requirement appears as a preview. Unlock it, submit a proposal. Switch back to homeowner, open responses, select the proposal, and confirm navigation to the customer project view. Record the actual observed text for each step.

- [ ] **Step 3: Update spec status**

In the spec file, change `**Status:** Approved in brainstorming — pending final spec review` to `**Status:** Implemented`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-04-phase-9-homeowner-marketplace-design.md
git commit -m "docs: Phase 9 homeowner marketplace spec implemented"
```
