import { describe, expect, it } from "vitest"
import { quantityProgress } from "./workerLabels"

describe("quantityProgress", () => {
  it("shows done against planned", () => {
    expect(quantityProgress({ value: 5, unit: "m3" }, { value: 42, unit: "m3" })).toBe("5 of 42 m3 done")
    expect(quantityProgress(undefined, { value: 42, unit: "m3" })).toBe("0 of 42 m3 done")
  })

  it("falls back when nothing is planned", () => {
    expect(quantityProgress({ value: 2, unit: "day" })).toBe("2 day done so far")
    expect(quantityProgress()).toBe("No planned amount set")
  })
})
