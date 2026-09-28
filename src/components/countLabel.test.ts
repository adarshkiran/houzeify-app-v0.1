import { describe, expect, it } from "vitest"
import { countLabel } from "./countLabel"

describe("countLabel", () => {
  it("uses the singular only for one", () => {
    expect(countLabel(0, "task")).toBe("0 tasks")
    expect(countLabel(1, "task")).toBe("1 task")
    expect(countLabel(4, "issue")).toBe("4 issues")
  })

  it("takes an irregular plural", () => {
    expect(countLabel(2, "check", "checks")).toBe("2 checks")
    expect(countLabel(1, "person", "people")).toBe("1 person")
    expect(countLabel(3, "person", "people")).toBe("3 people")
  })
})
