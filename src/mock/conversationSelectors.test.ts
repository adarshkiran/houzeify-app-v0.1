import { describe, expect, it } from "vitest"
import type { Session } from "../domain/session"
import {
  getThreadMessages,
  getThreadTimeline,
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

describe("getThreadTimeline", () => {
  const DIRECT = "thread-sharma-direct-arjun-ravi"

  it("merges messages and call logs in time order", () => {
    const withCall = {
      ...seed,
      callLogs: [
        {
          id: "call-1",
          threadId: DIRECT,
          loggedByMembershipId: "membership-manager-1",
          otherMembershipId: "membership-worker-ravi-sharma",
          type: "voice" as const,
          startedAt: "2026-09-27T09:00:00.000Z",
          durationMinutes: 5,
          createdAt: "2026-09-27T09:05:00.000Z",
        },
      ],
    }
    const timeline = getThreadTimeline(withCall, DIRECT)
    expect(timeline.some((entry) => entry.kind === "call" && entry.call.id === "call-1")).toBe(true)
    for (let i = 1; i < timeline.length; i++) {
      expect(Date.parse(timeline[i]!.at)).toBeGreaterThanOrEqual(Date.parse(timeline[i - 1]!.at))
    }
  })

  it("only includes call logs for the requested thread", () => {
    const other = {
      ...seed,
      callLogs: [
        {
          id: "call-2",
          threadId: "some-other-thread",
          loggedByMembershipId: "membership-manager-1",
          otherMembershipId: "membership-worker-ravi-sharma",
          type: "video" as const,
          startedAt: "2026-09-27T09:00:00.000Z",
          durationMinutes: 5,
          createdAt: "2026-09-27T09:05:00.000Z",
        },
      ],
    }
    const timeline = getThreadTimeline(other, DIRECT)
    expect(timeline.some((entry) => entry.kind === "call")).toBe(false)
  })

  it("returns only messages when there are no call logs", () => {
    const timeline = getThreadTimeline(seed, DIRECT)
    expect(timeline.every((entry) => entry.kind === "message")).toBe(true)
    expect(timeline).toHaveLength(seed.messages.filter((m) => m.threadId === DIRECT).length)
  })
})
