import { describe, expect, it } from "vitest"
import { isStale, selectChosen } from "./useNarrativeDraft"

const narrative = { text: "t", engine: "claude:x", generatedAt: "2026-10-17T09:00:00Z", factsHash: "a".repeat(64) }

describe("isStale", () => {
  it("is false with no narrative", () => expect(isStale(undefined, "x")).toBe(false))
  it("is false while the facts hash matches", () => expect(isStale(narrative, "a".repeat(64))).toBe(false))
  it("is true once the facts changed", () => expect(isStale(narrative, "b".repeat(64))).toBe(true))
  it("is true when there are no facts any more", () => expect(isStale(narrative, undefined)).toBe(true))
})

describe("selectChosen", () => {
  const h = "a".repeat(64)
  it("is undefined with no narrative", () => expect(selectChosen(undefined, true, h)).toBeUndefined())
  it("is undefined while the hash is unknown", () => expect(selectChosen(narrative, true, undefined)).toBeUndefined())
  it("returns the draft on hash match when AI is chosen", () => expect(selectChosen(narrative, true, h)).toBe(narrative))
  it("is undefined when standard is chosen", () => expect(selectChosen(narrative, false, h)).toBeUndefined())
  it("is undefined on hash mismatch", () => expect(selectChosen(narrative, true, "b".repeat(64))).toBeUndefined())
})
