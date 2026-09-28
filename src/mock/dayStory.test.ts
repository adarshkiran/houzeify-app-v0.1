import { describe, expect, it } from "vitest"
import type { DailyProgress, Task } from "../domain/models"
import { seedConstructionData as seed } from "./seed"
import { addDays, dayDiff, datesWithUpdates, dayStory, formatDay, latestUpdateDate, localToday, slideTrack, slideWindow } from "./dayStory"

const base = seed.dailyProgress.find((p) => p.id === "progress-sharma-2009")!
const update = (over: Partial<DailyProgress>): DailyProgress => ({ ...base, ...over })
const task = seed.tasks.find((t) => t.id === "task-4")!
const withDates = (over: Partial<Task>): Task => ({ ...task, ...over })
const today = "2026-09-28"

describe("dates", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01")
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30")
    expect(addDays("2026-09-28", -7)).toBe("2026-09-21")
  })

  it("labels a calendar day", () => {
    expect(formatDay("2026-09-25")).toBe("Fri 25 Sept")
    expect(formatDay("2026-10-01")).toBe("Thu 1 Oct")
  })

  it("formats the local date", () => {
    expect(localToday(new Date(2026, 8, 5, 23, 30))).toBe("2026-09-05")
  })

  it("finds the latest update date", () => {
    expect(latestUpdateDate([update({ date: "2026-09-20" }), update({ date: "2026-09-26" }), update({ date: "2026-09-18" })])).toBe("2026-09-26")
    expect(latestUpdateDate([])).toBeUndefined()
  })

  it("lists the dates that have updates", () => {
    expect(datesWithUpdates([update({ date: "2026-09-20" }), update({ date: "2026-09-26" })])).toEqual(
      new Set(["2026-09-20", "2026-09-26"]),
    )
  })
})

describe("dayStory", () => {
  const u20 = update({ id: "a", date: "2026-09-20", todaySummary: "Columns poured.", tomorrowPlan: "Start curing.", yesterdaySummary: "Rebar inspected." })

  it("shows the work reported for the date", () => {
    expect(dayStory("2026-09-20", [u20], { today, audience: "company" })).toEqual({
      kind: "done",
      notes: [{ text: "Columns poured.", progressId: "a", taskId: u20.taskId }],
    })
  })

  it("uses the day before's plan for the next day", () => {
    expect(dayStory("2026-09-21", [u20], { today, audience: "company" })).toMatchObject({
      kind: "planned",
      notes: [{ text: "Start curing." }],
    })
  })

  it("uses the next day's 'yesterday' note for the day before", () => {
    expect(dayStory("2026-09-19", [u20], { today, audience: "company" })).toMatchObject({
      kind: "done",
      notes: [{ text: "Rebar inspected." }],
    })
  })

  it("falls back to open tasks scheduled on the date (company)", () => {
    const tasks = [withDates({ plannedStart: "2026-10-01", dueDate: "2026-10-03" })]
    expect(dayStory("2026-10-02", [], { today, audience: "company", tasks })).toMatchObject({
      kind: "scheduled",
      notes: [{ text: task.title, taskId: task.id }],
    })
    // Finished tasks don't count.
    const done = [withDates({ plannedStart: "2026-10-01", dueDate: "2026-10-03", status: "completed" })]
    expect(dayStory("2026-10-02", [], { today, audience: "company", tasks: done }).kind).toBe("empty")
  })

  it("says why a day is empty", () => {
    expect(dayStory("2026-10-05", [], { today, audience: "company" })).toEqual({ kind: "empty", message: "No task assigned" })
    expect(dayStory("2026-09-10", [], { today, audience: "company" })).toEqual({ kind: "empty", message: "No update submitted" })
    expect(dayStory("2026-10-05", [], { today, audience: "homeowner" })).toEqual({ kind: "empty", message: "Nothing planned yet" })
    expect(dayStory("2026-09-10", [], { today, audience: "homeowner" })).toEqual({ kind: "empty", message: "No update shared" })
  })
})

describe("slideTrack", () => {
  it("counts days between dates", () => {
    expect(dayDiff("2026-09-28", "2026-10-05")).toBe(7)
    expect(dayDiff("2026-09-28", "2026-09-26")).toBe(-2)
  })

  it("lays out every day between the windows when moving forward", () => {
    expect(slideTrack("2026-09-28", "2026-09-30")).toEqual({
      dates: ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"],
      fromIndex: 0,
      toIndex: 2,
    })
  })

  it("and when moving back", () => {
    expect(slideTrack("2026-09-28", "2026-09-27")).toEqual({
      dates: ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"],
      fromIndex: 1,
      toIndex: 0,
    })
  })

  it("puts far-apart windows side by side", () => {
    expect(slideTrack("2026-09-28", "2026-12-01", 14)).toEqual({
      dates: ["2026-09-27", "2026-09-28", "2026-09-29", "2026-11-30", "2026-12-01", "2026-12-02"],
      fromIndex: 0,
      toIndex: 3,
    })
    expect(slideTrack("2026-09-28", "2026-06-01", 14).fromIndex).toBe(3)
  })
})

describe("slideWindow", () => {
  it("slides a row of any length through the days in between", () => {
    // Left side of the strip, 3 days, moving from 28 Sept to 30 Sept.
    expect(slideWindow("2026-09-25", "2026-09-27", 3)).toEqual({
      dates: ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"],
      fromIndex: 0,
      toIndex: 2,
    })
  })
})
