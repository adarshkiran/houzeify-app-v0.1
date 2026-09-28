import { useMemo } from "react"
import type { EntityId } from "../../domain/models"
import { ISSUE_REPORT_PERMISSIONS, Permissions, type Permission } from "../../domain/permissions"
import type { VoiceContext } from "../../domain/voice/types"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { localToday } from "../../mock/dayStory"
import { getWorkersForProject } from "../../mock/selectors"
import { useAccess, useActableUnits } from "../../session/useCan"
import { useScopedData } from "../../session/useScopedData"
import { useScopedLibrary } from "../../session/useScopedLibrary"

const DONE = new Set(["completed", "approved", "cancelled"])

/** What voice drafts lead to: creating tasks, reporting issues, logging progress. */
const VOICE_PERMISSIONS: readonly Permission[] = [Permissions.TASK_MANAGE, ...ISSUE_REPORT_PERMISSIONS]

/**
 * What the voice extractor may match against for one project — only the
 * locations, work types and tasks the signed-in person can act on, so a draft
 * never pre-fills something outside their scope.
 */
export function useVoiceContext(projectId: EntityId, currentTaskId?: EntityId): VoiceContext {
  const { state } = useConstructionData()
  const scoped = useScopedData()
  const can = useAccess()
  const units = useActableUnits(VOICE_PERMISSIONS, projectId || undefined)
  const library = useScopedLibrary(VOICE_PERMISSIONS, projectId || undefined)
  return useMemo(
    () => ({
      today: localToday(),
      units,
      workTypes: library.workTypes,
      people: getWorkersForProject(state, projectId).map((w) => ({ id: w.id, name: w.name })),
      tasks: scoped.tasks.filter(
        (t) => t.projectId === projectId && !DONE.has(t.status) && can(VOICE_PERMISSIONS, projectId, t),
      ),
      currentTaskId,
    }),
    [state, scoped.tasks, can, units, library.workTypes, projectId, currentTaskId],
  )
}
