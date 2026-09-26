import type {
  ConstructionDataState,
  EntityId,
  QuantityUnit,
  TaskTemplate,
  Trade,
  WorkType,
} from "./models"

/** Catalog version for construction library. */
export const WORK_LIBRARY_VERSION = "2026.09.3"

export const QUANTITY_UNITS: QuantityUnit[] = [
  "nos",
  "m",
  "m2",
  "m3",
  "kg",
  "tonne",
  "hour",
  "day",
  "percentage",
]

/** Short labels for unit selects (hour = machine/labour hire). */
export function quantityUnitLabel(unit: QuantityUnit): string {
  switch (unit) {
    case "hour":
      return "hour (hire)"
    case "day":
      return "day"
    case "percentage":
      return "%"
    case "nos":
      return "nos"
    default:
      return unit
  }
}

export function slugifyLibraryName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function getTradesForStage(
  state: ConstructionDataState,
  stageId?: EntityId,
): Trade[] {
  if (!stageId) return state.trades
  const tradeIds = new Set(
    state.workTypes
      .filter((workType) => workType.stageId === stageId)
      .map((workType) => workType.tradeId),
  )
  return state.trades.filter((trade) => tradeIds.has(trade.id))
}

export function getWorkTypesForStageTrade(
  state: ConstructionDataState,
  stageId?: EntityId,
  tradeId?: EntityId,
): WorkType[] {
  return state.workTypes.filter(
    (workType) =>
      (!stageId || workType.stageId === stageId) &&
      (!tradeId || workType.tradeId === tradeId),
  )
}

export function getTemplateForWorkType(
  state: ConstructionDataState,
  workTypeId?: EntityId,
): TaskTemplate | undefined {
  if (!workTypeId) return undefined
  return state.taskTemplates.find((template) => template.workTypeId === workTypeId)
}

export function defaultTaskTitle(
  state: ConstructionDataState,
  workTypeId?: EntityId,
): string {
  if (!workTypeId) return ""
  const template = getTemplateForWorkType(state, workTypeId)
  if (template) return template.name
  return state.workTypes.find((item) => item.id === workTypeId)?.name ?? ""
}
