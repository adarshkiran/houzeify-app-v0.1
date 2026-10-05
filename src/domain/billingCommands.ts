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
