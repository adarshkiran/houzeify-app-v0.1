import { useCallback, useMemo } from "react"
import type { EntityId, ProjectUnit } from "../domain/models"
import type { Permission } from "../domain/permissions"
import { actableUnits, canAct, type ScopeTarget } from "../domain/session"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useSession } from "./SessionProvider"

type Permissions = Permission | readonly Permission[]
const asList = (permissions: Permissions): readonly Permission[] =>
  Array.isArray(permissions) ? permissions : [permissions as Permission]

/**
 * `can(permission, projectId, target?)` for the signed-in person, using the
 * same scope rules as the commands. With no target it asks about the whole
 * project, which unit/stage/trade-scoped members are denied.
 */
export function useAccess() {
  const { session } = useSession()
  const { state } = useConstructionData()
  return useCallback(
    (permission: Permissions, projectId: EntityId, target: ScopeTarget = {}) =>
      canAct(
        session,
        state.memberships,
        state.projectUnits,
        projectId,
        asList(permission),
        target,
      ),
    [session, state.memberships, state.projectUnits],
  )
}

/** Whether the person holds `permission` for `target` (default: the whole project). */
export function useCan(
  permission: Permissions,
  projectId: EntityId | undefined,
  target: ScopeTarget = {},
): boolean {
  const can = useAccess()
  return projectId ? can(permission, projectId, target) : false
}

/** The project's units the person can act on with `permission`, for pickers. */
export function useActableUnits(
  permission: Permissions,
  projectId: EntityId | undefined,
): ProjectUnit[] {
  const { session } = useSession()
  const { state } = useConstructionData()
  return useMemo(
    () =>
      projectId
        ? actableUnits(
            session,
            state.memberships,
            state.projectUnits,
            projectId,
            asList(permission),
          )
        : [],
    [session, state.memberships, state.projectUnits, projectId, permission],
  )
}
