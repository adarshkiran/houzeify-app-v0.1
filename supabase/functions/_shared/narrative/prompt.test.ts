import { describe, expect, it } from "vitest"
import { NARRATIVE_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "./prompt.ts"
import { sampleReportFacts } from "./testFacts.ts"

describe("narrative prompt", () => {
  it("states every required rule", () => {
    const prompt = SYSTEM_PROMPT.toLowerCase()
    for (const rule of [
      "only the facts",
      "exactly as given",
      "no names",
      "do not speculate about causes",
      "legal or financial advice",
      "not enough data",
      "no links",
      "yyyy-mm-dd",
      "dd-mm-yyyy",
      "dozen",
    ]) {
      expect(prompt, rule).toContain(rule)
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
