import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import * as commands from "./constructionCommands"
import { ConflictError } from "./errors"
import type { ConstructionDataState, Task, TaskStatus } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const clock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }

function ids(): IdGenerator {
  let n = 0
  return { next: (prefix) => `${prefix}-${++n}`, short: () => `s${++n}` }
}
const ctx = (): CommandContext => ({ actor: manager, clock, ids: ids() })

/** task-13 with its status forced to the given one, everything else from the seed. */
function withTaskStatus(status: TaskStatus): ConstructionDataState {
  return {
    ...seed,
    tasks: seed.tasks.map((task: Task) => (task.id === "task-13" ? { ...task, status } : task)),
  }
}

const statusOf = (state: ConstructionDataState) =>
  state.tasks.find((task) => task.id === "task-13")!.status

describe("transitionTask", () => {
  it("makes a valid move and changes the status", () => {
    const state = withTaskStatus("draft")
    const next = commands.transitionTask("task-13", "assigned")(state, ctx())
    expect(statusOf(next.state)).toBe("assigned")
  })

  it("refuses an invalid move with a ConflictError and leaves the status unchanged", () => {
    const state = withTaskStatus("draft")
    expect(() => commands.transitionTask("task-13", "completed")(state, ctx())).toThrow(ConflictError)
    expect(() => commands.transitionTask("task-13", "completed")(state, ctx())).toThrow(
      "A task can't move from draft to completed.",
    )
    expect(statusOf(state)).toBe("draft")
  })

  it("refuses a move out of a terminal status with a ConflictError", () => {
    const state = withTaskStatus("completed")
    expect(() => commands.transitionTask("task-13", "draft")(state, ctx())).toThrow(ConflictError)
    expect(statusOf(state)).toBe("completed")
  })
})
