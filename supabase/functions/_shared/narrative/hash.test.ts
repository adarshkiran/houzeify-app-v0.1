import { describe, expect, it } from "vitest"
import { canonicalJson, hashFacts } from "./hash.ts"
import { sampleReportFacts } from "./testFacts.ts"

describe("canonicalJson", () => {
  it("sorts keys and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[2,{"y":2,"z":1}]},"b":1}',
    )
  })
})

describe("hashFacts", () => {
  it("is a stable 64-char hex digest regardless of key order", async () => {
    const facts = sampleReportFacts()
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(facts).reverse())))
    const hash = await hashFacts(facts)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashFacts(reordered)).toBe(hash)
  })

  it("changes when a fact changes", async () => {
    const facts = sampleReportFacts()
    expect(await hashFacts({ ...facts, overallPercent: facts.overallPercent + 1 })).not.toBe(await hashFacts(facts))
  })
})
