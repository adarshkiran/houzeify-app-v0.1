import type { ConstructionDataState, EntityId, WorkerOnboarding } from "./models"
import type { CommandContext } from "./ports"

const JOIN_CODE_LENGTH = 6

/** The worker's open onboarding: the invited or accepted record, if any. */
export function openOnboardingFor(
  state: ConstructionDataState,
  workerId: EntityId,
): WorkerOnboarding | undefined {
  return state.workerOnboardings.find(
    (o) => o.workerId === workerId && (o.status === "invited" || o.status === "accepted"),
  )
}

/** A short code a worker enters to accept a QR join. */
export function generateJoinCode(ctx: CommandContext): string {
  return ctx.ids
    .short()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, JOIN_CODE_LENGTH)
    .padEnd(JOIN_CODE_LENGTH, "X")
}
