import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkStagingTarget, projectRefFromUrl, requireStagingTarget } from "./stagingGuard.ts"

const REF = "abcdefghijklmnopqrst"
const URL_OK = `https://${REF}.supabase.co`

describe("projectRefFromUrl", () => {
  it("reads the ref of a hosted project", () => {
    expect(projectRefFromUrl(URL_OK)).toBe(REF)
    expect(projectRefFromUrl(`${URL_OK}/functions/v1/x`)).toBe(REF)
  })

  it("returns undefined for local stacks, custom domains, junk and wrong-length refs", () => {
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
    ]) {
      expect(projectRefFromUrl(url)).toBeUndefined()
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
    ["no expected ref", { ...base, expectedRef: undefined }],
    ["a malformed expected ref", { ...base, expectedRef: "not-a-ref" }],
    ["no url", { ...base, url: undefined }],
    ["a local url", { ...base, url: "http://127.0.0.1:54321" }],
    ["a custom domain", { ...base, url: "https://api.example.com" }],
    ["a different project in the url", { ...base, url: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }],
    ["a different linked project", { ...base, linkedRef: "zzzzzzzzzzzzzzzzzzzz" }],
    ["no typed ref", { ...base, typedRef: undefined }],
    ["a wrong typed ref", { ...base, typedRef: "zzzzzzzzzzzzzzzzzzzz" }],
  ])("refuses %s", (_name, input) => {
    const result = checkStagingTarget(input)
    expect(result.ok).toBe(false)
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
    await expect(requireStagingTarget({ env, ask })).resolves.toBe(REF)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it("throws when the typed ref is wrong", async () => {
    await expect(requireStagingTarget({ env, ask: async () => "nope" })).rejects.toThrow(/staging guard:/)
  })

  it("throws without prompting when the static checks already fail", async () => {
    const ask = vi.fn(async () => REF)
    await expect(
      requireStagingTarget({ env: { VITE_SUPABASE_URL: "http://127.0.0.1:54321", STAGING_PROJECT_REF: REF } as NodeJS.ProcessEnv, ask }),
    ).rejects.toThrow(/staging guard:/)
    await expect(requireStagingTarget({ env: { VITE_SUPABASE_URL: URL_OK } as NodeJS.ProcessEnv, ask })).rejects.toThrow(/staging guard:/)
    expect(ask).not.toHaveBeenCalled()
  })

  it("throws when the linked project differs", async () => {
    const ask = vi.fn(async () => REF)
    await expect(requireStagingTarget({ env, ask, linkedRef: "zzzzzzzzzzzzzzzzzzzz" })).rejects.toThrow(/staging guard:/)
    expect(ask).not.toHaveBeenCalled()
  })
})
