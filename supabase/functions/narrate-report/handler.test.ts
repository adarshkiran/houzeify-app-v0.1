import { afterEach, describe, expect, it, vi } from "vitest"
import { sampleReportFacts, sampleWeeklyFacts } from "../_shared/narrative/testFacts.ts"
import { hashFacts } from "../_shared/narrative/hash.ts"
import { handleRequest, type HandlerDeps, type ModelOutcome } from "./handler.ts"

const PROJECT = "00000000-0000-0000-0000-0000000031f1"
const facts = sampleReportFacts()
const goodParagraphs = ["The project is at risk. Overall progress is 42 percent against an expected 55 percent."]

function request(body: unknown, headers: Record<string, string> = { authorization: "Bearer jwt" }, method = "POST") {
  return new Request("http://localhost/narrate-report", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  })
}

function deps(outcome: ModelOutcome | Error, rpcImpl?: HandlerDeps["rpc"]) {
  const rpc = vi.fn(rpcImpl ?? (async (fn: string) => ({ data: fn === "consume_ai_narrative" ? "ticket-1" : true, error: null })))
  const narrate = vi.fn(async (_input: { system: string; user: string; schema: object }) => {
    if (outcome instanceof Error) throw outcome
    return outcome
  })
  return { rpc, narrate, deps: { rpc, model: { narrate }, now: () => "2026-10-17T09:00:00.000Z" } as HandlerDeps }
}

const body = { projectId: PROJECT, kind: "report", facts }
const json = async (res: Response) => res.json()

afterEach(() => vi.restoreAllMocks())

describe("handleRequest", () => {
  it("returns a narrative and spends one unit on success", async () => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "claude-opus-5-5" })
    const res = await handleRequest(request(body), d.deps)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({
      narrative: {
        text: goodParagraphs[0],
        engine: "claude:claude-opus-5-5",
        generatedAt: "2026-10-17T09:00:00.000Z",
        factsHash: await hashFacts(facts),
      },
    })
    expect(d.rpc).toHaveBeenCalledTimes(1)
    expect(d.rpc).toHaveBeenCalledWith("consume_ai_narrative", { project_id: PROJECT, kind: "report" })
  })

  it("rejects without an Authorization header, before any work", async () => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" })
    const res = await handleRequest(request(body, {}), d.deps)
    expect(res.status).toBe(401)
    expect(await json(res)).toEqual({ error: "unauthorized" })
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it("answers preflight and refuses other methods", async () => {
    const d = deps({ status: "failed" })
    const options = await handleRequest(request(undefined, {}, "OPTIONS"), d.deps)
    expect(options.status).toBe(204)
    expect(options.headers.get("access-control-allow-headers")).toContain("authorization")
    expect((await handleRequest(request(undefined, {}, "GET"), d.deps)).status).toBe(405)
  })

  it("refuses a malformed or mismatched body without metering", async () => {
    const d = deps({ status: "failed" })
    for (const bad of [
      null,
      { projectId: "not-a-uuid", kind: "report", facts },
      { projectId: PROJECT, kind: "chat", facts },
      { projectId: PROJECT, kind: "weekly-company", facts },
      { projectId: PROJECT, kind: "report" },
    ]) {
      const res = await handleRequest(request(bad), d.deps)
      expect(res.status).toBe(400)
      expect(await json(res)).toEqual({ error: "unavailable" })
    }
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['permission:Missing permission "project.manage" on project x', "forbidden"],
    ["conflict:AI summaries are not included in your plan.", "not-included"],
    ["conflict:You have used all AI summaries for this month.", "limit-reached"],
    ["boom", "unavailable"],
  ])("maps the metering refusal %s to %s and never calls the model", async (message, code) => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" }, async () => ({ data: null, error: { message } }))
    const res = await handleRequest(request(body), d.deps)
    expect(await json(res)).toEqual({ error: code })
    expect(d.narrate).not.toHaveBeenCalled()
  })

  it.each<[string, ModelOutcome | Error]>([
    ["a refusal", { status: "refused" }],
    ["a model failure", { status: "failed" }],
    ["a thrown error", new Error("network")],
  ])("refunds and reports unavailable on %s", async (_name, outcome) => {
    const d = deps(outcome)
    const res = await handleRequest(request(body), d.deps)
    expect(await json(res)).toEqual({ error: "unavailable" })
    expect(d.rpc).toHaveBeenLastCalledWith("refund_ai_narrative", { ticket: "ticket-1" })
  })

  it("refunds and reports rejected when the guard fails", async () => {
    const d = deps({ status: "ok", paragraphs: ["Overall progress is 99 percent."], model: "m" })
    const res = await handleRequest(request(body), d.deps)
    expect(await json(res)).toEqual({ error: "rejected" })
    expect(d.rpc).toHaveBeenLastCalledWith("refund_ai_narrative", { ticket: "ticket-1" })
  })

  it("still answers when the refund itself fails", async () => {
    const d = deps({ status: "failed" }, async (fn) =>
      fn === "consume_ai_narrative" ? { data: "ticket-1", error: null } : Promise.reject(new Error("down")),
    )
    expect(await json(await handleRequest(request(body), d.deps))).toEqual({ error: "unavailable" })
  })

  it("never puts facts or generated text in an error response", async () => {
    const d = deps({ status: "ok", paragraphs: ["Overall progress is 99 percent."], model: "m" })
    const text = JSON.stringify(await json(await handleRequest(request(body), d.deps)))
    expect(text).not.toContain("percent")
    expect(text).not.toContain("Foundation")
  })
})

describe("handleRequest does not trust client facts", () => {
  it("hashes the parsed facts, which equal the sample packet", async () => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" })
    const res = await json(await handleRequest(request(body), d.deps))
    expect(res.narrative.factsHash).toBe(await hashFacts(sampleReportFacts()))
  })

  it("never forwards extra keys or planted text to the model", async () => {
    const dirty = JSON.parse(JSON.stringify(facts))
    dirty.projectName = "PLANTED-NAME"
    dirty.stages[0].owner = "PLANTED-OWNER"
    dirty.signals[0].message = "PLANTED-PHONE 9876543210"
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" })
    const res = await handleRequest(request({ ...body, facts: dirty }), d.deps)
    expect((await json(res)).narrative).toBeDefined()
    const user = d.narrate.mock.calls[0][0].user
    expect(user).toContain("Foundation")
    for (const leak of ["PLANTED", "9876543210", "projectName", "owner"]) expect(user).not.toContain(leak)
  })

  it("answers 400 before metering when facts fail validation", async () => {
    const bad = JSON.parse(JSON.stringify(facts))
    bad.stages[0].name = "a@b.co"
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const res = await handleRequest(request({ ...body, facts: bad }), d.deps)
    expect(res.status).toBe(400)
    expect(await json(res)).toEqual({ error: "unavailable" })
    expect(d.rpc).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith("narrate-report: facts rejected")
    expect(JSON.stringify(warn.mock.calls)).not.toContain("a@b.co")
  })

  it("answers 400 when the parsed kind differs from the requested kind", async () => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" })
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const res = await handleRequest(request({ projectId: PROJECT, kind: "report", facts: sampleWeeklyFacts() }), d.deps)
    expect(res.status).toBe(400)
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it("logs only the reason word when the guard rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const d = deps({ status: "ok", paragraphs: ["Overall progress is 99 percent."], model: "m" })
    await handleRequest(request(body), d.deps)
    expect(warn).toHaveBeenCalledWith("narrate-report: guard rejected", "number")
    const logged = JSON.stringify(warn.mock.calls)
    expect(logged).not.toContain("99")
    expect(logged).not.toContain("Foundation")
    expect(logged).not.toContain(PROJECT)
  })
})
