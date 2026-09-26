import type { EntityId, ProjectMembership } from "./models"
import { isPermission, type Permission } from "./permissions"

export type AccountType = "homeowner" | "business"

export interface Session {
  accountType: AccountType
  personId: EntityId
  /** Set for business accounts; homeowners have no organization. */
  organizationId?: EntityId
  phone?: string
}

/**
 * Validate a persisted session. Anything malformed or incomplete is treated
 * as signed out; a business session must name its organization.
 */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Session> | null
    if (!parsed || typeof parsed.personId !== "string") return null
    if (parsed.accountType === "homeowner") return parsed as Session
    if (
      parsed.accountType === "business" &&
      typeof parsed.organizationId === "string"
    ) {
      return parsed as Session
    }
  } catch {
    // Corrupt JSON: behave as signed out.
  }
  return null
}

/** Permissions the session's person holds on one project via active memberships. */
export function projectPermissions(
  session: Session | null,
  memberships: readonly ProjectMembership[],
  projectId: EntityId,
): Permission[] {
  if (!session) return []
  const granted = new Set<Permission>()
  for (const membership of memberships) {
    if (
      membership.projectId !== projectId ||
      membership.status !== "active" ||
      membership.principalType !== "person" ||
      membership.principalId !== session.personId
    ) {
      continue
    }
    for (const permission of membership.permissions) {
      if (isPermission(permission)) granted.add(permission)
    }
  }
  return [...granted]
}

export function canOnProject(
  session: Session | null,
  memberships: readonly ProjectMembership[],
  projectId: EntityId,
  permission: Permission,
): boolean {
  return projectPermissions(session, memberships, projectId).includes(permission)
}

/** Ids of projects on which the session holds `permission`. */
export function projectIdsWithPermission(
  session: Session | null,
  memberships: readonly ProjectMembership[],
  permission: Permission,
): Set<EntityId> {
  const ids = new Set<EntityId>()
  for (const membership of memberships) {
    if (
      !ids.has(membership.projectId) &&
      canOnProject(session, memberships, membership.projectId, permission)
    ) {
      ids.add(membership.projectId)
    }
  }
  return ids
}

export class PermissionError extends Error {
  constructor(
    public readonly permission: Permission,
    public readonly projectId?: EntityId,
  ) {
    super(
      projectId
        ? `Missing permission "${permission}" on project ${projectId}`
        : `Missing permission "${permission}"`,
    )
    this.name = "PermissionError"
  }
}
