import { describe, expect, it } from "vitest"
import type { NarrativeErrorCode } from "../../../supabase/functions/_shared/narrative/types"
import { narrativeErrorMessage } from "./messages"

describe("narrativeErrorMessage", () => {
  it("has fixed, user-facing text for every code", () => {
    const codes: NarrativeErrorCode[] = ["unauthorized", "forbidden", "not-included", "limit-reached", "unavailable", "rejected"]
    for (const code of codes) {
      const message = narrativeErrorMessage(code)
      expect(message.length).toBeGreaterThan(10)
      expect(message).not.toMatch(/error|exception|\bnull\b|undefined/i)
    }
    expect(narrativeErrorMessage("limit-reached")).toContain("this month")
    expect(narrativeErrorMessage("rejected")).toContain("standard summary")
  })
})
