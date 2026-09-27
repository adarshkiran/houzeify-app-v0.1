import { describe, expect, it } from "vitest"
import type { Session } from "../domain/session"
import {
  getThreadMessages,
  getUnreadTotal,
  getViewerThreads,
  roleLabel,
  threadTitle,
} from "./conversationSelectors"
import { seedConstructionData as seed } from "./seed"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }

describe("conversation selectors", () => {
  it("orders threads: project, homeowner, context threads, then direct", () => {
    expect(getViewerThreads(seed, arjun, "project-sharma").map((v) => v.thread.id)).toEqual([
      "thread-sharma-project",
      "thread-sharma-homeowner",
      "thread-sharma-task-4",
      "thread-sharma-direct-arjun-ravi",
    ])
  })

  it("shows each viewer only what they can read, with unread counts", () => {
    const forRavi = getViewerThreads(seed, ravi)
    expect(forRavi.map((v) => [v.thread.id, v.unread])).toEqual([
      ["thread-sharma-project", 0],
      ["thread-sharma-task-4", 1],
      ["thread-sharma-direct-arjun-ravi", 1],
    ])
    expect(getViewerThreads(seed, homeowner).map((v) => v.thread.id)).toEqual(["thread-sharma-homeowner"])
  })

  it("totals unread per viewer", () => {
    expect(getUnreadTotal(seed, arjun, "project-sharma")).toBe(1)
    expect(getUnreadTotal(seed, ravi)).toBe(2)
    expect(getUnreadTotal(seed, homeowner)).toBe(1)
    expect(getUnreadTotal(seed, arjun, "project-reddy")).toBe(0)
  })

  it("lists messages oldest first and names threads", () => {
    expect(getThreadMessages(seed, "thread-sharma-project").map((m) => m.id)).toEqual(["message-1", "message-2", "message-3", "message-4"])
    const byId = (id: string) => seed.threads.find((t) => t.id === id)!
    expect(threadTitle(seed, byId("thread-sharma-project"))).toBe("Project chat")
    expect(threadTitle(seed, byId("thread-sharma-homeowner"))).toBe("Homeowner")
    expect(threadTitle(seed, byId("thread-sharma-task-4"))).toBe("Complete footing curing log")
    expect(threadTitle(seed, byId("thread-sharma-direct-arjun-ravi"), "membership-manager-1")).toBe("Ravi Naik")
    expect(threadTitle(seed, byId("thread-sharma-direct-arjun-ravi"), "membership-worker-ravi-sharma")).toBe("Arjun Mehta")
    expect(roleLabel("project-manager")).toBe("Project manager")
  })
})
