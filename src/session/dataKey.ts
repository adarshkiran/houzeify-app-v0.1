import type { Session } from "../domain/session"

/**
 * Identifies whose data a state load belongs to. Two sessions with the same key
 * read the same data, so a token refresh (a new session object for the same
 * person) must not look like a different session and send the app back to its
 * loading screen.
 */
export function sessionDataKey(session: Session | null): string {
  if (!session) return "none"
  return [session.accountType, session.personId, session.organizationId ?? ""].join("|")
}
