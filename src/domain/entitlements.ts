import type { ConstructionDataState, CreditWallet, EntitlementKey, EntityId, Plan } from "./models"

/** The plan of the organization's active subscription, or undefined when there is none. */
export function getActivePlan(state: ConstructionDataState, organizationId: EntityId): Plan | undefined {
  const subscription = state.subscriptions.find((s) => s.organizationId === organizationId && s.status === "active")
  if (!subscription) return undefined
  return state.plans.find((p) => p.id === subscription.planId)
}

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
