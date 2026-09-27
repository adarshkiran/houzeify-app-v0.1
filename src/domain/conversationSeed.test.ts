import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"

describe("seed conversations", () => {
  it("has the four Sharma threads with the right audiences", () => {
    const byId = Object.fromEntries(seed.threads.map((t) => [t.id, t]))
    expect(byId["thread-sharma-project"]).toMatchObject({ subject: "project", audience: "internal" })
    expect(byId["thread-sharma-task-4"]).toMatchObject({ subject: "task", targetId: "task-4", audience: "internal" })
    expect(byId["thread-sharma-homeowner"]).toMatchObject({ subject: "homeowner", audience: "homeowner" })
    expect(byId["thread-sharma-direct-arjun-ravi"]).toMatchObject({
      subject: "direct",
      audience: "internal",
      participantMembershipIds: ["membership-manager-1", "membership-worker-ravi-sharma"],
    })
  })

  it("only has messages in known threads, by members of that project", () => {
    for (const message of seed.messages) {
      const thread = seed.threads.find((t) => t.id === message.threadId)
      expect(thread, message.id).toBeDefined()
      const author = seed.memberships.find((m) => m.id === message.authorMembershipId)
      expect(author?.projectId, message.id).toBe(thread!.projectId)
      expect(Boolean(message.body) || Boolean(message.voice), message.id).toBe(true)
    }
  })

  it("keeps lastMessageAt equal to each thread's newest message", () => {
    for (const thread of seed.threads) {
      const newest = seed.messages
        .filter((m) => m.threadId === thread.id)
        .map((m) => m.createdAt)
        .sort()
        .at(-1)
      expect(thread.lastMessageAt, thread.id).toBe(newest)
    }
  })
})
