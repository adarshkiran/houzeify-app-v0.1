import { PermissionError } from "./session"

/** A command was given ids that don't fit together (wrong project, wrong org, unknown). */
export class IntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IntegrityError"
  }
}

/**
 * An integrity failure the user can act on (a duplicate, an invalid status
 * move). Unlike a bare IntegrityError its message is written for people.
 */
export class ConflictError extends IntegrityError {
  constructor(message: string) {
    super(message)
    this.name = "ConflictError"
  }
}

/**
 * User-facing text for a failed command. Typed failures get a fixed message
 * (their details name internal ids); other errors keep their own message.
 */
export function describeCommandError(error: unknown): string {
  if (error instanceof PermissionError) {
    return "You don't have permission to do that."
  }
  if (error instanceof ConflictError) return error.message
  if (error instanceof IntegrityError) {
    return "That change isn't valid for the selected project."
  }
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong. Please try again."
}
