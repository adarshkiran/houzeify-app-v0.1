import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "./seed"
import { messageLinks } from "./messageLinks"

describe("messageLinks", () => {
  const task = { ...seed.tasks[0]!, id: "t-1", title: "Pour Grid B", source: { threadId: "th-1", messageId: "m-1" } }
  const issue = { ...seed.issues[0]!, id: "i-1", title: "Leak", source: { threadId: "th-1", messageId: "m-1" } }
  const elsewhere = { ...seed.tasks[0]!, id: "t-2", source: { threadId: "th-2", messageId: "m-9" } }

  it("groups tasks and issues by their source message in this thread", () => {
    const links = messageLinks("th-1", [task, elsewhere], [issue])
    expect(links.get("m-1")).toEqual([
      { kind: "task", id: "t-1", title: "Pour Grid B" },
      { kind: "issue", id: "i-1", title: "Leak" },
    ])
    expect(links.has("m-9")).toBe(false)
  })

  it("only lists the records it is given (the caller passes what the viewer can read)", () => {
    expect(messageLinks("th-1", [], []).size).toBe(0)
  })
})
