import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkStagingTarget, projectRefFromUrl, readLinkedRef, requireStagingTarget } from "./stagingGuard.ts"

const REF = "abcdefghijklmnopqrst"
const OTHER_REF = "zzzzzzzzzzzzzzzzzzzz"
const URL_OK = `https://${REF}.supabase.co`

const tempDirs: string[] = []
function tempLinkedFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "staging-guard-"))
  tempDirs.push(dir)
  const path = join(dir, "project-ref")
  writeFileSync(path, content)
  return path
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

describe("projectRefFromUrl", () => {
  it("reads the ref of a hosted project", () => {
    expect(projectRefFromUrl(URL_OK)).toBe(REF)
    expect(projectRefFromUrl(`${URL_OK}/functions/v1/x`)).toBe(REF)
  })

  it("returns undefined for local stacks, custom domains, junk, wrong-length refs and adversarial hosts", () => {
    for (const url of [
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      "https://example.com",
      "https://staging.example.co",
      "https://short.supabase.co",
      "https://abcdefghijklmnopqrs.supabase.co",
      "https://abcdefghijklmnopqrstu.supabase.co",
      "not a url",
      "",
      "https://abcdefghijklmnopqrst.supabase.co.evil.com",
      "https://evil.com/abcdefghijklmnopqrst.supabase.co",
      "https://abcdefghijklmnopqrst.supabase.co@evil.com",
      "https://abcdefghijklmnopqrst.supabase.co.",
      "http://abcdefghijklmnopqrst.supabase.co",
      "https://abcdefghijklmnopqrst.supabase.co:8443",
    ]) {
      expect(projectRefFromUrl(url), url).toBeUndefined()
    }
  })
})

describe("checkStagingTarget", () => {
  const base = { url: URL_OK, expectedRef: REF, typedRef: REF }

  it("accepts a matching hosted target the operator confirmed", () => {
    expect(checkStagingTarget(base)).toEqual({ ok: true, ref: REF })
    expect(checkStagingTarget({ ...base, linkedRef: REF })).toEqual({ ok: true, ref: REF })
  })

  it.each([
    ["no expected ref", { ...base, expectedRef: undefined }, "STAGING_PROJECT_REF must be set"],
    ["a malformed expected ref", { ...base, expectedRef: "not-a-ref" }, "STAGING_PROJECT_REF must be set"],
    ["no url", { ...base, url: undefined }, "VITE_SUPABASE_URL is not set"],
    ["a local url", { ...base, url: "http://127.0.0.1:54321" }, "not a hosted Supabase project"],
    ["a custom domain", { ...base, url: "https://api.example.com" }, "not a hosted Supabase project"],
    ["a different project in the url", { ...base, url: `https://${OTHER_REF}.supabase.co` }, "does not match STAGING_PROJECT_REF"],
    ["a different linked project", { ...base, linkedRef: OTHER_REF }, "linked Supabase project does not match"],
    ["no typed ref", { ...base, typedRef: undefined }, "typed project ref does not match"],
    ["a wrong typed ref", { ...base, typedRef: OTHER_REF }, "typed project ref does not match"],
    ["a plain http url", { ...base, url: `http://${REF}.supabase.co` }, "not a hosted Supabase project"],
    ["a non-default port", { ...base, url: `https://${REF}.supabase.co:8443` }, "not a hosted Supabase project"],
  ])("refuses %s", (_name, input, phrase) => {
    const result = checkStagingTarget(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(phrase)
  })

  it("never puts the url, refs or keys in a refusal reason", () => {
    const secretUrl = `https://zzzzzzzzzzzzzzzzzzzz.supabase.co/?apikey=sk-secret-value`
    const result = checkStagingTarget({ url: secretUrl, expectedRef: REF, typedRef: REF })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      for (const leak of ["sk-secret-value", "zzzzzzzzzzzzzzzzzzzz", REF, "supabase.co"]) {
        expect(result.reason).not.toContain(leak)
      }
    }
  })
})

describe("readLinkedRef", () => {
  it("returns undefined when no linked file exists", () => {
    expect(readLinkedRef(join(tmpdir(), "staging-guard-does-not-exist", "project-ref"))).toBeUndefined()
  })

  it("returns the trimmed ref from a valid file", () => {
    expect(readLinkedRef(tempLinkedFile(`  ${REF}\n`))).toBe(REF)
  })

  it.each([
    ["an empty file", ""],
    ["garbage content", "not-a-ref\n"],
    ["an uppercase ref", "ABCDEFGHIJKLMNOPQRST\n"],
  ])("refuses %s", (_name, content) => {
    expect(() => readLinkedRef(tempLinkedFile(content))).toThrow("staging guard: the linked project ref could not be read")
  })

  it("refuses a linked path that exists but cannot be read as a file", () => {
    expect(() => readLinkedRef(tmpdir())).toThrow("staging guard: the linked project ref could not be read")
  })
})

describe("requireStagingTarget", () => {
  const env = { VITE_SUPABASE_URL: URL_OK, STAGING_PROJECT_REF: REF } as NodeJS.ProcessEnv

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("resolves to the ref when the operator types it", async () => {
    const ask = vi.fn(async () => ` ${REF} `)
    await expect(requireStagingTarget({ env, ask, linkedRef: undefined })).resolves.toBe(REF)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it("prints the real origin of the target in the banner", async () => {
    await requireStagingTarget({ env, ask: async () => REF, linkedRef: undefined })
    expect(console.log).toHaveBeenCalledWith(`Staging target: ${URL_OK}`)
  })

  it("throws when the typed ref is wrong", async () => {
    await expect(requireStagingTarget({ env, ask: async () => "nope", linkedRef: undefined })).rejects.toThrow(/staging guard:/)
  })

  it("throws without prompting when the static checks already fail", async () => {
    const ask = vi.fn(async () => REF)
    await expect(
      requireStagingTarget({
        env: { VITE_SUPABASE_URL: "http://127.0.0.1:54321", STAGING_PROJECT_REF: REF } as NodeJS.ProcessEnv,
        ask,
        linkedRef: undefined,
      }),
    ).rejects.toThrow(/staging guard:/)
    await expect(
      requireStagingTarget({ env: { VITE_SUPABASE_URL: URL_OK } as NodeJS.ProcessEnv, ask, linkedRef: undefined }),
    ).rejects.toThrow(/staging guard:/)
    expect(ask).not.toHaveBeenCalled()
  })

  it("throws when the linked project differs", async () => {
    const ask = vi.fn(async () => REF)
    await expect(requireStagingTarget({ env, ask, linkedRef: OTHER_REF })).rejects.toThrow(/staging guard:/)
    expect(ask).not.toHaveBeenCalled()
  })

  it("consults the linked file when linkedRef is omitted and refuses a different linked project", async () => {
    const ask = vi.fn(async () => REF)
    const linkedRefPath = tempLinkedFile(`${OTHER_REF}\n`)
    await expect(requireStagingTarget({ env, ask, linkedRefPath })).rejects.toThrow(/linked Supabase project does not match/)
    expect(ask).not.toHaveBeenCalled()
  })

  it("accepts the omitted linkedRef when the linked file matches", async () => {
    const ask = vi.fn(async () => REF)
    const linkedRefPath = tempLinkedFile(`${REF}\n`)
    await expect(requireStagingTarget({ env, ask, linkedRefPath })).resolves.toBe(REF)
  })

  it("refuses when the linked file exists but is garbage, without prompting", async () => {
    const ask = vi.fn(async () => REF)
    const linkedRefPath = tempLinkedFile("not-a-ref\n")
    await expect(requireStagingTarget({ env, ask, linkedRefPath })).rejects.toThrow("staging guard: the linked project ref could not be read")
    expect(ask).not.toHaveBeenCalled()
  })

  it("propagates a rejection from a closed terminal instead of resolving", async () => {
    const ask = vi.fn(async () => {
      throw new Error("staging guard: no terminal input")
    })
    await expect(requireStagingTarget({ env, ask, linkedRef: undefined })).rejects.toThrow("staging guard: no terminal input")
  })
})
