# Phase 10 — Pricing, Billing & SaaS Entitlements Design

**Status:** Approved in brainstorming — pending spec review

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §12 (Phase 10). Product rules from `Houzeify_Master_Plan_v0_2_FINAL.md` §13.2 (paid unlock principles), §22.4 (plan, credit, and unlock pricing), and the Billing entities in the data model section.

## Goal

Organizations hold a plan. The plan decides what features they can use. Partners spend credits to unlock marketplace requirements, and every credit movement is recorded. All of this runs in the in-memory mock with no real money. The UI reads permissions from one entitlement function, not from plan names.

## Explicitly out of scope

- Real payments, invoices, refunds, coupons, trials, and cancellations. Payments arrive with the backend (Phase 11).
- Homeowner AI plans and per-estimate purchases (AI Estimate, AI Plus, AI Pro). Estimates stay free in the prototype.
- Storage add-ons and advanced module add-ons.
- Developer and enterprise pricing, and tiered unlock costs by opportunity size. The master plan's ₹ ranges are not modeled.
- Negotiated or custom plans.

## Global constraints

- `src/domain/*.ts` never imports from `src/mock/*`.
- Legacy-style files keep single quotes and no semicolons; new files use double quotes and no semicolons.
- Ambient background and the Hozie mascot are preserved on every new or changed screen. Each new screen gets a Hozie insight card with factual copy only.
- Partner screens reuse `CompanyLayout`. No new layout components.
- Amounts are integer credits. No currency is shown in the prototype UI except where the plan price is displayed as a label.

## 1. Data model

Added to `src/domain/models.ts`:

```ts
export type PlanId = EntityId
export type EntitlementKey = "marketplace.unlock" | "marketplace.propose" | "team.members.unlimited"
export type SubscriptionStatus = "active" | "cancelled"

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

export type CreditTransactionKind = "grant" | "purchase" | "unlock"

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

`ConstructionDataState` gains `plans`, `subscriptions`, `wallets`, and `creditTransactions`. `MarketplaceUnlock` gains `creditTransactionId`, so every unlock links to the debit that paid for it.

**Rule.** The wallet balance is the sum of its transactions. Commands update the balance and append the transaction in one state change, so the two never drift.

**Plan catalogue (prototype values, seeded as data):**

| Plan | Price label | Entitlements | Monthly credits |
|---|---|---|---|
| Contractor Starter | ₹999 / month | `marketplace.unlock`, `marketplace.propose` | 30 |
| Contractor Pro | ₹2,499 / month | `marketplace.unlock`, `marketplace.propose`, `team.members.unlimited` | 100 |

`team.members.unlimited` is defined now but gates nothing in this phase. It proves the key mechanism without adding a new screen. Monthly credits are shown as plan content. They are not granted automatically in the prototype. Credits come from the starting balance or a simulated purchase.

## 2. Entitlements

New file `src/domain/entitlements.ts`:

- `getEntitlements(state, organizationId): EntitlementKey[]` returns the entitlements of the organization's active subscription. It returns `[]` when there is no active subscription.
- `hasEntitlement(state, organizationId, key): boolean` is a thin wrapper over `getEntitlements`.
- `getWallet(state, organizationId): CreditWallet` returns the wallet. It returns balance 0 when the organization has no wallet.

Commands call `hasEntitlement` as a guard and throw `ConflictError` with a plain message if it fails, for example "Your plan doesn't include marketplace unlocks. Upgrade to Contractor Starter." Screens call the same functions through the provider to show or hide actions. Screens never compare `planId` or a plan name.

## 3. Commands

New file `src/domain/billingCommands.ts`:

- `purchaseCredits(organizationId, credits)` — simulated top-up. Business accounts for that organization only. Accepts the pack sizes 50, 150, and 500 (from master plan §22.4.5). Adds the credits to the wallet and appends a `purchase` transaction. No money moves.
- `debitCredits(state, organizationId, amount, reason)` — internal helper, not a screen command. Refuses with a plain message if the balance is less than `amount`. Writes the transaction and the new balance together.

Changes to `src/domain/marketplaceCommands.ts`:

- `unlockRequirement(requirementId, partnerOrganizationId)` now does four things in order:
  1. Checks `marketplace.unlock` through `hasEntitlement`.
  2. Checks the existing rules: partner kind, requirement is `posted`, no earlier unlock by this organization.
  3. Debits a flat **10 credits** through `debitCredits`, with `kind: "unlock"` and `requirementId`.
  4. Appends the `MarketplaceUnlock` with `creditTransactionId`.
- A failed check at any step refuses the whole command, so no partial debit is ever recorded.
- `submitProposal` checks `marketplace.propose` in addition to its existing unlock requirement.

Every refusal is a `ConflictError`. The 10-credit unlock cost is a constant in `billingCommands.ts` (`UNLOCK_COST_CREDITS = 10`), so the price can change in one place.

## 4. Seed data

In `src/mock/seed.ts`:

- The demo contractor `org-buildright` gets an active **Contractor Starter** subscription and a wallet with a **starting balance of 30 credits**, enough for three unlocks.
- A second demo contractor is not added. The partner flow has only one organization to test with.
- The homeowner has no subscription and no wallet. Homeowner billing is out of scope.

## 5. Screens

- **Partner billing page** (`billing`, business, new route, `CompanyLayout`, new nav entry "Billing" in `companyNav`). Shows the current plan and its entitlements, the credit balance, a Buy 50 / 150 / 500 credits row of simulated top-up buttons, and the recent transaction list (kind, amount, balance after, date). A Hozie card with factual copy only.
- **Opportunities and requirement screens** (Phase 9, changed). The Unlock button shows "Unlock · 10 credits" and the current balance. If the balance is too low, the button is disabled and a line below it reads "You need 10 credits. You have N." with a link to Billing. If the plan lacks `marketplace.unlock`, the button is replaced by a line pointing to the plan.
- **Insufficient credits.** A refused unlock shows the `ConflictError` message in the toast. The page does not hide the failure.

Route additions in `src/domain/navigation.ts`: `billing` with `BUSINESS` access.

## 6. Error handling

- Refused commands show the `ConflictError` message through `useCommand`'s toast, as in Phase 9.
- A missing wallet or subscription is read as no credits or no entitlements. It never throws.
- An unlock is all-or-nothing. A debit always goes with its unlock record, so a failed unlock never costs credits.

## 7. Testing

Domain tests (Vitest):

- `getEntitlements` returns the plan's entitlements for an active subscription and `[]` for a cancelled or missing one.
- `hasEntitlement` is false for a key the plan does not include.
- `purchaseCredits` adds the credits, appends a `purchase` transaction, and refuses a pack size that is not 50, 150, or 500.
- `debitCredits` refuses when the balance is short and leaves the wallet unchanged.
- `unlockRequirement` debits exactly 10 credits, links `creditTransactionId`, and leaves the balance unchanged on refusal.
- `unlockRequirement` refuses when the plan lacks `marketplace.unlock`, even if the balance is high.
- `unlockRequirement` refuses when the balance is 9 and succeeds at 10.
- `submitProposal` refuses when the plan lacks `marketplace.propose`.
- Invariant: for every wallet, `balance` equals the sum of its transaction amounts. Tested after a sequence of purchases and unlocks.

Browser walkthrough, one page session, partner role: check the balance, unlock a requirement, confirm the balance dropped by 10, buy 50 credits, confirm the transaction list updates.

## 8. Build-plan alignment

- The UI reads entitlements from one function (`getEntitlements`). No screen checks plan names. This is the build plan's required product rule.
- Credits are the only money-like value in the prototype. Real currency and invoices wait for Phase 11.
- Entitlement keys are data, so new plan features are added in one catalogue rather than in screens.
