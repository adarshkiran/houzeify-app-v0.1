import Anthropic from "npm:@anthropic-ai/sdk@0.131.0"
import type { ModelClient, ModelOutcome } from "./handler.ts"

/**
 * The only file that talks to the model. Refusal fallbacks are on ("default"
 * routing, beta server-side-fallback-2026-07-01) per the Claude API guidance.
 * If the pinned SDK's types reject `fallbacks`, bump the SDK; do not drop the
 * fallback without telling the project owner.
 */
export function createAnthropicModel(apiKey: string | undefined, model: string): ModelClient {
  const client = apiKey ? new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 }) : undefined
  return {
    async narrate({ system, user, schema }): Promise<ModelOutcome> {
      if (!client) return { status: "failed" }
      const response = await client.beta.messages.create({
        model,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content: user }],
      })
      if (response.stop_reason === "refusal") return { status: "refused" }
      if (response.stop_reason !== "end_turn") return { status: "failed" }
      const block = response.content.find((b) => b.type === "text")
      if (!block || block.type !== "text") return { status: "failed" }
      try {
        const parsed = JSON.parse(block.text) as { paragraphs?: unknown }
        return { status: "ok", paragraphs: parsed.paragraphs, model: response.model }
      } catch {
        return { status: "failed" }
      }
    },
  }
}
