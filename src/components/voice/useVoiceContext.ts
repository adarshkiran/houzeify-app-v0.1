import { useMemo } from "react"
import type { EntityId } from "../../domain/models"
import type { VoiceContext } from "../../domain/voice/types"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { localToday } from "../../mock/dayStory"
import { getProjectUnits, getWorkersForProject } from "../../mock/selectors"

const DONE = new Set(["completed", "approved", "cancelled"])

/** What the voice extractor may match against for one project. */
export function useVoiceContext(projectId: EntityId, currentTaskId?: EntityId): VoiceContext {
  const { state } = useConstructionData()
  return useMemo(
    () => ({
      today: localToday(),
      units: getProjectUnits(state, projectId),
      workTypes: state.workTypes,
      people: getWorkersForProject(state, projectId).map((w) => ({ id: w.id, name: w.name })),
      tasks: state.tasks.filter((t) => t.projectId === projectId && !DONE.has(t.status)),
      currentTaskId,
    }),
    [state, projectId, currentTaskId],
  )
}
