import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sampleReportFacts } from "../../supabase/functions/_shared/narrative/testFacts"
import { loadState, narrateReport } from "./adapter"
import { supabaseCommands } from "../mock/commandSurface"
import { seedConstructionData } from "../mock/seed"

const request = { projectId: "00000000-0000-0000-0000-0000000031f1", kind: "report" as const, facts: sampleReportFacts() }
const clientWith = (invoke: () => Promise<{ data: unknown; error: unknown }>) =>
  ({ functions: { invoke: vi.fn(invoke) } }) as unknown as SupabaseClient
const narrative = { text: "t", engine: "claude:x", generatedAt: "2026-10-17T09:00:00Z", factsHash: "a".repeat(64) }

describe("narrateReport adapter", () => {
  it("passes through a narrative", async () => {
    const client = clientWith(async () => ({ data: { narrative }, error: null }))
    expect(await narrateReport(client, request)).toEqual({ narrative })
    expect(client.functions.invoke).toHaveBeenCalledWith("narrate-report", { body: request })
  })

  it("passes through a typed error", async () => {
    expect(await narrateReport(clientWith(async () => ({ data: { error: "limit-reached" }, error: null })), request)).toEqual({
      error: "limit-reached",
    })
  })

  it("maps transport failures and junk to unavailable", async () => {
    expect(await narrateReport(clientWith(async () => ({ data: null, error: new Error("net") })), request)).toEqual({ error: "unavailable" })
    expect(await narrateReport(clientWith(async () => ({ data: { weird: true }, error: null })), request)).toEqual({ error: "unavailable" })
    expect(await narrateReport(clientWith(async () => Promise.reject(new Error("boom"))), request)).toEqual({ error: "unavailable" })
  })

  it("maps an unknown error code to unavailable", async () => {
    expect(await narrateReport(clientWith(async () => ({ data: { error: "nope" }, error: null })), request)).toEqual({ error: "unavailable" })
  })

  it("rejects a malformed narrative", async () => {
    const bad = [
      { ...narrative, text: 5 },
      { ...narrative, engine: undefined },
      { ...narrative, generatedAt: 1 },
      { ...narrative, factsHash: "short" },
      { ...narrative, factsHash: "z".repeat(64) },
    ]
    for (const n of bad) {
      expect(await narrateReport(clientWith(async () => ({ data: { narrative: n }, error: null })), request)).toEqual({ error: "unavailable" })
    }
  })

  it("reads a typed code from a non-2xx response body", async () => {
    const http = (body: unknown) => {
      const error = Object.assign(new Error("non-2xx"), { context: new Response(JSON.stringify(body), { status: 401 }) })
      return clientWith(async () => ({ data: null, error }))
    }
    expect(await narrateReport(http({ error: "unauthorized" }), request)).toEqual({ error: "unauthorized" })
    expect(await narrateReport(http({ error: "forbidden" }), request)).toEqual({ error: "forbidden" })
    expect(await narrateReport(http({ error: "made-up" }), request)).toEqual({ error: "unavailable" })
    expect(await narrateReport(http("junk"), request)).toEqual({ error: "unavailable" })
    const notJson = Object.assign(new Error("x"), { context: new Response("<html>", { status: 502 }) })
    expect(await narrateReport(clientWith(async () => ({ data: null, error: notJson })), request)).toEqual({ error: "unavailable" })
  })

  it("drops extra server fields", async () => {
    const client = clientWith(async () => ({ data: { narrative: { ...narrative, secret: "x", model: "y" } }, error: null }))
    expect(await narrateReport(client, request)).toEqual({ narrative })
  })

  it("enforces migration 0031's shape", async () => {
    const bad = [
      { ...narrative, factsHash: "A".repeat(64) },
      { ...narrative, engine: "gpt:x" },
      { ...narrative, text: "" },
      { ...narrative, text: "x".repeat(4001) },
    ]
    for (const n of bad) {
      expect(await narrateReport(clientWith(async () => ({ data: { narrative: n }, error: null })), request)).toEqual({ error: "unavailable" })
    }
    const edge = { ...narrative, text: "x".repeat(4000) }
    expect(await narrateReport(clientWith(async () => ({ data: { narrative: edge }, error: null })), request)).toEqual({ narrative: edge })
  })

  it("maps a non-Response error context to unavailable", async () => {
    const error = Object.assign(new Error("x"), { context: { error: "forbidden" } })
    expect(await narrateReport(clientWith(async () => ({ data: null, error })), request)).toEqual({ error: "unavailable" })
  })

  it("sends the database uuid for a domain project id in supabase mode", async () => {
    const uuid = "11111111-1111-1111-1111-111111111111"
    const invoke = vi.fn(async () => ({ data: { narrative }, error: null }))
    const client = {
      functions: { invoke },
      from: (table: string) => ({
        select: () => ({
          range: async () => ({
            data: table === "projects" ? [{ id: uuid, legacy_id: "project-sharma" }] : [],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient
    await loadState(client).catch(() => undefined) // registers id mappings before row mapping may fail
    const surface = supabaseCommands({
      client,
      write: async (call) => call(),
      read: () => {
        throw new Error("unused")
      },
      getState: () => seedConstructionData,
    })
    await surface.narrateReport({ ...request, projectId: "project-sharma" })
    expect(invoke).toHaveBeenCalledWith("narrate-report", { body: { ...request, projectId: uuid } })
  })
})
