import { describe, expect, it } from "vitest"
import { describeCommandError, IntegrityError } from "./errors"
import { PermissionError } from "./session"

describe("describeCommandError", () => {
  it("explains permission failures without leaking ids", () => {
    const text = describeCommandError(new PermissionError("task.manage", "project-x"))
    expect(text).toMatch(/permission/i)
    expect(text).not.toContain("project-x")
  })

  it("explains integrity failures without leaking ids", () => {
    const text = describeCommandError(new IntegrityError("Task t-9 does not belong to project p-1"))
    expect(text).toMatch(/isn't valid|not valid/i)
    expect(text).not.toContain("t-9")
  })

  it("passes through a plain Error's message", () => {
    expect(describeCommandError(new Error("Stage and trade are required"))).toBe(
      "Stage and trade are required",
    )
  })

  it("has a generic fallback for non-errors", () => {
    expect(describeCommandError("boom")).toBe("Something went wrong. Please try again.")
  })
})
