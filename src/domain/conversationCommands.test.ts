import { beforeEach, describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { markThreadRead, openDirectThread, postMessage } from "./conversationCommands"
import { unreadCount } from "./conversations"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const clock: Clock = { now: () => new Date("2026-09-27T10:00:00.000Z") }
let ids: IdGenerator
beforeEach(() => {
  let n = 0
  ids = { next: (prefix) => `${prefix}-new-${++n}`, short: () => `s${++n}` }
})
const as = (actor: Session): CommandContext => ({ actor, clock, ids })
const run = <T,>(state: ConstructionDataState, actor: Session, command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T }) =>
  command(state, as(actor))

describe("postMessage", () => {
  it("adds a message to an existing thread and marks it read for the author", () => {
    const { state, result } = run(seed, ravi, postMessage({ threadId: "thread-sharma-task-4", body: "  Photo added.  " }))
    expect(result).toMatchObject({ threadId: "thread-sharma-task-4", authorMembershipId: "membership-worker-ravi-sharma", body: "Photo added." })
    expect(state.threads.find((t) => t.id === "thread-sharma-task-4")!.lastMessageAt).toBe("2026-09-27T10:00:00.000Z")
    expect(unreadCount(state, state.threads.find((t) => t.id === "thread-sharma-task-4")!, "membership-worker-ravi-sharma")).toBe(0)
    expect(unreadCount(state, state.threads.find((t) => t.id === "thread-sharma-task-4")!, "membership-manager-1")).toBe(1)
  })

  it("creates a task thread on the first message, and reuses it after", () => {
    const first = run(seed, arjun, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-13", body: "Start Monday." }))
    const created = first.state.threads.filter((t) => t.subject === "task" && t.targetId === "task-13")
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ audience: "internal", projectId: "project-sharma" })
    const second = run(first.state, arjun, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-13", body: "Pump booked." }))
    expect(second.state.threads.filter((t) => t.subject === "task" && t.targetId === "task-13")).toHaveLength(1)
    expect(second.state.messages.filter((m) => m.threadId === created[0].id)).toHaveLength(2)
  })

  it("accepts a voice message with a transcript", () => {
    const { result } = run(seed, ravi, postMessage({ threadId: "thread-sharma-project", voice: { url: "blob:v", durationSec: 6, transcript: " On site. " } }))
    expect(result.voice).toEqual({ url: "blob:v", durationSec: 6, transcript: "On site." })
    expect(result.body).toBeUndefined()
  })

  it("refuses empty and too-long messages", () => {
    expect(() => run(seed, ravi, postMessage({ threadId: "thread-sharma-project", body: "   " }))).toThrow("Write a message or record a voice note.")
    expect(() => run(seed, ravi, postMessage({ threadId: "thread-sharma-project", body: "x".repeat(2001) }))).toThrow("Messages can be up to 2,000 characters.")
  })

  it("refuses threads the author can't read", () => {
    expect(() => run(seed, ravi, postMessage({ threadId: "thread-sharma-homeowner", body: "Hi" }))).toThrow(PermissionError)
    expect(() => run(seed, ravi, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-9", body: "Hi" }))).toThrow(PermissionError)
    expect(() => run(seed, homeowner, postMessage({ threadId: "thread-sharma-project", body: "Hi" }))).toThrow(PermissionError)
  })

  it("lets the homeowner post in the Homeowner thread", () => {
    const { result } = run(seed, homeowner, postMessage({ projectId: "project-sharma", subject: "homeowner", body: "Thanks!" }))
    expect(result).toMatchObject({ threadId: "thread-sharma-homeowner", authorMembershipId: "membership-homeowner-sharma" })
  })

  it("rejects a target that isn't in the project", () => {
    expect(() => run(seed, arjun, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-6", body: "Hi" }))).toThrow()
  })
})

describe("openDirectThread", () => {
  it("returns the existing DM from either side", () => {
    expect(run(seed, arjun, openDirectThread("project-sharma", "membership-worker-ravi-sharma")).result.id).toBe("thread-sharma-direct-arjun-ravi")
    expect(run(seed, ravi, openDirectThread("project-sharma", "membership-manager-1")).result.id).toBe("thread-sharma-direct-arjun-ravi")
  })

  it("refuses pairs the plan doesn't allow", () => {
    expect(() => run(seed, arjun, openDirectThread("project-sharma", "membership-homeowner-sharma")))
      .toThrow("You can't message this person directly. Use the task or project conversation.")
    expect(() => run(seed, arjun, openDirectThread("project-sharma", "membership-manager-1"))).toThrow(ConflictError)
  })

  it("creates a DM for an allowed new pair", () => {
    const withoutDm = { ...seed, threads: seed.threads.filter((t) => t.subject !== "direct") }
    const { state, result } = run(withoutDm, ravi, openDirectThread("project-sharma", "membership-manager-1"))
    expect(result).toMatchObject({ subject: "direct", audience: "internal" })
    expect([...result.participantMembershipIds!].sort()).toEqual(["membership-manager-1", "membership-worker-ravi-sharma"])
    expect(state.threads).toHaveLength(withoutDm.threads.length + 1)
  })
})

describe("markThreadRead", () => {
  it("clears the caller's unread count", () => {
    const { state } = run(seed, ravi, markThreadRead("thread-sharma-direct-arjun-ravi"))
    expect(unreadCount(state, state.threads.find((t) => t.id === "thread-sharma-direct-arjun-ravi")!, "membership-worker-ravi-sharma")).toBe(0)
  })

  it("refuses a thread the caller can't read", () => {
    expect(() => run(seed, ravi, markThreadRead("thread-sharma-homeowner"))).toThrow(PermissionError)
  })
})
