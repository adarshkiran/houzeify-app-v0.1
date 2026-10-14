import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"

// supabase/seed.sql seeds the shared construction library (project_id null)
// from the mock seed. Workers' trade_ids and tasks reference these rows by
// legacy id, so a missing row makes its name resolve to "Unknown ...".
const sql = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8")

describe("supabase/seed.sql construction library", () => {
  it("seeds every mock stage, trade and work type by legacy id", () => {
    const missing = [
      ...seed.stages.map((s) => s.id),
      ...seed.trades.map((t) => t.id),
      ...seed.workTypes.map((w) => w.id),
    ].filter((id) => !sql.includes(`'${id}'`))
    expect(missing).toEqual([])
  })

  it("references only library ids from seeded tasks and worker trades", () => {
    const tradeIds = new Set(seed.trades.map((t) => t.id))
    const workerTrades = seed.workers.flatMap((w) => w.tradeIds)
    expect(workerTrades.filter((id) => !tradeIds.has(id))).toEqual([])
    for (const id of ["stage-foundation", "trade-civil", "work-backfilling"]) {
      expect(sql).toContain(`'${id}'`)
    }
  })
})
