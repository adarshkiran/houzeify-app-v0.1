import { useMemo } from "react"
import type { ConstructionDataState, EntityId } from "../domain/models"
import type { Permission } from "../domain/permissions"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useAccess, useActableUnits } from "./useCan"

/**
 * The state with its stage/work-type library narrowed to what the person can
 * act on: a work type is kept if some unit they can act on also covers its
 * stage and trade. Feed it to the stage → trade → work-type pickers.
 */
export function useScopedLibrary(
  permission: Permission | readonly Permission[],
  projectId: EntityId | undefined,
): ConstructionDataState {
  const { state } = useConstructionData()
  const can = useAccess()
  const units = useActableUnits(permission, projectId)
  return useMemo(() => {
    if (!projectId) return { ...state, workTypes: [], stages: [] }
    const workTypes = state.workTypes.filter((workType) =>
      units.some((unit) =>
        can(permission, projectId, {
          projectUnitId: unit.id,
          stageId: workType.stageId,
          tradeId: workType.tradeId,
        }),
      ),
    )
    const stageIds = new Set(workTypes.map((workType) => workType.stageId))
    return {
      ...state,
      workTypes,
      stages: state.stages.filter((stage) => stageIds.has(stage.id)),
    }
  }, [state, can, units, permission, projectId])
}
