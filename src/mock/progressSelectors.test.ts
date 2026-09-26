import { describe, expect, it } from "vitest"
import type { DailyProgress } from "../domain/models"
import { seedConstructionData as seed } from "./seed"
import {
  getChangesRequested,
  getMyMembershipIds,
  getProgressHistory,
  getPublishedForCustomer,
  getPublishedEvidence,
  getReadyToPublish,
  getVersionChain,
} from "./selectors"

const sharma = seed.dailyProgress.find((p) => p.id === "progress-sharma-2009")!

describe("progress selectors", () => {
  it("lists approved, unpublished updates as ready to publish", () => {
    expect(getReadyToPublish(seed).map((p) => p.id)).toEqual(["progress-reddy-1809"])
    expect(getReadyToPublish(seed, "project-sharma")).toEqual([])
  })

  it("history leaves out drafts and is newest first", () => {
    const ids = getProgressHistory(seed).map((p) => p.id)
    expect(ids).toEqual(["progress-sharma-2009", "progress-tech-1909", "progress-reddy-1809"])
  })

  it("walks the version chain oldest first", () => {
    const v1: DailyProgress = { ...sharma, id: "v1", reviewStatus: "superseded", supersededById: "v2" }
    const v2: DailyProgress = { ...sharma, id: "v2", version: 2, supersedesId: "v1" }
    const state = { ...seed, dailyProgress: [v2, v1] }
    expect(getVersionChain(state, v2).map((p) => p.id)).toEqual(["v1", "v2"])
  })

  it("finds updates sent back to a submitter", () => {
    const back: DailyProgress = { ...sharma, id: "back", reviewStatus: "changes-requested" }
    const state = { ...seed, dailyProgress: [back, ...seed.dailyProgress] }
    const mine = getMyMembershipIds(state, "person-arjun")
    expect(getChangesRequested(state, mine).map((p) => p.id)).toEqual(["back"])
    expect(getChangesRequested(state, mine, "task-99")).toEqual([])
    expect(getChangesRequested(state, getMyMembershipIds(state, "person-ravi"))).toEqual([])
  })

  it("returns only evidence named in the publication", () => {
    expect(getPublishedEvidence(seed, sharma).map((e) => e.id)).toEqual(["evidence-sharma-1", "evidence-sharma-2"])
    const reddy = seed.dailyProgress.find((p) => p.id === "progress-reddy-1809")!
    expect(getPublishedEvidence(seed, reddy)).toEqual([])
  })
})

describe("getPublishedForCustomer", () => {
  // Every non-approved status is also tried as "published", so the review
  // gate is proven on its own and not only through the publication flag.
  const cases: [DailyProgress["reviewStatus"], DailyProgress["publicationStatus"], boolean][] = [
    ["submitted", "private", false],
    ["submitted", "published", false],
    ["changes-requested", "private", false],
    ["changes-requested", "published", false],
    ["rejected", "private", false],
    ["rejected", "published", false],
    ["superseded", "private", false],
    ["superseded", "published", false],
    ["approved", "private", false],
    ["approved", "published", true],
  ]

  it.each(cases)("%s + %s → shown to the homeowner: %s", (reviewStatus, publicationStatus, shown) => {
    const item: DailyProgress = { ...sharma, id: "case", reviewStatus, publicationStatus }
    const state = { ...seed, dailyProgress: [item] }
    expect(getPublishedForCustomer(state, "project-sharma").map((p) => p.id)).toEqual(shown ? ["case"] : [])
  })
})
