import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import {
  QUANTITY_UNITS,
  WORK_LIBRARY_VERSION,
  defaultTaskTitle,
  getTemplateForWorkType,
  getTradesForStage,
  getWorkTypesForStageTrade,
  slugifyLibraryName,
} from "./workLibrary"

describe("workLibrary", () => {
  it("exposes a catalog version", () => {
    expect(WORK_LIBRARY_VERSION).toMatch(/^\d{4}\.\d{2}\.\d+$/)
  })

  it("exposes quantity units and slugifies names", () => {
    expect(QUANTITY_UNITS).toContain("m2")
    expect(QUANTITY_UNITS).toContain("hour")
    expect(slugifyLibraryName("Terrace Waterproofing")).toBe(
      "terrace-waterproofing",
    )
  })

  it("cascades RCC → Reinforcement → Column Reinforcement", () => {
    const trades = getTradesForStage(seedConstructionData, "stage-rcc")
    expect(trades.some((trade) => trade.id === "trade-reinforcement")).toBe(true)

    const workTypes = getWorkTypesForStageTrade(
      seedConstructionData,
      "stage-rcc",
      "trade-reinforcement",
    )
    expect(workTypes.map((item) => item.name)).toContain("Column Reinforcement")

    const column = workTypes.find((item) => item.name === "Column Reinforcement")!
    const template = getTemplateForWorkType(seedConstructionData, column.id)
    expect(template).toBeTruthy()
    expect(defaultTaskTitle(seedConstructionData, column.id)).toContain(
      "Column Reinforcement",
    )
  })

  it("covers every work type with a template", () => {
    for (const workType of seedConstructionData.workTypes) {
      expect(getTemplateForWorkType(seedConstructionData, workType.id)).toBeTruthy()
    }
  })
})
