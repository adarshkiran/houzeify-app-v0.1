import { describe, expect, it } from "vitest"
import {
  canTransitionTask,
  getAllowedTaskTransitions,
  statusAfterProgressApproval,
  statusAfterProgressRejection,
  statusAfterProgressSubmit,
} from "./taskTransitions"

describe("taskTransitions", () => {
  it("allows in-progress → submitted", () => {
    expect(canTransitionTask("in-progress", "submitted")).toBe(true)
    expect(getAllowedTaskTransitions("in-progress")).toContain("submitted")
  })

  it("rejects illegal jumps like draft → completed", () => {
    expect(canTransitionTask("draft", "completed")).toBe(false)
  })

  it("maps progress submit toward review/submitted", () => {
    expect(statusAfterProgressSubmit("in-progress")).toBe("submitted")
    expect(statusAfterProgressSubmit("submitted")).toBe("review")
    expect(statusAfterProgressSubmit("draft")).toBeNull()
  })

  it("advances linked task to approved after progress approval", () => {
    expect(statusAfterProgressApproval("submitted")).toBe("approved")
    expect(statusAfterProgressApproval("review")).toBe("approved")
    expect(statusAfterProgressApproval("in-progress")).toBe("in-progress")
  })

  it("reopens linked task after progress rejection when allowed", () => {
    expect(statusAfterProgressRejection("review")).toBe("reopened")
    expect(statusAfterProgressRejection("submitted")).toBe("reopened")
    expect(statusAfterProgressRejection("in-progress")).toBeNull()
  })
})
