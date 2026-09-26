import { describe, expect, it } from "vitest"
import {
  buildBatchUnitLabels,
  defaultRootUnitForKind,
  isMultiUnitProjectKind,
} from "./projectSetup"

describe("projectSetup", () => {
  it("bootstraps a root house unit only for individual-house", () => {
    expect(defaultRootUnitForKind("individual-house")).toEqual({
      kind: "house",
      code: "HOUSE",
      name: "Main House",
    })
    expect(defaultRootUnitForKind("villa-development")).toBeNull()
  })

  it("flags multi-unit project kinds", () => {
    expect(isMultiUnitProjectKind("villa-development")).toBe(true)
    expect(isMultiUnitProjectKind("individual-house")).toBe(false)
  })

  it("builds padded sequential unit labels", () => {
    expect(
      buildBatchUnitLabels({
        count: 3,
        kind: "villa",
        codePrefix: "V",
        namePrefix: "Villa",
        padDigits: 3,
      }),
    ).toEqual([
      { code: "V001", name: "Villa 1" },
      { code: "V002", name: "Villa 2" },
      { code: "V003", name: "Villa 3" },
    ])
  })
})
