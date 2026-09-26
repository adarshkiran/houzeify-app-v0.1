import type { ConstructionDataState } from "../domain/models"
import type {
  Clock,
  ConstructionRepository,
  IdGenerator,
} from "../domain/ports"
import { seedConstructionData } from "./seed"

export const systemClock: Clock = { now: () => new Date() }

export const uuidGenerator: IdGenerator = {
  next: (prefix) => `${prefix}-${crypto.randomUUID()}`,
  short: () => crypto.randomUUID().slice(0, 8),
}

/** Prototype storage: starts from the seed and lives only as long as the page. */
export function createInMemoryRepository(
  initial: ConstructionDataState = seedConstructionData,
): ConstructionRepository {
  let current = initial
  return {
    load: () => current,
    save: (state) => {
      current = state
    },
  }
}
