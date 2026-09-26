import type {
  EntityId,
  PermissionScope,
  ProjectMembership,
  ProjectUnit,
} from "./models"
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

/**
 * What an operation touches. Omitted fields mean "not specific to one": a
 * target with no `projectUnitId` is a whole-project operation, which a
 * unit-scoped membership must not perform.
 */
export interface ScopeTarget {
  projectUnitId?: EntityId
  stageId?: EntityId
  tradeId?: EntityId
}

/** True if `unitId`, or any ancestor of it, is one of `scopeUnitIds`. */
function unitInScope(
  unitId: EntityId,
  scopeUnitIds: readonly EntityId[],
  units: readonly ProjectUnit[],
): boolean {
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const seen = new Set<EntityId>()
  let current: EntityId | undefined = unitId
  while (current && !seen.has(current)) {
    if (scopeUnitIds.includes(current)) return true
    seen.add(current)
    current = byId.get(current)?.parentUnitId
  }
  return false
}

/**
 * Whether a membership's scope covers a target. An empty list means
 * unrestricted on that dimension; a non-empty list requires the target to
 * name a value inside it. All three dimensions must hold.
 */
export function scopeCovers(
  scope: PermissionScope,
  target: ScopeTarget,
  units: readonly ProjectUnit[],
): boolean {
  if (scope.projectUnitIds.length) {
    if (!target.projectUnitId) return false
    if (!unitInScope(target.projectUnitId, scope.projectUnitIds, units)) return false
  }
  if (scope.stageIds.length) {
    if (!target.stageId || !scope.stageIds.includes(target.stageId)) return false
  }
  if (scope.tradeIds.length) {
    if (!target.tradeId || !scope.tradeIds.includes(target.tradeId)) return false
  }
  return true
}

/**
 * The first active membership of the session's person that holds any of
 * `permissions` on the project AND whose scope covers `target`.
 */
export function authorizingMembership(
  session: Session | null,
  memberships: readonly ProjectMembership[],
  units: readonly ProjectUnit[],
  projectId: EntityId,
  permissions: readonly Permission[],
  target: ScopeTarget,
): ProjectMembership | undefined {
  if (!session) return undefined
  return memberships.find(
    (membership) =>
      membership.projectId === projectId &&
      membership.status === "active" &&
      membership.principalType === "person" &&
      membership.principalId === session.personId &&
      permissions.some((permission) => membership.permissions.includes(permission)) &&
      scopeCovers(membership.scope, target, units),
  )
}

/** Whether the person can act on `target` in this project (mirrors the commands). */
export function canAct(
  session: Session | null,
  memberships: readonly ProjectMembership[],
  units: readonly ProjectUnit[],
  projectId: EntityId,
  permissions: readonly Permission[],
  target: ScopeTarget,
): boolean {
  return (
    authorizingMembership(session, memberships, units, projectId, permissions, target) !==
    undefined
  )
}

/** The project's units the person can act on, for building pickers. */
export function actableUnits(
  session: Session | null,
  memberships: readonly ProjectMembership[],
  units: readonly ProjectUnit[],
  projectId: EntityId,
  permissions: readonly Permission[],
): ProjectUnit[] {
  return units.filter(
    (unit) =>
      unit.projectId === projectId &&
      canAct(session, memberships, units, projectId, permissions, {
        projectUnitId: unit.id,
      }),
  )
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
