import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { supabaseCommands } from "./commandSurface"
import { ConflictError } from "../domain/errors"
import { seedConstructionData } from "./seed"

// Task 14 concern: supabase-mode writes must be awaitable end to end, and a
// refused write must reject the caller's promise instead of being swallowed
// (so screens can show the refusal instead of a premature success toast).
// `write` stands in for the provider's real write helper, which calls the
// adapter and reloads state; mocking it here simulates the adapter call
// without hitting a real Supabase client.
describe("supabase-mode write commands", () => {
  it("returns a promise that resolves with the simulated adapter's result", async () => {
    const surface = supabaseCommands({
      client: {} as SupabaseClient,
      write: async () => "selected" as unknown as never,
      read: () => {
        throw new Error("not called in this test")
      },
      getState: () => seedConstructionData,
    })

    const result = surface.selectProposal("proposal-1")
    expect(result).toBeInstanceOf(Promise)
    await expect(result).resolves.toBe("selected")
  })

  it("propagates a rejected simulated adapter call as a rejected promise instead of swallowing it", async () => {
    const refusal = new ConflictError("already selected")
    const surface = supabaseCommands({
      client: {} as SupabaseClient,
      write: async () => {
        throw refusal
      },
      read: () => {
        throw new Error("not called in this test")
      },
      getState: () => seedConstructionData,
    })

    const result = surface.selectProposal("proposal-1")
    expect(result).toBeInstanceOf(Promise)
    await expect(result).rejects.toBe(refusal)
  })
})
