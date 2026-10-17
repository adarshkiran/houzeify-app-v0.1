import { describe, expect, it } from "vitest"
import { sampleReportFacts } from "../../../supabase/functions/_shared/narrative/testFacts"
import { factsKeyOf } from "./useNarrativeDraft"

describe("factsKeyOf", () => {
  it("is equal for equal content in different objects", () => {
    expect(factsKeyOf(structuredClone(sampleReportFacts()))).toBe(factsKeyOf(sampleReportFacts()))
  })
  it("differs when content differs and is undefined without facts", () => {
    const changed = { ...sampleReportFacts(), kind: "weekly-company" } as never
    expect(factsKeyOf(changed)).not.toBe(factsKeyOf(sampleReportFacts()))
    expect(factsKeyOf(undefined)).toBeUndefined()
  })
})
