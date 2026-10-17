import { checkNarrative } from "../_shared/narrative/guard.ts"
import { hashFacts } from "../_shared/narrative/hash.ts"
import { parseNarrativeFacts } from "../_shared/narrative/parseFacts.ts"
import { NARRATIVE_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "../_shared/narrative/prompt.ts"
import type { NarrativeErrorCode, NarrativeFacts, NarrativeKind, NarrativeResponse } from "../_shared/narrative/types.ts"

// Dependency-injected so every branch is unit tested without Deno, a database
// or the network. index.ts wires the real Supabase client and the model.

export type ModelOutcome =
  | { status: "ok"; paragraphs: unknown; model: string }
  | { status: "refused" }
  | { status: "failed" }

export interface ModelClient {
  narrate(input: { system: string; user: string; schema: object }): Promise<ModelOutcome>
}

export interface RpcResult {
  data: unknown
  error: { message: string } | null
}

export interface HandlerDeps {
  rpc(fn: "consume_ai_narrative" | "refund_ai_narrative", args: Record<string, unknown>): Promise<RpcResult>
  model: ModelClient
  now(): string
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY = 65536
const KINDS: readonly NarrativeKind[] = ["report", "weekly-company"]

function reply(body: NarrativeResponse | { error: NarrativeErrorCode }, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } })
}

function parseBody(value: unknown): { projectId: string; kind: NarrativeKind; rawFacts: unknown } | undefined {
  if (!value || typeof value !== "object") return undefined
  const { projectId, kind, facts } = value as Record<string, unknown>
  if (typeof projectId !== "string" || !UUID.test(projectId)) return undefined
  if (typeof kind !== "string" || !KINDS.includes(kind as NarrativeKind)) return undefined
  return { projectId, kind: kind as NarrativeKind, rawFacts: facts }
}

function metering(message: string): NarrativeErrorCode {
  if (message.startsWith("permission:")) return "forbidden"
  if (message.includes("not included in your plan")) return "not-included"
  if (message.includes("used all AI summaries")) return "limit-reached"
  return "unavailable"
}

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return reply({ error: "unavailable" }, 405)
  if (!req.headers.get("authorization")) return reply({ error: "unauthorized" }, 401)

  let parsed: ReturnType<typeof parseBody>
  try {
    const declared = Number(req.headers.get("content-length") ?? 0)
    const text = declared > MAX_BODY ? undefined : await req.text()
    parsed = text !== undefined && text.length <= MAX_BODY ? parseBody(JSON.parse(text)) : undefined
  } catch {
    parsed = undefined
  }
  if (!parsed) return reply({ error: "unavailable" }, 400)
  const { projectId, kind } = parsed

  // Never trust the client's packet: rebuild it field by field before any spend.
  const facts: NarrativeFacts | undefined = parseNarrativeFacts(parsed.rawFacts)
  if (!facts || facts.kind !== kind) {
    console.warn("narrate-report: facts rejected")
    return reply({ error: "unavailable" }, 400)
  }

  let consumed: RpcResult
  try {
    consumed = await deps.rpc("consume_ai_narrative", { project_id: projectId, kind })
  } catch {
    return reply({ error: "unavailable" }) // Nothing was charged.
  }
  if (!consumed) return reply({ error: "unavailable" }) // Nothing was charged.
  if (consumed.error) return reply({ error: metering(consumed.error.message) })
  const ticket = consumed.data
  if (typeof ticket !== "string" || !UUID.test(ticket)) return reply({ error: "unavailable" })

  let refunded = false
  const refund = async () => {
    if (refunded) return
    refunded = true
    try {
      const result = await deps.rpc("refund_ai_narrative", { ticket })
      if (result?.error) console.warn("narrate-report: refund failed")
    } catch {
      // A failed refund must not turn a handled failure into a crash.
      console.warn("narrate-report: refund failed")
    }
  }

  // Anything that goes wrong after the unit is spent must refund it.
  try {
    let outcome: ModelOutcome
    try {
      outcome = await deps.model.narrate({ system: SYSTEM_PROMPT, user: buildUserMessage(facts), schema: NARRATIVE_SCHEMA })
    } catch {
      outcome = { status: "failed" }
    }
    if (!outcome || outcome.status !== "ok") {
      await refund()
      return reply({ error: "unavailable" })
    }

    const checked = checkNarrative(outcome.paragraphs, facts)
    if (!checked.ok) {
      console.warn("narrate-report: guard rejected", checked.reason)
      await refund()
      return reply({ error: "rejected" })
    }

    return reply({
      narrative: {
        text: checked.text,
        engine: `claude:${outcome.model}`,
        generatedAt: deps.now(),
        factsHash: await hashFacts(facts),
      },
    })
  } catch {
    await refund()
    return reply({ error: "unavailable" })
  }
}
