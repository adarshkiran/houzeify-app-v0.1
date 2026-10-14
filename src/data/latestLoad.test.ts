import { describe, expect, it } from "vitest"
import { createLatestWinsLoader } from "./latestLoad"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("createLatestWinsLoader", () => {
  it("commits a single load", async () => {
    const committed: string[] = []
    const loader = createLatestWinsLoader(async () => "a", (v) => committed.push(v))
    await loader.reload()
    expect(committed).toEqual(["a"])
  })

  it("discards an older load that resolves after a newer one (overlapping writes)", async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const pending = [first, second]
    const committed: string[] = []
    const loader = createLatestWinsLoader(() => pending.shift()!.promise, (v) => committed.push(v))

    const a = loader.reload()
    const b = loader.reload()
    second.resolve("fresh")
    await b
    first.resolve("stale")
    await a
    expect(committed).toEqual(["fresh"])
  })

  it("discards an older load even when it resolves first", async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const pending = [first, second]
    const committed: string[] = []
    const loader = createLatestWinsLoader(() => pending.shift()!.promise, (v) => committed.push(v))

    const a = loader.reload()
    const b = loader.reload()
    first.resolve("stale")
    await Promise.resolve()
    expect(committed).toEqual([])
    second.resolve("fresh")
    await Promise.all([a, b])
    expect(committed).toEqual(["fresh"])
  })

  it("does not resolve a superseded caller until the newest load has committed", async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const pending = [first, second]
    const committed: string[] = []
    const loader = createLatestWinsLoader(() => pending.shift()!.promise, (v) => committed.push(v))

    let aDone = false
    const a = loader.reload().then(() => {
      aDone = true
    })
    void loader.reload()
    first.resolve("stale")
    await Promise.resolve()
    await Promise.resolve()
    expect(aDone).toBe(false)
    second.resolve("fresh")
    await a
    expect(committed).toEqual(["fresh"])
  })

  it("drops in-flight results after invalidate (sign-out or account switch)", async () => {
    const inflight = deferred<string>()
    const committed: string[] = []
    const loader = createLatestWinsLoader(() => inflight.promise, (v) => committed.push(v))

    const a = loader.reload()
    loader.invalidate()
    inflight.resolve("previous user's data")
    await a
    expect(committed).toEqual([])
  })

  it("commits loads started after an invalidate", async () => {
    const committed: string[] = []
    let n = 0
    const loader = createLatestWinsLoader(async () => `load-${++n}`, (v) => committed.push(v))
    loader.invalidate()
    await loader.reload()
    expect(committed).toEqual(["load-1"])
  })

  it("rejects the caller when its load fails, and still lets a newer load commit", async () => {
    const failing = deferred<string>()
    const ok = deferred<string>()
    const pending = [failing, ok]
    const committed: string[] = []
    const loader = createLatestWinsLoader(() => pending.shift()!.promise, (v) => committed.push(v))

    const a = loader.reload()
    const b = loader.reload()
    failing.reject(new Error("network"))
    ok.resolve("fresh")
    await expect(a).rejects.toThrow("network")
    await b
    expect(committed).toEqual(["fresh"])
  })
})
