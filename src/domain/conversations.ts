import type {
  ConstructionDataState,
  EntityId,
  ProjectMembership,
  ProjectRole,
  Thread,
  ThreadSubject,
} from "./models"
import { Permissions } from "./permissions"
import { scopeCovers, type ScopeTarget, type Session } from "./session"

/**
 * Conversation visibility (Phase 6A). A thread is readable when the person
 * holds an active membership on its project that passes the subject's rule;
 * the same membership is who they post as. Pure, like the read-scope rules.
 */

/** Company staff who may read the homeowner channel regardless of permissions. */
const HOMEOWNER_CHANNEL_ROLES: readonly ProjectRole[] = ["project-manager", "developer-admin"]

/** Direct-message pairs from the build plan (§21); order doesn't matter. */
const DIRECT_PAIRS: ReadonlyArray<readonly [ProjectRole, ProjectRole]> = [
  ["worker", "supervisor"],
  ["worker", "contractor"],
  ["worker", "project-manager"],
  ["contractor", "supervisor"],
  ["contractor", "project-manager"],
  ["contractor", "developer-admin"],
  ["project-manager", "supervisor"],
  ["project-manager", "developer-admin"],
  ["supervisor", "developer-admin"],
  ["project-manager", "project-manager"],
  ["supervisor", "supervisor"],
  ["developer-admin", "developer-admin"],
]

export function canMessageDirectly(a: ProjectRole, b: ProjectRole): boolean {
  return DIRECT_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export function findThread(
  state: ConstructionDataState,
  projectId: EntityId,
  subject: ThreadSubject,
  targetId?: EntityId,
): Thread | undefined {
  return state.threads.find(
    (thread) =>
      thread.projectId === projectId &&
      thread.subject === subject &&
      (thread.targetId ?? undefined) === (targetId ?? undefined),
  )
}

/** The unit / task / issue a context thread is about, as a scope target. */
function threadTarget(state: ConstructionDataState, thread: Thread): ScopeTarget | undefined {
  if (thread.subject === "unit") {
    const unit = state.projectUnits.find((u) => u.id === thread.targetId && u.projectId === thread.projectId)
    return unit ? { projectUnitId: unit.id } : undefined
  }
  if (thread.subject === "task") {
    return state.tasks.find((t) => t.id === thread.targetId && t.projectId === thread.projectId)
  }
  if (thread.subject === "issue") {
    return state.issues.find((i) => i.id === thread.targetId && i.projectId === thread.projectId)
  }
  return undefined
}

function membershipCanRead(
  state: ConstructionDataState,
  membership: ProjectMembership,
  thread: Thread,
): boolean {
  if (thread.subject === "homeowner") {
    return (
      membership.role === "homeowner" ||
      HOMEOWNER_CHANNEL_ROLES.includes(membership.role) ||
      membership.permissions.includes(Permissions.CUSTOMER_PUBLISH)
    )
  }
  if (thread.subject === "direct") {
    return thread.participantMembershipIds?.includes(membership.id) ?? false
  }
  if (membership.role === "homeowner") return false
  if (!membership.permissions.includes(Permissions.PROJECT_READ)) return false
  if (thread.subject === "project") return true
  const target = threadTarget(state, thread)
  return target ? scopeCovers(membership.scope, target, state.projectUnits) : false
}

/** The membership a person reads and posts in this thread with, if any. */
export function readerMembership(
  state: ConstructionDataState,
  session: Session | null,
  thread: Thread,
): ProjectMembership | undefined {
  if (!session) return undefined
  return state.memberships.find(
    (membership) =>
      membership.projectId === thread.projectId &&
      membership.status === "active" &&
      membership.principalType === "person" &&
      membership.principalId === session.personId &&
      membershipCanRead(state, membership, thread),
  )
}

export function canReadThread(
  state: ConstructionDataState,
  session: Session | null,
  thread: Thread,
): boolean {
  return readerMembership(state, session, thread) !== undefined
}

/** Messages by others newer than this member's last read. */
export function unreadCount(
  state: ConstructionDataState,
  thread: Thread,
  membershipId: EntityId,
): number {
  const lastReadAt = state.threadReads.find(
    (read) => read.threadId === thread.id && read.membershipId === membershipId,
  )?.lastReadAt
  return state.messages.filter(
    (message) =>
      message.threadId === thread.id &&
      message.authorMembershipId !== membershipId &&
      // Seed times use +05:30 and commands write UTC, so compare instants.
      (!lastReadAt || Date.parse(message.createdAt) > Date.parse(lastReadAt)),
  ).length
}
