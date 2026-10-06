import { describe, expect, it } from "vitest"
import { attendanceDate, dayState, validateTimes } from "./attendance"
import type { WorkerAttendance } from "./models"

const base: WorkerAttendance = {
  id: "a1", workerId: "w1", projectId: "p1", assignmentId: "as1", date: "2026-10-06",
  recordedBy: "supervisor", createdAt: "2026-10-06T03:00:00.000Z", updatedAt: "2026-10-06T03:00:00.000Z",
}

describe("attendanceDate", () => {
  it("uses the Asia/Kolkata calendar day, not UTC", () => {
    // 2026-10-05T19:00:00Z is 2026-10-06 00:30 in Asia/Kolkata
    expect(attendanceDate(new Date("2026-10-05T19:00:00.000Z"))).toBe("2026-10-06")
  })
})

describe("dayState", () => {
  it("is not-recorded with no record", () => {
    expect(dayState(undefined, false)).toBe("not-recorded")
  })
  it("is absent for an absent status", () => {
    expect(dayState({ ...base, status: "absent" }, true)).toBe("absent")
  })
  it("is complete for a check-in when checkout is not required", () => {
    expect(dayState({ ...base, status: "present", checkInAt: "2026-10-06T03:30:00.000Z" }, false)).toBe("complete")
  })
  it("is incomplete for a check-in without checkout when checkout is required", () => {
    expect(dayState({ ...base, status: "present", checkInAt: "2026-10-06T03:30:00.000Z" }, true)).toBe("incomplete")
  })
  it("is complete once checked out when checkout is required", () => {
    expect(
      dayState({ ...base, status: "present", checkInAt: "2026-10-06T03:30:00.000Z", checkOutAt: "2026-10-06T12:00:00.000Z" }, true),
    ).toBe("complete")
  })
  it("is complete for a supervisor entry with no times when checkout is not required", () => {
    expect(dayState({ ...base, status: "half-day" }, false)).toBe("complete")
  })
  it("is incomplete for a supervisor entry with no times when checkout is required", () => {
    expect(dayState({ ...base, status: "half-day" }, true)).toBe("incomplete")
  })
})

describe("validateTimes", () => {
  it("refuses a check-out without a check-in", () => {
    expect(validateTimes(undefined, "2026-10-06T12:00:00.000Z")?.message).toBe("Check in before you check out.")
  })
  it("refuses a check-out earlier than check-in", () => {
    expect(validateTimes("2026-10-06T12:00:00.000Z", "2026-10-06T03:00:00.000Z")?.message).toBe(
      "Check-out can't be earlier than check-in.",
    )
  })
  it("accepts valid times", () => {
    expect(validateTimes("2026-10-06T03:00:00.000Z", "2026-10-06T12:00:00.000Z")).toBeNull()
  })
})
