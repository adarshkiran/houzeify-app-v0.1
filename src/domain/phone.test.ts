import { describe, expect, it } from "vitest"
import { normalizePhone, samePhone } from "./phone"

describe("phone normalization", () => {
  it("ignores spaces, dashes, brackets and a country code", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210")
    expect(normalizePhone("098765-43210")).toBe("9876543210")
    expect(normalizePhone("(91) 98765 43210")).toBe("9876543210")
    expect(normalizePhone("9876543210")).toBe("9876543210")
  })

  it("returns an empty string when there are no digits", () => {
    expect(normalizePhone(undefined)).toBe("")
    expect(normalizePhone("")).toBe("")
    expect(normalizePhone("n/a")).toBe("")
  })

  it("samePhone compares normalized values and never matches empties", () => {
    expect(samePhone("+91 98765 43210", "9876543210")).toBe(true)
    expect(samePhone("9876543210", "9876543211")).toBe(false)
    expect(samePhone(undefined, undefined)).toBe(false)
    expect(samePhone("", "")).toBe(false)
  })
})
