/** A command was given ids that don't fit together (wrong project, wrong org, unknown). */
export class IntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IntegrityError"
  }
}
