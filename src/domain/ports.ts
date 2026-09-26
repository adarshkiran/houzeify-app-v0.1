import type { ConstructionDataState } from "./models"
import type { Session } from "./session"

/** Source of "now". Injected so commands are deterministic under test. */
export interface Clock {
  now(): Date
}

/** Source of entity ids. Injected so commands are deterministic under test. */
export interface IdGenerator {
  /** A fresh id such as `task-<unique>`. */
  next(prefix: string): string
  /** A short unique suffix for slug fallbacks. */
  short(): string
}

/**
 * Where construction data lives. The prototype only has an in-memory
 * implementation, so this is synchronous; a real backend will need an async
 * variant (and loading states in the provider).
 */
export interface ConstructionRepository {
  load(): ConstructionDataState
  save(state: ConstructionDataState): void
}

/** Everything a command needs besides the current state and its input. */
export interface CommandContext {
  /** The signed-in session, or null when signed out. */
  actor: Session | null
  clock: Clock
  ids: IdGenerator
}

/** A command's outcome: the next state plus whatever the caller needs back. */
export interface CommandResult<T> {
  state: ConstructionDataState
  result: T
}

export type Command<T> = (
  state: ConstructionDataState,
  ctx: CommandContext,
) => CommandResult<T>
