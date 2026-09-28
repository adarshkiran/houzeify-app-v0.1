import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import * as commands from "./constructionCommands"
import { IntegrityError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext } from "./ports"
import { PermissionError, type Session } from "./session"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const clock: Clock = { now: () => new Date("2026-09-28T09:00:00.000Z") }
const as = (actor: Session): CommandContext => {
  let n = 0
  return { actor, clock, ids: { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` } }
}

const taskInput = {
  projectId: "project-sharma",
  projectUnitId: "unit-sharma-house",
  stageId: "stage-rcc",
  tradeId: "trade-civil",
  workTypeId: "work-curing",
  title: "Cure the Grid B columns",
  priority: "medium" as const,
}
const fromTask4 = { threadId: "thread-sharma-task-4", messageId: "message-5" }

describe("createTask with a source message", () => {
  it("keeps the link to the conversation message", () => {
    const { result } = commands.createTask({ ...taskInput, source: fromTask4 })(seed, as(arjun))
    expect(result.source).toEqual(fromTask4)
  })

  it("refuses a message that isn't in that thread", () => {
    expect(() =>
      commands.createTask({ ...taskInput, source: { threadId: "thread-sharma-task-4", messageId: "message-1" } })(seed, as(arjun)),
    ).toThrow(IntegrityError)
  })

  it("refuses a message that doesn't exist", () => {
    expect(() =>
      commands.createTask({ ...taskInput, source: { threadId: "thread-sharma-task-4", messageId: "message-nope" } })(seed, as(arjun)),
    ).toThrow(IntegrityError)
  })

  it("refuses a thread from another project", () => {
    const moved: ConstructionDataState = {
      ...seed,
      threads: seed.threads.map((t) => (t.id === "thread-sharma-task-4" ? { ...t, projectId: "project-reddy" } : t)),
    }
    expect(() => commands.createTask({ ...taskInput, source: fromTask4 })(moved, as(arjun))).toThrow(IntegrityError)
  })
})

describe("reportIssue with a source message", () => {
  const issueInput = {
    projectId: "project-sharma",
    taskId: "task-4",
    title: "Hessian drying out",
    description: "",
    severity: "medium" as const,
  }

  it("keeps the link when the reporter can read the thread", () => {
    const { result } = commands.reportIssue({ ...issueInput, source: fromTask4 })(seed, as(ravi))
    expect(result.source).toEqual(fromTask4)
  })

  it("refuses a thread the reporter can't read", () => {
    // Workers never read the Homeowner thread.
    expect(() =>
      commands.reportIssue({ ...issueInput, source: { threadId: "thread-sharma-homeowner", messageId: "message-7" } })(seed, as(ravi)),
    ).toThrow(PermissionError)
  })

  it("works without a source, as before", () => {
    const { result } = commands.reportIssue(issueInput)(seed, as(ravi))
    expect(result.source).toBeUndefined()
  })
})
