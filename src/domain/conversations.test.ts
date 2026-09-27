import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import {
  canMessageDirectly,
  canReadThread,
  findThread,
  readerMembership,
  unreadCount,
} from "./conversations"
import type { Thread } from "./models"
import type { Session } from "./session"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const thread = (id: string) => seed.threads.find((t) => t.id === id)!
const draft = (partial: Partial<Thread>): Thread => ({
  id: "draft",
  projectId: "project-sharma",
  subject: "project",
  audience: "internal",
  createdAt: "2026-09-27T00:00:00+05:30",
  ...partial,
})

describe("canReadThread", () => {
  it("lets the manager read every Sharma thread", () => {
    for (const t of seed.threads) expect(canReadThread(seed, arjun, t), t.id).toBe(true)
  })

  it("never lets a worker read the Homeowner thread", () => {
    expect(canReadThread(seed, ravi, thread("thread-sharma-homeowner"))).toBe(false)
  })

  it("lets a worker read the project chat, their task thread and their DM", () => {
    expect(canReadThread(seed, ravi, thread("thread-sharma-project"))).toBe(true)
    expect(canReadThread(seed, ravi, thread("thread-sharma-task-4"))).toBe(true)
    expect(canReadThread(seed, ravi, thread("thread-sharma-direct-arjun-ravi"))).toBe(true)
  })

  it("hides threads outside a scoped worker's trade or unit", () => {
    // Ravi is scoped to Main House + civil; task-9 is electrical, issue-3 is whole-project.
    expect(canReadThread(seed, ravi, draft({ subject: "task", targetId: "task-9" }))).toBe(false)
    expect(canReadThread(seed, ravi, draft({ subject: "issue", targetId: "issue-3" }))).toBe(false)
  })

  it("lets the homeowner read only the Homeowner thread", () => {
    expect(canReadThread(seed, homeowner, thread("thread-sharma-homeowner"))).toBe(true)
    expect(canReadThread(seed, homeowner, thread("thread-sharma-project"))).toBe(false)
    expect(canReadThread(seed, homeowner, thread("thread-sharma-task-4"))).toBe(false)
    expect(canReadThread(seed, homeowner, thread("thread-sharma-direct-arjun-ravi"))).toBe(false)
  })

  it("denies people who aren't on the project, and signed-out sessions", () => {
    const other = draft({ projectId: "project-reddy" })
    expect(canReadThread(seed, ravi, other)).toBe(false)
    expect(canReadThread(seed, null, thread("thread-sharma-project"))).toBe(false)
  })

  it("returns the membership a person reads (and posts) with", () => {
    expect(readerMembership(seed, ravi, thread("thread-sharma-task-4"))?.id).toBe("membership-worker-ravi-sharma")
  })
})

describe("canMessageDirectly", () => {
  it("allows the build plan's pairs in either order", () => {
    expect(canMessageDirectly("worker", "supervisor")).toBe(true)
    expect(canMessageDirectly("project-manager", "worker")).toBe(true)
    expect(canMessageDirectly("contractor", "developer-admin")).toBe(true)
    expect(canMessageDirectly("supervisor", "project-manager")).toBe(true)
  })

  it("refuses other pairs", () => {
    expect(canMessageDirectly("worker", "worker")).toBe(false)
    expect(canMessageDirectly("worker", "homeowner")).toBe(false)
    expect(canMessageDirectly("homeowner", "project-manager")).toBe(false)
    expect(canMessageDirectly("consultant", "worker")).toBe(false)
  })
})

describe("unreadCount and findThread", () => {
  it("counts newer messages by others", () => {
    expect(unreadCount(seed, thread("thread-sharma-project"), "membership-manager-1")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-task-4"), "membership-worker-ravi-sharma")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-direct-arjun-ravi"), "membership-worker-ravi-sharma")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-homeowner"), "membership-homeowner-sharma")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-direct-arjun-ravi"), "membership-manager-1")).toBe(0)
  })

  it("finds a thread by subject and target", () => {
    expect(findThread(seed, "project-sharma", "task", "task-4")?.id).toBe("thread-sharma-task-4")
    expect(findThread(seed, "project-sharma", "homeowner")?.id).toBe("thread-sharma-homeowner")
    expect(findThread(seed, "project-sharma", "task", "task-9")).toBeUndefined()
  })
})
