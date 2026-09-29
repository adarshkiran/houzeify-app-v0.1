import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { publishDocument, publishIssue, uploadDocument } from "./constructionCommands"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

// membership-manager-1: project-manager on project-sharma (CUSTOMER_PUBLISH + EVIDENCE_CAPTURE).
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
// membership-worker-ravi-sharma: worker on project-sharma (EVIDENCE_CAPTURE, no CUSTOMER_PUBLISH).
const worker: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const clock: Clock = { now: () => new Date("2026-09-29T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session): CommandContext => ({ actor, clock, ids: ids() })
const run = <T,>(state: ConstructionDataState, actor: Session, command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T }) =>
  command(state, as(actor))

describe("publishIssue", () => {
  // All seeded issues default to private; issue-3 is the only one on project-sharma
  // (membership-manager-1's project), so it's the fixture these tests publish/hide.
  const published = {
    ...seed,
    issues: seed.issues.map((item) =>
      item.id === "issue-3" ? { ...item, customerVisibility: "customer-visible" as const } : item,
    ),
  }

  it("shares a private issue with the homeowner", () => {
    const { result } = run(seed, manager, publishIssue("issue-3", true))
    expect(result.customerVisibility).toBe("customer-visible")
  })

  it("can hide an already-shared issue again", () => {
    const { result } = run(published, manager, publishIssue("issue-3", false))
    expect(result.customerVisibility).toBe("private")
  })

  it("is a no-op when already in that state", () => {
    const { state, result } = run(seed, manager, publishIssue("issue-3", false))
    expect(result.customerVisibility).toBe("private")
    expect(state).toBe(seed)
  })

  it("refuses a caller without CUSTOMER_PUBLISH", () => {
    expect(() => run(seed, worker, publishIssue("issue-3", true))).toThrow(PermissionError)
    expect(() => run(seed, homeowner, publishIssue("issue-3", true))).toThrow(PermissionError)
  })

  it("refuses a missing issue", () => {
    expect(() => run(seed, manager, publishIssue("nope", true))).toThrow(PermissionError)
  })
})

describe("uploadDocument", () => {
  const input = { projectId: "project-sharma", title: "Site plan v2", category: "drawing" as const, url: "blob:x" }

  it("uploads a document, defaulting to private", () => {
    const { result, state } = run(seed, manager, uploadDocument(input))
    expect(result).toMatchObject({ projectId: "project-sharma", title: "Site plan v2", category: "drawing", customerVisibility: "private", uploadedByMembershipId: "membership-manager-1" })
    expect(state.documents).toContainEqual(result)
  })

  it("refuses a scope-restricted worker (documents are project-wide, not unit-scoped)", () => {
    expect(() => run(seed, worker, uploadDocument(input))).toThrow(PermissionError)
  })

  it("refuses a caller without EVIDENCE_CAPTURE", () => {
    expect(() => run(seed, homeowner, uploadDocument(input))).toThrow(PermissionError)
  })

  it("requires a non-empty title", () => {
    expect(() => run(seed, manager, uploadDocument({ ...input, title: "   " }))).toThrow(ConflictError)
    expect(() => run(seed, manager, uploadDocument({ ...input, title: "   " }))).toThrow(/title/i)
  })
})

describe("publishDocument", () => {
  it("shares a private document with the homeowner", () => {
    const { result } = run(seed, manager, publishDocument("document-sharma-2", true))
    expect(result.customerVisibility).toBe("customer-visible")
  })

  it("can hide a document again", () => {
    const { result } = run(seed, manager, publishDocument("document-sharma-1", false))
    expect(result.customerVisibility).toBe("private")
  })

  it("refuses a caller without CUSTOMER_PUBLISH", () => {
    expect(() => run(seed, worker, publishDocument("document-sharma-2", true))).toThrow(PermissionError)
  })

  it("refuses a missing document", () => {
    expect(() => run(seed, manager, publishDocument("nope", true))).toThrow(PermissionError)
  })
})
