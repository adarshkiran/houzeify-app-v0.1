import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { memoryCommands, supabaseCommands } from "./commandSurface"
import { seedConstructionData } from "./seed"

// The provider exposes one command surface whichever data source is active.
// Both builders take the same shape of dependencies, so the key sets must match.
describe("provider command surface", () => {
  it("exposes the same command names in memory and supabase modes", () => {
    const memory = memoryCommands({
      run: () => {
        throw new Error("not called in a shape test")
      },
      read: () => {
        throw new Error("not called in a shape test")
      },
      getState: () => seedConstructionData,
    })
    const supabase = supabaseCommands({
      client: {} as SupabaseClient,
      write: async () => {
        throw new Error("not called in a shape test")
      },
      read: () => {
        throw new Error("not called in a shape test")
      },
      getState: () => seedConstructionData,
    })
    expect(Object.keys(supabase).sort()).toEqual(Object.keys(memory).sort())
  })
})
