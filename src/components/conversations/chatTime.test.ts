import { describe, expect, it } from "vitest"
import { dayLabel, relativeTime, sameDay } from "./chatTime"

const now = new Date(2026, 8, 28, 15, 0).getTime() // Mon 28 Sept 2026, 3 pm local
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString()

describe("relativeTime", () => {
  it("counts minutes and hours today", () => {
    expect(relativeTime(at(28, 14, 59), now)).toBe("1 min ago")
    expect(relativeTime(new Date(now - 20_000).toISOString(), now)).toBe("Just now")
    expect(relativeTime(at(28, 12), now)).toBe("3 h ago")
  })

  it("names yesterday, then the weekday, then the date", () => {
    expect(relativeTime(at(27, 23), now)).toBe("Yesterday")
    expect(relativeTime(at(25, 9), now)).toBe("Fri")
    expect(relativeTime(at(10, 9), now)).toBe("10 Sept")
  })
})

describe("dayLabel", () => {
  it("says Today and Yesterday, else the full date", () => {
    expect(dayLabel(at(28, 8), now)).toBe("Today")
    expect(dayLabel(at(27, 8), now)).toBe("Yesterday")
    expect(dayLabel(at(25, 8), now)).toBe("Friday, 25 September")
  })
})

describe("sameDay", () => {
  it("compares calendar days", () => {
    expect(sameDay(at(27, 1), at(27, 23))).toBe(true)
    expect(sameDay(at(27, 23), at(28, 1))).toBe(false)
  })
})
