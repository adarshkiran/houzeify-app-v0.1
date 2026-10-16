import { afterEach, describe, expect, it, vi } from "vitest"
import { interpretResponse } from "./interpret.ts"

const text = (t: string) => ({ type: "text", text: t })
const SECRET = "SECRET-MODEL-CONTENT"

afterEach(() => vi.restoreAllMocks())

function run(r: Parameters<typeof interpretResponse>[0]) {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const outcome = interpretResponse(r)
  return { outcome, warn }
}

describe("interpretResponse", () => {
  it("refusal", () => {
    const { outcome, warn } = run({ stop_reason: "refusal", content: [text(SECRET)], model: "m" })
    expect(outcome).toEqual({ status: "refused" })
    expect(warn).toHaveBeenCalledWith("narrate-report: model refused")
  })
  it.each(["max_tokens", "pause_turn"])("%s fails and logs the enum only", (reason) => {
    const { outcome, warn } = run({ stop_reason: reason, content: [text(SECRET)], model: "m" })
    expect(outcome).toEqual({ status: "failed" })
    expect(warn).toHaveBeenCalledWith("narrate-report: unexpected stop_reason", reason)
  })
  it("no text block", () => {
    const { outcome, warn } = run({ stop_reason: "end_turn", content: [{ type: "thinking" }], model: "m" })
    expect(outcome).toEqual({ status: "failed" })
    expect(warn).toHaveBeenCalledWith("narrate-report: no text block")
  })
  it("skips a thinking block before the text", () => {
    const { outcome } = run({
      stop_reason: "end_turn",
      content: [{ type: "thinking", text: "hmm" }, text('{"paragraphs":["a"]}')],
      model: "claude-x",
    })
    expect(outcome).toEqual({ status: "ok", paragraphs: ["a"], model: "claude-x" })
  })
  it("bad JSON", () => {
    const { outcome, warn } = run({ stop_reason: "end_turn", content: [text(SECRET)], model: "m" })
    expect(outcome).toEqual({ status: "failed" })
    expect(warn).toHaveBeenCalledWith("narrate-report: unparsable model output")
  })
  it("JSON null yields ok with undefined paragraphs", () => {
    const { outcome } = run({ stop_reason: "end_turn", content: [text("null")], model: "m" })
    expect(outcome).toEqual({ status: "ok", paragraphs: undefined, model: "m" })
  })
  it("never logs content", () => {
    const { warn } = run({ stop_reason: "end_turn", content: [text(SECRET)], model: "m" })
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET)
  })
})
