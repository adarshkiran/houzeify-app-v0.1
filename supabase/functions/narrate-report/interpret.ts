import type { ModelOutcome } from "./handler.ts"

/**
 * Pure decision logic for a model response (no SDK import, so it is unit
 * tested). Logs only fixed strings and the stop_reason enum, never content.
 */
export function interpretResponse(response: {
  stop_reason: string | null
  content: { type: string; text?: string }[]
  model: string
}): ModelOutcome {
  if (response.stop_reason === "refusal") {
    console.warn("narrate-report: model refused")
    return { status: "refused" }
  }
  if (response.stop_reason !== "end_turn") {
    console.warn("narrate-report: unexpected stop_reason", response.stop_reason)
    return { status: "failed" }
  }
  const block = response.content.find((b) => b.type === "text")
  if (!block || typeof block.text !== "string") {
    console.warn("narrate-report: no text block")
    return { status: "failed" }
  }
  try {
    const parsed = JSON.parse(block.text) as { paragraphs?: unknown } | null
    return { status: "ok", paragraphs: parsed?.paragraphs, model: response.model }
  } catch {
    console.warn("narrate-report: unparsable model output")
    return { status: "failed" }
  }
}
