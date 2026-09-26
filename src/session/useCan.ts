import { useCallback } from "react"
import type { EntityId } from "../domain/models"
import type { Permission } from "../domain/permissions"
import { canOnProject } from "../domain/session"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useSession } from "./SessionProvider"

/** `can(permission, projectId)` for the signed-in person, for checks in loops. */
export function useAccess() {
  const { session } = useSession()
  const { state } = useConstructionData()
  return useCallback(
    (permission: Permission, projectId: EntityId) =>
      canOnProject(session, state.memberships, projectId, permission),
    [session, state.memberships],
  )
}

/** Whether the signed-in person holds `permission` on one project. */
export function useCan(
  permission: Permission,
  projectId: EntityId | undefined,
): boolean {
  const can = useAccess()
  return projectId ? can(permission, projectId) : false
}
