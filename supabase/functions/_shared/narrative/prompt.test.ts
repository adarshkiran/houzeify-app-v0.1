import { describe, expect, it } from "vitest"
import { NARRATIVE_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "./prompt.ts"
import { sampleReportFacts } from "./testFacts.ts"

describe("narrative prompt", () => {
  it("states the hard rules", () => {
    for (const rule of ["only the facts", "No names", "exactly as given", "not enough data"]) {
      expect(SYSTEM_PROMPT.toLowerCase()).toContain(rule.toLowerCase())
    }
  })

  it("puts the facts in the user message as canonical JSON", () => {
    const message = buildUserMessage(sampleReportFacts())
    expect(message).toContain('"overallPercent":42')
    expect(message.indexOf('"asOf"')).toBeLessThan(message.indexOf('"status"'))
  })

  it("asks for a paragraphs array", () => {
    expect(NARRATIVE_SCHEMA).toMatchObject({ required: ["paragraphs"], additionalProperties: false })
  })
})
