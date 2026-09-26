import { describe, expect, it } from "vitest"
import { canTransitionIssue, getAllowedIssueTransitions } from "./issueTransitions"

describe("issue status transitions", () => {
  it("follows open -> in-progress -> resolved -> closed", () => {
    expect(canTransitionIssue("open", "in-progress")).toBe(true)
    expect(canTransitionIssue("in-progress", "resolved")).toBe(true)
    expect(canTransitionIssue("resolved", "closed")).toBe(true)
  })

  it("allows resolving straight from open", () => {
    expect(canTransitionIssue("open", "resolved")).toBe(true)
  })

  it("allows reopening from resolved and closed, and pausing back to open", () => {
    expect(canTransitionIssue("resolved", "open")).toBe(true)
    expect(canTransitionIssue("closed", "open")).toBe(true)
    expect(canTransitionIssue("in-progress", "open")).toBe(true)
  })

  it("rejects skipping review or staying put", () => {
    expect(canTransitionIssue("open", "closed")).toBe(false)
    expect(canTransitionIssue("in-progress", "closed")).toBe(false)
    expect(canTransitionIssue("closed", "resolved")).toBe(false)
    expect(canTransitionIssue("open", "open")).toBe(false)
  })

  it("lists the allowed next statuses", () => {
    expect(getAllowedIssueTransitions("closed")).toEqual(["open"])
    expect(getAllowedIssueTransitions("open")).toEqual(["in-progress", "resolved"])
  })
})
