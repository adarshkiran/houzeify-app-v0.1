import { ConflictError } from "./errors"
import type { ISODate, WorkerAttendance } from "./models"

export type DayState = "not-recorded" | "absent" | "complete" | "incomplete"

/** The calendar day in Asia/Kolkata for an instant (spec A5). */
export function attendanceDate(instant: Date): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

/** Computed, never stored (spec §2). */
export function dayState(record: WorkerAttendance | undefined, requireCheckout: boolean): DayState {
  if (!record) return "not-recorded"
  if (record.status === "absent") return "absent"
  const present = record.status === "present" || record.status === "half-day" || !record.status
  if (!present) return "not-recorded"
  if (requireCheckout && !record.checkOutAt) return "incomplete"
  return "complete"
}

/** Returns the refusal, or null when the times are valid (spec A7). */
export function validateTimes(checkInAt?: string, checkOutAt?: string): ConflictError | null {
  if (!checkOutAt) return null
  if (!checkInAt) return new ConflictError("Check in before you check out.")
  if (new Date(checkOutAt) < new Date(checkInAt)) {
    return new ConflictError("Check-out can't be earlier than check-in.")
  }
  return null
}
