# Phase 10 Billing & Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizations hold a plan that decides their entitlements. Partners spend a flat 10 credits to unlock a requirement, and every credit movement is recorded, all simulated in the in-memory mock.

**Architecture:** Plan, subscription, wallet, and credit transactions are plain data in `ConstructionDataState`. A pure `entitlements.ts` reads them, and `billingCommands.ts` owns the debit helper and simulated top-up. Existing marketplace commands call these as guards and debit inside the same state change, so an unlock is all-or-nothing. Screens read entitlements and balance through the provider; no screen compares plan names.

**Tech Stack:** TypeScript, React 19, Ant Design 6, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-phase-10-billing-entitlements-design.md`

## Global Constraints

- `src/domain/*.ts` never imports from `src/mock/*`.
- Legacy-style files keep single quotes and no semicolons; new files use double quotes and no semicolons.
- Refusals are `ConflictError` with a plain message.
- Unlock cost is a constant `UNLOCK_COST_CREDITS = 10`, defined once in `src/domain/billingCommands.ts`.
- Credit pack sizes are exactly 50, 150, and 500.
- Entitlement keys: `marketplace.unlock`, `marketplace.propose`, `team.members.unlimited`.
- Demo contractor `org-buildright` starts on Contractor Starter with a 30-credit balance.
- Ambient background and Hozie mascot are preserved on every new or changed screen. Each new screen gets a Hozie insight card with factual copy only.
- Partner screens reuse `CompanyLayout`. No new layout components.

## File Structure

- Modify `src/domain/models.ts`: add `PlanId`, `EntitlementKey`, `SubscriptionStatus`, `Plan`, `Subscription`, `CreditTransactionKind`, `CreditTransaction`, `CreditWallet`; add `plans`, `subscriptions`, `wallets`, `creditTransactions` to `ConstructionDataState`; add `creditTransactionId` to `MarketplaceUnlock`.
- Modify `src/mock/seed.ts`: seed the plan catalogue, the demo subscription and wallet, and the empty transaction list.
- Create `src/domain/entitlements.ts`: `getEntitlements`, `hasEntitlement`, `getWallet`.
- Create `src/domain/billingCommands.ts`: `UNLOCK_COST_CREDITS`, `CREDIT_PACKS`, `purchaseCredits`, `debitCredits`.
- Modify `src/domain/marketplaceCommands.ts`: `unlockRequirement` checks entitlement and debits; `submitProposal` checks `marketplace.propose`.
- Modify `src/mock/ConstructionDataProvider.tsx`: expose `purchaseCredits`.
- Modify `src/domain/navigation.ts`: add `billing` route (`BUSINESS`).
- Modify `src/components/company/companyNav.tsx`: add Billing entry.
- Create `src/screens/BillingScreen.tsx`: plan, entitlements, balance, top-up buttons, transaction list, Hozie card.
- Modify `src/App.tsx`: render `billing`.
- Modify `src/screens/MarketplaceRequirementScreen.tsx` and `src/screens/MarketplaceOpportunitiesScreen.tsx`: unlock cost and balance, disabled state, entitlement message.
- Tests: `src/domain/entitlements.test.ts`, `src/domain/billingCommands.test.ts`, `src/domain/marketplaceBilling.test.ts`, `src/mock/seed.test.ts` (new if missing; otherwise add to existing seed test file).

---

### Task 1: Billing data model and seed

**Files:**
- Modify: `src/domain/models.ts` (near the marketplace types, and in `ConstructionDataState`)
- Modify: `src/mock/seed.ts` (organizations section near line 1178, state literal near line 1443)
- Test: `src/mock/seed.test.ts` (create if absent)

**Interfaces:**
- Consumes: existing `EntityId`, `ISODateTime`, `ConstructionDataState`, `MarketplaceUnlock`.
- Produces: `Plan`, `Subscription`, `CreditTransaction`, `CreditWallet`, `EntitlementKey`, `CreditTransactionKind` types; seed exports nothing new beyond the state fields.

- [ ] **Step 1: Write the failing seed test**

Create `src/mock/seed.test.ts` (if it already exists, append the `describe` block):

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "./seed"

describe("billing seed", () => {
  it("seeds the two plans with the spec entitlements", () => {
    const starter = seed.plans.find((p) => p.name === "Contractor Starter")!
    const pro = seed.plans.find((p) => p.name === "Contractor Pro")!
    expect(starter.entitlements).toEqual(["marketplace.unlock", "marketplace.propose"])
    expect(pro.entitlements).toEqual(["marketplace.unlock", "marketplace.propose", "team.members.unlimited"])
  })

  it("puts the demo contractor on Starter with a 30-credit wallet", () => {
    const sub = seed.subscriptions.find((s) => s.organizationId === "org-buildright")!
    const starter = seed.plans.find((p) => p.name === "Contractor Starter")!
    expect(sub.planId).toBe(starter.id)
    expect(sub.status).toBe("active")
    expect(seed.wallets.find((w) => w.organizationId === "org-buildright")!.balance).toBe(30)
  })

  it("starts with no credit transactions", () => {
    expect(seed.creditTransactions).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/mock/seed.test.ts`
Expected: FAIL, `seed.plans` is undefined.

- [ ] **Step 3: Add the types to `src/domain/models.ts`**

Add after the `Proposal` interface:

```ts
export type PlanId = EntityId
export type EntitlementKey = "marketplace.unlock" | "marketplace.propose" | "team.members.unlimited"
export type SubscriptionStatus = "active" | "cancelled"
export type CreditTransactionKind = "grant" | "purchase" | "unlock"

export interface Plan {
  id: PlanId
  name: string
  priceLabel: string
  entitlements: EntitlementKey[]
  monthlyCredits: number
}

export interface Subscription {
  id: EntityId
  organizationId: EntityId
  planId: PlanId
  status: SubscriptionStatus
  startedAt: ISODateTime
}

export interface CreditTransaction {
  id: EntityId
  organizationId: EntityId
  kind: CreditTransactionKind
  /** Positive for grants and purchases, negative for unlocks. */
  amount: number
  balanceAfter: number
  requirementId?: EntityId
  createdAt: ISODateTime
}

export interface CreditWallet {
  organizationId: EntityId
  balance: number
}
```

In `MarketplaceUnlock`, add `creditTransactionId: EntityId`.

In `ConstructionDataState`, after `proposals: Proposal[]`, add:

```ts
  plans: Plan[]
  subscriptions: Subscription[]
  wallets: CreditWallet[]
  creditTransactions: CreditTransaction[]
```

- [ ] **Step 4: Seed the data in `src/mock/seed.ts`**

Above `export const seedConstructionData`, add:

```ts
const plans: Plan[] = [
  {
    id: "plan-contractor-starter",
    name: "Contractor Starter",
    priceLabel: "₹999 / month",
    entitlements: ["marketplace.unlock", "marketplace.propose"],
    monthlyCredits: 30,
  },
  {
    id: "plan-contractor-pro",
    name: "Contractor Pro",
    priceLabel: "₹2,499 / month",
    entitlements: ["marketplace.unlock", "marketplace.propose", "team.members.unlimited"],
    monthlyCredits: 100,
  },
]
```

In the state literal, add:

```ts
  plans,
  subscriptions: [
    {
      id: "subscription-buildright",
      organizationId: ACTIVE_ORGANIZATION_ID,
      planId: "plan-contractor-starter",
      status: "active",
      startedAt: "2026-01-10T09:00:00+05:30",
    },
  ],
  wallets: [{ organizationId: ACTIVE_ORGANIZATION_ID, balance: 30 }],
  creditTransactions: [],
```

Add `Plan`, `Subscription`, `CreditWallet` to the models import in `seed.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/mock/seed.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: errors only in test fixtures that build a full `ConstructionDataState` literal. Fix each by adding `plans: [], subscriptions: [], wallets: [], creditTransactions: []`. Grep to find them: `grep -rn "proposals: \[\]" src`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/models.ts src/mock/seed.ts src/mock/seed.test.ts
git commit -m "feat: add billing data model and demo plan, subscription, and wallet"
```

---

### Task 2: Entitlements and wallet reads

**Files:**
- Create: `src/domain/entitlements.ts`
- Test: `src/domain/entitlements.test.ts`

**Interfaces:**
- Consumes: `ConstructionDataState`, `EntitlementKey`, `CreditWallet`, `EntityId` from `./models`.
- Produces: `getEntitlements(state, organizationId): EntitlementKey[]`, `hasEntitlement(state, organizationId, key): boolean`, `getWallet(state, organizationId): CreditWallet`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import type { ConstructionDataState } from "./models"
import { getEntitlements, getWallet, hasEntitlement } from "./entitlements"

const ORG = "org-buildright"

describe("getEntitlements", () => {
  it("returns the active plan's entitlements", () => {
    expect(getEntitlements(seed, ORG)).toEqual(["marketplace.unlock", "marketplace.propose"])
  })

  it("returns none when the subscription is cancelled", () => {
    const state: ConstructionDataState = {
      ...seed,
      subscriptions: seed.subscriptions.map((s) => ({ ...s, status: "cancelled" as const })),
    }
    expect(getEntitlements(state, ORG)).toEqual([])
  })

  it("returns none for an organization without a subscription", () => {
    expect(getEntitlements(seed, "org-nobody")).toEqual([])
  })
})

describe("hasEntitlement", () => {
  it("is false for a key the plan does not include", () => {
    expect(hasEntitlement(seed, ORG, "team.members.unlimited")).toBe(false)
  })

  it("is true for a key the plan includes", () => {
    expect(hasEntitlement(seed, ORG, "marketplace.unlock")).toBe(true)
  })
})

describe("getWallet", () => {
  it("returns the wallet balance", () => {
    expect(getWallet(seed, ORG)).toEqual({ organizationId: ORG, balance: 30 })
  })

  it("returns a zero balance when there is no wallet", () => {
    expect(getWallet(seed, "org-nobody")).toEqual({ organizationId: "org-nobody", balance: 0 })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domain/entitlements.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/domain/entitlements.ts`**

```ts
import type { ConstructionDataState, CreditWallet, EntitlementKey, EntityId } from "./models"

/** The only place plan contents are read. Screens and commands call these, never plan names. */
export function getEntitlements(state: ConstructionDataState, organizationId: EntityId): EntitlementKey[] {
  const subscription = state.subscriptions.find((s) => s.organizationId === organizationId && s.status === "active")
  if (!subscription) return []
  const plan = state.plans.find((p) => p.id === subscription.planId)
  return plan ? [...plan.entitlements] : []
}

export function hasEntitlement(state: ConstructionDataState, organizationId: EntityId, key: EntitlementKey): boolean {
  return getEntitlements(state, organizationId).includes(key)
}

export function getWallet(state: ConstructionDataState, organizationId: EntityId): CreditWallet {
  return state.wallets.find((w) => w.organizationId === organizationId) ?? { organizationId, balance: 0 }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/entitlements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entitlements.ts src/domain/entitlements.test.ts
git commit -m "feat: read plan entitlements and credit wallet from one source"
```

---

### Task 3: Credit commands (purchase and debit)

**Files:**
- Create: `src/domain/billingCommands.ts`
- Test: `src/domain/billingCommands.test.ts`

**Interfaces:**
- Consumes: `ConstructionDataState`, `CreditTransaction`, `CreditWallet`, `EntityId` from `./models`; `ConflictError` from `./errors`; `Command`, `CommandContext` from `./ports`; `getWallet` from `./entitlements`.
- Produces: `UNLOCK_COST_CREDITS = 10`, `CREDIT_PACKS = [50, 150, 500] as const`, `purchaseCredits(organizationId: EntityId, credits: number): Command<CreditWallet>`, `debitCredits(state, ctx, organizationId, amount, kind, requirementId?): { state, transaction: CreditTransaction }` (plain helper, not a command).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import { CREDIT_PACKS, UNLOCK_COST_CREDITS, debitCredits, purchaseCredits } from "./billingCommands"
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
    expect(state.creditTransactions).toHaveLength(1)
    expect(state.creditTransactions[0]).toMatchObject({ kind: "purchase", amount: 50, balanceAfter: 80, organizationId: ORG })
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domain/billingCommands.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/domain/billingCommands.ts`**

```ts
import { getWallet } from "./entitlements"
import { ConflictError } from "./errors"
import type { ConstructionDataState, CreditTransaction, CreditTransactionKind, CreditWallet, EntityId } from "./models"
import type { Command, CommandContext } from "./ports"

export const UNLOCK_COST_CREDITS = 10
export const CREDIT_PACKS = [50, 150, 500] as const

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

/** Simulated top-up: no money moves. Business accounts for that organization only. */
export const purchaseCredits =
  (organizationId: EntityId, credits: number): Command<CreditWallet> =>
  (state, ctx) => {
    if (ctx.actor?.accountType !== "business" || ctx.actor.organizationId !== organizationId) {
      throw new ConflictError("Only this organization's team can buy credits.")
    }
    if (!(CREDIT_PACKS as readonly number[]).includes(credits)) {
      throw new ConflictError("Choose a 50, 150, or 500 credit pack.")
    }
    const { state: next, transaction } = applyCredits(state, ctx, organizationId, credits, "purchase")
    return { state: next, result: getWallet(next, transaction.organizationId) }
  }

/**
 * Internal helper used by other commands inside the same state change.
 * Refuses when the balance is short. Amount is positive; the sign is applied here.
 */
export function debitCredits(
  state: ConstructionDataState,
  ctx: CommandContext,
  organizationId: EntityId,
  amount: number,
  kind: CreditTransactionKind,
  requirementId?: EntityId,
): { state: ConstructionDataState; transaction: CreditTransaction } {
  const balance = getWallet(state, organizationId).balance
  if (balance < amount) {
    throw new ConflictError(`You need ${amount} credits. You have ${balance}.`)
  }
  return applyCredits(state, ctx, organizationId, -amount, kind, requirementId)
}

function applyCredits(
  state: ConstructionDataState,
  ctx: CommandContext,
  organizationId: EntityId,
  delta: number,
  kind: CreditTransactionKind,
  requirementId?: EntityId,
): { state: ConstructionDataState; transaction: CreditTransaction } {
  const balanceAfter = getWallet(state, organizationId).balance + delta
  const transaction: CreditTransaction = {
    id: ctx.ids.next("credit"),
    organizationId,
    kind,
    amount: delta,
    balanceAfter,
    requirementId,
    createdAt: iso(ctx),
  }
  const hasWallet = state.wallets.some((w) => w.organizationId === organizationId)
  const wallets = hasWallet
    ? state.wallets.map((w) => (w.organizationId === organizationId ? { ...w, balance: balanceAfter } : w))
    : [...state.wallets, { organizationId, balance: balanceAfter }]
  return {
    state: { ...state, wallets, creditTransactions: [...state.creditTransactions, transaction] },
    transaction,
  }
}
```

Note: `CreditTransaction` gets a `requirementId` that may be `undefined`. The model field is optional, so this type-checks.

Also add `CreditTransaction` import is already present. `CreditTransactionKind` must be exported from models (done in Task 1).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/billingCommands.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/billingCommands.ts src/domain/billingCommands.test.ts
git commit -m "feat: add simulated credit purchase and guarded debit"
```

---

### Task 4: Gate unlocks and proposals on entitlements and credits

**Files:**
- Modify: `src/domain/marketplaceCommands.ts` (`unlockRequirement` lines 60-83, `submitProposal` lines 86-115)
- Test: `src/domain/marketplaceBilling.test.ts`

**Interfaces:**
- Consumes: `hasEntitlement` from `./entitlements`; `debitCredits`, `UNLOCK_COST_CREDITS` from `./billingCommands`.
- Produces: `unlockRequirement` debits 10 credits and sets `creditTransactionId` on the unlock. Unchanged signature.

- [ ] **Step 1: Write the failing test**

Create `src/domain/marketplaceBilling.test.ts`. It needs a posted requirement. Build one through the existing commands:

```ts
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
    expect(next.result.creditTransactionId).toBe(next.state.creditTransactions[0].id)
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
    expect(nine.creditTransactions).toHaveLength(0)
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domain/marketplaceBilling.test.ts`
Expected: FAIL, the debit and entitlement assertions do not hold yet.

- [ ] **Step 3: Update `unlockRequirement` in `src/domain/marketplaceCommands.ts`**

Add imports:

```ts
import { hasEntitlement } from "./entitlements"
import { UNLOCK_COST_CREDITS, debitCredits } from "./billingCommands"
```

Replace the `unlockRequirement` body after the existing checks (after the "already unlocked" check) with:

```ts
    if (!hasEntitlement(state, partnerOrganizationId, "marketplace.unlock")) {
      throw new ConflictError("Your plan doesn't include marketplace unlocks. Upgrade to Contractor Starter.")
    }
    const debit = debitCredits(state, ctx, partnerOrganizationId, UNLOCK_COST_CREDITS, "unlock", requirementId)
    const unlock: MarketplaceUnlock = {
      id: ctx.ids.next("unlock"),
      requirementId,
      partnerOrganizationId,
      unlockedAt: iso(ctx),
      creditTransactionId: debit.transaction.id,
    }
    return { state: { ...debit.state, unlocks: [...debit.state.unlocks, unlock] }, result: unlock }
```

Put the entitlement check before the debit, as shown, so a missing plan refuses before any credits are touched. The ordering matches the spec: entitlement, then the existing rules, then the debit.

- [ ] **Step 4: Update `submitProposal`**

After the `requireBusinessFor` and `ctx.actor` checks, add:

```ts
    if (!hasEntitlement(state, partnerOrganizationId, "marketplace.propose")) {
      throw new ConflictError("Your plan doesn't include submitting proposals. Upgrade to Contractor Starter.")
    }
```

- [ ] **Step 5: Fix existing marketplace tests**

Run: `npx vitest run`

Existing tests that unlock with the seed still pass because the seed balance is 30. Any test that builds a fixture organization (for example `org-contractor`) needs its own subscription and wallet. Add `subscriptions` and `wallets` entries for that org in the fixture, pointing to `plan-contractor-starter`, with balance 30. Repeat until the suite is green.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/domain/marketplaceBilling.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/domain/marketplaceCommands.ts src/domain/marketplaceBilling.test.ts
git add -u src
git commit -m "feat: charge 10 credits per unlock and gate unlocks and proposals on plan"
```

---

### Task 5: Ledger invariant test

**Files:**
- Test: `src/domain/billingInvariant.test.ts`

**Interfaces:**
- Consumes: `purchaseCredits` (Task 3), `unlockRequirement` and `postRequirement` (Task 4), `getWallet` (Task 2).
- Produces: none (test only).

- [ ] **Step 1: Write the test**

```ts
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
    let state: ConstructionDataState = seed
    state = purchaseCredits(ORG, 50)(state, as(business)).state
    expect(getWallet(state, ORG).balance).toBe(30 + sumTransactions(state, ORG))

    const gen = generateEstimate({
      projectName: "A", propertyType: "House", location: "Hyderabad, Telangana",
      builtUpAreaSqft: 1200, floors: 1, constructionLevel: "basic",
    })(state, as(homeowner))
    state = gen.state
    state = confirmEstimate(gen.result.id)(state, as(homeowner)).state
    const post = postRequirement(gen.result.id)(state, as(homeowner))
    state = post.state

    state = unlockRequirement(post.result.id, ORG)(state, as(business)).state
    expect(getWallet(state, ORG).balance).toBe(30 + 50 - 10)
    expect(getWallet(state, ORG).balance).toBe(30 + sumTransactions(state, ORG))
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/domain/billingInvariant.test.ts`
Expected: PASS (the behavior exists after Tasks 3 and 4).

- [ ] **Step 3: Commit**

```bash
git add src/domain/billingInvariant.test.ts
git commit -m "test: wallet balance matches its transaction ledger"
```

---

### Task 6: Provider and Billing screen

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx` (add `purchaseCredits` to the context, following the `run` pattern used by `unlockRequirement`)
- Modify: `src/domain/navigation.ts` (add `billing: { access: BUSINESS }` to `routes`)
- Modify: `src/components/company/companyNav.tsx` (add Billing entry after Opportunities, using an existing icon from `@ant-design/icons`, such as `WalletOutlined`)
- Create: `src/screens/BillingScreen.tsx`
- Modify: `src/App.tsx` (add a `screen === "billing"` block that mirrors the `marketplace-opportunities` block)

**Interfaces:**
- Consumes: `getEntitlements`, `getWallet` (Task 2); `purchaseCredits` (Task 3); `useCommand` from `src/session/useCommand.ts`; `CompanyLayout`; `AmbientBg`; the Hozie card pattern used on `MarketplaceOpportunitiesScreen`.
- Produces: a `billing` route rendering `BillingScreen`.

- [ ] **Step 1: Read the reference screens before writing**

Read `src/screens/MarketplaceOpportunitiesScreen.tsx` and `src/components/company/companyNav.tsx`. Copy their layout, Hozie card, and nav structure exactly. The new screen must match them.

- [ ] **Step 2: Add the provider command**

In `ConstructionDataProvider.tsx`, add `purchaseCredits: (credits: number) => Promise<...>` (or the same shape as the other `run`-based commands) that calls `purchaseCredits(ACTIVE_ORGANIZATION_ID, credits)` for the current session's organization. Follow the exact shape of the existing `unlockRequirement` wiring.

- [ ] **Step 3: Add the route and nav entry**

`navigation.ts`: inside `routes`, add `billing: { access: BUSINESS },` next to the other business routes.

`companyNav.tsx`: add `{ key: "billing", label: "Billing", icon: WalletOutlined }` after the Opportunities entry, following the same object shape.

- [ ] **Step 4: Write `BillingScreen.tsx`**

The screen has four parts:
1. Plan card: the plan name and `priceLabel` from the subscription's plan, and a list of entitlements in plain words (for example, "Unlock marketplace requirements", "Submit proposals"). When there is no active subscription, show "No active plan".
2. Balance card: `getWallet(state, ACTIVE_ORGANIZATION_ID).balance` as "N credits", with a line "Each unlock uses 10 credits."
3. Top-up row: three buttons "Buy 50 credits", "Buy 150 credits", "Buy 500 credits", each calling `purchaseCredits` through `useCommand` with a success toast.
4. Transactions list: `creditTransactions` for the organization, newest first, showing kind, amount with sign, balance after, and date. Empty state: "No credit activity yet."

Include the Hozie insight card with factual copy only, for example "Your balance covers N unlocks at 10 credits each."

Use the ambient background and `CompanyLayout` active key `billing`.

- [ ] **Step 5: Wire the screen in `App.tsx`**

Add a block that renders `<BillingScreen />` under `screen === "billing"`, using the same `slide` wrapper as the other business screens.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run the dev server through the existing project process (port 5174). Open the Billing route as the business session, confirm the balance shows 30, click Buy 50 credits, confirm the balance shows 80 and the list shows one purchase row. Use `read_page` or `get_page_text` for the check, and take one screenshot for the summary.

- [ ] **Step 7: Commit**

```bash
git add src/mock/ConstructionDataProvider.tsx src/domain/navigation.ts src/components/company/companyNav.tsx src/screens/BillingScreen.tsx src/App.tsx
git commit -m "feat: add partner billing screen with plan, balance, and top-up"
```

---

### Task 7: Unlock cost and balance on partner screens

**Files:**
- Modify: `src/screens/MarketplaceRequirementScreen.tsx` (the Unlock button and its surrounding copy)
- Modify: `src/screens/MarketplaceOpportunitiesScreen.tsx` (the unlocked and locked markers, if they show an unlock action)

**Interfaces:**
- Consumes: `getWallet`, `hasEntitlement` (Task 2); `UNLOCK_COST_CREDITS` (Task 3); `routes` navigation `navigate("billing")`.
- Produces: none.

- [ ] **Step 1: Read the two screens**

Read both files in full before editing. Keep their existing patterns.

- [ ] **Step 2: Update the Unlock button**

In `MarketplaceRequirementScreen.tsx`, compute:

```ts
const wallet = getWallet(state, ACTIVE_ORGANIZATION_ID)
const canUnlockPlan = hasEntitlement(state, ACTIVE_ORGANIZATION_ID, "marketplace.unlock")
const canAfford = wallet.balance >= UNLOCK_COST_CREDITS
```

Then:
- Button label: `Unlock · ${UNLOCK_COST_CREDITS} credits`.
- When `!canUnlockPlan`: hide the button and show a line "Your plan doesn't include marketplace unlocks." with a button "View plan" that navigates to `billing`.
- When `canUnlockPlan && !canAfford`: disable the Unlock button and show "You need 10 credits. You have N." with a link button "Buy credits" that navigates to `billing`.
- Otherwise: enabled, as before.

Use `navigate` from the provider for the link.

- [ ] **Step 3: Update the Opportunities screen**

If it shows an unlock action, apply the same label. Otherwise leave it unchanged and say so in the commit message.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` and `npx vitest run`.
Expected: both green.

In the dev server: as the business account with 30 credits, open a posted requirement, confirm the button reads "Unlock · 10 credits" and is enabled. Unlock it and confirm the balance on Billing reads 20. Reach a state with under 10 credits (buy nothing; unlock two more requirements to drop to 10, then check the disabled state at under 10 is covered by the domain test). Take a screenshot for the summary.

- [ ] **Step 5: Commit**

```bash
git add src/screens/MarketplaceRequirementScreen.tsx src/screens/MarketplaceOpportunitiesScreen.tsx
git commit -m "feat: show unlock cost, balance, and plan gate on partner screens"
```

---

### Task 8: Final verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all tests pass. Report the count.

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both succeed.

- [ ] **Step 3: Scope check**

Run: `git diff --stat main..HEAD -- src docs`
Expected: only the files listed in File Structure, plus the spec and this plan. Confirm `.claude/` and `Houzeify_Master_Plan_v0_2_FINAL.md` are not staged.

- [ ] **Step 4: Report**

State the test count, typecheck and build results, and the browser checks from Tasks 6 and 7, with the screenshot.
