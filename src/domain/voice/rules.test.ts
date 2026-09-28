import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../../mock/seed"
import type { ProjectUnit } from "../models"
import {
  cleanTitle, findDate, findPeopleCount, findPerson, findPriority, findQuantity,
  findSeverity, findUnit, findWorkType, splitProgress,
} from "./rules"

const MON = "2026-09-28" // a Monday
const people = [
  { id: "w-ravi-n", name: "Ravi Naik" },
  { id: "w-ravi-k", name: "Ravi Kumar" },
  { id: "w-suresh", name: "Suresh Kumar" },
]
const unit = (id: string, name: string, code: string): ProjectUnit =>
  ({ id, projectId: "p", kind: "block", code, name, status: "active", sequence: 1 })
const units = [unit("u-main", "Main House", "HOUSE"), unit("u-b", "Block B", "BLK-B")]

describe("findDate", () => {
  it("reads today, tomorrow and day after tomorrow", () => {
    expect(findDate("do it today", MON)?.date).toBe("2026-09-28")
    expect(findDate("pour the columns tomorrow", MON)?.date).toBe("2026-09-29")
    expect(findDate("day after tomorrow please", MON)?.date).toBe("2026-09-30")
  })
  it("reads weekdays forward, and rolls today's weekday to next week as a guess", () => {
    expect(findDate("finish by Friday", MON)?.date).toBe("2026-10-02")
    const monday = findDate("on monday", MON)
    expect(monday?.date).toBe("2026-10-05")
    expect(monday?.guessed).toBeDefined()
  })
  it("reads day-of-month, rolling into next month", () => {
    expect(findDate("by the 30th", MON)?.date).toBe("2026-09-30")
    expect(findDate("by the 5th", MON)?.date).toBe("2026-10-05")
  })
  it("reads next week as next Monday (guessed) and marks starts", () => {
    const next = findDate("sometime next week", MON)
    expect(next?.date).toBe("2026-10-05")
    expect(next?.guessed).toBeDefined()
    expect(findDate("start tomorrow", MON)?.start).toBe(true)
    expect(findDate("finish tomorrow", MON)?.start).toBe(false)
  })
  it("returns nothing without a date", () => {
    expect(findDate("pour the columns", MON)).toBeUndefined()
  })
})

describe("findQuantity", () => {
  it("reads number + unit", () => {
    expect(findQuantity("pour 42 cubic metres")).toMatchObject({ value: 42, unit: "m3" })
    expect(findQuantity("plaster 120 sqm")).toMatchObject({ value: 120, unit: "m2" })
    expect(findQuantity("10 bags of cement")).toMatchObject({ value: 10, unit: "nos" })
    expect(findQuantity("curing for 3 days")).toMatchObject({ value: 3, unit: "day" })
    expect(findQuantity("500 kg steel")).toMatchObject({ value: 500, unit: "kg" })
  })
  it("converts square feet to m2 and says so", () => {
    const q = findQuantity("tile 100 sq ft")
    expect(q).toMatchObject({ value: 9.29, unit: "m2" })
    expect(q?.converted).toBeDefined()
  })
  it("ignores bare numbers", () => {
    expect(findQuantity("grid 4 to 9")).toBeUndefined()
  })
})

describe("findPerson", () => {
  it("matches a full name", () => {
    expect(findPerson("Ravi Naik, pour the columns", people)).toMatchObject({ kind: "one", person: { id: "w-ravi-n" } })
  })
  it("asks to choose when a first name is shared", () => {
    const found = findPerson("Ravi, pour the columns", people)
    expect(found?.kind).toBe("many")
  })
  it("matches a unique first name", () => {
    expect(findPerson("ask Suresh to check", people)).toMatchObject({ kind: "one", person: { id: "w-suresh" } })
  })
  it("reports an unknown name after assign/ask/tell", () => {
    expect(findPerson("assign to Mahesh", people)).toMatchObject({ kind: "unknown", name: "Mahesh" })
  })
  it("returns nothing when no one is named", () => {
    expect(findPerson("pour the columns tomorrow", people)).toBeUndefined()
  })
})

describe("findUnit", () => {
  it("matches name or code, else the only unit", () => {
    expect(findUnit("in block b", units)?.unit.id).toBe("u-b")
    expect(findUnit("at the main house", units)?.unit.id).toBe("u-main")
    expect(findUnit("somewhere", units)).toBeUndefined()
    expect(findUnit("somewhere", [units[0]!])).toMatchObject({ how: "only-one" })
  })
})

describe("findWorkType", () => {
  const lib = seed.workTypes
  it("prefers a Work Library name", () => {
    expect(findWorkType("column shuttering on grid B", lib)).toMatchObject({ how: "name", workType: { id: "work-column-shuttering" } })
    expect(findWorkType("start curing", lib)?.workType.id).toBe("work-curing")
  })
  it("combines element and action words", () => {
    expect(findWorkType("pour the columns", lib)?.workType.id).toBe("work-column-casting")
    expect(findWorkType("concrete the footings", lib)?.workType.id).toBe("work-footing-concrete")
    expect(findWorkType("put rebar in the slab", lib)?.workType.id).toBe("work-slab-reinforcement")
  })
  it("uses single keywords", () => {
    expect(findWorkType("backfill around grid A", lib)?.workType.id).toBe("work-backfilling")
    expect(findWorkType("brick work on the east wall", lib)?.workType.id).toBe("work-brick-masonry")
  })
  it("returns nothing for unknown work", () => {
    expect(findWorkType("have a chat with the client", lib)).toBeUndefined()
  })
})

describe("priority, severity, people count", () => {
  it("reads priority words, default medium", () => {
    expect(findPriority("urgent, pour now").priority).toBe("high")
    expect(findPriority("this is critical").priority).toBe("critical")
    expect(findPriority("low priority, when free").priority).toBe("low")
    expect(findPriority("pour the columns")).toEqual({ priority: "medium" })
  })
  it("reads severity words, default medium", () => {
    expect(findSeverity("scaffold is unsafe").severity).toBe("critical")
    expect(findSeverity("water leak in the basement").severity).toBe("high")
    expect(findSeverity("sand delivery is late").severity).toBe("medium")
    expect(findSeverity("something looks off")).toEqual({ severity: "medium" })
  })
  it("reads people on site", () => {
    expect(findPeopleCount("5 of us worked today")?.count).toBe(5)
    expect(findPeopleCount("we had 7 workers")?.count).toBe(7)
    expect(findPeopleCount("finished the slab")).toBeUndefined()
  })
})

describe("splitProgress and cleanTitle", () => {
  it("splits today / tomorrow / blocker", () => {
    const s = splitProgress("Finished curing the footings. Tomorrow we start backfilling, waiting for sand delivery")
    expect(s.today).toEqual(["Finished curing the footings"])
    expect(s.tomorrow).toEqual(["Tomorrow we start backfilling"])
    expect(s.blocker).toEqual(["waiting for sand delivery"])
  })
  it("treats unmarked sentences as today", () => {
    expect(splitProgress("Laid 200 blocks on the east wall").today).toEqual(["Laid 200 blocks on the east wall"])
  })
  it("cleans a title", () => {
    expect(cleanTitle("Ravi, please pour the Grid B columns tomorrow, urgent", ["Ravi", "tomorrow", "urgent"]))
      .toBe("Pour the Grid B columns")
    expect(cleanTitle("ok can you check the lintel", [])).toBe("Check the lintel")
  })
})
