import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { ConflictError, IntegrityError, describeCommandError } from "../domain/errors"
import { PermissionError } from "../domain/session"
import { USER_FACING_RAISES, refusalFrom, selectAll } from "./adapter"

describe("refusalFrom", () => {
  it("maps conflict: and permission: prefixes to typed errors", () => {
    expect(refusalFrom("conflict:You need 10 credits.", "P0001")).toBeInstanceOf(ConflictError)
    expect(refusalFrom('permission:Missing permission "task.manage" on project x', "P0001")).toBeInstanceOf(PermissionError)
  })

  it("never exposes raw database text for an unprefixed raise carrying ids", () => {
    const raw = "Task 3f1c2a9e-1111-2222-3333-444455556666 does not belong to project 9a8b7c6d-0000-1111-2222-333344445555"
    const error = refusalFrom(raw, "P0001")
    expect(error).toBeInstanceOf(IntegrityError)
    expect(error).not.toBeInstanceOf(ConflictError)
    expect(describeCommandError(error)).not.toContain("3f1c2a9e")
  })

  it("keeps hand-written user-facing sentences", () => {
    const error = refusalFrom("Give the issue a title.", "P0001")
    expect(error).toBeInstanceOf(ConflictError)
    expect(describeCommandError(error)).toBe("Give the issue a title.")
  })

  it("maps constraint, syntax and RLS errors to typed errors instead of raw text", () => {
    const syntax = refusalFrom('invalid input syntax for type uuid: ""', "22P02")
    expect(syntax).toBeInstanceOf(IntegrityError)
    expect(describeCommandError(syntax)).not.toContain("uuid")
    expect(refusalFrom('new row violates row-level security policy for table "tasks"', "42501")).toBeInstanceOf(PermissionError)
    expect(refusalFrom('duplicate key value violates unique constraint "x"', "23505")).toBeInstanceOf(IntegrityError)
  })

  it("leaves transport errors without a database code alone", () => {
    const error = refusalFrom("Failed to fetch")
    expect(error).not.toBeInstanceOf(IntegrityError)
    expect(error.message).toBe("Failed to fetch")
  })
})

// Fails when a migration adds an unprefixed `raise exception '<sentence>'` with no
// placeholder: decide whether it is meant for people (add it to USER_FACING_RAISES,
// or better, prefix it with conflict:) so it is not silently shown as a generic error.
describe("migrations' unprefixed raise sentences", () => {
  const dir = new URL("../../supabase/migrations/", import.meta.url)
  const literals = new Set<string>()
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(new URL(file, dir), "utf8")
    for (const match of sql.matchAll(/raise exception '((?:[^']|'')*)'\s*[;,]/g)) {
      const text = match[1].replace(/''/g, "'")
      if (text.startsWith("conflict:") || text.startsWith("permission:")) continue
      if (text.includes("%")) continue
      literals.add(text)
    }
  }

  it("are all classified as user-facing", () => {
    const internal = new Set([
      "a correction must be version + 1 of the version it supersedes",
      "daily progress content is immutable; correct it with a new version",
    ])
    const unclassified = [...literals].filter((t) => !USER_FACING_RAISES.includes(t) && !internal.has(t))
    expect(unclassified).toEqual([])
  })
})

describe("selectAll", () => {
  type Call = { ordered: boolean; from: number; to: number }
  function fakeClient(total: number, calls: Call[]) {
    const page = (ordered: boolean) => ({
      range: (from: number, to: number) => {
        calls.push({ ordered, from, to })
        const rows = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => ({ id: from + i }))
        return Promise.resolve({ data: rows, error: null })
      },
    })
    return { from: () => ({ select: () => ({ ...page(false), order: () => page(true) }) }) } as never
  }

  it("reads a table under the cap with one unordered request, as before", async () => {
    const calls: Call[] = []
    expect(await selectAll(fakeClient(3, calls), "tasks")).toHaveLength(3)
    expect(calls).toEqual([{ ordered: false, from: 0, to: 999 }])
  })

  it("re-reads in a stable order across pages when the first page is full", async () => {
    const calls: Call[] = []
    const rows = await selectAll<{ id: number }>(fakeClient(2500, calls), "tasks")
    expect(rows).toHaveLength(2500)
    expect(rows[2499].id).toBe(2499)
    expect(calls.filter((c) => c.ordered).map((c) => [c.from, c.to])).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it("surfaces a typed error when a page fails", async () => {
    const failing = { data: null, error: { code: "42501", message: "permission denied for table x" } }
    const client = { from: () => ({ select: () => ({ range: () => Promise.resolve(failing) }) }) } as never
    await expect(selectAll(client, "tasks")).rejects.toBeInstanceOf(PermissionError)
  })
})
