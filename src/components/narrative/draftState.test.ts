import { describe, expect, it } from "vitest"
import { isStale } from "./useNarrativeDraft"

const narrative = { text: "t", engine: "claude:x", generatedAt: "2026-10-17T09:00:00Z", factsHash: "a".repeat(64) }

describe("isStale", () => {
  it("is false with no narrative", () => expect(isStale(undefined, "x")).toBe(false))
  it("is false while the facts hash matches", () => expect(isStale(narrative, "a".repeat(64))).toBe(false))
  it("is true once the facts changed", () => expect(isStale(narrative, "b".repeat(64))).toBe(true))
  it("is true when there are no facts any more", () => expect(isStale(narrative, undefined)).toBe(true))
})
